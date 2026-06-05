import { PoolClient } from "pg";
import {
  toNumber,
  isFutureDate,
  calcMaxNerve,
  calcMaxLife,
  canAttemptCrime,
  getCooldownRemaining,
  isImmuneToAntiCheat,
  UserRow,
} from "../models/userModels";
import {
  parseCrime,
  parseProgress,
  parseSpecial,
  CrimeDefinition,
  CrimeProgress,
  CrimeSpecial,
} from "../models/crimeModels";
import {
  calcCrimeLevel,
  resolveCrimeOutcome,
  OutcomeResult,
} from "./crimeEngine";
import { applyShadowPunishment } from "./shadowPunish";
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
  JailError,
  RateLimitError,
} from "../utils/errors";

// ============================================================
// NOTE: UserRow is now imported from userModels.ts
// Single source of truth — no duplicate type definitions
// ============================================================

// ─── Pre-flight checks ───────────────────────────────────

export function assertCanAttempt(user: UserRow) {
  if (!canAttemptCrime(user.last_crime_at)) {
    throw new RateLimitError(
      `Slow down. Cooldown ${getCooldownRemaining(user.last_crime_at)}ms`
    );
  }

  if (isFutureDate(user.federal_jail_until)) {
    const seconds = Math.ceil(
      (new Date(user.federal_jail_until as string).getTime() - Date.now()) / 1000
    );
    throw new JailError(seconds, "federal");
  }

  if (isFutureDate(user.jail_until)) {
    const seconds = Math.ceil(
      (new Date(user.jail_until as string).getTime() - Date.now()) / 1000
    );
    throw new JailError(seconds, "normal");
  }
}

export function assertCrimeRequirements(user: UserRow, crime: CrimeDefinition) {
  if (toNumber(user.level) < crime.unlock_level) {
    throw new ForbiddenError(
      `You need to be level ${crime.unlock_level} to attempt this crime.`
    );
  }

  if (toNumber(user.nerve) < crime.nerve_cost) {
    throw new ValidationError("Not enough nerve.", {
      currentNerve:  toNumber(user.nerve),
      requiredNerve: crime.nerve_cost,
    });
  }
}

// ─── Loaders ─────────────────────────────────────────────

export async function loadCrime(
  client: PoolClient,
  crimeKey: string
): Promise<CrimeDefinition> {
  const result = await client.query(
    `SELECT * FROM crimes WHERE crime_key = $1 AND is_active = TRUE LIMIT 1`,
    [crimeKey]
  );
  if (result.rows.length === 0) {
    throw new NotFoundError("Crime");
  }
  return parseCrime(result.rows[0] as Record<string, unknown>);
}

export async function loadOrCreateProgress(
  client: PoolClient,
  userId: number,
  crimeId: number
): Promise<CrimeProgress> {
  await client.query(
    `INSERT INTO user_crime_progress (user_id, crime_id)
     VALUES ($1, $2) ON CONFLICT (user_id, crime_id) DO NOTHING`,
    [userId, crimeId]
  );

  const result = await client.query(
    `SELECT * FROM user_crime_progress
     WHERE user_id = $1 AND crime_id = $2 LIMIT 1`,
    [userId, crimeId]
  );
  return parseProgress(result.rows[0] as Record<string, unknown>);
}

export async function pickAvailableSpecial(
  client: PoolClient,
  userId: number,
  crimeId: number,
  crimeLevel: number
): Promise<CrimeSpecial | null> {
  const result = await client.query(
    `SELECT cs.* FROM crime_specials cs
     WHERE cs.crime_id = $1 AND cs.is_active = TRUE
       AND cs.unlock_crime_level <= $2
       AND NOT EXISTS (
         SELECT 1 FROM user_crime_specials ucs
         WHERE ucs.user_id = $3 AND ucs.crime_special_id = cs.id
       )`,
    [crimeId, crimeLevel, userId]
  );
  if (result.rows.length === 0) return null;
  const idx = Math.floor(Math.random() * result.rows.length);
  return parseSpecial(result.rows[idx] as Record<string, unknown>);
}

// ─── Persistence ─────────────────────────────────────────

export async function saveSpecialDiscovery(
  client: PoolClient,
  userId: number,
  specialId: number
): Promise<boolean> {
  const result = await client.query(
    `INSERT INTO user_crime_specials (user_id, crime_special_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, crime_special_id) DO NOTHING
     RETURNING id`,
    [userId, specialId]
  );
  return result.rows.length > 0;
}

export async function updateProgress(
  client: PoolClient,
  userId: number,
  crimeId: number,
  data: {
    crimeXp:            number;
    crimeLevel:         number;
    hiddenCpl:          number;
    attempts:           number;
    successes:          number;
    failures:           number;
    critFailures:       number;
    specialsFoundCount: number;
  }
) {
  await client.query(
    `UPDATE user_crime_progress
     SET crime_xp = $1, crime_level = $2, hidden_cpl = $3,
         attempts = $4, successes = $5, failures = $6,
         crit_failures = $7, specials_found_count = $8,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $9 AND crime_id = $10`,
    [
      data.crimeXp, data.crimeLevel, data.hiddenCpl,
      data.attempts, data.successes, data.failures,
      data.critFailures, data.specialsFoundCount,
      userId, crimeId,
    ]
  );
}

