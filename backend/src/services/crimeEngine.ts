// ============================================================
// CRIME ENGINE — Core outcome logic
// Weighted Outcome Resolver, XP, CPL, Jail, Rewards
//
// CRIT FAIL ECONOMY:
//   Tier 1-2: percentage of cash on hand, capped, never negative
//   Tier 3-5: flat amount taken directly, CAN go negative (debt)
//
// SECURITY: Uses crypto.randomInt for all outcome rolls.
// Math.random() is predictable — a sophisticated attacker could
// fingerprint the PRNG state and predict crime outcomes.
// ============================================================

import { randomInt } from "crypto";
import {
  CrimeDefinition,
  CrimeProgress,
  CrimeSpecial,
} from "../models/crimeModels";

// ============================================================
// TYPES
// ============================================================

export type OutcomeType = "special" | "success" | "fail" | "crit_fail";

export interface OutcomeResult {
  outcome:       OutcomeType;
  reward_money:  number;
  reward_points: number;
  xp_gained:     number;
  xp_lost:       number;
  cpl_change:    number;
  jail_seconds:  number;
  life_loss:     number;
  money_loss:    number;
  special:       CrimeSpecial | null;
  message:       string;
}

// ============================================================
// SECURE RANDOM HELPERS
// BUG FIX: crypto.randomInt instead of Math.random()
// Math.random() is a predictable PRNG — attackers can fingerprint
// the RNG state after enough observations and predict outcomes.
// ============================================================

/**
 * Cryptographically secure integer in [min, max] inclusive.
 */
function randomBetween(min: number, max: number): number {
  if (min === max) return min;
  return randomInt(min, max + 1);
}

/**
 * Cryptographically secure float in [min, max).
 * Uses randomInt scaled to 1,000,000 resolution.
 */
function randomFloat(min: number, max: number): number {
  const RESOLUTION = 1_000_000;
  const scaled = randomInt(0, RESOLUTION);
  return min + (scaled / RESOLUTION) * (max - min);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ============================================================
// CRIME LEVEL FROM XP
// ============================================================

export function calcCrimeLevel(xp: number): number {
  if (xp <= 0) return 0;
  const level = Math.floor(100 * Math.pow(xp / 500_000, 0.45));
  return clamp(level, 0, 100);
}

export function xpForNextLevel(currentLevel: number): number {
  if (currentLevel >= 100) return 0;
  const nextLevel = currentLevel + 1;
  return Math.ceil(500_000 * Math.pow(nextLevel / 100, 1 / 0.45));
}

// ============================================================
// WEIGHTED OUTCOME RESOLVER
// ============================================================

function buildOutcomeWeights(
  tier:                number,
  crimeLevel:          number,
  hiddenCpl:           number,
  hasAvailableSpecial: boolean
): Record<OutcomeType, number> {
  const levelFactor   = crimeLevel / 100;
  const cplFactor     = clamp(hiddenCpl / 200, 0, 1);
  const masteryFactor = (levelFactor * 0.6) + (cplFactor * 0.4);

  const tierBaseCrit: Record<number, number> = {
    1: 5, 2: 10, 3: 18, 4: 25, 5: 32,
  };
  const tierCritFloor: Record<number, number> = {
    1: 1, 2: 2, 3: 3, 4: 4, 5: 5,
  };
  const tierBaseSuccess: Record<number, number> = {
    1: 62, 2: 48, 3: 35, 4: 28, 5: 22,
  };

  const baseCrit    = tierBaseCrit[tier]    ?? tierBaseCrit[3]!;
  const critFloor   = tierCritFloor[tier]   ?? tierCritFloor[3]!;
  const successBase = tierBaseSuccess[tier] ?? tierBaseSuccess[3]!;

  const critWeight = Math.max(
    critFloor,
    Math.round(baseCrit - masteryFactor * (baseCrit - critFloor))
  );

  const specialWeight  = hasAvailableSpecial ? 3 : 0;
  const successCeiling = 100 - critFloor - specialWeight - 3;

  const successWeight = Math.min(
    successCeiling,
    Math.round(successBase + masteryFactor * (successCeiling - successBase))
  );

  const failWeight = Math.max(
    3,
    100 - critWeight - specialWeight - successWeight
  );

  return {
    special:   specialWeight,
    success:   successWeight,
    fail:      failWeight,
    crit_fail: critWeight,
  };
}

function rollOutcome(weights: Record<OutcomeType, number>): OutcomeType {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);

  // BUG FIX: guard against zero or negative total (weight bug upstream)
  if (total <= 0) {
    return "fail";
  }

  // BUG FIX: use crypto.randomInt for the roll
  // Scale to integer space to use randomInt
  const roll = randomInt(0, total);

  let cumulative = 0;
  for (const [outcome, weight] of Object.entries(weights)) {
    cumulative += weight;
    if (roll < cumulative) return outcome as OutcomeType;
  }

  // Should never reach here with valid weights — defensive fallback
  return "fail";
}

