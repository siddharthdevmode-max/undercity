import { redis }   from "../config/redis";
import { config }  from "../config";
import { logger }  from "../utils/logger";
import { pool }    from "../config/database";
import type { UserRow } from "../models/userModels";

const CACHE_TTL_SEC = config.isTest ? 1 : 15;
const CACHE_PREFIX  = "user:cache:";

function cacheKey(uid: string): string {
  return `${CACHE_PREFIX}${uid}`;
}

export async function getCachedUser(uid: string): Promise<UserRow | null> {
  if (config.isTest) return null;

  try {
    const raw = await redis.get(cacheKey(uid));
    if (!raw) return null;
    return JSON.parse(raw) as UserRow;
  } catch (err) {
    logger.warn("User cache read failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function setCachedUser(uid: string, user: UserRow): Promise<void> {
  if (config.isTest) return;

  try {
    await redis.setex(cacheKey(uid), CACHE_TTL_SEC, JSON.stringify(user));
  } catch (err) {
    logger.warn("User cache write failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function invalidateUserCache(uid: string): Promise<void> {
  if (config.isTest) return;

  try {
    await redis.del(cacheKey(uid));
  } catch {
    // non-fatal
  }
}

export async function getCachedUserWithFallback(
  uid: string
): Promise<{ user: UserRow; cached: boolean }> {
  const cached = await getCachedUser(uid);
  if (cached) return { user: cached, cached: true };

  const result = await pool.query(
    `SELECT * FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`,
    [uid]
  );
  if (result.rows.length === 0) {
    throw new Error("User not found");
  }

  const user = result.rows[0] as UserRow;
  await setCachedUser(uid, user).catch(() => {});
  return { user, cached: false };
}

export function buildCacheKey(uid: string): string {
  return cacheKey(uid);
}


