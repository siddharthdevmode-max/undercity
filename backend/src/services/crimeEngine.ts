// ============================================================
// CRIME ENGINE — Core outcome logic
// Weighted Outcome Resolver, XP, CPL, Jail, Rewards
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
  outcome: OutcomeType;
  reward_money: number;
  reward_points: number;
  xp_gained: number;
  xp_lost: number;
  cpl_change: number;
  jail_seconds: number;
  life_loss: number;
  money_loss: number;
  special: CrimeSpecial | null;
  message: string;
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
// Exponential curve — harder to level up as you go higher
// Level 0 = 0 XP
// Level 100 = ~500,000 XP
// Level CAN drop if XP drops (fail/crit_fail)
// XP floor = 0
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
// Uses crime level + hidden CPL to build outcome weights
// Never allows 100% success or 0% crit
// Tier 1 is more forgiving than higher tiers
// ============================================================

function buildOutcomeWeights(
  tier: number,
  crimeLevel: number,
  hiddenCpl: number,
  hasAvailableSpecial: boolean
): Record<OutcomeType, number> {

  const levelFactor = crimeLevel / 100;
  const cplFactor = clamp(hiddenCpl / 200, 0, 1);
  const masteryFactor = (levelFactor * 0.6) + (cplFactor * 0.4);

  // Base crit rates per tier — tier 1 is very forgiving
  const tierBaseCrit: Record<number, number> = {
    1: 5,
    2: 10,
    3: 18,
    4: 25,
    5: 32,
  };

  // Minimum crit floor — always some danger
  const tierCritFloor: Record<number, number> = {
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
  };

  // Base success per tier — tier 1 starts generous
  const tierBaseSuccess: Record<number, number> = {
    1: 62,
    2: 48,
    3: 35,
    4: 28,
    5: 22,
  };

  // Fallback to tier 3 behavior if somehow invalid tier
  const baseCrit = tierBaseCrit[tier] ?? tierBaseCrit[3];
  const critFloor = tierCritFloor[tier] ?? tierCritFloor[3];
  const successBase = tierBaseSuccess[tier] ?? tierBaseSuccess[3];

  const critWeight = Math.max(
    critFloor,
    Math.round(baseCrit - masteryFactor * (baseCrit - critFloor))
  );

  // Special weight — only if one is available
  const specialWeight = hasAvailableSpecial ? 3 : 0;

  const successCeiling = 100 - critFloor - specialWeight - 3;

  const successWeight = Math.min(
    successCeiling,
    Math.round(successBase + masteryFactor * (successCeiling - successBase))
  );

  // Fail gets the remainder
  const failWeight = Math.max(
    3,
    100 - critWeight - specialWeight - successWeight
  );

  return {
    special: specialWeight,
    success: successWeight,
    fail: failWeight,
    crit_fail: critWeight,
  };
}

function rollOutcome(weights: Record<OutcomeType, number>): OutcomeType {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const roll = Math.random() * total;

  let cumulative = 0;
  for (const [outcome, weight] of Object.entries(weights)) {
    cumulative += weight;
    if (roll < cumulative) return outcome as OutcomeType;
  }

  return "fail";
}

// ============================================================
// CPL CHANGE PER OUTCOME
// Tier-aware: higher tier = bigger CPL swings
// ============================================================

function calcCplChange(outcome: OutcomeType, tier: number): number {
  const tierMult = 1 + (tier - 1) * 0.15;

  switch (outcome) {
    case "special":
      return randomFloat(8, 15) * tierMult;
    case "success":
      return randomFloat(1, 4) * tierMult;
    case "fail":
      return -randomFloat(0.5, 2) * tierMult;
    case "crit_fail":
      return -randomFloat(4, 10) * tierMult;
    default:
      return 0;
  }
}

// ============================================================
// XP GAIN / LOSS PER OUTCOME
//
// success    = gain  80-200   × tierMult
// special    = gain  800-1500 × tierMult
// fail       = lose  20-50   × tierMult  (0.25 of success)
// crit_fail  = lose  200-375  × tierMult  (0.25 of special)
//
// XP floor = 0 (handled in controller)
// ============================================================

function calcXpChange(
  outcome: OutcomeType,
  tier: number
): { xp_gained: number; xp_lost: number } {
  const tierMult = tier * 1.5;

  switch (outcome) {
    case "special":
      return {
        xp_gained: Math.round(randomBetween(800, 1500) * tierMult),
        xp_lost: 0,
      };
    case "success":
      return {
        xp_gained: Math.round(randomBetween(80, 200) * tierMult),
        xp_lost: 0,
      };
    case "fail":
      return {
        xp_gained: 0,
        xp_lost: Math.round(randomBetween(20, 50) * tierMult),
      };
    case "crit_fail":
      return {
        xp_gained: 0,
        xp_lost: Math.round(randomBetween(200, 375) * tierMult),
      };
    default:
      return { xp_gained: 0, xp_lost: 0 };
  }
}

