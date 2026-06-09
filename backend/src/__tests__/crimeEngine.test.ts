// ============================================================
// CRIME ENGINE TESTS
// ============================================================

import { describe, it, expect, vi } from "vitest";
import {
  calcCrimeLevel,
  xpForNextLevel,
  calcJailSeconds,
  calcCritPenalties,
  resolveCrimeOutcome,
  applySanityCap,
  calcLevelProgress,
  MAX_SINGLE_CRIME_REWARD,
} from "../services/crimeEngine";
import type { CrimeDefinition, CrimeProgress } from "../models/crimeModels";

// ── Fixtures ──────────────────────────────────────────────

const baseCrime: CrimeDefinition = {
  id:               1,
  crime_key:        "pickpocket",
  name:             "Pickpocket",
  tier:             1,
  unlock_level:     1,
  nerve_cost:       2,
  min_reward:       100,
  max_reward:       5000,
  jail_min_seconds: 60,
  jail_max_seconds: 300,
  is_federal:       false,
};

const baseProgress: CrimeProgress = {
  id:                   1,
  user_id:              1,
  crime_id:             1,
  crime_xp:             0,
  crime_level:          0,
  hidden_cpl:           0,
  attempts:             0,
  successes:            0,
  failures:             0,
  crit_failures:        0,
  specials_found_count: 0,
};

// ── calcCrimeLevel ────────────────────────────────────────

describe("calcCrimeLevel", () => {
  it("returns 0 for 0 xp", () => {
    expect(calcCrimeLevel(0)).toBe(0);
  });

  it("returns 0 for negative xp", () => {
    expect(calcCrimeLevel(-100)).toBe(0);
  });

  it("returns 100 max", () => {
    expect(calcCrimeLevel(999_999_999)).toBe(100);
  });

  it("returns a value between 0 and 100 for mid xp", () => {
    const level = calcCrimeLevel(500_000);
    expect(level).toBeGreaterThan(0);
    expect(level).toBeLessThanOrEqual(100);
  });

  it("increases monotonically with XP", () => {
    const l1 = calcCrimeLevel(10_000);
    const l2 = calcCrimeLevel(100_000);
    const l3 = calcCrimeLevel(1_000_000);
    expect(l2).toBeGreaterThanOrEqual(l1);
    expect(l3).toBeGreaterThanOrEqual(l2);
  });
});

// ── xpForNextLevel ────────────────────────────────────────

describe("xpForNextLevel", () => {
  it("returns 0 at max level 100", () => {
    expect(xpForNextLevel(100)).toBe(0);
  });

  it("returns positive value for level 0", () => {
    expect(xpForNextLevel(0)).toBeGreaterThan(0);
  });

  it("increases as level increases", () => {
    expect(xpForNextLevel(10)).toBeLessThan(xpForNextLevel(50));
  });
});

// ── calcLevelProgress ─────────────────────────────────────

describe("calcLevelProgress", () => {
  it("returns 0 for 0 xp", () => {
    expect(calcLevelProgress(0)).toBe(0);
  });

  it("returns 100 at max level", () => {
    expect(calcLevelProgress(999_999_999)).toBe(100);
  });

  it("returns value between 0 and 100", () => {
    const p = calcLevelProgress(100_000);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(100);
  });
});

// ── calcJailSeconds ───────────────────────────────────────

describe("calcJailSeconds", () => {
  it("returns 0 if crime has no jail time", () => {
    const noJailCrime = { ...baseCrime, jail_min_seconds: 0, jail_max_seconds: 0 };
    expect(calcJailSeconds(noJailCrime, 0, 0)).toBe(0);
  });

  it("returns value within jail range", () => {
    const seconds = calcJailSeconds(baseCrime, 0, 0);
    expect(seconds).toBeGreaterThanOrEqual(baseCrime.jail_min_seconds);
    expect(seconds).toBeLessThanOrEqual(baseCrime.jail_max_seconds);
  });

  it("high mastery reduces jail time", () => {
    const lowMastery  = calcJailSeconds(baseCrime, 0,   0);
    const highMastery = calcJailSeconds(baseCrime, 100, 200);
    expect(highMastery).toBeLessThanOrEqual(lowMastery);
  });
});

// ── calcCritPenalties ─────────────────────────────────────

