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

// Hard bans: no cache — always hit DB for instant enforcement
// Shadow/soft bans: 30s cache is acceptable
const SOFT_CACHE_TTL_SEC   = 30;
const CACHE_PREFIX         = "ban:";
const HARD_BAN_CACHE_PREFIX = "hardban:";

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
  res:  Response,
  next: NextFunction
): Promise<void> => {
  const uid = req.firebaseUser?.uid;
  if (!uid) return next();

  if (config.isTest) { next(); return; }

  try {
    const data = await getBanRecord(uid);
    if (!data) return next();

    if (data.is_hard_banned) {
      logger.warn("🚫 Hard-banned user blocked", { uid: uid.slice(0, 8) });
      return next(new BannedError("hard", data.ban_reason ?? "Terms of service violation"));
    }

    if (data.ban_type === "soft" && data.ban_expires_at) {
      const expiresAt = new Date(data.ban_expires_at);
      if (expiresAt > new Date()) {
        logger.warn("🚫 Soft-banned user blocked", {
          uid:       uid.slice(0, 8),
          expiresAt: data.ban_expires_at,
        });
        return next(new BannedError("soft", data.ban_reason ?? "Temporary ban", expiresAt));
      }
      void clearExpiredSoftBan(uid);
    }

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
  // ── Hard ban: ALWAYS check DB directly, no cache ──────
  // A 30s cache window on hard bans means banned users can
  // still act for up to 30s after being banned. Unacceptable.
  // We use a short 3s cache only to prevent hammering on the
  // same request, but not the 30s soft ban window.
  const hardBanCacheKey = `${HARD_BAN_CACHE_PREFIX}${uid}`;
  const softCacheKey    = `${CACHE_PREFIX}${uid}`;

  // Try soft cache first (30s) for non-hard-ban data
  try {
    const cached = await redis.get(softCacheKey);
    if (cached !== null) {
      const parsed = JSON.parse(cached) as BanRecord;
      // If cached record says hard banned, re-verify from DB
      // (in case ban was reversed by admin)
      if (!parsed.is_hard_banned) return parsed;
    }
  } catch { /* Redis down — fall through */ }

  // Always hit DB for fresh data
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

  // Only cache if NOT hard banned (hard bans always need fresh DB check)
  if (!record.is_hard_banned) {
    try {
      await redis.set(softCacheKey, JSON.stringify(record), "EX", SOFT_CACHE_TTL_SEC);
    } catch { /* Non-critical */ }
  } else {
    // Short 3s cache for hard bans just to prevent DB hammering on same request
    try {
      await redis.set(hardBanCacheKey, JSON.stringify(record), "EX", 3);
    } catch { /* Non-critical */ }
  }

  return record;
}

export async function invalidateBanCache(uid: string): Promise<void> {
  try {
    await Promise.all([
      redis.del(`${CACHE_PREFIX}${uid}`),
      redis.del(`${HARD_BAN_CACHE_PREFIX}${uid}`),
    ]);
  } catch { /* Non-critical */ }
}

async function clearExpiredSoftBan(uid: string): Promise<void> {
  try {
    await pool.query(
      `UPDATE users
       SET ban_type       = NULL,
           ban_reason     = NULL,
           ban_expires_at = NULL,
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
