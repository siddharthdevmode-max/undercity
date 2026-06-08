import { describe, it, expect } from "vitest";
import {
  applyShadowPunishment,
  CrimeOutcomeForPunish,
} from "../services/shadowPunish";

// ============================================================
// HELPER
// ============================================================

function makeOutcome(
  overrides: Partial<CrimeOutcomeForPunish> = {}
): CrimeOutcomeForPunish {
  return {
    outcome:       "success",
    reward_money:  1000,
    reward_points: 10,
    xp_gained:     100,
    xp_lost:       0,
    cpl_change:    5,
    jail_seconds:  0,
    money_loss:    0,
    life_loss:     0,
    special:       null,
    message:       "You did the thing.",
    ...overrides,
  };
}

// ============================================================
// IMMUNE — no punishment at all
// ============================================================

describe("applyShadowPunishment — immune users", () => {
  it("returns outcome unchanged when isImmune = true", () => {
    const result = applyShadowPunishment(
      makeOutcome({ reward_money: 5000, reward_points: 50 }),
      10,
      true
    );
    expect(result.reward_money).toBe(5000);
    expect(result.reward_points).toBe(50);
    expect(result.outcome).toBe("success");
  });

  it("does not nerf even score=0 if immune", () => {
    const result = applyShadowPunishment(makeOutcome({ reward_money: 9999 }), 0, true);
    expect(result.reward_money).toBe(9999);
  });

  it("default isImmune is false", () => {
    // score=10 without isImmune → should be punished
    const result = applyShadowPunishment(makeOutcome({ reward_money: 1000 }), 10);
    expect(result.reward_money).toBeLessThan(1000);
  });
});

// ============================================================
// CLEAN tier (score >= 70) — explicit early return
// ============================================================

describe("applyShadowPunishment — CLEAN tier (>= 70)", () => {
  it("score=70 → no punishment", () => {
    const result = applyShadowPunishment(makeOutcome({ reward_money: 1000 }), 70);
    expect(result.reward_money).toBe(1000);
    expect(result.outcome).toBe("success");
  });

  it("score=100 → no punishment", () => {
    const result = applyShadowPunishment(makeOutcome({ reward_money: 1000 }), 100);
    expect(result.reward_money).toBe(1000);
  });

  it("score=80 → no punishment", () => {
    const result = applyShadowPunishment(makeOutcome({ reward_money: 500 }), 80);
    expect(result.reward_money).toBe(500);
    expect(result.reward_points).toBe(10);
    expect(result.xp_gained).toBe(100);
  });
});

// ============================================================
// WATCHED tier (score 40–69) — LINE 39
// Light nerf: 50% money, 50% points, 75% XP
// ============================================================

describe("applyShadowPunishment — WATCHED tier (40–69)", () => {
  it("halves reward_money at score=40", () => {
    const result = applyShadowPunishment(makeOutcome({ reward_money: 1000 }), 40);
    expect(result.reward_money).toBe(500);
  });

  it("halves reward_money at score=69", () => {
    const result = applyShadowPunishment(makeOutcome({ reward_money: 1000 }), 69);
    expect(result.reward_money).toBe(500);
  });

  it("halves reward_money at score=55 (mid-tier)", () => {
    const result = applyShadowPunishment(makeOutcome({ reward_money: 800 }), 55);
    expect(result.reward_money).toBe(400);
  });

  it("halves reward_points", () => {
    const result = applyShadowPunishment(makeOutcome({ reward_points: 100 }), 50);
    expect(result.reward_points).toBe(50);
  });

  it("reduces xp_gained to 75%", () => {
    const result = applyShadowPunishment(makeOutcome({ xp_gained: 200 }), 50);
    expect(result.xp_gained).toBe(150);
  });

  it("does NOT change outcome type (still success)", () => {
    const result = applyShadowPunishment(makeOutcome(), 50);
    expect(result.outcome).toBe("success");
  });

  it("does NOT change message", () => {
    const result = applyShadowPunishment(makeOutcome({ message: "original" }), 50);
    expect(result.message).toBe("original");
  });

  it("does NOT null specials (specials survive WATCHED tier)", () => {
    const special = {
      id: 1, crime_id: 1, title: "Lucky",
      description: "desc", reward_money: 500,
      reward_points: 5, unlock_crime_level: 0,
    };
    const result = applyShadowPunishment(makeOutcome({ special }), 50);
    expect(result.special).toBe(special);
  });

  it("floors fractional money correctly", () => {
    const result = applyShadowPunishment(makeOutcome({ reward_money: 101 }), 50);
    expect(result.reward_money).toBe(50); // Math.floor(101 * 0.5)
    expect(Number.isInteger(result.reward_money)).toBe(true);
  });
});