// ============================================================
// CPL CHANGE PER OUTCOME
// ============================================================

function calcCplChange(outcome: OutcomeType, tier: number): number {
  const tierMult = 1 + (tier - 1) * 0.15;

  switch (outcome) {
    case "special":   return randomFloat(8, 15)   * tierMult;
    case "success":   return randomFloat(1, 4)    * tierMult;
    case "fail":      return -randomFloat(0.5, 2) * tierMult;
    case "crit_fail": return -randomFloat(4, 10)  * tierMult;
    default:          return 0;
  }
}

// ============================================================
// XP GAIN / LOSS PER OUTCOME
// ============================================================

function calcXpChange(
  outcome: OutcomeType,
  tier:    number
): { xp_gained: number; xp_lost: number } {
  const tierMult = tier * 1.5;

  switch (outcome) {
    case "special":
      return { xp_gained: Math.round(randomBetween(800, 1500) * tierMult), xp_lost: 0 };
    case "success":
      return { xp_gained: Math.round(randomBetween(80, 200)   * tierMult), xp_lost: 0 };
    case "fail":
      return { xp_gained: 0, xp_lost: Math.round(randomBetween(20, 50)   * tierMult) };
    case "crit_fail":
      return { xp_gained: 0, xp_lost: Math.round(randomBetween(200, 375) * tierMult) };
    default:
      return { xp_gained: 0, xp_lost: 0 };
  }
}

// ============================================================
// JAIL TIME RESOLVER
// ============================================================

export function calcJailSeconds(
  crime:      CrimeDefinition,
  crimeLevel: number,
  hiddenCpl:  number
): number {
  if (crime.jail_min_seconds === 0 && crime.jail_max_seconds === 0) return 0;

  const masteryFactor = clamp(
    (crimeLevel / 100) * 0.6 + clamp(hiddenCpl / 200, 0, 1) * 0.4,
    0,
    1
  );

  const range     = crime.jail_max_seconds - crime.jail_min_seconds;
  const reduction = Math.floor(masteryFactor * range * 0.75);
  const jailSec   = crime.jail_max_seconds - reduction;

  return clamp(jailSec, crime.jail_min_seconds, crime.jail_max_seconds);
}

// ============================================================
// MONEY REWARD RESOLVER
// ============================================================

function calcReward(crime: CrimeDefinition): number {
  return randomBetween(crime.min_reward, crime.max_reward);
}

// ============================================================
// CRIT FAIL PENALTIES
// ============================================================

const TIER_PCT_CONFIG: Record<number, { minPct: number; maxPct: number; cap: number }> = {
  1: { minPct: 0.05, maxPct: 0.25, cap: 2_000 },
  2: { minPct: 0.10, maxPct: 0.35, cap: 30_000 },
};

const TIER_FLAT_CONFIG: Record<number, [number, number]> = {
  3: [50_000,    200_000],
  4: [500_000,   1_250_000],
  5: [2_500_000, 5_000_000],
};

export interface CritPenalties {
  money_loss: number;
  life_loss:  number;
  skipJail:   boolean;
}

export function calcCritPenalties(
  tier:       number,
  cashOnHand: number,
  maxLife:    number
): CritPenalties {
  // BUG FIX: crypto.randomInt for the 50/50 split
  const loseMoney = randomInt(0, 2) === 0;

  if (!loseMoney) {
    const lifeLossPct = randomFloat(0.2, 0.75); // capped at 75% max life loss
    return {
      money_loss: 0,
      life_loss:  Math.floor(maxLife * lifeLossPct),
      skipJail:   true,
    };
  }

  const pctConfig = TIER_PCT_CONFIG[tier];
  if (pctConfig) {
    const pct  = randomFloat(pctConfig.minPct, pctConfig.maxPct);
    const loss = Math.floor(Math.max(0, cashOnHand) * pct);
    return {
      money_loss: Math.min(loss, pctConfig.cap),
      life_loss:  0,
      skipJail:   false,
    };
  }

  const flatRange = TIER_FLAT_CONFIG[tier];
  if (flatRange) {
    return {
      money_loss: randomBetween(flatRange[0], flatRange[1]),
      life_loss:  0,
      skipJail:   false,
    };
  }

  return { money_loss: 0, life_loss: 0, skipJail: false };
}

