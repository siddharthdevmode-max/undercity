// ============================================================
// UAC 2.0 — TRUST ENGINE
// ============================================================

import { pool }             from "../config/database";
import { withTransaction }  from "../config/database";
import { redis }            from "../config/redis";
import { logger }           from "../utils/logger";
import { isImmuneFromUAC }  from "./immunityCheck";
import { Alerts }           from "../utils/alerts";

// ── Violation registry ─────────────────────────────────────

export const VIOLATIONS = {
  INVALID_CHALLENGE:    { severity: 10,  reason: "Invalid challenge token",         cooldownSec: 60   },
  RATE_LIMIT_HIT:       { severity: 5,   reason: "Rate limit exceeded",             cooldownSec: 300  },
  HONEYPOT_TRIGGERED:   { severity: 100, reason: "Honeypot endpoint accessed",      cooldownSec: 0    },
  SIGNATURE_FAILURE:    { severity: 20,  reason: "Multiple signature failures",     cooldownSec: 120  },
  CHALLENGE_REUSE:      { severity: 25,  reason: "Challenge token replay attempt",  cooldownSec: 60   },
  IMPOSSIBLE_ACTION:    { severity: 50,  reason: "Physically impossible action",    cooldownSec: 60   },
  SUSPICIOUS_TIMING:    { severity: 15,  reason: "Bot-like timing detected",        cooldownSec: 300  },
  EARNINGS_VELOCITY:    { severity: 30,  reason: "Abnormal earnings velocity",      cooldownSec: 1_800 },
  ACTIVE_HOURS_ANOMALY: { severity: 25,  reason: "Inhuman active hours detected",   cooldownSec: 3_600 },
  SUCCESS_RATE_SPIKE:   { severity: 20,  reason: "Suspicious success rate spike",   cooldownSec: 900  },
  VPN_PROXY_DETECTED:   { severity: 15,  reason: "VPN or proxy usage detected",     cooldownSec: 21_600 },
  DATACENTER_IP:        { severity: 10,  reason: "Datacenter IP detected",          cooldownSec: 21_600 },
  TOR_DETECTED:         { severity: 40,  reason: "Tor exit node detected",          cooldownSec: 21_600 },
  GEO_BLOCKED:          { severity: 50,  reason: "Access from geo-blocked region",  cooldownSec: 86_400 },
} as const;

export type ViolationType = keyof typeof VIOLATIONS;

// ── Trust tier ─────────────────────────────────────────────

export type TrustTier =
  | "CLEAN"
  | "WATCHED"
  | "SUSPICIOUS"
  | "SHADOW_BANNED"
  | "HARD_BANNED"
  | "UNKNOWN";

export function getTrustTier(score: number): TrustTier {
  if (score >= 70) return "CLEAN";
  if (score >= 40) return "WATCHED";
  if (score >= 20) return "SUSPICIOUS";
  if (score >= 1)  return "SHADOW_BANNED";
  return "HARD_BANNED";
}

// ── FlagResult ─────────────────────────────────────────────

export interface FlagResult {
  newTrustScore: number | null; // BUG FIX: null when skipped (not a fake 100)
  tier:          TrustTier;
  isBanned:      boolean;
  skipped:       boolean;
  reason:        string;
}

// ── Dedup cooldown ─────────────────────────────────────────

async function isViolationOnCooldown(
  uid:           string,
  violationType: ViolationType,
  cooldownSec:   number
): Promise<boolean> {
  if (cooldownSec === 0) return false;
  try {
    const key    = `trust:cooldown:${violationType}:${uid}`;
    const result = await redis.set(key, "1", "EX", cooldownSec, "NX");
    return result === null;
  } catch {
    return false;
  }
}

// ============================================================
// flagUser
// ============================================================

