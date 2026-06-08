import { describe, it, expect, vi } from "vitest";
import {
  calcCrimeLevel,
  xpForNextLevel,
  calcJailSeconds,
  resolveCrimeOutcome,
  calcLevelProgress,
  applySanityCap,
  MAX_SINGLE_CRIME_REWARD,
  calcCritPenalties,
} from "../services/crimeEngine";
import type { CrimeDefinition, CrimeProgress } from "../models/crimeModels";

// ============================================================
// HELPER FACTORIES
// ============================================================

function makeCrime(overrides: Partial<CrimeDefinition> = {}): CrimeDefinition {
  return {
    id: 1,
    crime_key: "test_crime",
    name: "Test Crime",
    tier: 1,
    unlock_level: 1,
    nerve_cost: 2,
    min_reward: 100,
    max_reward: 200,
    jail_min_seconds: 30,
    jail_max_seconds: 120,
    is_federal: false,
    ...overrides,
  };
}

function makeProgress(overrides: Partial<CrimeProgress> = {}): CrimeProgress {
  return {
    id: 1,
    user_id: 1,
    crime_id: 1,
    crime_xp: 0,
    crime_level: 0,
    hidden_cpl: 0,
    attempts: 0,
    successes: 0,
    failures: 0,
    crit_failures: 0,
    specials_found_count: 0,
    ...overrides,
  };
}

// ============================================================
// CRIME LEVEL CALCULATION
// ============================================================

describe("calcCrimeLevel", () => {
  it("returns 0 for zero XP", () => {
    expect(calcCrimeLevel(0)).toBe(0);
  });

  it("returns 0 for negative XP", () => {
    expect(calcCrimeLevel(-100)).toBe(0);
  });

  it("caps at level 100 for huge XP", () => {
    expect(calcCrimeLevel(99_999_999)).toBe(100);
  });

  it("level grows with XP (monotonic)", () => {
    const l1 = calcCrimeLevel(1_000);
    const l2 = calcCrimeLevel(10_000);
    const l3 = calcCrimeLevel(100_000);
    expect(l2).toBeGreaterThanOrEqual(l1);
    expect(l3).toBeGreaterThanOrEqual(l2);
  });

  it("level 100 needs roughly 500k XP", () => {
    expect(calcCrimeLevel(500_000)).toBe(100);
  });

  it("returns integer (no fractional levels)", () => {
    const level = calcCrimeLevel(12_345);
    expect(Number.isInteger(level)).toBe(true);
  });

  it("returns 0 for exactly 0 xp boundary", () => {
    expect(calcCrimeLevel(0)).toBe(0);
  });
});

// ============================================================
// XP REQUIRED FOR NEXT LEVEL
// ============================================================

describe("xpForNextLevel", () => {
  it("returns 0 at max level", () => {
    expect(xpForNextLevel(100)).toBe(0);
  });

  it("returns positive XP requirement at low levels", () => {
    expect(xpForNextLevel(1)).toBeGreaterThan(0);
    expect(xpForNextLevel(50)).toBeGreaterThan(0);
  });

  it("higher levels need more XP than lower levels", () => {
    const low  = xpForNextLevel(10);
    const high = xpForNextLevel(80);
    expect(high).toBeGreaterThan(low);
  });

  it("returns integer XP values", () => {
    expect(Number.isInteger(xpForNextLevel(10))).toBe(true);
    expect(Number.isInteger(xpForNextLevel(50))).toBe(true);
  });

  it("xpForNextLevel(99) is positive and at most 500000", () => {
    // Level 99 → 100 requires XP up to (but possibly equal to) 500k
    // Use toBeLessThanOrEqual — xpForNextLevel(99) can equal 500000
    const xp = xpForNextLevel(99);
    expect(xp).toBeGreaterThan(0);
    expect(xp).toBeLessThanOrEqual(500_000);
  });

  it("xpForNextLevel(0) returns positive XP", () => {
    expect(xpForNextLevel(0)).toBeGreaterThan(0);
  });

  it("xpForNextLevel(1) < xpForNextLevel(99)", () => {
    expect(xpForNextLevel(1)).toBeLessThan(xpForNextLevel(99));
  });
});

// ============================================================
// JAIL TIME CALCULATION
// ============================================================