// ============================================================
// MAIN RESOLVE FUNCTION
// ============================================================

export function resolveCrimeOutcome(
  crime:            CrimeDefinition,
  progress:         CrimeProgress,
  availableSpecial: CrimeSpecial | null,
  cashOnHand:       number,
  maxLife:          number
): OutcomeResult {
  const { tier }                    = crime;
  const { crime_level, hidden_cpl } = progress;

  const weights = buildOutcomeWeights(
    tier,
    crime_level,
    hidden_cpl,
    availableSpecial !== null
  );

  const outcome = rollOutcome(weights);

  const { xp_gained, xp_lost } = calcXpChange(outcome, tier);
  const cpl_change              = calcCplChange(outcome, tier);

  let reward_money:  number              = 0;
  let reward_points: number              = 0;
  let jail_seconds:  number              = 0;
  let life_loss:     number              = 0;
  let money_loss:    number              = 0;
  let special:       CrimeSpecial | null = null;
  let message:       string              = "";

  switch (outcome) {
    case "special":
      special       = availableSpecial!;
      reward_money  = special.reward_money;
      reward_points = special.reward_points;
      message       = special.description;
      break;

    case "success":
      reward_money = calcReward(crime);
      message = `You successfully pulled off ${crime.name} and earned $${reward_money.toLocaleString()}.`;
      break;

    case "fail":
      message = `You attempted ${crime.name} but couldn't pull it off. You lost some experience.`;
      break;

    case "crit_fail": {
      const penalties = calcCritPenalties(tier, cashOnHand, maxLife);
      money_loss = penalties.money_loss;
      life_loss  = penalties.life_loss;

      if (!penalties.skipJail) {
        jail_seconds = calcJailSeconds(crime, crime_level, hidden_cpl);
      }

      if (money_loss > 0) {
        const wouldBeNegative = tier >= 3 && cashOnHand - money_loss < 0;
        if (wouldBeNegative) {
          message = `You got caught during ${crime.name}! Lost $${money_loss.toLocaleString()}. You're now in debt.`;
        } else {
          message = `You got caught during ${crime.name}! Lost $${money_loss.toLocaleString()}.`;
        }
      } else {
        message = `You got caught during ${crime.name}! You took serious damage.`;
      }
      break;
    }
  }

  return {
    outcome,
    reward_money,
    reward_points,
    xp_gained,
    xp_lost,
    cpl_change,
    jail_seconds,
    life_loss,
    money_loss,
    special,
    message,
  };
}

// ============================================================
// LEVEL PROGRESS HELPERS
// ============================================================

export function calcLevelProgress(xp: number): number {
  if (xp <= 0) return 0;
  const currentLevel   = calcCrimeLevel(xp);
  if (currentLevel >= 100) return 100;
  const currentLevelXp = Math.ceil(500_000 * Math.pow(currentLevel / 100, 1 / 0.45));
  const nextLevelXp    = Math.ceil(500_000 * Math.pow((currentLevel + 1) / 100, 1 / 0.45));
  const range          = nextLevelXp - currentLevelXp;
  const progress       = xp - currentLevelXp;
  return Math.min(100, Math.max(0, Math.round((progress / range) * 100)));
}

// ============================================================
// REWARD SANITY CAP
// ============================================================

export const MAX_SINGLE_CRIME_REWARD = 20_000_000;

export function applySanityCap(
  result:  OutcomeResult,
  crimeId: string,
  // BUG FIX: accept logger object directly — avoids 'this' context loss
  log:     { warn: (msg: string, meta: Record<string, unknown>) => void }
): OutcomeResult {
  if (result.reward_money > MAX_SINGLE_CRIME_REWARD) {
    log.warn("Crime reward sanity cap triggered", {
      crimeId,
      rawReward: result.reward_money,
      cappedAt:  MAX_SINGLE_CRIME_REWARD,
      outcome:   result.outcome,
    });
    return { ...result, reward_money: MAX_SINGLE_CRIME_REWARD };
  }
  return result;
}
