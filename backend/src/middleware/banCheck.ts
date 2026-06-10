// ============================================================
// BAN CHECK MIDDLEWARE — UNDERCITY
// ============================================================

import { Request, Response, NextFunction } from "express";
import { pool }        from "../config/database";
import redis           from "../config/redis";
import { logger }      from "../utils/logger";
import { BannedError } from "../utils/errors";
import { config }      from "../config";
import type { TrustTier } from "../services/trustEngine";

// Hard bans: 3s micro-cache to prevent DB hammering on rapid requests
// Soft/shadow bans: 30s cache is acceptable latency
const SOFT_CACHE_TTL_SEC     = 30;
const HARD_BAN_CACHE_TTL_SEC = 3;
const SOFT_CACHE_PREFIX      = "ban:soft:";
const HARD_BAN_CACHE_PREFIX  = "ban:hard:";

interface BanRecord {
  is_hard_banned:   boolean;
  is_shadow_banned: boolean;
  ban_type:         "soft" | "hard" | "shadow" | null;
  ban_reason:       string | null;
  ban_expires_at:   string | null;
  trust_score:      number;
}

export const checkBanStatus = async (
  req:  Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const uid = req.firebaseUser?.uid;
  if (!uid) return next();
  if (config.isTest) { next(); return; }

  try {
    const data = await getBanRecord(uid);
    if (!data) return next();

    // ── Hard ban ─────────────────────────────────────────
    if (data.is_hard_banned) {
      logger.warn("🚫 Hard-banned user blocked", { uid: uid.slice(0, 8) });
      return next(
        new BannedError("hard", data.ban_reason ?? "Terms of service violation")
      );
    }

    // ── Soft ban ──────────────────────────────────────────
    if (data.ban_type === "soft" && data.ban_expires_at) {
      const expiresAt = new Date(data.ban_expires_at);
      if (expiresAt > new Date()) {
        logger.warn("🚫 Soft-banned user blocked", {
          uid:       uid.slice(0, 8),
          expiresAt: data.ban_expires_at,
        });
        return next(
          new BannedError("soft", data.ban_reason ?? "Temporary ban", expiresAt)
        );
      }
      void clearExpiredSoftBan(uid);
    }

    // ── Trust tier ────────────────────────────────────────
    const score = data.trust_score ?? 100;
    const tier: TrustTier =
      score >= 70 ? "CLEAN"
      : score >= 40 ? "WATCHED"
      : score >= 20 ? "SUSPICIOUS"
      : score >= 1  ? "SHADOW_BANNED"
      : "HARD_BANNED";

    req.trustInfo = {
      isShadowBanned: !!data.is_shadow_banned,
      trustScore:     score,
      tier,
      isHardBanned:   !!data.is_hard_banned,
    };

    next();
  } catch (error: unknown) {
    logger.error("Ban check error", {
      uid:   uid.slice(0, 8),
      error: error instanceof Error ? error.message : String(error),
    });
    next();
  }
};

async function getBanRecord(uid: string): Promise<BanRecord | null> {
  const hardKey = `${HARD_BAN_CACHE_PREFIX}${uid}`;
  const softKey = `${SOFT_CACHE_PREFIX}${uid}`;

  // ── Check hard ban cache first (3s micro-cache) ───────
  try {
    const cachedHard = await redis.get(hardKey);
    if (cachedHard !== null) {
      return JSON.parse(cachedHard) as BanRecord;
    }
  } catch { /* Redis down — fall through */ }

  // ── Check soft ban cache (30s) ────────────────────────
  // Only use soft cache if we know user is NOT hard banned
  try {
    const cachedSoft = await redis.get(softKey);
    if (cachedSoft !== null) {
      const parsed = JSON.parse(cachedSoft) as BanRecord;
      // Soft cache must never serve a hard-banned record
      // (admin could have hard-banned between soft cache writes)
      if (!parsed.is_hard_banned) return parsed;
      // Soft cache has stale hard-ban=true → fall through to DB
    }
  } catch { /* Redis down — fall through */ }

  // ── DB lookup ─────────────────────────────────────────
  const result = await pool.query<BanRecord>(
    `SELECT
       is_hard_banned, is_shadow_banned,
       ban_type, ban_reason, ban_expires_at,
       COALESCE(trust_score, 100) AS trust_score
     FROM users
     WHERE firebase_uid = $1
     LIMIT 1`,
    [uid]
  );

  if (result.rows.length === 0) return null;

  const record = result.rows[0];

  // ── Cache based on ban state ──────────────────────────
  if (record.is_hard_banned) {
    // Hard-banned: short 3s cache in hard-ban slot only
    // Never write to soft cache — prevents stale soft cache
    // returning is_hard_banned=false after a hard ban is applied
    try {
      await redis.set(hardKey, JSON.stringify(record), "EX", HARD_BAN_CACHE_TTL_SEC);
    } catch { /* Non-critical */ }
  } else {
    // Not hard-banned: write to soft cache (30s)
    // Also clear any stale hard-ban cache entry
    try {
      await Promise.all([
        redis.set(softKey, JSON.stringify(record), "EX", SOFT_CACHE_TTL_SEC),
        redis.del(hardKey),
      ]);
    } catch { /* Non-critical */ }
  }

  return record;
}

export async function invalidateBanCache(uid: string): Promise<void> {
  try {
    await Promise.all([
      redis.del(`${SOFT_CACHE_PREFIX}${uid}`),
      redis.del(`${HARD_BAN_CACHE_PREFIX}${uid}`),
    ]);
  } catch { /* Non-critical */ }
}

async function clearExpiredSoftBan(uid: string): Promise<void> {
  try {
    await pool.query(
      `UPDATE users
       SET ban_type        = NULL,
           ban_reason      = NULL,
           ban_expires_at  = NULL,
           is_shadow_banned = FALSE
       WHERE firebase_uid = $1
         AND ban_expires_at <= NOW()`,
      [uid]
    );
    await invalidateBanCache(uid);
    logger.info("✅ Expired soft ban cleared", { uid: uid.slice(0, 8) });
  } catch (error) {
    logger.error("Failed to clear expired soft ban", {
      uid:   uid.slice(0, 8),
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