export async function updateUserStats(
  client: PoolClient,
  userId: number,
  data: {
    money:            number;
    points:           number;
    nerve:            number;
    maxNerve:         number;
    life:             number;
    maxLife:          number;
    jailUntil:        Date | null;
    federalJailUntil: Date | null;
  }
) {
  await client.query(
    `UPDATE users
     SET money = $1, points = $2, nerve = $3, max_nerve = $4,
         life = $5, max_life = $6, jail_until = $7,
         federal_jail_until = $8, last_crime_at = CURRENT_TIMESTAMP
     WHERE id = $9`,
    [
      data.money, data.points, data.nerve, data.maxNerve,
      data.life, data.maxLife, data.jailUntil, data.federalJailUntil,
      userId,
    ]
  );
}

export async function getTotalCrimeXp(
  client: PoolClient,
  userId: number
): Promise<number> {
  const result = await client.query(
    `SELECT COALESCE(SUM(crime_xp), 0) AS total_xp
     FROM user_crime_progress WHERE user_id = $1`,
    [userId]
  );
  return toNumber(result.rows[0]?.total_xp ?? 0);
}

// ─── Outcome calculation ─────────────────────────────────

export function calculateOutcome(
  crime:            CrimeDefinition,
  progress:         CrimeProgress,
  availableSpecial: CrimeSpecial | null,
  user:             UserRow,
  trustInfo:        { isShadowBanned: boolean; trustScore: number }
): OutcomeResult {
  const maxLife = calcMaxLife(toNumber(user.level));

  let outcome = resolveCrimeOutcome(
    crime,
    progress,
    availableSpecial,
    toNumber(user.money),
    maxLife
  );

  // 🛡️ Sync check — user already loaded, no extra DB hit needed
  const immune = isImmuneToAntiCheat(user);

  if (trustInfo.isShadowBanned && !immune) {
    outcome = applyShadowPunishment(outcome, trustInfo.trustScore, immune);
  }

  return outcome;
}

// ─── Stat builder ────────────────────────────────────────

export function buildUpdatedStats(
  user:         UserRow,
  crime:        CrimeDefinition,
  progress:     CrimeProgress,
  outcome:      OutcomeResult,
  totalCrimeXp: number
) {
  const playerLevel     = toNumber(user.level);
  const maxLife         = calcMaxLife(playerLevel);
  const updatedMaxNerve = calcMaxNerve(totalCrimeXp);

  const updatedNerve  = Math.max(0, toNumber(user.nerve) - crime.nerve_cost);
  const finalNerve    = Math.min(updatedNerve, updatedMaxNerve);

  const updatedMoney  = Math.max(0,
    toNumber(user.money) - outcome.money_loss + outcome.reward_money
  );
  const updatedPoints = Math.max(0,
    toNumber(user.points) + outcome.reward_points
  );
  const updatedLife   = Math.max(1, toNumber(user.life) - outcome.life_loss);

  const updatedCrimeXp    = Math.max(0,
    progress.crime_xp + outcome.xp_gained - outcome.xp_lost
  );
  const updatedCrimeLevel = calcCrimeLevel(updatedCrimeXp);
  const updatedHiddenCpl  = Math.max(0, progress.hidden_cpl + outcome.cpl_change);

  const attempts     = progress.attempts + 1;
  const successes    = progress.successes +
    (outcome.outcome === "success" || outcome.outcome === "special" ? 1 : 0);
  const failures     = progress.failures  +
    (outcome.outcome === "fail"      ? 1 : 0);
  const critFailures = progress.crit_failures +
    (outcome.outcome === "crit_fail" ? 1 : 0);

  let jailUntil: Date | null =
    user.jail_until ? new Date(user.jail_until) : null;
  let federalJailUntil: Date | null =
    user.federal_jail_until ? new Date(user.federal_jail_until) : null;

  if (outcome.outcome === "crit_fail" && outcome.jail_seconds > 0) {
    const until = new Date(Date.now() + outcome.jail_seconds * 1000);
    if (crime.is_federal) federalJailUntil = until;
    else                  jailUntil        = until;
  }

  return {
    money:            updatedMoney,
    points:           updatedPoints,
    nerve:            finalNerve,
    maxNerve:         updatedMaxNerve,
    life:             updatedLife,
    maxLife,
    jailUntil,
    federalJailUntil,
    crimeXp:          updatedCrimeXp,
    crimeLevel:       updatedCrimeLevel,
    hiddenCpl:        updatedHiddenCpl,
    attempts,
    successes,
    failures,
    critFailures,
  };
}