// ============================================================
// SUSPICIOUS tier (score 20–39) — LINE 50
// Heavy nerf: 10% money, 0 points, 20% XP, null specials
// ============================================================

describe("applyShadowPunishment — SUSPICIOUS tier (20–39)", () => {
  it("guts reward_money to 10% at score=20", () => {
    const result = applyShadowPunishment(makeOutcome({ reward_money: 1000 }), 20);
    expect(result.reward_money).toBe(100);
  });

  it("guts reward_money to 10% at score=39", () => {
    const result = applyShadowPunishment(makeOutcome({ reward_money: 1000 }), 39);
    expect(result.reward_money).toBe(100);
  });

  it("guts reward_money to 10% at score=30 (mid-tier)", () => {
    const result = applyShadowPunishment(makeOutcome({ reward_money: 500 }), 30);
    expect(result.reward_money).toBe(50);
  });

  it("zeros out reward_points completely", () => {
    const result = applyShadowPunishment(makeOutcome({ reward_points: 999 }), 30);
    expect(result.reward_points).toBe(0);
  });

  it("reduces xp_gained to 20%", () => {
    const result = applyShadowPunishment(makeOutcome({ xp_gained: 100 }), 30);
    expect(result.xp_gained).toBe(20);
  });

  it("nulls out specials", () => {
    const special = {
      id: 1, crime_id: 1, title: "Lucky",
      description: "desc", reward_money: 500,
      reward_points: 5, unlock_crime_level: 0,
    };
    const result = applyShadowPunishment(makeOutcome({ special }), 30);
    expect(result.special).toBeNull();
  });

  it("does NOT change outcome type", () => {
    const result = applyShadowPunishment(makeOutcome(), 30);
    expect(result.outcome).toBe("success");
  });

  it("floors fractional money correctly", () => {
    const result = applyShadowPunishment(makeOutcome({ reward_money: 99 }), 30);
    expect(result.reward_money).toBe(9); // Math.floor(99 * 0.1)
    expect(Number.isInteger(result.reward_money)).toBe(true);
  });
});

// ============================================================
// SHADOW_BANNED tier (score 1–19)
// 95% forced fail, crit_fail doubled jail, 5% tiny reward
// ============================================================

describe("applyShadowPunishment — SHADOW_BANNED tier (1–19)", () => {
  it("converts most successes to fails (~95% rate)", () => {
    let failCount = 0;
    for (let i = 0; i < 1000; i++) {
      const result = applyShadowPunishment(makeOutcome(), 10);
      if (result.outcome === "fail") failCount++;
    }
    const failRate = failCount / 1000;
    expect(failRate).toBeGreaterThan(0.88);
    expect(failRate).toBeLessThanOrEqual(1.0);
  });

  it("when punished to fail, all rewards are zeroed", () => {
    for (let i = 0; i < 100; i++) {
      const result = applyShadowPunishment(makeOutcome(), 10);
      if (result.outcome === "fail") {
        expect(result.reward_money).toBe(0);
        expect(result.reward_points).toBe(0);
        expect(result.xp_gained).toBe(0);
        expect(result.special).toBeNull();
        return;
      }
    }
  });

  it("when not failed (5%), rewards are nerfed to 5%", () => {
    for (let i = 0; i < 200; i++) {
      const result = applyShadowPunishment(
        makeOutcome({ reward_money: 1000 }),
        10
      );
      if (result.outcome === "success") {
        expect(result.reward_money).toBeLessThanOrEqual(50);
        expect(result.reward_points).toBe(0);
        expect(result.special).toBeNull();
        return;
      }
    }
  });

  it("crit_fail outcomes have doubled jail time", () => {
    const original = makeOutcome({ outcome: "crit_fail", jail_seconds: 60 });
    const result   = applyShadowPunishment(original, 10);
    expect(result.outcome).toBe("crit_fail");
    expect(result.jail_seconds).toBe(120);
    expect(result.reward_money).toBe(0);
    expect(result.xp_gained).toBe(0);
  });

  it("crit_fail with 0 jail_seconds stays 0", () => {
    const original = makeOutcome({ outcome: "crit_fail", jail_seconds: 0 });
    const result   = applyShadowPunishment(original, 10);
    expect(result.jail_seconds).toBe(0);
  });

  it("fail messages are realistic (no 'ban' or 'cheat')", () => {
    for (let i = 0; i < 50; i++) {
      const result = applyShadowPunishment(makeOutcome(), 5);
      if (result.outcome === "fail") {
        expect(result.message.toLowerCase()).not.toContain("ban");
        expect(result.message.toLowerCase()).not.toContain("cheat");
        expect(result.message.length).toBeGreaterThan(10);
        return;
      }
    }
  });

  it("works at score=1 (lowest non-zero)", () => {
    const result = applyShadowPunishment(makeOutcome({ reward_money: 1000 }), 1);
    expect(result.reward_money).toBeLessThan(1000);
  });

  it("works at score=19 (highest shadow-banned)", () => {
    const result = applyShadowPunishment(makeOutcome({ reward_money: 1000 }), 19);
    expect(result.reward_money).toBeLessThan(1000);
  });
});

