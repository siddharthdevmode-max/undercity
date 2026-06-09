// ============================================================
// UAC 2.0 — TRUST RECOVERY ENGINE
// Runs daily via BullMQ scheduler or admin trigger.
//
// ALGORITHM:
//   +1 trust per day of clean play (no flags in last 24h)
//   +5 bonus per 7-day clean streak
//   Max auto-regen = 70 (must appeal to reach 100)
//   Hard-banned users never recover automatically.
//
// BATCH PROCESSING:
//   Processes in batches of BATCH_SIZE to avoid holding
//   too many pool connections simultaneously.
//   Each row uses withTransaction() from config/database.ts.
//
// INTERVAL FIX:
//   $2 * INTERVAL '1 hour' is NOT valid PostgreSQL.
//   Correct form: ($2 || ' hours')::INTERVAL
// ============================================================

import { pool, withTransaction } from "../config/database";
import { logger }                from "../utils/logger";
import { getTrustTier }          from "./trustEngine";

const MAX_AUTO_REGEN   = 70;
const DAILY_REGEN      = 1;
const WEEKLY_BONUS     = 5;
const REGEN_INTERVAL_H = 24;
const BATCH_SIZE       = 500;

export interface TrustRecoveryResult {
  processed: number;
  recovered: number;
  skipped:   number;
  batches:   number;
}

export async function runTrustRecovery(): Promise<TrustRecoveryResult> {
  let processed = 0;
  let recovered = 0;
  let skipped   = 0;
  let batches   = 0;

  try {
    logger.info("🔄 Trust recovery starting...");

    const eligibleResult = await pool.query(
      `SELECT
         u.id,
         u.firebase_uid,
         u.trust_score,
         COALESCE(u.trust_regen_streak, 0) AS trust_regen_streak,
         u.last_trust_regen_at,
         u.last_flag_at
       FROM users u
       WHERE u.deleted_at     IS NULL
         AND u.is_hard_banned  = FALSE
         AND u.trust_score     > 0
         AND u.trust_score     < $1
         AND (
           u.last_flag_at IS NULL
           OR u.last_flag_at < NOW() - ($2 || ' hours')::INTERVAL
         )
         AND (
           u.last_trust_regen_at IS NULL
           OR u.last_trust_regen_at < NOW() - ($2 || ' hours')::INTERVAL
         )
       ORDER BY u.trust_score ASC`,
      [MAX_AUTO_REGEN, REGEN_INTERVAL_H]
    );

    const eligible = eligibleResult.rows as Array<{
      id:                  number;
      firebase_uid:        string;
      trust_score:         number;
      trust_regen_streak:  number;
      last_trust_regen_at: Date | null;
      last_flag_at:        Date | null;
    }>;

    logger.info(`🔄 Trust recovery: ${eligible.length} users eligible`);

    for (let batchStart = 0; batchStart < eligible.length; batchStart += BATCH_SIZE) {
      const batch = eligible.slice(batchStart, batchStart + BATCH_SIZE);
      batches++;

      const batchResults = await Promise.allSettled(
        batch.map((user) => recoverUser(user))
      );

      for (const result of batchResults) {
        processed++;
        if (result.status === "fulfilled") {
          if (result.value) recovered++;
          else               skipped++;
        } else {
          skipped++;
          logger.error("Trust recovery: row error", {
            error: result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
          });
        }
      }

      logger.debug(`✅ Trust recovery batch ${batches} complete`, {
        batchSize: batch.length,
        recovered,
        skipped,
      });
    }

    logger.info("✅ Trust recovery complete", {
      processed,
      recovered,
      skipped,
      batches,
    });

    return { processed, recovered, skipped, batches };

  } catch (err) {
    logger.error("TrustRecovery: fatal error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { processed, recovered, skipped, batches };
  }
}

async function recoverUser(user: {
  id:                 number;
  firebase_uid:       string;
  trust_score:        number;
  trust_regen_streak: number;
}): Promise<boolean> {
  const oldScore = user.trust_score;
  const streak   = user.trust_regen_streak + 1;
  const isWeekly = streak % 7 === 0;
  const gain     = DAILY_REGEN + (isWeekly ? WEEKLY_BONUS : 0);
  const newScore = Math.min(MAX_AUTO_REGEN, oldScore + gain);

  if (newScore === oldScore) return false;

  const isShadowBanned = newScore > 0 && newScore < 20;
  const reason         = isWeekly ? "WEEKLY_STREAK_BONUS" : "DAILY_REGEN";

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE users
       SET    trust_score         = $1,
              is_shadow_banned    = $2,
              trust_regen_streak  = $3,
              last_trust_regen_at = NOW(),
              updated_at          = NOW()
       WHERE  id = $4`,
      [newScore, isShadowBanned, streak, user.id]
    );

    await client.query(
      `INSERT INTO trust_recovery_log
         (user_id, firebase_uid, old_score, new_score, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, user.firebase_uid, oldScore, newScore, reason]
    );
  });

  logger.debug("✅ Trust recovered", {
    uid:      user.firebase_uid.substring(0, 8),
    score:    `${oldScore} → ${newScore}`,
    tier:     getTrustTier(newScore),
    streak,
    isWeekly,
  });

  return true;
}
