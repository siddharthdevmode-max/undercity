import { describe, it, expect, vi } from "vitest";
import {
  toNumber,
  isFutureDate,
  calcMaxLife,
  calcMaxNerve,
  canAttemptCrime,
  getCooldownRemaining,
  isContributor,
  isCitizen,
  isFreePlayer,
  hasPaidTier,
  getUserByFirebaseUid,
  isImmuneToAntiCheat,
} from "../models/userModels";

// ============================================================
// toNumber
// ============================================================

describe("toNumber", () => {
  it("returns 0 for null",          () => expect(toNumber(null)).toBe(0));
  it("returns 0 for undefined",     () => expect(toNumber(undefined)).toBe(0));
  it("converts string number",      () => expect(toNumber("42")).toBe(42));
  it("converts actual number",      () => expect(toNumber(100)).toBe(100));
  it("converts decimal string",     () => expect(toNumber("3.14")).toBeCloseTo(3.14));
  it("converts 0 string",           () => expect(toNumber("0")).toBe(0));
  it("returns 0 for empty string",  () => expect(toNumber("")).toBe(0));
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
    // 100k XP is genuine early game — step rounding keeps it at 30.
    // Use 500k XP: raw ≈ 43.8 → floor 43 → step 40 → passes > 30.
    expect(calcMaxNerve(500_000)).toBeGreaterThan(30);
  });

  it("never exceeds 130 (cap)", () => {
    expect(calcMaxNerve(99_999_999)).toBe(130);
    expect(calcMaxNerve(999_999_999)).toBe(130);
  });

  it("is monotonically increasing with XP", () => {
    const n1 = calcMaxNerve(10_000);
    const n2 = calcMaxNerve(500_000);
    const n3 = calcMaxNerve(1_000_000);
    expect(n2).toBeGreaterThanOrEqual(n1);
    expect(n3).toBeGreaterThanOrEqual(n2);
  });

  it("returns integer (floored to nearest 5)", () => {
    const nerve = calcMaxNerve(50_000);
    expect(nerve % 5).toBe(0);
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

describe("isContributor / isCitizen / isFreePlayer / hasPaidTier", () => {
  it("isContributor returns true for contributor", () => {
    expect(isContributor({ user_tier: "contributor" })).toBe(true);
    expect(isContributor({ user_tier: "player" })).toBe(false);
    expect(isContributor({ user_tier: "citizen" })).toBe(false);
  });

  it("isCitizen returns true for citizen", () => {
    expect(isCitizen({ user_tier: "citizen" })).toBe(true);
    expect(isCitizen({ user_tier: "player" })).toBe(false);
    expect(isCitizen({ user_tier: "contributor" })).toBe(false);
  });

  it("isFreePlayer returns true only for player", () => {
    expect(isFreePlayer({ user_tier: "player" })).toBe(true);
    expect(isFreePlayer({ user_tier: "citizen" })).toBe(false);
    expect(isFreePlayer({ user_tier: "contributor" })).toBe(false);
  });

  it("hasPaidTier returns true for citizen and contributor", () => {
    expect(hasPaidTier({ user_tier: "citizen" })).toBe(true);
    expect(hasPaidTier({ user_tier: "contributor" })).toBe(true);
    expect(hasPaidTier({ user_tier: "player" })).toBe(false);
  });
});

describe("getUserByFirebaseUid", () => {
  it("returns null when user not found", async () => {
    const { pool } = await import("../config/database");
    const { getUserByFirebaseUid } = await import("../models/userModels");
    const mockClient = {
      query: vi.fn().mockResolvedValueOnce({ rows: [] }),
    };
    vi.mocked(pool as unknown as { connect: ReturnType<typeof vi.fn> });
    const result = await getUserByFirebaseUid(mockClient as never, "uid-999");
    expect(result).toBeNull();
  });

  it("returns user row when found", async () => {
    const { getUserByFirebaseUid } = await import("../models/userModels");
    const fakeUser = {
      id: 1, firebase_uid: "uid-001", username: "testplayer",
      level: 1, money: 750, points: 0,
      nerve: 30, max_nerve: 30,
      energy: 100, max_energy: 100,
      life: 100, max_life: 100, happiness: 50,
      hospital_until: null, jail_until: null,
      federal_jail_until: null, last_crime_at: null,
      is_shadow_banned: false, is_hard_banned: false,
      is_admin: false, is_developer: false,
      trust_score: 100, total_flags: 0,
      created_at: new Date().toISOString(),
      user_tier: "player", tier_expires_at: null,
      tier_granted_at: null, tier_granted_by: null,
      last_nerve_update: null, email: "test@test.com",
    };
    const mockClient = {
      query: vi.fn().mockResolvedValueOnce({ rows: [fakeUser] }),
    };
    const result = await getUserByFirebaseUid(mockClient as never, "uid-001");
    expect(result).not.toBeNull();
    expect(result!.username).toBe("testplayer");
  });
});
