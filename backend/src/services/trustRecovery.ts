import { pool } from "../config/database";
import { logger } from "../utils/logger";
import { getTrustTier } from "./trustEngine";

// ============================================================
// UAC 2.0 — TRUST RECOVERY ENGINE
// Runs daily via cron / admin trigger
// +1 trust per day of clean play
// +5 bonus per 7-day clean streak
// Max auto-regen = 70 (must appeal to reach 100)
// ============================================================

const MAX_AUTO_REGEN   = 70;
const DAILY_REGEN      = 1;
const WEEKLY_BONUS     = 5;
const REGEN_INTERVAL_H = 24;

export async function runTrustRecovery(): Promise<{
  processed: number;
  recovered: number;
  skipped:   number;
}> {
  let processed = 0;
  let recovered = 0;
  let skipped   = 0;

  try {
    // ✅ Parameterized interval — no SQL injection risk
    const eligible = await pool.query(
      `SELECT
         u.id,
         u.firebase_uid,
         u.trust_score,
         u.trust_regen_streak,
         u.last_trust_regen_at,
         u.last_flag_at
       FROM users u
       WHERE u.deleted_at IS NULL
         AND u.is_hard_banned = FALSE
         AND u.trust_score > 0
         AND u.trust_score < $1
         AND (
           u.last_flag_at IS NULL
           OR u.last_flag_at < NOW() - ($2 * INTERVAL '1 hour')
         )
         AND (
           u.last_trust_regen_at IS NULL
           OR u.last_trust_regen_at < NOW() - ($2 * INTERVAL '1 hour')
         )`,
      [MAX_AUTO_REGEN, REGEN_INTERVAL_H]
    );

    logger.info(`🔄 Trust recovery: ${eligible.rows.length} users eligible`);

    for (const user of eligible.rows) {
      processed++;

      const oldScore = user.trust_score as number;
      const streak   = (user.trust_regen_streak as number) + 1;
      const isWeekly = streak % 7 === 0;

      let gain = DAILY_REGEN;
      if (isWeekly) gain += WEEKLY_BONUS;

      const newScore = Math.min(MAX_AUTO_REGEN, oldScore + gain);

      if (newScore === oldScore) {
        skipped++;
        continue;
      }

      const isShadowBanned = newScore > 0 && newScore < 20;

      // ✅ Wrapped in transaction — UPDATE + INSERT are atomic
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        await client.query(
          `UPDATE users
           SET trust_score         = $1,
               is_shadow_banned    = $2,
               trust_regen_streak  = $3,
               last_trust_regen_at = NOW()
           WHERE id = $4`,
          [newScore, isShadowBanned, streak, user.id]
        );

        await client.query(
          `INSERT INTO trust_recovery_log
             (user_id, firebase_uid, old_score, new_score, reason)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            user.id,
            user.firebase_uid,
            oldScore,
            newScore,
            isWeekly ? "WEEKLY_STREAK_BONUS" : "DAILY_REGEN",
          ]
        );

        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        logger.error("Trust recovery row error", {
          uid:   (user.firebase_uid as string).substring(0, 8),
          error: err instanceof Error ? err.message : String(err),
        });
        skipped++;
        continue;
      } finally {
        client.release();
      }

      recovered++;

      logger.info("✅ Trust recovered", {
        uid:      (user.firebase_uid as string).substring(0, 8),
        score:    `${oldScore} → ${newScore}`,
        tier:     getTrustTier(newScore),
        streak,
        isWeekly,
      });
    }

    logger.info("✅ Trust recovery complete", { processed, recovered, skipped });
    return { processed, recovered, skipped };

  } catch (error: unknown) {
    logger.error("Trust recovery error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { processed, recovered, skipped };
  }
}
