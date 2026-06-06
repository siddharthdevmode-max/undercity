import { logger }           from "../utils/logger";
import { pool }             from "../config/database";
import { redis }            from "../config/redis";
import { SocketNotify }     from "../config/socket";
import { config }           from "../config";
import { regenNerveByTier } from "./nerveService";

// ============================================================
// GAME TICK ENGINE — UNDERCITY HEARTBEAT
//
// Tick interval: config.game.tickIntervalMs (default 60s)
//
// TIMING STRATEGY:
//   Instead of modular tickCount (resets on restart = broken timing),
//   we use wall-clock time stored in Redis.
//   Each regeneration type checks: "was this last run > X minutes ago?"
//   This survives server restarts, crashes, and deploys cleanly.
//
// REGEN SCHEDULE:
//   Energy:    +1 every 5  minutes (global timer — tier energy benefits coming later)
//   Nerve:     TIER-AWARE (per-user timestamp via nerveService)
//              player/citizen  = 1 nerve / 5 min
//              contributor     = 1 nerve / 3 min
//   Life:      +2 every 3  minutes
//   Happiness: -1 every 15 minutes (decay if no activity)
//
// NERVE CHANGE (v2):
//   Nerve regen NO LONGER uses a global Redis timer.
//   nerveService.regenNerveByTier() uses per-user last_nerve_update
//   timestamps in the DB. The tick just calls it every cycle (60s),
//   and the service itself decides who is due for regen.
//
// CIRCUIT BREAKER:
//   3 consecutive DB failures → tick pauses for 5 minutes
//   Prevents hammering a struggling DB
// ============================================================

// ── Constants ──────────────────────────────────────────────

const TICK_INTERVAL_MS   = config.game.tickIntervalMs; // default 60_000

// Regen intervals in milliseconds (for non-nerve systems)
const ENERGY_REGEN_MS    = (config.game.energyRegenSec  ?? 300)  * 1_000; // 5 min
const LIFE_REGEN_MS      = 3  * 60 * 1_000;                                // 3 min
const HAPPINESS_DECAY_MS = 15 * 60 * 1_000;                                // 15 min

// Redis keys for last-run timestamps
const REDIS_KEY = {
  energyLastRun:    "gametick:energy:lastrun",
  lifeLastRun:      "gametick:life:lastrun",
  happinessLastRun: "gametick:happiness:lastrun",
  tickCount:        "gametick:count",
  lastTickAt:       "gametick:lasttick",
} as const;

// Circuit breaker state
const CIRCUIT = {
  failures:        0,
  maxFailures:     3,
  pauseUntil:      0,
  pauseDurationMs: 5 * 60 * 1_000, // 5 minutes
};

// ── Tick state ─────────────────────────────────────────────

let tickInterval: NodeJS.Timeout | null = null;
let isRunning                           = false;

// ── Circuit breaker ────────────────────────────────────────

function recordSuccess(): void {
  CIRCUIT.failures = 0;
}

function recordFailure(context: string): void {
  CIRCUIT.failures++;

  logger.warn(`⚠️ Game tick failure [${CIRCUIT.failures}/${CIRCUIT.maxFailures}]`, {
    context,
  });

  if (CIRCUIT.failures >= CIRCUIT.maxFailures) {
    CIRCUIT.pauseUntil = Date.now() + CIRCUIT.pauseDurationMs;
    CIRCUIT.failures   = 0;

    logger.error("🔴 Game tick circuit breaker OPEN — pausing for 5 minutes", {
      resumeAt: new Date(CIRCUIT.pauseUntil).toISOString(),
    });
  }
}

function isCircuitOpen(): boolean {
  if (CIRCUIT.pauseUntil > Date.now()) return true;
  if (CIRCUIT.pauseUntil !== 0 && CIRCUIT.pauseUntil <= Date.now()) {
    logger.info("🟢 Game tick circuit breaker CLOSED — resuming");
    CIRCUIT.pauseUntil = 0;
  }
  return false;
}