// ============================================================
// HARD_BANNED fallback (score = 0) — LINE 102
// Safety net — should never reach here (banCheck blocks them)
// ============================================================

describe("applyShadowPunishment — HARD_BANNED fallback (score = 0)", () => {
  it("zeros all rewards when score = 0", () => {
    const result = applyShadowPunishment(makeOutcome({ reward_money: 5000 }), 0);
    expect(result.reward_money).toBe(0);
    expect(result.reward_points).toBe(0);
    expect(result.xp_gained).toBe(0);
  });

  it("forces outcome to fail when score = 0", () => {
    const result = applyShadowPunishment(makeOutcome(), 0);
    expect(result.outcome).toBe("fail");
  });

  it("nulls specials when score = 0", () => {
    const special = {
      id: 1, crime_id: 1, title: "x",
      description: "y", reward_money: 100,
      reward_points: 1, unlock_crime_level: 0,
    };
    const result = applyShadowPunishment(makeOutcome({ special }), 0);
    expect(result.special).toBeNull();
  });

  it("resets cpl_change to 0 when score = 0", () => {
    const result = applyShadowPunishment(makeOutcome({ cpl_change: 10 }), 0);
    expect(result.cpl_change).toBe(0);
  });

  it("uses a realistic fail message when score = 0", () => {
    const result = applyShadowPunishment(makeOutcome(), 0);
    expect(result.message.toLowerCase()).not.toContain("ban");
    expect(result.message.length).toBeGreaterThan(10);
  });
});

// ============================================================
// TIER BOUNDARY — exact boundary values
// ============================================================

describe("applyShadowPunishment — tier boundaries", () => {
  it("score=70 → CLEAN → full rewards", () => {
    const result = applyShadowPunishment(makeOutcome({ reward_money: 1000 }), 70);
    expect(result.reward_money).toBe(1000);
    expect(result.outcome).toBe("success");
  });

  it("score=69 → WATCHED → 50% money", () => {
    const result = applyShadowPunishment(makeOutcome({ reward_money: 1000 }), 69);
    expect(result.reward_money).toBe(500);
  });

  it("score=40 → WATCHED → 50% money", () => {
    const result = applyShadowPunishment(makeOutcome({ reward_money: 1000 }), 40);
    expect(result.reward_money).toBe(500);
  });

  it("score=39 → SUSPICIOUS → 10% money", () => {
    const result = applyShadowPunishment(makeOutcome({ reward_money: 1000 }), 39);
    expect(result.reward_money).toBe(100);
  });

  it("score=20 → SUSPICIOUS → 10% money", () => {
    const result = applyShadowPunishment(makeOutcome({ reward_money: 1000 }), 20);
    expect(result.reward_money).toBe(100);
  });

  it("score=19 → SHADOW_BANNED → heavy punishment", () => {
    const result = applyShadowPunishment(makeOutcome({ reward_money: 1000 }), 19);
    expect(result.reward_money).toBeLessThan(100);
  });

  it("score=1 → SHADOW_BANNED → heavy punishment", () => {
    const result = applyShadowPunishment(makeOutcome({ reward_money: 1000 }), 1);
    expect(result.reward_money).toBeLessThan(100);
  });

  it("score=0 → HARD_BANNED fallback → zeroed", () => {
    const result = applyShadowPunishment(makeOutcome({ reward_money: 1000 }), 0);
    expect(result.reward_money).toBe(0);
    expect(result.outcome).toBe("fail");
  });
});
