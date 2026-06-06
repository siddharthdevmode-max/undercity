// ============================================================
// NERVE SERVICE — UNDERCITY
//
// Tier-aware nerve regeneration.
//
// STRATEGY:
//   Instead of one global timer for all users, we use
//   per-tier SQL updates with different time thresholds.
//
//   The game tick runs every 60s. On each tick, this service
//   checks each tier group:
//     - player/citizen:  regen if last_nerve_update >= 5 min ago
//     - contributor:     regen if last_nerve_update >= 3 min ago
//
//   Uses a per-user `last_nerve_update` timestamp so regen
//   is accurate even across server restarts.
//
// WHY PER-USER TIMESTAMP?
//   A global Redis timer breaks when:
//   - Server restarts mid-cycle
//   - Users log in after being offline
//   - Different tiers need different intervals
//
//   Per-user `last_nerve_update` in the DB is the source of truth.
//   No Redis dependency for correctness.
// ============================================================

import { pool }                       from "../config/database";
import { logger }                     from "../utils/logger";
import { TIER_CONFIG, type UserTier } from "../config/tiers";

// ── Types ──────────────────────────────────────────────────

export interface NerveRegenResult {
  player:      number;
  citizen:     number;
  contributor: number;
  total:       number;
}

// ── Main regen function (called from gameTick) ─────────────

export async function regenNerveByTier(): Promise<NerveRegenResult> {
  const results: NerveRegenResult = {
    player:      0,
    citizen:     0,
    contributor: 0,
    total:       0,
  };

  const tiers: UserTier[] = ["player", "citizen", "contributor"];

  // Run each tier update concurrently
  const updates = await Promise.allSettled(
    tiers.map((tier) => regenNerveForTier(tier))
  );

  updates.forEach((result, i) => {
    const tier = tiers[i]!;
    if (result.status === "fulfilled") {
      results[tier] = result.value;
      results.total += result.value;
    } else {
      logger.error(`❌ Nerve regen failed for tier: ${tier}`, {
        error: result.reason?.message,
      });
    }
  });

  return results;
}

// ── Per-tier regen ─────────────────────────────────────────

async function regenNerveForTier(tier: UserTier): Promise<number> {
  const regenSec = TIER_CONFIG[tier].nerveRegenSec;

  // UPDATE users whose nerve is below max AND enough time has passed
  // since their last nerve update for their tier's regen interval.
  //
  // COALESCE handles users who have never had last_nerve_update set
  // (defaults to epoch 0 → will always qualify for regen).
  const result = await pool.query(
    `UPDATE users
     SET    nerve             = LEAST(nerve + 1, max_nerve),
            last_nerve_update = NOW(),
            updated_at        = NOW()
     WHERE  user_tier         = $1
       AND  nerve             < max_nerve
       AND  deleted_at        IS NULL
       AND  EXTRACT(EPOCH FROM (NOW() - COALESCE(last_nerve_update, '1970-01-01'::timestamptz)))
              >= $2
     RETURNING id`,
    [tier, regenSec]
  );

  const count = result.rowCount ?? 0;

  if (count > 0) {
    logger.debug(`🧠 Nerve regen [${tier}]: ${count} users (+1 nerve)`, {
      tier,
      regenSec,
      updated: count,
    });
  }

  return count;
}

// ── Deduct nerve (used by crimeService) ────────────────────

export async function deductNerve(
  userId: number,
  amount: number,
  client?: import("pg").PoolClient
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

  if (result.rowCount === 0) {
    // Not enough nerve — fetch current value
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
    currentNerve: result.rows[0].nerve,
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
     WHERE  id = $1
       AND  deleted_at IS NULL`,
    [userId]
  );

  const row = result.rows[0];
  if (!row) return null;

  const tier      = (row.user_tier as UserTier) ?? "player";
  const regenSec  = TIER_CONFIG[tier].nerveRegenSec;
  const lastUpdate = row.last_nerve_update
    ? new Date(row.last_nerve_update).getTime()
    : 0;

  const elapsed         = (Date.now() - lastUpdate) / 1_000;
  const secondsUntilNext = row.nerve >= row.max_nerve
    ? 0
    : Math.max(0, Math.ceil(regenSec - elapsed));

  return {
    nerve:            row.nerve,
    maxNerve:         row.max_nerve,
    tier,
    regenRateSec:     regenSec,
    secondsUntilNext,
  };
}