// ── Redis time helpers ─────────────────────────────────────

async function getLastRun(key: string): Promise<number> {
  try {
    const val = await redis.get(key);
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

async function setLastRun(key: string): Promise<void> {
  try {
    await redis.set(key, String(Date.now()), "EX", 60 * 60 * 24);
  } catch {
    // Non-fatal
  }
}

async function isDue(key: string, intervalMs: number): Promise<boolean> {
  const lastRun = await getLastRun(key);
  return Date.now() - lastRun >= intervalMs;
}

// ── Regen jobs ─────────────────────────────────────────────

async function regenEnergy(): Promise<{ updated: number }> {
  if (!(await isDue(REDIS_KEY.energyLastRun, ENERGY_REGEN_MS))) {
    return { updated: 0 };
  }

  const result = await pool.query(`
    UPDATE users
    SET    energy     = LEAST(energy + 1, max_energy),
           updated_at = NOW()
    WHERE  energy     < max_energy
      AND  deleted_at IS NULL
    RETURNING id
  `);

  await setLastRun(REDIS_KEY.energyLastRun);
  return { updated: result.rowCount ?? 0 };
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
      AND  hospital_until IS NULL
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
      AND  deleted_at   IS NULL
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

// ── Tier expiry check ──────────────────────────────────────
// Downgrade expired citizens/contributors back to player

async function checkTierExpiry(): Promise<{ downgraded: number }> {
  const result = await pool.query(`
    UPDATE users
    SET    user_tier       = 'player',
           tier_expires_at = NULL,
           tier_granted_at = NULL,
           tier_granted_by = NULL,
           updated_at      = NOW()
    WHERE  user_tier       != 'player'
      AND  tier_expires_at IS NOT NULL
      AND  tier_expires_at <= NOW()
      AND  deleted_at      IS NULL
    RETURNING id, username, user_tier
  `);

  const count = result.rowCount ?? 0;

  if (count > 0) {
    logger.info(`⏰ Tier expiry: ${count} users downgraded to player`, {
      users: result.rows.map((r: { id: number; username: string }) => ({
        id:       r.id,
        username: r.username,
      })),
    });
  }

  return { downgraded: count };
}

// ── Tick metrics ───────────────────────────────────────────

export interface TickResult {
  tickNumber:     number;
  durationMs:     number;
  energy:         { updated: number };
  nerve:          { player: number; citizen: number; contributor: number; total: number };
  life:           { updated: number };
  happiness:      { updated: number };
  tierExpiry:     { downgraded: number };
  onlineCount:    number;
  ranAt:          string;
}

// ── Main tick ──────────────────────────────────────────────

export async function runGameTick(): Promise<TickResult | null> {
  if (isRunning) {
    logger.warn("⏱️ Game tick skipped — previous tick still running");
    return null;
  }

  if (isCircuitOpen()) {
    logger.warn("🔴 Game tick skipped — circuit breaker open");
    return null;
  }

  isRunning = true;
  const startMs = Date.now();

  let tickNumber = 0;
  try {
    tickNumber = await redis.incr(REDIS_KEY.tickCount);
    await redis.set(REDIS_KEY.lastTickAt, new Date().toISOString());
  } catch {
    // Non-fatal
  }

  try {
    logger.debug(`⏱️ Game tick #${tickNumber} started`);

    const [energyR, nerveR, lifeR, happinessR, onlineR, tierR] = await Promise.allSettled([
      regenEnergy(),
      regenNerveByTier(),       // ← NEW: tier-aware nerve regen
      regenLife(),
      decayHappiness(),
      getOnlineCount(),
      checkTierExpiry(),        // ← NEW: auto-downgrade expired tiers
    ]);

    const energy    = energyR.status    === "fulfilled" ? energyR.value    : { updated: 0 };
    const nerve     = nerveR.status     === "fulfilled" ? nerveR.value     : { player: 0, citizen: 0, contributor: 0, total: 0 };
    const life      = lifeR.status      === "fulfilled" ? lifeR.value      : { updated: 0 };
    const happiness = happinessR.status === "fulfilled" ? happinessR.value : { updated: 0 };
    const online    = onlineR.status    === "fulfilled" ? onlineR.value    : 0;
    const tierExp   = tierR.status      === "fulfilled" ? tierR.value      : { downgraded: 0 };

    // Log sub-job errors
    if (energyR.status    === "rejected") logger.error("⚡ Energy regen failed",     { error: energyR.reason?.message });
    if (nerveR.status     === "rejected") logger.error("🧠 Nerve regen failed",      { error: nerveR.reason?.message });
    if (lifeR.status      === "rejected") logger.error("❤️  Life regen failed",      { error: lifeR.reason?.message });
    if (happinessR.status === "rejected") logger.error("😊 Happiness decay failed",  { error: happinessR.reason?.message });
    if (onlineR.status    === "rejected") logger.error("👥 Online count failed",     { error: onlineR.reason?.message });
    if (tierR.status      === "rejected") logger.error("⏰ Tier expiry check failed", { error: tierR.reason?.message });

    // Broadcast online count
    SocketNotify.onlineCount(online);

    const durationMs = Date.now() - startMs;

    const result: TickResult = {
      tickNumber,
      durationMs,
      energy,
      nerve,
      life,
      happiness,
      tierExpiry: tierExp,
      onlineCount: online,
      ranAt:       new Date().toISOString(),
    };

    if (durationMs > TICK_INTERVAL_MS * 0.5) {
      logger.warn(`⚠️ Game tick #${tickNumber} took ${durationMs}ms (>${TICK_INTERVAL_MS * 0.5}ms threshold)`, result);
    } else {
      logger.debug(`✅ Game tick #${tickNumber} complete`, result);
    }

    recordSuccess();
    return result;

  } catch (err) {
    const durationMs = Date.now() - startMs;
    const message    = err instanceof Error ? err.message : String(err);

    logger.error(`❌ Game tick #${tickNumber} failed`, { error: message, durationMs });
    recordFailure(`tick #${tickNumber}: ${message}`);
    return null;

  } finally {
    isRunning = false;
  }
}

// ── Start / Stop ───────────────────────────────────────────

export function startGameTick(): void {
  if (tickInterval) {
    logger.warn("⏱️ Game tick already running");
    return;
  }

  if (config.isTest) {
    logger.info("⏱️ Skipping game tick in test mode");
    return;
  }

  const bootDelay = 5_000;
  setTimeout(() => {
    void runGameTick();
  }, bootDelay);

  tickInterval = setInterval(() => {
    void runGameTick();
  }, TICK_INTERVAL_MS);

  if (tickInterval.unref) tickInterval.unref();

  logger.info(`✅ Game tick started`, {
    intervalMs:    TICK_INTERVAL_MS,
    energyRegenMs: ENERGY_REGEN_MS,
    nerveRegen:    "tier-aware (per-user timestamp)",
    lifeRegenMs:   LIFE_REGEN_MS,
    bootDelayMs:   bootDelay,
  });
}

export function stopGameTick(): void {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
    logger.info("🛑 Game tick stopped");
  }
}

// ── Health / debug info ────────────────────────────────────

export async function getTickInfo(): Promise<{
  isRunning:     boolean;
  circuitOpen:   boolean;
  tickCount:     number;
  lastTickAt:    string | null;
  lastRunTimes:  Record<string, string | null>;
}> {
  try {
    const [count, lastAt, energyLast, lifeLast, happyLast] =
      await Promise.all([
        redis.get(REDIS_KEY.tickCount),
        redis.get(REDIS_KEY.lastTickAt),
        redis.get(REDIS_KEY.energyLastRun),
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
        energy:    toIso(energyLast),
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
