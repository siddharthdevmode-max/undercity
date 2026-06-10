// ============================================================
// BAN CHECK MIDDLEWARE — UNDERCITY
//
// SHADOW BAN DESIGN:
//   Shadow-banned users pass through ALL routes normally.
//   The punishment is applied ONLY to crime outcomes (crimeService).
//   Other routes (bank, market, profile) are unaffected.
//   This is intentional — the user should not know they are banned.
//   If wider punishment is needed, add it to those route handlers.
// ============================================================

import { Request, Response, NextFunction } from "express";
import { pool }          from "../config/database";
import redis             from "../config/redis";
import { logger }        from "../utils/logger";
import { BannedError }   from "../utils/errors";
import { config }        from "../config";
import { getTrustTier }  from "../services/trustEngine";

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

    // ── Hard ban ──────────────────────────────────────────
    if (data.is_hard_banned) {
      logger.warn("Hard-banned user blocked", { uid: uid.slice(0, 8) });
      return next(
        new BannedError("hard", data.ban_reason ?? "Terms of service violation")
      );
    }

    // ── Soft ban ──────────────────────────────────────────
    if (data.ban_type === "soft") {
      // BUG FIX: null ban_expires_at = indefinite soft ban — still enforce
      if (!data.ban_expires_at) {
        logger.warn("Indefinite soft ban enforced", { uid: uid.slice(0, 8) });
        return next(
          new BannedError("soft", data.ban_reason ?? "Account suspended")
        );
      }

      const expiresAt = new Date(data.ban_expires_at);
      if (expiresAt > new Date()) {
        logger.warn("Soft-banned user blocked", {
          uid:       uid.slice(0, 8),
          expiresAt: data.ban_expires_at,
        });
        return next(
          new BannedError("soft", data.ban_reason ?? "Temporary ban", expiresAt)
        );
      }
      // Soft ban expired — clear it async
      void clearExpiredSoftBan(uid);
    }

    // ── Trust info (for shadow punishment in crime routes) ─
    const score = data.trust_score ?? 100;

    // BUG FIX: use getTrustTier() not duplicated inline logic
    req.trustInfo = {
      isShadowBanned: !!data.is_shadow_banned,
      trustScore:     score,
      tier:           getTrustTier(score),
      isHardBanned:   !!data.is_hard_banned,
    };

    next();
  } catch (error: unknown) {
    logger.error("Ban check error", {
      uid:   uid.slice(0, 8),
      error: error instanceof Error ? error.message : String(error),
    });
    // Fail open — don't block legitimate users on error
    next();
  }
};

async function getBanRecord(uid: string): Promise<BanRecord | null> {
  const hardKey = `${HARD_BAN_CACHE_PREFIX}${uid}`;
  const softKey = `${SOFT_CACHE_PREFIX}${uid}`;

  let redisFailed = false;

  // ── Hard ban cache (3s) ───────────────────────────────
  try {
    const cachedHard = await redis.get(hardKey);
    if (cachedHard !== null) {
      return JSON.parse(cachedHard) as BanRecord;
    }
  } catch {
    redisFailed = true;
  }

  // ── Soft ban cache (30s) ──────────────────────────────
  if (!redisFailed) {
    try {
      const cachedSoft = await redis.get(softKey);
      if (cachedSoft !== null) {
        const parsed = JSON.parse(cachedSoft) as BanRecord;
        if (!parsed.is_hard_banned) return parsed;
      }
    } catch {
      redisFailed = true;
    }
  }

  // BUG FIX: log when both caches miss due to Redis failure
  if (redisFailed) {
    logger.warn("Ban check: Redis unavailable — falling through to DB", {
      uid: uid.slice(0, 8),
    });
  }

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
  const record = result.rows[0]!;

  // ── Cache ─────────────────────────────────────────────
  if (!redisFailed) {
    if (record.is_hard_banned) {
      try {
        await redis.set(hardKey, JSON.stringify(record), "EX", HARD_BAN_CACHE_TTL_SEC);
      } catch { /* non-critical */ }
    } else {
      try {
        await Promise.all([
          redis.set(softKey, JSON.stringify(record), "EX", SOFT_CACHE_TTL_SEC),
          redis.del(hardKey),
        ]);
      } catch { /* non-critical */ }
    }
  }

  return record;
}

export async function invalidateBanCache(uid: string): Promise<void> {
  try {
    await Promise.all([
      redis.del(`${SOFT_CACHE_PREFIX}${uid}`),
      redis.del(`${HARD_BAN_CACHE_PREFIX}${uid}`),
    ]);
  } catch { /* non-critical */ }
}

async function clearExpiredSoftBan(uid: string): Promise<void> {
  try {
    await pool.query(
      `UPDATE users
       SET ban_type         = NULL,
           ban_reason       = NULL,
           ban_expires_at   = NULL,
           is_shadow_banned = FALSE
       WHERE firebase_uid  = $1
         AND ban_expires_at <= NOW()`,
      [uid]
    );
    await invalidateBanCache(uid);
    logger.info("Expired soft ban cleared", { uid: uid.slice(0, 8) });
  } catch (error) {
    logger.error("Failed to clear expired soft ban", {
      uid:   uid.slice(0, 8),
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