describe("calcCritPenalties", () => {
  it("never returns negative money_loss", () => {
    for (let i = 0; i < 50; i++) {
      const result = calcCritPenalties(1, 1000, 100);
      expect(result.money_loss).toBeGreaterThanOrEqual(0);
    }
  });

  it("tier 1 money loss never exceeds cap of $2000", () => {
    for (let i = 0; i < 50; i++) {
      const result = calcCritPenalties(1, 100_000, 100);
      if (result.money_loss > 0) {
        expect(result.money_loss).toBeLessThanOrEqual(2_000);
      }
    }
  });

  it("tier 5 can produce large flat losses", () => {
    let foundLargeLoss = false;
    for (let i = 0; i < 100; i++) {
      const result = calcCritPenalties(5, 10_000_000, 100);
      if (result.money_loss >= 2_500_000) foundLargeLoss = true;
    }
    expect(foundLargeLoss).toBe(true);
  });

  it("life loss path sets skipJail = true", () => {
    let foundLifeLoss = false;
    for (let i = 0; i < 100; i++) {
      const result = calcCritPenalties(1, 1000, 100);
      if (result.life_loss > 0) {
        expect(result.skipJail).toBe(true);
        foundLifeLoss = true;
        break;
      }
    }
    // Life loss happens 50% of the time — 100 attempts should find it
    // (probability of NOT finding it = 0.5^100 ≈ 0)
    expect(foundLifeLoss).toBe(true);
  });

  it("money loss path sets skipJail = false", () => {
    let foundMoneyLoss = false;
    for (let i = 0; i < 100; i++) {
      const result = calcCritPenalties(1, 1000, 100);
      if (result.money_loss > 0) {
        expect(result.skipJail).toBe(false);
        foundMoneyLoss = true;
        break;
      }
    }
    expect(foundMoneyLoss).toBe(true);
  });
});

// ── applySanityCap ────────────────────────────────────────

describe("applySanityCap", () => {
  it("passes through normal rewards unchanged", () => {
    const mockLog = vi.fn();
    const result  = {
      outcome:       "success" as const,
      reward_money:  5_000,
      reward_points: 0,
      xp_gained:     100,
      xp_lost:       0,
      cpl_change:    1,
      jail_seconds:  0,
      life_loss:     0,
      money_loss:    0,
      special:       null,
      message:       "ok",
    };

    const capped = applySanityCap(result, "pickpocket", mockLog);
    expect(capped.reward_money).toBe(5_000);
    expect(mockLog).not.toHaveBeenCalled();
  });

  it("caps reward at MAX_SINGLE_CRIME_REWARD and logs", () => {
    const mockLog = vi.fn();
    const result  = {
      outcome:       "success" as const,
      reward_money:  MAX_SINGLE_CRIME_REWARD + 1,
      reward_points: 0,
      xp_gained:     100,
      xp_lost:       0,
      cpl_change:    1,
      jail_seconds:  0,
      life_loss:     0,
      money_loss:    0,
      special:       null,
      message:       "ok",
    };

    const capped = applySanityCap(result, "bugged_crime", mockLog);
    expect(capped.reward_money).toBe(MAX_SINGLE_CRIME_REWARD);
    expect(mockLog).toHaveBeenCalledWith(
      "🚨 Crime reward sanity cap triggered",
      expect.objectContaining({ crimeId: "bugged_crime" })
    );
  });
});

// ── resolveCrimeOutcome ───────────────────────────────────

describe("resolveCrimeOutcome", () => {
  it("always returns a valid outcome type", () => {
    const validOutcomes = new Set(["success", "fail", "crit_fail", "special"]);

    for (let i = 0; i < 100; i++) {
      const result = resolveCrimeOutcome(baseCrime, baseProgress, null, 10_000, 100);
      expect(validOutcomes.has(result.outcome)).toBe(true);
    }
  });

  it("success outcome has positive reward_money", () => {
    // Run enough times to hit a success
    let found = false;
    for (let i = 0; i < 200; i++) {
      const result = resolveCrimeOutcome(baseCrime, baseProgress, null, 10_000, 100);
      if (result.outcome === "success") {
        expect(result.reward_money).toBeGreaterThan(0);
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it("crit_fail outcome has no reward_money", () => {
    let found = false;
    for (let i = 0; i < 200; i++) {
      const result = resolveCrimeOutcome(baseCrime, baseProgress, null, 10_000, 100);
      if (result.outcome === "crit_fail") {
        expect(result.reward_money).toBe(0);
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it("reward_money is within min/max range on success", () => {
    for (let i = 0; i < 200; i++) {
      const result = resolveCrimeOutcome(baseCrime, baseProgress, null, 10_000, 100);
      if (result.outcome === "success") {
        expect(result.reward_money).toBeGreaterThanOrEqual(baseCrime.min_reward);
        expect(result.reward_money).toBeLessThanOrEqual(baseCrime.max_reward);
      }
    }
  });

  it("tier 1-2 crit_fail money_loss is capped (never goes below 0 for caller)", () => {
    // The engine can return money_loss > 0 for tier 1
    // but the service layer floors money at 0 for tier 1-2
    // Here we just check the engine doesn't return negative money_loss
    for (let i = 0; i < 100; i++) {
      const result = resolveCrimeOutcome(baseCrime, baseProgress, null, 0, 100);
      expect(result.money_loss).toBeGreaterThanOrEqual(0);
    }
  });
});