describe("calcJailSeconds", () => {
  it("returns 0 when crime has no jail range", () => {
    const crime = makeCrime({ jail_min_seconds: 0, jail_max_seconds: 0 });
    expect(calcJailSeconds(crime, 0, 0)).toBe(0);
  });

  it("returns max jail at level 0, no mastery", () => {
    const crime = makeCrime({ jail_min_seconds: 30, jail_max_seconds: 120 });
    expect(calcJailSeconds(crime, 0, 0)).toBe(120);
  });

  it("higher mastery reduces jail time", () => {
    const crime      = makeCrime({ jail_min_seconds: 30, jail_max_seconds: 120 });
    const noviceJail = calcJailSeconds(crime, 10, 10);
    const expertJail = calcJailSeconds(crime, 90, 180);
    expect(expertJail).toBeLessThan(noviceJail);
  });

  it("never goes below the minimum", () => {
    const crime = makeCrime({ jail_min_seconds: 30, jail_max_seconds: 120 });
    const jail  = calcJailSeconds(crime, 100, 200);
    expect(jail).toBeGreaterThanOrEqual(30);
  });

  it("never exceeds the maximum", () => {
    const crime = makeCrime({ jail_min_seconds: 30, jail_max_seconds: 120 });
    const jail  = calcJailSeconds(crime, 0, 0);
    expect(jail).toBeLessThanOrEqual(120);
  });

  it("returns integer seconds", () => {
    const crime = makeCrime({ jail_min_seconds: 30, jail_max_seconds: 120 });
    expect(Number.isInteger(calcJailSeconds(crime, 50, 100))).toBe(true);
  });
});

// ============================================================
// CRIT FAIL PENALTIES — explicit unit tests
// ============================================================

describe("calcCritPenalties", () => {

  it("NEVER returns both money_loss > 0 AND life_loss > 0", () => {
    for (let i = 0; i < 500; i++) {
      const result = calcCritPenalties(1, 1000, 100);
      const bothPositive = result.money_loss > 0 && result.life_loss > 0;
      expect(bothPositive).toBe(false);
    }
  });

  it("NEVER returns both zero (one must always have a value)", () => {
    for (let i = 0; i < 500; i++) {
      const result = calcCritPenalties(1, 1000, 100);
      const bothZero = result.money_loss === 0 && result.life_loss === 0;
      expect(bothZero).toBe(false);
    }
  });

  it("tier 1 money_loss is capped at $2000", () => {
    for (let i = 0; i < 200; i++) {
      const result = calcCritPenalties(1, 1_000_000, 100);
      if (result.money_loss > 0) {
        expect(result.money_loss).toBeLessThanOrEqual(2_000);
      }
    }
  });

  it("tier 2 money_loss is capped at $30000", () => {
    for (let i = 0; i < 200; i++) {
      const result = calcCritPenalties(2, 1_000_000, 100);
      if (result.money_loss > 0) {
        expect(result.money_loss).toBeLessThanOrEqual(30_000);
      }
    }
  });

  it("tier 1-2 money_loss is always >= 0 (never negative)", () => {
    for (let i = 0; i < 200; i++) {
      const r1 = calcCritPenalties(1, 0, 100);
      expect(r1.money_loss).toBeGreaterThanOrEqual(0);
      const r2 = calcCritPenalties(2, 0, 100);
      expect(r2.money_loss).toBeGreaterThanOrEqual(0);
    }
  });

  it("tier 3 flat loss is in range $50k - $200k", () => {
    let foundMoneyLoss = false;
    for (let i = 0; i < 500; i++) {
      const result = calcCritPenalties(3, 1_000_000, 100);
      if (result.money_loss > 0) {
        foundMoneyLoss = true;
        expect(result.money_loss).toBeGreaterThanOrEqual(50_000);
        expect(result.money_loss).toBeLessThanOrEqual(200_000);
      }
    }
    expect(foundMoneyLoss).toBe(true);
  });

  it("tier 5 flat loss is in range $2.5M - $5M", () => {
    let foundMoneyLoss = false;
    for (let i = 0; i < 500; i++) {
      const result = calcCritPenalties(5, 10_000_000, 100);
      if (result.money_loss > 0) {
        foundMoneyLoss = true;
        expect(result.money_loss).toBeGreaterThanOrEqual(2_500_000);
        expect(result.money_loss).toBeLessThanOrEqual(5_000_000);
      }
    }
    expect(foundMoneyLoss).toBe(true);
  });

  it("skipJail is true when life loss path is chosen", () => {
    let foundLifeLoss = false;
    for (let i = 0; i < 500; i++) {
      const result = calcCritPenalties(1, 1000, 100);
      if (result.life_loss > 0) {
        foundLifeLoss = true;
        expect(result.skipJail).toBe(true);
        break;
      }
    }
    expect(foundLifeLoss).toBe(true);
  });

  it("skipJail is false when money loss path is chosen", () => {
    let foundMoneyLoss = false;
    for (let i = 0; i < 500; i++) {
      const result = calcCritPenalties(1, 1000, 100);
      if (result.money_loss > 0) {
        foundMoneyLoss = true;
        expect(result.skipJail).toBe(false);
        break;
      }
    }
    expect(foundMoneyLoss).toBe(true);
  });

  it("life_loss respects maxLife parameter", () => {
    for (let i = 0; i < 500; i++) {
      const result = calcCritPenalties(1, 1000, 50);
      if (result.life_loss > 0) {
        expect(result.life_loss).toBeLessThanOrEqual(50);
      }
    }
  });
});