export async function flagUser(params: {
  firebaseUid:   string;
  violationType: ViolationType;
  details?:      Record<string, unknown>;
  ipAddress?:    string;
  userAgent?:    string;
}): Promise<FlagResult> {
  const violation = VIOLATIONS[params.violationType];

  const SKIPPED = (reason: string): FlagResult => ({
    newTrustScore: null, // BUG FIX: null not fake 100
    tier:          "CLEAN",
    isBanned:      false,
    skipped:       true,
    reason,
  });

  if (await isImmuneFromUAC(params.firebaseUid)) {
    logger.debug("UAC flag skipped — immune user", {
      uid:  params.firebaseUid.substring(0, 8),
      type: params.violationType,
    });
    return SKIPPED("immune");
  }

  if (await isViolationOnCooldown(
    params.firebaseUid,
    params.violationType,
    violation.cooldownSec
  )) {
    logger.debug("UAC flag skipped — cooldown active", {
      uid:  params.firebaseUid.substring(0, 8),
      type: params.violationType,
    });
    return SKIPPED("deduped");
  }

  // BUG FIX: use withTransaction helper for safe rollback
  try {
    return await withTransaction(async (client) => {
      const userResult = await client.query(
        `SELECT id, trust_score, is_hard_banned
         FROM   users
         WHERE  firebase_uid = $1
           AND  deleted_at   IS NULL
         LIMIT  1
         FOR    UPDATE`,
        [params.firebaseUid]
      );

      if (userResult.rows.length === 0) {
        return {
          newTrustScore: null,
          tier:          "UNKNOWN",
          isBanned:      false,
          skipped:       true,
          reason:        "user not found",
        };
      }

      const user     = userResult.rows[0] as { id: number; trust_score: number; is_hard_banned: boolean };
      const oldScore = user.trust_score ?? 100;

      const insertViolation = () => client.query(
        `INSERT INTO uac_violations
           (user_id, firebase_uid, violation_type, severity, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          user.id, params.firebaseUid, params.violationType,
          violation.severity, JSON.stringify(params.details ?? {}),
          params.ipAddress ?? null, params.userAgent ?? null,
        ]
      );

      if (user.is_hard_banned || oldScore === 0) {
        await insertViolation();
        return {
          newTrustScore: 0,
          tier:          "HARD_BANNED",
          isBanned:      true,
          skipped:       false,
          reason:        "already banned",
        };
      }

      const newScore       = Math.max(0, oldScore - violation.severity);
      const isShadowBanned = newScore > 0 && newScore < 20;
      const isHardBanned   = newScore === 0;

      await client.query(
        `UPDATE users
         SET    trust_score      = $1,
                is_shadow_banned = $2,
                is_hard_banned   = $3,
                ban_type         = CASE WHEN $3 THEN 'hard'
                                        WHEN $2 THEN 'shadow'
                                        ELSE ban_type
                                   END,
                last_flag_reason = $4,
                last_flag_at     = NOW(),
                total_flags      = total_flags + 1,
                updated_at       = NOW()
         WHERE  id = $5`,
        [newScore, isShadowBanned, isHardBanned, violation.reason, user.id]
      );

      await insertViolation();

      const tier = getTrustTier(newScore);

      logger.warn("UAC FLAG", {
        uid:      params.firebaseUid.substring(0, 8),
        type:     params.violationType,
        trust:    `${oldScore} → ${newScore}`,
        tier,
        severity: violation.severity,
      });

      if (isHardBanned) {
        void Alerts.systemError(
          "Auto Hard-Ban",
          `User ${params.firebaseUid.substring(0, 8)} auto-banned. Violation: ${params.violationType}`,
          "high"
        );
      }

      return { newTrustScore: newScore, tier, isBanned: isHardBanned, skipped: false, reason: violation.reason };
    });
  } catch (err) {
    logger.error("TrustEngine: flagUser error", {
      error: err instanceof Error ? err.message : String(err),
      uid:   params.firebaseUid.substring(0, 8),
    });
    return { newTrustScore: null, tier: "CLEAN", isBanned: false, skipped: true, reason: "error" };
  }
}

// ============================================================
// getTrustInfo
// ============================================================

export async function getTrustInfo(firebaseUid: string): Promise<{
  trustScore:     number;
  tier:           TrustTier;
  isShadowBanned: boolean;
  isHardBanned:   boolean;
}> {
  if (await isImmuneFromUAC(firebaseUid)) {
    return { trustScore: 100, tier: "CLEAN", isShadowBanned: false, isHardBanned: false };
  }

  try {
    const result = await pool.query(
      `SELECT trust_score, is_shadow_banned, is_hard_banned
       FROM   users
       WHERE  firebase_uid = $1
         AND  deleted_at   IS NULL
       LIMIT  1`,
      [firebaseUid]
    );

    if (result.rows.length === 0) {
      // BUG FIX: return CLEAN for missing users (not UNKNOWN with fake score)
      return { trustScore: 100, tier: "CLEAN", isShadowBanned: false, isHardBanned: false };
    }

    const row   = result.rows[0] as { trust_score: number; is_shadow_banned: boolean; is_hard_banned: boolean };
    const score = row.trust_score ?? 100;

    return {
      trustScore:     score,
      tier:           getTrustTier(score),
      isShadowBanned: !!row.is_shadow_banned,
      isHardBanned:   !!row.is_hard_banned,
    };
  } catch (err) {
    logger.error("TrustEngine: getTrustInfo error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { trustScore: 100, tier: "CLEAN", isShadowBanned: false, isHardBanned: false };
  }
}

// ============================================================
// manualTrustAdjust
// ============================================================

export async function manualTrustAdjust(
  firebaseUid: string,
  newScore:    number,
  adminUid:    string,
  reason:      string
): Promise<{ success: boolean; newScore: number }> {
  const clamped        = Math.min(100, Math.max(0, newScore));
  const isShadowBanned = clamped > 0 && clamped < 20;
  const isHardBanned   = clamped === 0;

  // Determine ban_type for consistency with banCheck.ts
  const banType = isHardBanned
    ? "hard"
    : isShadowBanned
      ? "shadow"
      : null;

  try {
    const oldRow = await pool.query<{ id: number; trust_score: number }>(
      `SELECT id, trust_score FROM users
       WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`,
      [firebaseUid]
    );
    const oldScore = oldRow.rows[0]?.trust_score ?? 100;
    const userId   = oldRow.rows[0]?.id;

    if (!userId) {
      logger.warn("manualTrustAdjust: user not found", {
        uid: firebaseUid.substring(0, 8),
      });
      return { success: false, newScore: -1 };
    }

    await pool.query(
      `UPDATE users
       SET    trust_score      = $1,
              is_shadow_banned = $2,
              is_hard_banned   = $3,
              -- BUG FIX: update ban_type for banCheck.ts consistency
              ban_type         = $4,
              last_flag_reason = $5,
              last_flag_at     = NOW(),
              updated_at       = NOW()
       WHERE  firebase_uid = $6
         AND  deleted_at   IS NULL`,
      [clamped, isShadowBanned, isHardBanned, banType, `Admin adjustment: ${reason}`, firebaseUid]
    );

    // BUG FIX: include user_id in trust_recovery_log (NOT NULL FK)
    await pool.query(
      `INSERT INTO trust_recovery_log
         (user_id, firebase_uid, old_score, new_score, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        firebaseUid,
        oldScore,
        clamped,
        `ADMIN_ADJUST by ${adminUid.substring(0, 8)}: ${reason}`,
      ]
    );

    logger.info("Manual trust adjustment", {
      uid:      firebaseUid.substring(0, 8),
      adminUid: adminUid.substring(0, 8),
      newScore: clamped,
      reason,
    });

    return { success: true, newScore: clamped };
  } catch (err) {
    logger.error("TrustEngine: manualTrustAdjust error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { success: false, newScore: -1 };
  }
}
