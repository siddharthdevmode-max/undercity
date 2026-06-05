import { PoolClient } from "pg";
import { pool } from "../config/database";
import { logger } from "../utils/logger";
import { isImmuneFromUAC } from "./immunityCheck";

// ============================================================
// VIOLATION TYPES & SEVERITY
// ============================================================

export const VIOLATIONS = {
  // UAC 1.0
  INVALID_CHALLENGE:    { severity: 10,  reason: "Invalid challenge token" },
  RATE_LIMIT_HIT:       { severity: 5,   reason: "Rate limit exceeded" },
  HONEYPOT_TRIGGERED:   { severity: 100, reason: "Honeypot endpoint accessed" },
  SUSPICIOUS_TIMING:    { severity: 15,  reason: "Bot-like timing detected" },
  SIGNATURE_FAILURE:    { severity: 20,  reason: "Multiple signature failures" },
  CHALLENGE_REUSE:      { severity: 25,  reason: "Challenge token replay attempt" },
  IMPOSSIBLE_ACTION:    { severity: 50,  reason: "Physically impossible action" },
  // UAC 2.0 — Pillar 2: Statistical Anomaly Detection
  EARNINGS_VELOCITY:    { severity: 30,  reason: "Abnormal earnings velocity detected" },
  ACTIVE_HOURS_ANOMALY: { severity: 25,  reason: "Inhuman active hours detected" },
  SUCCESS_RATE_SPIKE:   { severity: 20,  reason: "Suspicious success rate spike" },
  // UAC 2.0 — Pillar 3: Network Intelligence
  VPN_PROXY_DETECTED:   { severity: 15,  reason: "VPN or proxy usage detected" },
  TOR_DETECTED:         { severity: 40,  reason: "Tor exit node detected" },
  GEO_BLOCKED:          { severity: 50,  reason: "Access from geo-blocked region" },
} as const;

export type ViolationType = keyof typeof VIOLATIONS;

export function getTrustTier(score: number): string {
  if (score >= 70) return "CLEAN";
  if (score >= 40) return "WATCHED";
  if (score >= 20) return "SUSPICIOUS";
  if (score >= 1)  return "SHADOW_BANNED";
  return "HARD_BANNED";
}

export async function flagUser(params: {
  firebaseUid:    string;
  violationType:  ViolationType;
  details?:       Record<string, unknown>;
  ipAddress?:     string;
  userAgent?:     string;
}): Promise<{ newTrustScore: number; tier: string; isBanned: boolean }> {

  // 🛡️ DEV/ADMIN IMMUNITY — bail before any DB writes
  if (await isImmuneFromUAC(params.firebaseUid)) {
    logger.info("🛡️ UAC flag SKIPPED (immune user)", {
      uid:  params.firebaseUid.substring(0, 8),
      type: params.violationType,
    });
    return { newTrustScore: 100, tier: "CLEAN", isBanned: false };
  }

  const client: PoolClient = await pool.connect();

  try {
    await client.query("BEGIN");

    const violation = VIOLATIONS[params.violationType];

    const userResult = await client.query(
      `SELECT id, trust_score FROM users WHERE firebase_uid = $1 LIMIT 1`,
      [params.firebaseUid]
    );

    if (userResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return { newTrustScore: 0, tier: "UNKNOWN", isBanned: false };
    }

    const user     = userResult.rows[0];
    const oldScore = user.trust_score ?? 100;
    const newScore = Math.max(0, oldScore - violation.severity);

    const isShadowBanned = newScore > 0 && newScore < 20;
    const isHardBanned   = newScore === 0;

    await client.query(
      `UPDATE users
       SET trust_score      = $1,
           is_shadow_banned = $2,
           is_hard_banned   = $3,
           last_flag_reason = $4,
           last_flag_at     = CURRENT_TIMESTAMP,
           total_flags      = total_flags + 1
       WHERE id = $5`,
      [newScore, isShadowBanned, isHardBanned, violation.reason, user.id]
    );

    await client.query(
      `INSERT INTO uac_violations
       (user_id, firebase_uid, violation_type, severity, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        user.id,
        params.firebaseUid,
        params.violationType,
        violation.severity,
        JSON.stringify(params.details ?? {}),
        params.ipAddress  || null,
        params.userAgent  || null,
      ]
    );

    await client.query("COMMIT");

    const tier = getTrustTier(newScore);

    logger.warn("🚨 UAC FLAG", {
      uid:   params.firebaseUid.substring(0, 8),
      type:  params.violationType,
      trust: `${oldScore} → ${newScore}`,
      tier,
    });

    return { newTrustScore: newScore, tier, isBanned: isHardBanned };

  } catch (error: unknown) {
    await client.query("ROLLBACK");
    logger.error("flagUser error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { newTrustScore: 100, tier: "ERROR", isBanned: false };
  } finally {
    client.release();
  }
}

export async function getTrustInfo(firebaseUid: string): Promise<{
  trustScore:     number;
  tier:           string;
  isShadowBanned: boolean;
  isHardBanned:   boolean;
}> {
  // Devs/admins always show CLEAN
  if (await isImmuneFromUAC(firebaseUid)) {
    return {
      trustScore:     100,
      tier:           "CLEAN",
      isShadowBanned: false,
      isHardBanned:   false,
    };
  }

  const result = await pool.query(
    `SELECT trust_score, is_shadow_banned, is_hard_banned
     FROM users WHERE firebase_uid = $1 LIMIT 1`,
    [firebaseUid]
  );

  if (result.rows.length === 0) {
    return {
      trustScore:     100,
      tier:           "UNKNOWN",
      isShadowBanned: false,
      isHardBanned:   false,
    };
  }

  const row   = result.rows[0];
  const score = row.trust_score ?? 100;

  return {
    trustScore:     score,
    tier:           getTrustTier(score),
    isShadowBanned: !!row.is_shadow_banned,
    isHardBanned:   !!row.is_hard_banned,
  };
}
