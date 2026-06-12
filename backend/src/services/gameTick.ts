// ============================================================
// GAME TICK ENGINE — UNDERCITY HEARTBEAT
//
// Tick interval: config.game.tickIntervalMs (default 60s)
//
// REGEN STRATEGY:
//   Nerve:     TIER-AWARE, per-user timestamp (nerveService)
//   Energy:    TIER-AWARE, per-user timestamp (mirrors nerve)
//   Life:      global timer (+2 every 3 min)
//   Happiness: global timer, decay for inactive users only
//
// CIRCUIT BREAKER:
//   3 consecutive outer failures → pause 5 minutes
//   3 consecutive ticks with any sub-task failure → alert
// ============================================================

import { logger }           from "../utils/logger";
import { tickPool as pool } from "../config/database";
import { redis }            from "../config/redis";
import { SafeNotify }       from "../config/socket";
import { config }           from "../config";
import { TIER_CONFIG, type UserTier } from "../config/tiers";
import { Alerts }           from "../utils/alerts";
import { regenNerveByTier } from "./nerveService";
import { expireListings } from "./marketService";

const TICK_INTERVAL_MS       = config.game.tickIntervalMs;
const SLOW_TICK_THRESHOLD_MS = 30_000;
const LIFE_REGEN_MS          = 3 * 60 * 1_000;
const HAPPINESS_DECAY_MS     = 15 * 60 * 1_000;

const REDIS_KEY = {
  lifeLastRun:      "gametick:life:lastrun",
  happinessLastRun: "gametick:happiness:lastrun",
  tickCount:        "gametick:count",
  lastTickAt:       "gametick:lasttick",
} as const;

const CIRCUIT = {
  failures:                0,
  maxFailures:             3,
  pauseUntil:              0,
  pauseDurationMs:         5 * 60 * 1_000,
  consecutivePartialFails: 0,
  maxPartialFails:         3,
};

let tickInterval: NodeJS.Timeout | null = null;
let isRunning = false;

function recordSuccess(): void {
  CIRCUIT.failures                = 0;
  CIRCUIT.consecutivePartialFails = 0;
}

function recordFailure(context: string): void {
  CIRCUIT.failures++;
  logger.warn(`Game tick failure [${CIRCUIT.failures}/${CIRCUIT.maxFailures}]`, { context });

  if (CIRCUIT.failures >= CIRCUIT.maxFailures) {
    CIRCUIT.pauseUntil = Date.now() + CIRCUIT.pauseDurationMs;
    CIRCUIT.failures   = 0;
    logger.error("Game tick circuit breaker OPEN — pausing 5 minutes", {
      resumeAt: new Date(CIRCUIT.pauseUntil).toISOString(),
    });
  }
}

function recordPartialFailure(failedTasks: string[]): void {
  CIRCUIT.consecutivePartialFails++;
  if (CIRCUIT.consecutivePartialFails >= CIRCUIT.maxPartialFails) {
    logger.error("Game tick partial failure threshold reached", {
      consecutiveFails: CIRCUIT.consecutivePartialFails,
      failedTasks,
    });
    void Alerts.gameTickFailed(`Repeated sub-task failures: ${failedTasks.join(", ")}`);
    CIRCUIT.consecutivePartialFails = 0;
  }
}

function isCircuitOpen(): boolean {
  if (CIRCUIT.pauseUntil > Date.now()) return true;
  if (CIRCUIT.pauseUntil !== 0 && CIRCUIT.pauseUntil <= Date.now()) {
    logger.info("Game tick circuit breaker CLOSED — resuming");
    CIRCUIT.pauseUntil = 0;
  }
  return false;
}

async function getLastRun(key: string): Promise<number> {
  try {
    const val = await redis.get(key);
    return val ? parseInt(val, 10) : 0;
  } catch { return 0; }
}

async function setLastRun(key: string): Promise<void> {
  try {
    await redis.set(key, String(Date.now()), "EX", 86_400);
  } catch { /* non-fatal */ }
}

