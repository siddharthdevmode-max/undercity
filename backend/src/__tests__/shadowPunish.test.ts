import { describe, it, expect } from "vitest";
import {
  applyShadowPunishment,
  CrimeOutcomeForPunish,
} from "../services/shadowPunish";

// ============================================================
// HELPER — build a normal "success" outcome to punish
// ============================================================

function makeSuccessOutcome(
  overrides: Partial<CrimeOutcomeForPunish> = {}
): CrimeOutcomeForPunish {
  return {
    outcome: "success",
    reward_money: 1000,
    reward_points: 10,
    xp_gained: 100,
    xp_lost: 0,
    cpl_change: 5,
    jail_seconds: 0,
    money_loss: 0,
    life_loss: 0,
    special: null,
    message: "You did the thing.",
    ...overrides,
  };
}

// ============================================================
// SHADOW PUNISHMENT
// ============================================================

describe("applyShadowPunishment", () => {
  it("converts most successes to fails (~95% rate)", () => {
    let failCount = 0;
    const trials = 1000;

    for (let i = 0; i < trials; i++) {
      const result = applyShadowPunishment(makeSuccessOutcome(), 10);
      if (result.outcome === "fail") failCount++;
    }

    // Should be between 90% and 100% (allow variance)
    const failRate = failCount / trials;
    expect(failRate).toBeGreaterThan(0.9);
    expect(failRate).toBeLessThanOrEqual(1.0);
  });

  it("when punished to fail, rewards are zeroed", () => {
    for (let i = 0; i < 100; i++) {
      const result = applyShadowPunishment(makeSuccessOutcome(), 10);
      if (result.outcome === "fail") {
        expect(result.reward_money).toBe(0);
        expect(result.reward_points).toBe(0);
        expect(result.xp_gained).toBe(0);
        expect(result.special).toBeNull();
        return;
      }
    }
  });

  it("when not failed, rewards are heavily nerfed", () => {
    for (let i = 0; i < 100; i++) {
      const result = applyShadowPunishment(makeSuccessOutcome(), 10);
      if (result.outcome === "success") {
        // 5% of original 1000 = 50
        expect(result.reward_money).toBeLessThanOrEqual(50);
        expect(result.reward_points).toBe(0);
        expect(result.special).toBeNull();
        return;
      }
    }
  });

  it("crit_fail outcomes have doubled jail time", () => {
    const original = makeSuccessOutcome({
      outcome: "crit_fail",
      jail_seconds: 60,
    });
    const result = applyShadowPunishment(original, 10);
    expect(result.outcome).toBe("crit_fail");
    expect(result.jail_seconds).toBe(120);
    expect(result.reward_money).toBe(0);
  });

  it("fail messages sound realistic (not obvious 'you are banned')", () => {
    const result = applyShadowPunishment(makeSuccessOutcome(), 10);
    if (result.outcome === "fail") {
      expect(result.message.toLowerCase()).not.toContain("ban");
      expect(result.message.toLowerCase()).not.toContain("cheat");
      expect(result.message.length).toBeGreaterThan(10);
    }
  });
});
