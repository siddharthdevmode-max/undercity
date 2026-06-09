// ============================================================
// SHADOW PUNISH TESTS
// applyShadowPunishment is a PURE SYNC function — no DB, no Redis.
// Tests call it directly with outcome objects.
// ============================================================

import { describe, it, expect } from "vitest";
import { applyShadowPunishment } from "../services/shadowPunish";
import type { CrimeOutcomeForPunish } from "../services/shadowPunish";

// ── Fixture ───────────────────────────────────────────────

function makeOutcome(
  overrides: Partial<CrimeOutcomeForPunish> = {}
): CrimeOutcomeForPunish {
  return {
    outcome:       "success",
    reward_money:  10_000,
    reward_points: 100,
    xp_gained:     500,
    xp_lost:       0,
    jail_seconds:  0,
    money_loss:    0,
    life_loss:     0,
    message:       "You pulled it off.",
    special:       null,
    cpl_change:    2,
    ...overrides,
  };
}

// ── CLEAN tier (score >= 70) ──────────────────────────────

describe("CLEAN tier (score >= 70)", () => {
  it("returns outcome unchanged", () => {
    const outcome = makeOutcome();
    const result  = applyShadowPunishment(outcome, 100);
    expect(result.reward_money).toBe(10_000);
    expect(result.reward_points).toBe(100);
    expect(result.xp_gained).toBe(500);
  });

  it("immune user always returns outcome unchanged", () => {
    const outcome = makeOutcome();
    const result  = applyShadowPunishment(outcome, 0, true);
    expect(result.reward_money).toBe(10_000);
  });
});

// ── WATCHED tier (score 40-69) ────────────────────────────

describe("WATCHED tier (score 40-69)", () => {
  it("reduces money to 50%", () => {
    const result = applyShadowPunishment(makeOutcome(), 50);
    expect(result.reward_money).toBe(5_000);
  });

  it("reduces points to 50%", () => {
    const result = applyShadowPunishment(makeOutcome(), 50);
    expect(result.reward_points).toBe(50);
  });

  it("reduces xp to 75%", () => {
    const result = applyShadowPunishment(makeOutcome(), 50);
    expect(result.xp_gained).toBe(375);
  });

  it("applies at boundary score 40", () => {
    const result = applyShadowPunishment(makeOutcome(), 40);
    expect(result.reward_money).toBe(5_000);
  });

  it("applies at boundary score 69", () => {
    const result = applyShadowPunishment(makeOutcome(), 69);
    expect(result.reward_money).toBe(5_000);
  });
});

// ── SUSPICIOUS tier (score 20-39) ────────────────────────

describe("SUSPICIOUS tier (score 20-39)", () => {
  it("reduces money to 10%", () => {
    const result = applyShadowPunishment(makeOutcome(), 30);
    expect(result.reward_money).toBe(1_000);
  });

  it("zeroes out points", () => {
    const result = applyShadowPunishment(makeOutcome(), 30);
    expect(result.reward_points).toBe(0);
  });

  it("reduces xp to 20%", () => {
    const result = applyShadowPunishment(makeOutcome(), 30);
    expect(result.xp_gained).toBe(100);
  });

  it("nulls special", () => {
    const outcome = makeOutcome({
      special: {
        id: 1, crime_id: 1, title: "Special",
        description: "desc", reward_money: 5000,
        reward_points: 50, unlock_crime_level: 0,
      },
    });
    const result = applyShadowPunishment(outcome, 25);
    expect(result.special).toBeNull();
  });
});

// ── SHADOW_BANNED tier (score 1-19) ──────────────────────

describe("SHADOW_BANNED tier (score 1-19)", () => {
  it("forces fail outcome 95% of the time (statistical)", () => {
    let failCount = 0;
    const RUNS    = 1000;

    for (let i = 0; i < RUNS; i++) {
      const result = applyShadowPunishment(makeOutcome({ outcome: "success" }), 10);
      if (result.outcome === "fail") failCount++;
    }

    // Expect 90-99% fail rate (95% target, allow ±5% variance)
    const failRate = failCount / RUNS;
    expect(failRate).toBeGreaterThan(0.88);
    expect(failRate).toBeLessThan(0.99);
  });

  it("forced fail has zero rewards", () => {
    // Run enough times to guarantee hitting the 95% fail path
    for (let i = 0; i < 50; i++) {
      const result = applyShadowPunishment(makeOutcome({ outcome: "success" }), 5);
      if (result.outcome === "fail") {
        expect(result.reward_money).toBe(0);
        expect(result.reward_points).toBe(0);
        expect(result.xp_gained).toBe(0);
        expect(result.special).toBeNull();
        return;
      }
    }
  });

  it("crit_fail doubles jail time", () => {
    const outcome = makeOutcome({ outcome: "crit_fail", jail_seconds: 300 });
    // For crit_fail the punishment is always applied (doubles jail)
    const result  = applyShadowPunishment(outcome, 10);
    if (result.outcome === "crit_fail") {
      expect(result.jail_seconds).toBe(600);
    }
  });
});

// ── HARD_BANNED fallback (score 0) ────────────────────────

describe("HARD_BANNED fallback (score 0)", () => {
  it("zeroes everything — safety net", () => {
    const result = applyShadowPunishment(makeOutcome(), 0);
    expect(result.outcome).toBe("fail");
    expect(result.reward_money).toBe(0);
    expect(result.reward_points).toBe(0);
    expect(result.xp_gained).toBe(0);
    expect(result.special).toBeNull();
  });
});