async function isDue(key: string, intervalMs: number): Promise<boolean> {
  const lastRun = await getLastRun(key);
  return Date.now() - lastRun >= intervalMs;
}

// ── BUG FIX: Tier-aware energy regen (mirrors nerve regen) ──
// Each tier has different energy regen rate from TIER_CONFIG.
// Uses per-user last_energy_update timestamp for accuracy.

async function regenEnergyByTier(): Promise<{ updated: number }> {
  const BATCH_SIZE = 500;
  let totalUpdated = 0;

  // BUG FIX: player and citizen have different energy regen rates
  // citizen: 720s, player: 900s — must run separately
  const tierGroups: { tiers: UserTier[]; regenSec: number }[] = [
    { tiers: ["player"],      regenSec: TIER_CONFIG.player.energyRegenSec },
    { tiers: ["citizen"],     regenSec: TIER_CONFIG.citizen.energyRegenSec },
    { tiers: ["contributor"], regenSec: TIER_CONFIG.contributor.energyRegenSec },
  ];

  for (const group of tierGroups) {
    const tierParams = group.tiers.map((_, i) => `$${i + 2}`).join(", ");
     
    while (true) {
      const result = await pool.query(
        `UPDATE users
         SET    energy             = LEAST(energy + ${TIER_CONFIG[group.tiers[0]!].energyRegenAmount}, max_energy),
                last_energy_update = NOW(),
                updated_at         = NOW()
         WHERE  id IN (
           SELECT id FROM users
           WHERE  user_tier  = ANY(ARRAY[${tierParams}]::varchar[])
             AND  energy     < max_energy
             AND  deleted_at IS NULL
             AND  EXTRACT(EPOCH FROM (
                    NOW() - COALESCE(last_energy_update, '1970-01-01'::timestamptz)
                  )) >= $1
           LIMIT ${BATCH_SIZE}
         )
         RETURNING id`,
        [group.regenSec, ...group.tiers]
      );
      const batchCount = result.rowCount ?? 0;
      totalUpdated += batchCount;
      if (batchCount < BATCH_SIZE) break;
    }
  }

  if (totalUpdated > 0) {
    logger.debug(`Energy regen: ${totalUpdated} users updated`);
  }

  return { updated: totalUpdated };
}

async function regenLife(): Promise<{ updated: number }> {
  if (!(await isDue(REDIS_KEY.lifeLastRun, LIFE_REGEN_MS))) {
    return { updated: 0 };
  }

  const result = await pool.query(`
    UPDATE users
    SET    life       = LEAST(life + 2, max_life),
           updated_at = NOW()
    WHERE  life       < max_life
      AND  (hospital_until IS NULL OR hospital_until <= NOW())
      AND  deleted_at  IS NULL
    RETURNING id
  `);

  await setLastRun(REDIS_KEY.lifeLastRun);
  return { updated: result.rowCount ?? 0 };
}

async function decayHappiness(): Promise<{ updated: number }> {
  if (!(await isDue(REDIS_KEY.happinessLastRun, HAPPINESS_DECAY_MS))) {
    return { updated: 0 };
  }

  const result = await pool.query(`
    UPDATE users
    SET    happiness  = GREATEST(happiness - 1, 0),
           updated_at = NOW()
    WHERE  happiness  > 0
      AND  last_seen_at < NOW() - INTERVAL '30 minutes'
      -- BUG FIX: exclude hospitalized users from happiness decay
      AND  (hospital_until IS NULL OR hospital_until <= NOW())
      AND  deleted_at IS NULL
    RETURNING id
  `);

  await setLastRun(REDIS_KEY.happinessLastRun);
  return { updated: result.rowCount ?? 0 };
}

async function getOnlineCount(): Promise<number> {
  const result = await pool.query(`
    SELECT COUNT(*) AS count
    FROM   users
    WHERE  last_seen_at > NOW() - INTERVAL '5 minutes'
      AND  deleted_at   IS NULL
  `);
  return parseInt(result.rows[0]?.count ?? "0", 10);
}