// ============================================================
// OUTCOME RESOLVER
// ============================================================

describe("resolveCrimeOutcome", () => {
  it("returns a valid outcome type", () => {
    const result = resolveCrimeOutcome(makeCrime(), makeProgress(), null, 1000, 100);
    expect(["special", "success", "fail", "crit_fail"]).toContain(result.outcome);
  });

  it("never returns special when none is available", () => {
    for (let i = 0; i < 50; i++) {
      const result = resolveCrimeOutcome(makeCrime(), makeProgress(), null, 1000, 100);
      expect(result.outcome).not.toBe("special");
    }
  });

  it("success outcome gives positive money reward within crime range", () => {
    let foundSuccess = false;
    for (let i = 0; i < 100; i++) {
      const result = resolveCrimeOutcome(
        makeCrime({ min_reward: 100, max_reward: 200 }),
        makeProgress({ crime_level: 80, hidden_cpl: 150 }),
        null,
        1000,
        100
      );
      if (result.outcome === "success") {
        foundSuccess = true;
        expect(result.reward_money).toBeGreaterThanOrEqual(100);
        expect(result.reward_money).toBeLessThanOrEqual(200);
        break;
      }
    }
    expect(foundSuccess).toBe(true);
  });

  it("fail outcome has no rewards but loses XP", () => {
    for (let i = 0; i < 100; i++) {
      const result = resolveCrimeOutcome(makeCrime(), makeProgress(), null, 1000, 100);
      if (result.outcome === "fail") {
        expect(result.reward_money).toBe(0);
        expect(result.reward_points).toBe(0);
        expect(result.xp_lost).toBeGreaterThan(0);
        break;
      }
    }
  });

  it("crit_fail can trigger jail time (money loss path)", () => {
    let foundCritFailWithJail = false;
    for (let i = 0; i < 500; i++) {
      const result = resolveCrimeOutcome(
        makeCrime({ jail_min_seconds: 30, jail_max_seconds: 120 }),
        makeProgress(),
        null,
        1000,
        100
      );
      if (result.outcome === "crit_fail" && result.jail_seconds > 0) {
        foundCritFailWithJail = true;
        expect(result.jail_seconds).toBeGreaterThanOrEqual(30);
        expect(result.jail_seconds).toBeLessThanOrEqual(120);
        // When jail_seconds > 0, life_loss MUST be 0 (money loss path)
        expect(result.life_loss).toBe(0);
        break;
      }
    }
    expect(foundCritFailWithJail).toBe(true);
  });

  it("crit_fail NEVER has both money_loss > 0 AND life_loss > 0", () => {
    for (let i = 0; i < 500; i++) {
      const result = resolveCrimeOutcome(makeCrime(), makeProgress(), null, 1000, 100);
      if (result.outcome === "crit_fail") {
        const bothPositive = result.money_loss > 0 && result.life_loss > 0;
        const bothZero     = result.money_loss === 0 && result.life_loss === 0;
        expect(bothPositive).toBe(false);
        expect(bothZero).toBe(false);
      }
    }
  });

  it("crit_fail life loss path has jail_seconds = 0", () => {
    let foundLifeLoss = false;
    for (let i = 0; i < 500; i++) {
      const result = resolveCrimeOutcome(
        makeCrime({ jail_min_seconds: 30, jail_max_seconds: 120 }),
        makeProgress(),
        null,
        1000,
        100
      );
      if (result.outcome === "crit_fail" && result.life_loss > 0) {
        foundLifeLoss = true;
        expect(result.jail_seconds).toBe(0);
        expect(result.money_loss).toBe(0);
        break;
      }
    }
    expect(foundLifeLoss).toBe(true);
  });

  it("result message is always a non-empty string", () => {
    for (let i = 0; i < 20; i++) {
      const result = resolveCrimeOutcome(makeCrime(), makeProgress(), null, 1000, 100);
      expect(typeof result.message).toBe("string");
      expect(result.message.length).toBeGreaterThan(0);
    }
  });

  it("all numeric result fields are finite numbers", () => {
    for (let i = 0; i < 20; i++) {
      const result = resolveCrimeOutcome(makeCrime(), makeProgress(), null, 1000, 100);
      expect(Number.isFinite(result.reward_money)).toBe(true);
      expect(Number.isFinite(result.reward_points)).toBe(true);
      expect(Number.isFinite(result.xp_gained)).toBe(true);
      expect(Number.isFinite(result.xp_lost)).toBe(true);
      expect(Number.isFinite(result.jail_seconds)).toBe(true);
      expect(Number.isFinite(result.life_loss)).toBe(true);
      expect(Number.isFinite(result.money_loss)).toBe(true);
    }
  });

  it("tier 1 crit_fail money_loss never exceeds $2000", () => {
    for (let i = 0; i < 500; i++) {
      const result = resolveCrimeOutcome(
        makeCrime({ tier: 1 }),
        makeProgress(),
        null,
        1_000_000,
        100
      );
      if (result.outcome === "crit_fail") {
        expect(result.money_loss).toBeLessThanOrEqual(2_000);
      }
    }
  });

  it("tier 3+ crit_fail money_loss can be > $2000 (no cap)", () => {
    let foundHighLoss = false;
    for (let i = 0; i < 500; i++) {
      const result = resolveCrimeOutcome(
        makeCrime({ tier: 3 }),
        makeProgress(),
        null,
        10_000_000,
        100
      );
      if (result.outcome === "crit_fail" && result.money_loss > 2_000) {
        foundHighLoss = true;
        break;
      }
    }
    expect(foundHighLoss).toBe(true);
  });
});

