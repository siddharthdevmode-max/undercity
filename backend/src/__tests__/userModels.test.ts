import { describe, it, expect } from "vitest";
import {
  toNumber,
  isFutureDate,
  calcMaxLife,
  calcMaxNerve,
  canAttemptCrime,
  getCooldownRemaining,
} from "../models/userModels";

// ============================================================
// toNumber
// ============================================================

describe("toNumber", () => {
  it("returns 0 for null and undefined", () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
  });

  it("converts string numbers", () => {
    expect(toNumber("42")).toBe(42);
    expect(toNumber("0")).toBe(0);
  });

  it("passes through actual numbers", () => {
    expect(toNumber(7)).toBe(7);
    expect(toNumber(0)).toBe(0);
  });
});

// ============================================================
// isFutureDate
// ============================================================

describe("isFutureDate", () => {
  it("returns false for null/undefined", () => {
    expect(isFutureDate(null)).toBe(false);
    expect(isFutureDate(undefined)).toBe(false);
  });

  it("returns false for past dates", () => {
    const past = new Date(Date.now() - 10_000);
    expect(isFutureDate(past)).toBe(false);
  });

  it("returns true for future dates", () => {
    const future = new Date(Date.now() + 60_000);
    expect(isFutureDate(future)).toBe(true);
  });
});

// ============================================================
// calcMaxLife
// ============================================================

describe("calcMaxLife", () => {
  it("level 1 gives 100 life", () => {
    expect(calcMaxLife(1)).toBe(100);
  });

  it("level 2 gives 125 life", () => {
    expect(calcMaxLife(2)).toBe(125);
  });

  it("scales linearly: each level adds 25", () => {
    expect(calcMaxLife(10)).toBe(100 + 9 * 25);
    expect(calcMaxLife(50)).toBe(100 + 49 * 25);
  });
});

// ============================================================
// calcMaxNerve
// ============================================================

describe("calcMaxNerve", () => {
  it("starts at 30 with zero XP", () => {
    expect(calcMaxNerve(0)).toBe(30);
  });

  it("caps at 130 with huge XP", () => {
    expect(calcMaxNerve(999_999_999)).toBe(130);
  });

  it("grows monotonically with XP", () => {
    const low = calcMaxNerve(10_000);
    const mid = calcMaxNerve(100_000);
    const high = calcMaxNerve(1_000_000);
    expect(mid).toBeGreaterThanOrEqual(low);
    expect(high).toBeGreaterThanOrEqual(mid);
  });

  it("never returns above 130 (cap enforced)", () => {
    expect(calcMaxNerve(Number.MAX_SAFE_INTEGER)).toBeLessThanOrEqual(130);
  });
});

// ============================================================
// canAttemptCrime + cooldown
// ============================================================

describe("canAttemptCrime", () => {
  it("returns true when no last crime exists", () => {
    expect(canAttemptCrime(null)).toBe(true);
    expect(canAttemptCrime(undefined)).toBe(true);
  });

  it("returns false if last crime was under 1 second ago", () => {
    const recent = new Date(Date.now() - 500);
    expect(canAttemptCrime(recent)).toBe(false);
  });

  it("returns true if last crime was over 1 second ago", () => {
    const old = new Date(Date.now() - 2000);
    expect(canAttemptCrime(old)).toBe(true);
  });
});

describe("getCooldownRemaining", () => {
  it("returns 0 when no last crime", () => {
    expect(getCooldownRemaining(null)).toBe(0);
  });

  it("returns positive ms when cooldown active", () => {
    const recent = new Date(Date.now() - 200);
    const remaining = getCooldownRemaining(recent);
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(1000);
  });

  it("returns 0 when cooldown expired", () => {
    const old = new Date(Date.now() - 5000);
    expect(getCooldownRemaining(old)).toBe(0);
  });
});