async function checkTierExpiry(): Promise<{ downgraded: number }> {
  // BUG FIX: capture old tier before update for accurate logging
  const result = await pool.query(`
    WITH expired AS (
      SELECT id, username, user_tier AS old_tier
      FROM   users
      WHERE  user_tier       != 'player'
        AND  tier_expires_at IS NOT NULL
        AND  tier_expires_at <= NOW()
        AND  deleted_at      IS NULL
    )
    UPDATE users u
    SET    user_tier       = 'player',
           tier_expires_at = NULL,
           tier_granted_at = NULL,
           tier_granted_by = NULL,
           updated_at      = NOW()
    FROM   expired
    WHERE  u.id = expired.id
    RETURNING u.id, u.username, expired.old_tier
  `);

  const count = result.rowCount ?? 0;

  if (count > 0) {
    logger.info(`Tier expiry: ${count} users downgraded to player`, {
      users: result.rows.map((r: { id: number; username: string; old_tier: string }) => ({
        id:       r.id,
        username: r.username,
        fromTier: r.old_tier,  // BUG FIX: now shows the actual old tier
      })),
    });
  }

  return { downgraded: count };
}

export interface TickResult {
  tickNumber:      number;
  durationMs:      number;
  energy:          { updated: number };
  nerve:           { player_citizen: number; contributor: number; total: number };
  life:            { updated: number };
  happiness:       { updated: number };
  tierExpiry:      { downgraded: number };
  onlineCount:     number;
  marketExpired:   number;
  ranAt:           string;
  partialFailures: string[];
}

export async function runGameTick(): Promise<TickResult | null> {
  if (isRunning) {
    logger.warn("Game tick skipped — previous tick still running");
    return null;
  }

  if (isCircuitOpen()) {
    logger.warn("Game tick skipped — circuit breaker open");
    return null;
  }

  isRunning = true;
  const startMs = Date.now();
  let tickNumber = 0;

  try {
    tickNumber = await redis.incr(REDIS_KEY.tickCount);
    await redis.set(REDIS_KEY.lastTickAt, new Date().toISOString());
  } catch { /* non-fatal */ }

  try {
    logger.debug(`Game tick #${tickNumber} started`);

    const [energyR, nerveR, lifeR, happinessR, onlineR, tierR, marketR] =
      await Promise.allSettled([
        regenEnergyByTier(),
        regenNerveByTier(),
        regenLife(),
        decayHappiness(),
        getOnlineCount(),
        checkTierExpiry(),
        expireListings(),
      ]);

    const energy    = energyR.status    === "fulfilled" ? energyR.value    : { updated: 0 };
    const nerve     = nerveR.status     === "fulfilled" ? nerveR.value     : { player_citizen: 0, contributor: 0, total: 0 };
    const life      = lifeR.status      === "fulfilled" ? lifeR.value      : { updated: 0 };
    const happiness = happinessR.status === "fulfilled" ? happinessR.value : { updated: 0 };
    const online    = onlineR.status    === "fulfilled" ? onlineR.value    : 0;
    const tierExp   = tierR.status      === "fulfilled" ? tierR.value      : { downgraded: 0 };
    const marketExp = marketR.status    === "fulfilled" ? marketR.value    : 0;

    const partialFailures: string[] = [];
    if (energyR.status    === "rejected") { partialFailures.push("energy");    logger.error("Energy regen failed",      { error: (energyR    as PromiseRejectedResult).reason?.message }); }
    if (nerveR.status     === "rejected") { partialFailures.push("nerve");     logger.error("Nerve regen failed",       { error: (nerveR     as PromiseRejectedResult).reason?.message }); }
    if (lifeR.status      === "rejected") { partialFailures.push("life");      logger.error("Life regen failed",        { error: (lifeR      as PromiseRejectedResult).reason?.message }); }
    if (happinessR.status === "rejected") { partialFailures.push("happiness"); logger.error("Happiness decay failed",   { error: (happinessR as PromiseRejectedResult).reason?.message }); }
    if (onlineR.status    === "rejected") { partialFailures.push("online");    logger.error("Online count failed",      { error: (onlineR    as PromiseRejectedResult).reason?.message }); }
    if (tierR.status      === "rejected") { partialFailures.push("tier");      logger.error("Tier expiry check failed", { error: (tierR      as PromiseRejectedResult).reason?.message }); }
    if (marketR.status    === "rejected") { partialFailures.push("market");    logger.error("Market listing expiry failed", { error: (marketR    as PromiseRejectedResult).reason?.message }); }

    if (partialFailures.length > 0) recordPartialFailure(partialFailures);

    SafeNotify.onlineCount(online);

    const durationMs = Date.now() - startMs;

    const result: TickResult = {
      tickNumber,
      durationMs,
      energy,
      nerve,
      life,
      happiness,
      tierExpiry:      tierExp,
      onlineCount:     online,
      marketExpired:   marketExp,
      ranAt:           new Date().toISOString(),
      partialFailures,
    };

    if (durationMs > SLOW_TICK_THRESHOLD_MS) {
      logger.warn(`Game tick #${tickNumber} SLOW: ${durationMs}ms`, result);
      void Alerts.gameTickSlow(durationMs);
    } else {
      logger.debug(`Game tick #${tickNumber} complete in ${durationMs}ms`);
    }

    if (partialFailures.length === 0) recordSuccess();

    return result;

  } catch (err) {
    const durationMs = Date.now() - startMs;
    const message    = err instanceof Error ? err.message : String(err);
    logger.error(`Game tick #${tickNumber} failed`, { error: message, durationMs });
    recordFailure(`tick #${tickNumber}: ${message}`);
    void Alerts.gameTickFailed(message);
    return null;

  } finally {
    isRunning = false;
  }
}

