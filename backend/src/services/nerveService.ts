// ============================================================
// NERVE SERVICE — UNDERCITY
//
// Tier-aware nerve regeneration via per-user timestamp.
// The game tick calls regenNerveByTier() every 60s.
// Each tier runs a batched UPDATE — efficient, no per-user loops.
//
// citizen and player share the same regen rate (300s).
// They are combined into a single query for efficiency.
// ============================================================

import { Pool, PoolClient } from "pg";
import { tickPool as pool } from "../config/database";
import { logger }           from "../utils/logger";
import { TIER_CONFIG, type UserTier } from "../config/tiers";

// ── Types ──────────────────────────────────────────────────

export interface NerveRegenResult {
  player_citizen: number;   // combined (same regen rate)
  contributor:    number;
  total:          number;
}

// ── Main regen function (called from gameTick) ─────────────

export async function regenNerveByTier(): Promise<NerveRegenResult> {
  // BUG FIX: player and citizen share 300s regen rate — combine into one query
  // contributor is 180s — separate query

  const [combinedResult, contribResult] = await Promise.allSettled([
    regenNerveForTiers(["player", "citizen"], TIER_CONFIG.player.nerveRegenSec),
    regenNerveForTiers(["contributor"],       TIER_CONFIG.contributor.nerveRegenSec),
  ]);

  const playerCitizen = combinedResult.status === "fulfilled"
    ? combinedResult.value
    : (logger.error("Nerve regen failed for player/citizen", {
        error: (combinedResult as PromiseRejectedResult).reason?.message,
      }), 0);

  const contributor = contribResult.status === "fulfilled"
    ? contribResult.value
    : (logger.error("Nerve regen failed for contributor", {
        error: (contribResult as PromiseRejectedResult).reason?.message,
      }), 0);

  return {
    player_citizen: playerCitizen,
    contributor,
    total: playerCitizen + contributor,
  };
}

// ── Per-tier-group regen ───────────────────────────────────

async function regenNerveForTiers(
  tiers:    UserTier[],
  regenSec: number
): Promise<number> {
  // Process in batches to reduce lock contention on large tables
  // BUG FIX: LIMIT 500 per batch — avoids locking thousands of rows simultaneously
  const BATCH_SIZE = 500;
  let totalUpdated = 0;

  const tierParams = tiers.map((_, i) => `$${i + 2}`).join(", ");

   
  while (true) {
    const result = await pool.query(
      `UPDATE users
       SET    nerve             = LEAST(nerve + 1, max_nerve),
              last_nerve_update = NOW(),
              updated_at        = NOW()
       WHERE  id IN (
         SELECT id FROM users
         WHERE  user_tier  = ANY(ARRAY[${tierParams}]::varchar[])
           AND  nerve      < max_nerve
           AND  deleted_at IS NULL
           AND  EXTRACT(EPOCH FROM (
                  NOW() - COALESCE(last_nerve_update, '1970-01-01'::timestamptz)
                )) >= $1
         LIMIT ${BATCH_SIZE}
       )
       RETURNING id`,
      [regenSec, ...tiers]
    );

    const batchCount = result.rowCount ?? 0;
    totalUpdated += batchCount;

    if (batchCount < BATCH_SIZE) break; // no more rows to process
  }

  if (totalUpdated > 0) {
    logger.debug(`Nerve regen [${tiers.join("/")}]: ${totalUpdated} users (+1 nerve)`, {
      tiers,
      regenSec,
      updated: totalUpdated,
    });
  }

  return totalUpdated;
}

// ── Deduct nerve (used by crimeService) ────────────────────

export async function deductNerve(
  userId: number,
  amount: number,
  // BUG FIX: correct union type — both Pool and PoolClient have .query()
  client?: PoolClient | Pool
): Promise<{ success: boolean; currentNerve: number }> {
  const db = client ?? pool;

  const result = await db.query(
    `UPDATE users
     SET    nerve      = nerve - $2,
            updated_at = NOW()
     WHERE  id         = $1
       AND  nerve      >= $2
       AND  deleted_at IS NULL
     RETURNING nerve`,
    [userId, amount]
  );

  if ((result.rowCount ?? 0) === 0) {
    const current = await db.query(
      `SELECT nerve FROM users WHERE id = $1`,
      [userId]
    );
    return {
      success:      false,
      currentNerve: current.rows[0]?.nerve ?? 0,
    };
  }

  return {
    success:      true,
    currentNerve: result.rows[0].nerve as number,
  };
}

// ── Get nerve status for a user ────────────────────────────

export interface NerveStatus {
  nerve:            number;
  maxNerve:         number;
  tier:             UserTier;
  regenRateSec:     number;
  secondsUntilNext: number;
}

export async function getNerveStatus(userId: number): Promise<NerveStatus | null> {
  const result = await pool.query(
    `SELECT nerve, max_nerve, user_tier, last_nerve_update
     FROM   users
     WHERE  id         = $1
       AND  deleted_at IS NULL`,
    [userId]
  );

  const row = result.rows[0];
  if (!row) return null;

  const tier      = (row.user_tier as UserTier) ?? "player";
  const regenSec  = TIER_CONFIG[tier].nerveRegenSec;
  const lastUpdate = row.last_nerve_update
    ? new Date(row.last_nerve_update as string).getTime()
    : 0;

  const elapsed          = (Date.now() - lastUpdate) / 1_000;
  const secondsUntilNext = (row.nerve as number) >= (row.max_nerve as number)
    ? 0
    : Math.max(0, Math.ceil(regenSec - elapsed));

  return {
    nerve:            row.nerve as number,
    maxNerve:         row.max_nerve as number,
    tier,
    regenRateSec:     regenSec,
    secondsUntilNext,
  };
}