// ============================================================
// LEVEL PROGRESS HELPERS
// ============================================================

describe("calcLevelProgress", () => {
  it("returns 0 for 0 XP", () => {
    expect(calcLevelProgress(0)).toBe(0);
  });

  it("returns 100 for max XP", () => {
    expect(calcLevelProgress(999_999_999)).toBe(100);
  });

  it("returns value between 0 and 100 inclusive", () => {
    for (const xp of [1000, 10000, 100000, 250000, 499999]) {
      const progress = calcLevelProgress(xp);
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(100);
    }
  });
});

// ============================================================
// SANITY CAP
// ============================================================

describe("applySanityCap", () => {
  const mockLog = vi.fn();

  it("passes through normal rewards unchanged", () => {
    const result = { reward_money: 5_000, outcome: "success" } as never;
    const capped = applySanityCap(result, "test_crime", mockLog);
    expect(capped.reward_money).toBe(5_000);
    expect(mockLog).not.toHaveBeenCalled();
  });

  it("caps rewards above MAX_SINGLE_CRIME_REWARD", () => {
    const result = { reward_money: 999_999_999, outcome: "success" } as never;
    const capped = applySanityCap(result, "test_crime", mockLog);
    expect(capped.reward_money).toBe(MAX_SINGLE_CRIME_REWARD);
    expect(mockLog).toHaveBeenCalledWith(
      expect.stringContaining("sanity cap"),
      expect.objectContaining({ crimeId: "test_crime" })
    );
  });

  it("MAX_SINGLE_CRIME_REWARD is 20_000_000 (2x tier 5 max)", () => {
    expect(MAX_SINGLE_CRIME_REWARD).toBe(20_000_000);
  });

  it("does not mutate original result object", () => {
    const result = { reward_money: 999_999_999, outcome: "success" } as never;
    applySanityCap(result, "test_crime", mockLog);
    expect(result.reward_money).toBe(999_999_999);
  });
});