export function startGameTick(): void {
  if (tickInterval) {
    logger.warn("Game tick already running");
    return;
  }

  if (config.isTest) {
    logger.info("Skipping game tick in test mode");
    return;
  }

  const bootDelay = 5_000;
  setTimeout(() => { void runGameTick(); }, bootDelay);

  tickInterval = setInterval(() => { void runGameTick(); }, TICK_INTERVAL_MS);
  if (tickInterval.unref) tickInterval.unref();

  logger.info("Game tick started", {
    intervalMs:      TICK_INTERVAL_MS,
    slowThresholdMs: SLOW_TICK_THRESHOLD_MS,
    lifeRegenMs:     LIFE_REGEN_MS,
    bootDelayMs:     bootDelay,
  });
}

export function stopGameTick(): void {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
    logger.info("Game tick stopped");
  }
}

export async function getTickInfo(): Promise<{
  isRunning:    boolean;
  circuitOpen:  boolean;
  tickCount:    number;
  lastTickAt:   string | null;
  lastRunTimes: Record<string, string | null>;
}> {
  try {
    const [count, lastAt, lifeLast, happyLast] = await Promise.all([
      redis.get(REDIS_KEY.tickCount),
      redis.get(REDIS_KEY.lastTickAt),
      redis.get(REDIS_KEY.lifeLastRun),
      redis.get(REDIS_KEY.happinessLastRun),
    ]);

    const toIso = (ms: string | null) =>
      ms ? new Date(parseInt(ms, 10)).toISOString() : null;

    return {
      isRunning:   isRunning,
      circuitOpen: isCircuitOpen(),
      tickCount:   count ? parseInt(count, 10) : 0,
      lastTickAt:  lastAt,
      lastRunTimes: {
        energy:    "tier-aware (per-user timestamp)",
        nerve:     "tier-aware (per-user timestamp)",
        life:      toIso(lifeLast),
        happiness: toIso(happyLast),
      },
    };
  } catch {
    return {
      isRunning:    isRunning,
      circuitOpen:  isCircuitOpen(),
      tickCount:    0,
      lastTickAt:   null,
      lastRunTimes: { energy: null, nerve: null, life: null, happiness: null },
    };
  }
}
