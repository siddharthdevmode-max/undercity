import { logger } from "../utils/logger";
import { pool } from "../config/database";
import { SocketNotify } from "../config/socket";

// ============================================================
// GAME TICK ENGINE — UNDERCITY HEARTBEAT
// Runs every 60 seconds in production
// Handles: nerve regen, life regen, online count broadcast
// ============================================================

let tickInterval: NodeJS.Timeout | null = null;
let tickCount = 0;

const TICK_INTERVAL_MS = 60_000; // 1 minute

export async function runGameTick(): Promise<void> {
  tickCount++;
  const tickId = `tick-${tickCount}`;

  try {
    logger.debug(`⏱️  Game tick [${tickId}] started`);

    // Run all tick jobs in parallel
    const [nerveResult, lifeResult, onlineCount] = await Promise.allSettled([
      regenNerve(),
      regenLife(),
      getOnlineCount(),
    ]);

    // Broadcast online count to all connected players
    if (onlineCount.status === "fulfilled") {
      SocketNotify.onlineCount(onlineCount.value);
    }

    logger.debug(`✅ Game tick [${tickId}] complete`, {
      nerve: nerveResult.status,
      life:  lifeResult.status,
      online: onlineCount.status === "fulfilled" ? onlineCount.value : "error",
    });

  } catch (err) {
    logger.error(`❌ Game tick [${tickId}] failed`, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── Nerve Regeneration ─────────────────────────────────────
// +1 nerve every 5 minutes (every 5 ticks), up to max_nerve
async function regenNerve(): Promise<void> {
  if (tickCount % 5 !== 0) return; // only every 5 ticks

  const result = await pool.query(`
    UPDATE users
    SET nerve = LEAST(nerve + 1, max_nerve),
        updated_at = NOW()
    WHERE nerve < max_nerve
      AND deleted_at IS NULL
    RETURNING id
  `);

  logger.debug(`⚡ Nerve regen: ${result.rowCount ?? 0} players updated`);
}

// ── Life Regeneration ──────────────────────────────────────
// +2 life every 3 minutes (every 3 ticks), up to max_life
async function regenLife(): Promise<void> {
  if (tickCount % 3 !== 0) return; // only every 3 ticks

  const result = await pool.query(`
    UPDATE users
    SET life = LEAST(life + 2, max_life),
        updated_at = NOW()
    WHERE life < max_life
      AND hospital_until IS NULL
      AND deleted_at IS NULL
    RETURNING id
  `);

  logger.debug(`❤️  Life regen: ${result.rowCount ?? 0} players updated`);
}

// ── Online Count ───────────────────────────────────────────
async function getOnlineCount(): Promise<number> {
  const result = await pool.query(`
    SELECT COUNT(*) as count
    FROM users
    WHERE last_seen_at > NOW() - INTERVAL '5 minutes'
      AND deleted_at IS NULL
  `);

  return parseInt(result.rows[0]?.count ?? "0", 10);
}

// ── Start / Stop ───────────────────────────────────────────
export function startGameTick(): void {
  if (tickInterval) {
    logger.warn("⏱️  Game tick already running");
    return;
  }

  // Run immediately on start
  runGameTick().catch((err) => {
    logger.error("⏱️  Initial game tick failed", { error: err.message });
  });

  tickInterval = setInterval(() => {
    runGameTick().catch((err) => {
      logger.error("⏱️  Game tick interval error", { error: err.message });
    });
  }, TICK_INTERVAL_MS);

  logger.info(`✅ Game tick started (every ${TICK_INTERVAL_MS / 1000}s)`);
}

export function stopGameTick(): void {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
    logger.info("🛑 Game tick stopped");
  }
}
