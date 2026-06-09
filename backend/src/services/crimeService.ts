// ============================================================
// CRIME SERVICE — UNDERCITY
// Pre-flight checks, loaders, persistence, and stat builders.
// All DB operations use a passed PoolClient (caller manages tx).
// ============================================================

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

// FIX: Import CrimeOutcomeForPunish so the type contract between
// crimeService and shadowPunish is enforced at compile time.
// OutcomeResult and CrimeOutcomeForPunish have the same fields —
// importing the interface prevents silent divergence if either changes.
import {
  applyShadowPunishment,
  type CrimeOutcomeForPunish,
} from "./shadowPunish";
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
  JailError,
  HospitalError,
  RateLimitError,
} from "../utils/errors";

// ─── Pre-flight checks ────────────────────────────────────

export function assertCanAttempt(user: UserRow): void {
  if (!canAttemptCrime(user.last_crime_at)) {
    throw new RateLimitError(
      `Slow down. Cooldown ${getCooldownRemaining(user.last_crime_at)}ms`
    );
  }

  if (isFutureDate(user.hospital_until)) {
    const seconds = Math.ceil(
      (new Date(user.hospital_until as string).getTime() - Date.now()) / 1000
    );
    throw new HospitalError(seconds);
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

export function assertCrimeRequirements(user: UserRow, crime: CrimeDefinition): void {
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

// ─── Loaders ──────────────────────────────────────────────

export async function loadCrime(
  client:   PoolClient,
  crimeKey: string
): Promise<CrimeDefinition> {
  const result = await client.query(
    `SELECT * FROM crimes WHERE crime_key = $1 AND is_active = TRUE LIMIT 1`,
    [crimeKey]
  );
  if (result.rows.length === 0) throw new NotFoundError("Crime");
  return parseCrime(result.rows[0] as Record<string, unknown>);
}

export async function loadOrCreateProgress(
  client:  PoolClient,
  userId:  number,
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
  client:     PoolClient,
  userId:     number,
  crimeId:    number,
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

// ─── Persistence ──────────────────────────────────────────

export async function saveSpecialDiscovery(
  client:    PoolClient,
  userId:    number,
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
  client:  PoolClient,
  userId:  number,
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
): Promise<void> {
  await client.query(
    `UPDATE user_crime_progress
     SET crime_xp             = $1,
         crime_level          = $2,
         hidden_cpl           = $3,
         attempts             = $4,
         successes            = $5,
         failures             = $6,
         crit_failures        = $7,
         specials_found_count = $8,
         updated_at           = CURRENT_TIMESTAMP
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
): Promise<void> {
  await client.query(
    `UPDATE users
     SET money              = $1,
         points             = $2,
         nerve              = $3,
         max_nerve          = $4,
         life               = $5,
         max_life           = $6,
         jail_until         = $7,
         federal_jail_until = $8,
         last_crime_at      = CURRENT_TIMESTAMP
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

// ─── Outcome calculation ──────────────────────────────────

export function calculateOutcome(
  crime:            CrimeDefinition,
  progress:         CrimeProgress,
  availableSpecial: CrimeSpecial | null,
  user:             UserRow,
  trustInfo:        { isShadowBanned: boolean; trustScore: number }
): OutcomeResult {
  const maxLife = calcMaxLife(toNumber(user.level));

  const outcome = resolveCrimeOutcome(
    crime,
    progress,
    availableSpecial,
    toNumber(user.money),
    maxLife
  );

  const immune = isImmuneToAntiCheat(user);

  // Apply shadow punishment for all non-clean trust tiers.
  // trustScore < 70 = WATCHED, SUSPICIOUS, SHADOW_BANNED, HARD_BANNED.
  // Hard banned users never reach here — banCheck blocks them first.
  // immune users (admins/devs) always bypass.
  const shouldPunish = !immune && trustInfo.trustScore < 70;

  if (!shouldPunish) return outcome;

  // FIX: Cast through CrimeOutcomeForPunish to enforce the type contract.
  // OutcomeResult is a superset of CrimeOutcomeForPunish — all fields exist.
  // This cast makes TypeScript verify the contract at compile time.
  // If either type changes, this line will break loudly instead of silently.
  const punished = applyShadowPunishment(
    outcome as unknown as CrimeOutcomeForPunish,
    trustInfo.trustScore,
    immune
  );

  // Cast back — punished has same shape as OutcomeResult
  return punished as unknown as OutcomeResult;
}

// ─── Stat builder ─────────────────────────────────────────

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

  const updatedNerve = Math.max(0, toNumber(user.nerve) - crime.nerve_cost);
  const finalNerve   = Math.min(updatedNerve, updatedMaxNerve);

  // ── Money — debt mechanic ──────────────────────────────
  // Tier 1-2: crimeEngine caps money_loss so result should >= 0
  //   Defense-in-depth floor here as well.
  // Tier 3-5: money CAN go negative — intentional debt mechanic.
  const rawMoney = toNumber(user.money) - outcome.money_loss + outcome.reward_money;
  const updatedMoney = crime.tier <= 2
    ? Math.max(0, rawMoney)   // Tier 1-2: floor at 0, never debt
    : rawMoney;               // Tier 3-5: allow negative (debt mechanic)

  const updatedPoints = Math.max(0,
    toNumber(user.points) + outcome.reward_points
  );

  // Life: minimum 1 — players cannot die, just get very low
  const updatedLife = Math.max(1, toNumber(user.life) - outcome.life_loss);

  const updatedCrimeXp    = Math.max(0,
    progress.crime_xp + outcome.xp_gained - outcome.xp_lost
  );
  const updatedCrimeLevel = calcCrimeLevel(updatedCrimeXp);
  const updatedHiddenCpl  = Math.max(0, progress.hidden_cpl + outcome.cpl_change);

  const attempts     = progress.attempts + 1;
  const successes    = progress.successes +
    (outcome.outcome === "success" || outcome.outcome === "special" ? 1 : 0);
  const failures     = progress.failures +
    (outcome.outcome === "fail" ? 1 : 0);
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
