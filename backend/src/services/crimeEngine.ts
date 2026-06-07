// ============================================================
// CRIME ENGINE — Core outcome logic
// Weighted Outcome Resolver, XP, CPL, Jail, Rewards
//
// CRIT FAIL ECONOMY:
//   Tier 1-2: percentage of cash on hand, capped, never negative
//   Tier 3-5: flat amount taken directly, CAN go negative (debt)
//
// When money goes negative (tier 3+):
//   - Player can still commit crimes and earn money
//   - Player CANNOT buy anything until money >= 0
//   - Creates real risk for high-tier crime attempts
// ============================================================

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
// HELPERS
// ============================================================

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ============================================================
// CRIME LEVEL FROM XP
// ============================================================

export function calcCrimeLevel(xp: number): number {
  if (xp <= 0) return 0;
  const level = Math.floor(100 * Math.pow(xp / 500000, 0.45));
  return clamp(level, 0, 100);
}

export function xpForNextLevel(currentLevel: number): number {
  if (currentLevel >= 100) return 0;
  const nextLevel = currentLevel + 1;
  return Math.ceil(500000 * Math.pow(nextLevel / 100, 1 / 0.45));
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
  const levelFactor  = crimeLevel / 100;
  const cplFactor    = clamp(hiddenCpl / 200, 0, 1);
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
  const roll  = Math.random() * total;

  let cumulative = 0;
  for (const [outcome, weight] of Object.entries(weights)) {
    cumulative += weight;
    if (roll < cumulative) return outcome as OutcomeType;
  }

  return "fail";
}

// ============================================================
// CPL CHANGE PER OUTCOME
// ============================================================

function calcCplChange(outcome: OutcomeType, tier: number): number {
  const tierMult = 1 + (tier - 1) * 0.15;

  switch (outcome) {
    case "special":   return randomFloat(8, 15)  * tierMult;
    case "success":   return randomFloat(1, 4)   * tierMult;
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
//
// TIER 1-2: Percentage-based (safe for beginners)
//   Tier 1: lose 5-25% of cash, capped at $2,000, floor $0
//   Tier 2: lose 10-35% of cash, capped at $30,000, floor $0
//   Money NEVER goes below $0 for tier 1-2.
//
// TIER 3-5: Flat amount (brutal for veterans)
//   Tier 3: lose $50,000   – $200,000
//   Tier 4: lose $500,000  – $1,250,000
//   Tier 5: lose $2,500,000 – $5,000,000
//   Money CAN go negative (debt mechanic).
//
// For ALL tiers: EITHER money loss OR life loss, never both.
// ============================================================

const TIER_PCT_CONFIG: Record<number, { minPct: number; maxPct: number; cap: number }> = {
  1: { minPct: 0.05, maxPct: 0.25, cap: 2_000 },
  2: { minPct: 0.10, maxPct: 0.35, cap: 30_000 },
};

const TIER_FLAT_CONFIG: Record<number, [number, number]> = {
  3: [50_000,     200_000],
  4: [500_000,    1_250_000],
  5: [2_500_000,  5_000_000],
};

function calcCritPenalties(
  tier:       number,
  cashOnHand: number,
  maxLife:    number
): { money_loss: number; life_loss: number } {
  // 50/50: money loss OR life loss
  const loseMoney = Math.random() < 0.5;

  if (!loseMoney) {
    const lifeLossPct = randomFloat(0.2, 0.9);
    return {
      money_loss: 0,
      life_loss:  Math.floor(maxLife * lifeLossPct),
    };
  }

  // Tier 1-2: percentage of cash on hand, capped, never negative
  const pctConfig = TIER_PCT_CONFIG[tier];
  if (pctConfig) {
    const pct  = randomFloat(pctConfig.minPct, pctConfig.maxPct);
    const loss = Math.floor(Math.max(0, cashOnHand) * pct);
    return {
      money_loss: Math.min(loss, pctConfig.cap),
      life_loss:  0,
    };
  }

  // Tier 3-5: flat loss, CAN go negative (debt mechanic)
  const flatRange = TIER_FLAT_CONFIG[tier];
  if (flatRange) {
    return {
      money_loss: randomBetween(flatRange[0], flatRange[1]),
      life_loss:  0,
    };
  }

  // Fallback (should never hit)
  return { money_loss: 0, life_loss: 0 };
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
      money_loss   = penalties.money_loss;
      life_loss    = penalties.life_loss;
      jail_seconds = calcJailSeconds(crime, crime_level, hidden_cpl);

      if (money_loss > 0) {
        const wouldBeNegative = tier >= 3 && cashOnHand - money_loss < 0;
        if (wouldBeNegative) {
          message = `You got caught during ${crime.name}! Lost $${money_loss.toLocaleString()}. Your balance has gone negative — you're in debt until you earn it back.`;
        } else {
          message = `You got caught during ${crime.name}! Lost $${money_loss.toLocaleString()} and significant experience.`;
        }
      } else {
        message = `You got caught during ${crime.name}! You took serious damage and lost significant experience.`;
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
  const currentLevel    = calcCrimeLevel(xp);
  if (currentLevel >= 100) return 100;
  const currentLevelXp  = Math.ceil(500000 * Math.pow(currentLevel / 100, 1 / 0.45));
  const nextLevelXp     = Math.ceil(500000 * Math.pow((currentLevel + 1) / 100, 1 / 0.45));
  const range           = nextLevelXp - currentLevelXp;
  const progress        = xp - currentLevelXp;
  return Math.min(100, Math.max(0, Math.round((progress / range) * 100)));
}

// ============================================================
// REWARD SANITY CAP
// Absolute server-side ceiling regardless of engine output.
// Protects economy if crime data is corrupted or bugged.
// Tier 5 max is $10M — we cap at 2x that as a safety net.
// Log any hit so we know immediately if the engine is broken.
// ============================================================

export const MAX_SINGLE_CRIME_REWARD = 20_000_000;

export function applySanityCap(
  result:  OutcomeResult,
  crimeId: string,
  log:     (msg: string, meta: Record<string, unknown>) => void
): OutcomeResult {
  if (result.reward_money > MAX_SINGLE_CRIME_REWARD) {
    log("🚨 Crime reward sanity cap triggered", {
      crimeId,
      rawReward: result.reward_money,
      cappedAt:  MAX_SINGLE_CRIME_REWARD,
      outcome:   result.outcome,
    });
    return { ...result, reward_money: MAX_SINGLE_CRIME_REWARD };
  }
  return result;
}
