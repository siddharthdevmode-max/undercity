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
  it("returns 0 for null", ()      => expect(toNumber(null)).toBe(0));
  it("returns 0 for undefined", () => expect(toNumber(undefined)).toBe(0));
  it("converts string number", ()  => expect(toNumber("42")).toBe(42));
  it("converts actual number", ()  => expect(toNumber(100)).toBe(100));
  it("converts decimal string", () => expect(toNumber("3.14")).toBeCloseTo(3.14));
  it("converts 0 string", ()       => expect(toNumber("0")).toBe(0));
  it("returns 0 for empty string",() => expect(toNumber("")).toBe(0));
});

// ============================================================
// isFutureDate
// ============================================================

describe("isFutureDate", () => {
  it("returns false for null/undefined", () => {
    expect(isFutureDate(null)).toBe(false);
    expect(isFutureDate(undefined)).toBe(false);
    expect(isFutureDate("")).toBe(false);
  });

  it("returns true for future date string", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isFutureDate(future)).toBe(true);
  });

  it("returns false for past date string", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(isFutureDate(past)).toBe(false);
  });

  it("returns true for future Date object", () => {
    expect(isFutureDate(new Date(Date.now() + 60_000))).toBe(true);
  });

  it("returns false for past Date object", () => {
    expect(isFutureDate(new Date(Date.now() - 60_000))).toBe(false);
  });
});

// ============================================================
// calcMaxLife
// ============================================================

describe("calcMaxLife", () => {
  it("returns 100 at level 1", () => {
    expect(calcMaxLife(1)).toBe(100);
  });

  it("increases by 25 per level", () => {
    expect(calcMaxLife(2)).toBe(125);
    expect(calcMaxLife(3)).toBe(150);
    expect(calcMaxLife(10)).toBe(325);
  });

  it("is monotonically increasing", () => {
    const l1 = calcMaxLife(5);
    const l2 = calcMaxLife(10);
    const l3 = calcMaxLife(50);
    expect(l2).toBeGreaterThan(l1);
    expect(l3).toBeGreaterThan(l2);
  });
});

// ============================================================
// calcMaxNerve
// ============================================================

describe("calcMaxNerve", () => {
  it("returns 30 at 0 XP (base)", () => {
    expect(calcMaxNerve(0)).toBe(30);
  });

  it("returns more than 30 with XP", () => {
    expect(calcMaxNerve(100_000)).toBeGreaterThan(30);
  });

  it("never exceeds 130 (cap)", () => {
    expect(calcMaxNerve(99_999_999)).toBe(130);
    expect(calcMaxNerve(999_999_999)).toBe(130);
  });

  it("is monotonically increasing with XP", () => {
    const n1 = calcMaxNerve(10_000);
    const n2 = calcMaxNerve(100_000);
    const n3 = calcMaxNerve(1_000_000);
    expect(n2).toBeGreaterThanOrEqual(n1);
    expect(n3).toBeGreaterThanOrEqual(n2);
  });

  it("returns integer (floored)", () => {
    const nerve = calcMaxNerve(50_000);
    expect(nerve).toBe(Math.floor(nerve));
  });
});

// ============================================================
// canAttemptCrime
// ============================================================

describe("canAttemptCrime", () => {
  it("returns true when lastCrimeAt is null", () => {
    expect(canAttemptCrime(null)).toBe(true);
    expect(canAttemptCrime(undefined)).toBe(true);
    expect(canAttemptCrime("")).toBe(true);
  });

  it("returns false when last crime was less than 1s ago", () => {
    const recent = new Date(Date.now() - 500).toISOString();
    expect(canAttemptCrime(recent)).toBe(false);
  });

  it("returns true when last crime was more than 1s ago", () => {
    const old = new Date(Date.now() - 2000).toISOString();
    expect(canAttemptCrime(old)).toBe(true);
  });

  it("returns true for invalid date string", () => {
    expect(canAttemptCrime("not-a-date")).toBe(true);
  });
});

// ============================================================
// getCooldownRemaining
// ============================================================

describe("getCooldownRemaining", () => {
  it("returns 0 when no lastCrimeAt", () => {
    expect(getCooldownRemaining(null)).toBe(0);
    expect(getCooldownRemaining(undefined)).toBe(0);
  });

  it("returns 0 when cooldown has passed", () => {
    const old = new Date(Date.now() - 2000).toISOString();
    expect(getCooldownRemaining(old)).toBe(0);
  });

  it("returns positive ms when still in cooldown", () => {
    const recent = new Date(Date.now() - 200).toISOString();
    const remaining = getCooldownRemaining(recent);
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(1000);
  });

  it("returns integer (ceil)", () => {
    const recent = new Date(Date.now() - 100).toISOString();
    const remaining = getCooldownRemaining(recent);
    expect(remaining).toBe(Math.ceil(remaining));
  });
});
