import { describe, it, expect } from "vitest";
import {
  calcCrimeLevel,
  xpForNextLevel,
  calcJailSeconds,
  resolveCrimeOutcome,
} from "../services/crimeEngine";
import type { CrimeDefinition, CrimeProgress } from "../models/crimeModels";

// ============================================================
// HELPER FACTORIES — keep tests clean
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
    const low = xpForNextLevel(10);
    const high = xpForNextLevel(80);
    expect(high).toBeGreaterThan(low);
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
    const crime = makeCrime({ jail_min_seconds: 30, jail_max_seconds: 120 });
    const noviceJail = calcJailSeconds(crime, 10, 10);
    const expertJail = calcJailSeconds(crime, 90, 180);
    expect(expertJail).toBeLessThan(noviceJail);
  });

  it("never goes below the minimum", () => {
    const crime = makeCrime({ jail_min_seconds: 30, jail_max_seconds: 120 });
    const jail = calcJailSeconds(crime, 100, 200);
    expect(jail).toBeGreaterThanOrEqual(30);
  });

  it("never exceeds the maximum", () => {
    const crime = makeCrime({ jail_min_seconds: 30, jail_max_seconds: 120 });
    const jail = calcJailSeconds(crime, 0, 0);
    expect(jail).toBeLessThanOrEqual(120);
  });
});

// ============================================================
// OUTCOME RESOLVER
// ============================================================

describe("resolveCrimeOutcome", () => {
  it("returns a valid outcome type", () => {
    const result = resolveCrimeOutcome(
      makeCrime(),
      makeProgress(),
      null,
      1000,
      100
    );
    expect(["special", "success", "fail", "crit_fail"]).toContain(result.outcome);
  });

  it("never returns special when none is available", () => {
    for (let i = 0; i < 50; i++) {
      const result = resolveCrimeOutcome(makeCrime(), makeProgress(), null, 1000, 100);
      expect(result.outcome).not.toBe("special");
    }
  });

  it("success outcome gives positive money reward within crime range", () => {
    // Run many trials to find at least one success
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

  it("crit_fail can trigger jail time", () => {
    let foundCritFailWithJail = false;
    for (let i = 0; i < 200; i++) {
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
        break;
      }
    }
    expect(foundCritFailWithJail).toBe(true);
  });

  it("crit_fail causes EITHER money loss OR life loss, never both", () => {
    for (let i = 0; i < 100; i++) {
      const result = resolveCrimeOutcome(makeCrime(), makeProgress(), null, 1000, 100);
      if (result.outcome === "crit_fail") {
        const bothZero = result.money_loss === 0 && result.life_loss === 0;
        const onlyMoney = result.money_loss > 0 && result.life_loss === 0;
        const onlyLife = result.money_loss === 0 && result.life_loss > 0;
        expect(bothZero || onlyMoney || onlyLife).toBe(true);
      }
    }
  });
});
