import { pool } from "../config/database";
import redis from "../config/redis";
import { logger } from "../utils/logger";

// ============================================================
// IMMUNITY CHECK
// Devs + Admins bypass UAC entirely (no flags, no punishments,
// no fingerprint hits, no shadow nerfs).
//
// Cached in Redis for 60s to avoid DB hit on every game action.
// Cache key format: immune:<firebase_uid>
// ============================================================

const CACHE_TTL_SECONDS = 60;
const CACHE_PREFIX = "immune:";

/**
 * Returns true if the user is an admin or developer.
 * Cached for 60s in Redis.
 * Fails OPEN (returns false) on errors — better to over-enforce than under-enforce.
 */
export async function isImmuneFromUAC(firebaseUid: string): Promise<boolean> {
  if (!firebaseUid) return false;

  const cacheKey = `${CACHE_PREFIX}${firebaseUid}`;

  // Check cache first
  try {
    const cached = await redis.get(cacheKey);
    if (cached !== null) return cached === "1";
  } catch (err) {
    // Redis down — fall through to DB
    logger.warn("immunity cache read failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // DB lookup
  try {
    const result = await pool.query<{ is_admin: boolean; is_developer: boolean }>(
      `SELECT is_admin, is_developer FROM users WHERE firebase_uid = $1 LIMIT 1`,
      [firebaseUid]
    );

    const row = result.rows[0];
    const immune = !!(row && (row.is_admin || row.is_developer));

    // Cache result
    try {
      await redis.set(cacheKey, immune ? "1" : "0", "EX", CACHE_TTL_SECONDS);
    } catch {
      // ignore cache write failures
    }

    return immune;
  } catch (err) {
    logger.error("immunity DB check failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return false; // fail-safe: not immune
  }
}

/**
 * Invalidate immunity cache for a user.
 * Call this when an admin promotes/demotes someone via the admin panel.
 */
export async function invalidateImmunityCache(firebaseUid: string): Promise<void> {
  try {
    await redis.del(`${CACHE_PREFIX}${firebaseUid}`);
  } catch (err) {
    logger.warn("immunity cache invalidation failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