// ============================================================
// JAIL TIME RESOLVER
// Higher mastery = closer to min jail time
// ============================================================

export function calcJailSeconds(
  crime: CrimeDefinition,
  crimeLevel: number,
  hiddenCpl: number
): number {
  if (crime.jail_min_seconds === 0 && crime.jail_max_seconds === 0) return 0;

  const masteryFactor = clamp(
    (crimeLevel / 100) * 0.6 + clamp(hiddenCpl / 200, 0, 1) * 0.4,
    0,
    1
  );

  const range = crime.jail_max_seconds - crime.jail_min_seconds;
  const reduction = Math.floor(masteryFactor * range * 0.75);
  const jailSeconds = crime.jail_max_seconds - reduction;

  return clamp(jailSeconds, crime.jail_min_seconds, crime.jail_max_seconds);
}

// ============================================================
// MONEY REWARD RESOLVER
// ============================================================

function calcReward(crime: CrimeDefinition): number {
  return randomBetween(crime.min_reward, crime.max_reward);
}

// ============================================================
// CRIT FAIL PENALTIES
// EITHER money loss OR life loss — never both
// ============================================================

function calcCritPenalties(
  cashOnHand: number,
  maxLife: number
): { money_loss: number; life_loss: number } {
  const loseMoney = Math.random() < 0.5;

  if (loseMoney) {
    const moneyLossPct = randomFloat(0.001, 0.01); // 0.1% to 1%
    return {
      money_loss: Math.floor(cashOnHand * moneyLossPct),
      life_loss: 0,
    };
  } else {
    const lifeLossPct = randomFloat(0.2, 0.9); // 20% to 90% of max life
    return {
      money_loss: 0,
      life_loss: Math.floor(maxLife * lifeLossPct),
    };
  }
}

// ============================================================
// MAIN RESOLVE FUNCTION
// ============================================================

export function resolveCrimeOutcome(
  crime: CrimeDefinition,
  progress: CrimeProgress,
  availableSpecial: CrimeSpecial | null,
  cashOnHand: number,
  maxLife: number
): OutcomeResult {

  const { tier } = crime;
  const { crime_level, hidden_cpl } = progress;

  // Build weights and roll outcome
  const weights = buildOutcomeWeights(
    tier,
    crime_level,
    hidden_cpl,
    availableSpecial !== null
  );

  const outcome = rollOutcome(weights);

  // Calculate XP and CPL changes
  const { xp_gained, xp_lost } = calcXpChange(outcome, tier);
  const cpl_change = calcCplChange(outcome, tier);

  // Initialize result values
  let reward_money = 0;
  let reward_points = 0;
  let jail_seconds = 0;
  let life_loss = 0;
  let money_loss = 0;
  let special: CrimeSpecial | null = null;
  let message = "";

  switch (outcome) {
    case "special":
      special = availableSpecial!;
      reward_money = special.reward_money;
      reward_points = special.reward_points;
      message = special.description;
      break;

    case "success":
      reward_money = calcReward(crime);
      message = `You successfully pulled off ${crime.name} and earned $${reward_money.toLocaleString()}.`;
      break;

    case "fail":
      message = `You attempted ${crime.name} but couldn't pull it off. You lost some experience.`;
      break;

    case "crit_fail": {
      const penalties = calcCritPenalties(cashOnHand, maxLife);
      money_loss = penalties.money_loss;
      life_loss = penalties.life_loss;
      jail_seconds = calcJailSeconds(crime, crime_level, hidden_cpl);

      if (money_loss > 0) {
        message = `You got caught during ${crime.name}! Lost $${money_loss.toLocaleString()} and significant experience.`;
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
// RNG NOTE
// Math.random() is intentionally used here — not crypto seeded.
// Crime outcomes don't need cryptographic randomness.
// Server-side RNG prevents client manipulation.
// If fairness auditing is needed in future, seed with
// a server-controlled value per session.
// ============================================================

// Returns XP progress percentage within current level (0-100)
export function calcLevelProgress(xp: number): number {
  if (xp <= 0) return 0;
  const currentLevel = calcCrimeLevel(xp);
  if (currentLevel >= 100) return 100;
  const currentLevelXp = Math.ceil(500000 * Math.pow(currentLevel / 100, 1 / 0.45));
  const nextLevelXp    = Math.ceil(500000 * Math.pow((currentLevel + 1) / 100, 1 / 0.45));
  const range          = nextLevelXp - currentLevelXp;
  const progress       = xp - currentLevelXp;
  return Math.min(100, Math.max(0, Math.round((progress / range) * 100)));
}
