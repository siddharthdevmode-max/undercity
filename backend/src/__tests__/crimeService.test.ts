// ============================================================
// CRIME SERVICE — UNIT TESTS
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────

const mocks = vi.hoisted(() => {
  const mockClientQuery = vi.fn();
  const mockPoolQuery   = vi.fn();
  const applyShadowPunishment = vi.fn().mockImplementation((outcome: unknown) => outcome);

  return { mockClientQuery, mockPoolQuery, applyShadowPunishment };
});

vi.mock("../config/database", () => ({
  pool: {
    query:   mocks.mockPoolQuery,
    connect: vi.fn().mockResolvedValue({ query: mocks.mockClientQuery }),
    on:      vi.fn(),
    totalCount: 1, idleCount: 1, waitingCount: 0,
  },
  withTransaction: vi.fn(),
  getPoolStats:    vi.fn().mockReturnValue({ total: 1, idle: 1, waiting: 0 }),
}));

vi.mock("../config/redis", () => ({
  default: { get: vi.fn().mockResolvedValue(null), set: vi.fn(), on: vi.fn(), status: "ready" },
  redis:   { get: vi.fn().mockResolvedValue(null), set: vi.fn(), on: vi.fn(), status: "ready" },
}));

vi.mock("../services/crimeEngine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/crimeEngine")>();
  return {
    ...actual,
    resolveCrimeOutcome: vi.fn().mockReturnValue({
      outcome:       "success",
      reward_money:  1000,
      reward_points: 10,
      xp_gained:     100,
      xp_lost:       0,
      cpl_change:    2,
      jail_seconds:  0,
      life_loss:     0,
      money_loss:    0,
      special:       null,
      message:       "You succeeded",
    }),
  };
});

vi.mock("../services/shadowPunish", () => ({
  applyShadowPunishment: mocks.applyShadowPunishment,
}));

vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  getRequestLogger: vi.fn().mockReturnValue({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}));

// ── Import after mocks ─────────────────────────────────────

import {
  assertCanAttempt,
  assertCrimeRequirements,
  calculateOutcome,
  buildUpdatedStats,
} from "../services/crimeService";

import {
  JailError,
  HospitalError,
  RateLimitError,
  ForbiddenError,
  ValidationError,
} from "../utils/errors";

import type { UserRow }                      from "../models/userModels";
import type { CrimeDefinition, CrimeProgress } from "../models/crimeModels";

// ── Factories ──────────────────────────────────────────────

function makeUser(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id:                  1,
    firebase_uid:        "uid-123",
    email:               "test@test.com",
    username:            "testplayer",
    level:               1,
    money:               1000,
    points:              0,
    nerve:               30,
    max_nerve:           30,
    life:                100,
    max_life:            100,
    hospital_until:      null,
    jail_until:          null,
    federal_jail_until:  null,
    last_crime_at:       null,
    is_shadow_banned:    false,
    is_hard_banned:      false,
    is_admin:            false,
    is_developer:        false,
    trust_score:         100,
    total_flags:         0,
    created_at:          new Date().toISOString(),
    user_tier:           "player",
    tier_expires_at:     null,
    tier_granted_at:     null,
    tier_granted_by:     null,
    last_nerve_update:   null,
    ...overrides,
  };
}

function makeCrime(overrides: Partial<CrimeDefinition> = {}): CrimeDefinition {
  return {
    id:               1,
    crime_key:        "pickpocket",
    name:             "Pickpocket",
    tier:             1,
    unlock_level:     1,
    nerve_cost:       5,
    min_reward:       100,
    max_reward:       500,
    jail_min_seconds: 60,
    jail_max_seconds: 300,
    is_federal:       false,
    ...overrides,
  };
}

function makeProgress(overrides: Partial<CrimeProgress> = {}): CrimeProgress {
  return {
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
    ...overrides,
  };
}

const trustClean = { isShadowBanned: false, trustScore: 100 };

// ============================================================
// assertCanAttempt
// ============================================================

describe("assertCanAttempt", () => {

  it("passes for a clean user with no restrictions", () => {
    expect(() => assertCanAttempt(makeUser())).not.toThrow();
  });

  it("throws RateLimitError when last_crime_at is less than 1 second ago", () => {
    const user = makeUser({ last_crime_at: new Date(Date.now() - 100).toISOString() });
    expect(() => assertCanAttempt(user)).toThrow(RateLimitError);
  });

  it("passes when last_crime_at is exactly 1 second ago", () => {
    const user = makeUser({ last_crime_at: new Date(Date.now() - 1001).toISOString() });
    expect(() => assertCanAttempt(user)).not.toThrow();
  });

  it("passes when last_crime_at is null (first crime ever)", () => {
    expect(() => assertCanAttempt(makeUser({ last_crime_at: null }))).not.toThrow();
  });

  it("throws HospitalError when hospital_until is in the future", () => {
    const hospitalUntil = new Date(Date.now() + 3_600_000).toISOString();
    expect(() => assertCanAttempt(makeUser({ hospital_until: hospitalUntil }))).toThrow(HospitalError);
  });

  it("HospitalError has correct secondsRemaining", () => {
    const hospitalUntil = new Date(Date.now() + 60_000).toISOString();
    const user = makeUser({ hospital_until: hospitalUntil });
    try {
      assertCanAttempt(user);
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(HospitalError);
      const e = err as HospitalError;
      expect(e.secondsRemaining).toBeGreaterThan(0);
      expect(e.secondsRemaining).toBeLessThanOrEqual(60);
    }
  });

  it("does NOT throw HospitalError when hospital_until is in the past", () => {
    const hospitalUntil = new Date(Date.now() - 1000).toISOString();
    expect(() => assertCanAttempt(makeUser({ hospital_until: hospitalUntil }))).not.toThrow();
  });

  it("throws JailError (federal) when federal_jail_until is in the future", () => {
    const federalJail = new Date(Date.now() + 3_600_000).toISOString();
    const user = makeUser({ federal_jail_until: federalJail });
    try {
      assertCanAttempt(user);
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(JailError);
      expect((err as JailError).jailType).toBe("federal");
    }
  });

  it("throws JailError (normal) when jail_until is in the future", () => {
    const jailUntil = new Date(Date.now() + 3_600_000).toISOString();
    const user = makeUser({ jail_until: jailUntil });
    try {
      assertCanAttempt(user);
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(JailError);
      expect((err as JailError).jailType).toBe("normal");
    }
  });

  it("federal jail takes priority over normal jail", () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    const user = makeUser({ jail_until: future, federal_jail_until: future });
    try {
      assertCanAttempt(user);
      expect.fail("Should have thrown");
    } catch (err) {
      expect((err as JailError).jailType).toBe("federal");
    }
  });

  it("HospitalError takes priority over jail", () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    const user = makeUser({ hospital_until: future, jail_until: future });
    expect(() => assertCanAttempt(user)).toThrow(HospitalError);
  });

  it("JailError has correct secondsRemaining", () => {
    const jailUntil = new Date(Date.now() + 120_000).toISOString();
    const user = makeUser({ jail_until: jailUntil });
    try {
      assertCanAttempt(user);
    } catch (err) {
      const e = err as JailError;
      expect(e.secondsRemaining).toBeGreaterThan(0);
      expect(e.secondsRemaining).toBeLessThanOrEqual(120);
    }
  });
});

// ============================================================
// assertCrimeRequirements
// ============================================================

describe("assertCrimeRequirements", () => {

  it("passes when level and nerve are sufficient", () => {
    expect(() => assertCrimeRequirements(makeUser({ level: 5, nerve: 10 }), makeCrime({ unlock_level: 5, nerve_cost: 10 }))).not.toThrow();
  });

  it("throws ForbiddenError when player level is below unlock_level", () => {
    expect(() => assertCrimeRequirements(makeUser({ level: 4 }), makeCrime({ unlock_level: 5 }))).toThrow(ForbiddenError);
  });

  it("ForbiddenError message contains required level", () => {
    try {
      assertCrimeRequirements(makeUser({ level: 1 }), makeCrime({ unlock_level: 10 }));
    } catch (err) {
      expect((err as Error).message).toContain("10");
    }
  });

  it("passes when player level equals unlock_level exactly", () => {
    expect(() => assertCrimeRequirements(makeUser({ level: 5 }), makeCrime({ unlock_level: 5 }))).not.toThrow();
  });

  it("throws ValidationError when nerve is insufficient", () => {
    expect(() => assertCrimeRequirements(makeUser({ nerve: 2 }), makeCrime({ nerve_cost: 5 }))).toThrow(ValidationError);
  });

  it("passes when nerve equals nerve_cost exactly", () => {
    expect(() => assertCrimeRequirements(makeUser({ nerve: 5 }), makeCrime({ nerve_cost: 5 }))).not.toThrow();
  });

  it("throws ForbiddenError BEFORE ValidationError (level checked first)", () => {
    expect(() => assertCrimeRequirements(makeUser({ level: 1, nerve: 0 }), makeCrime({ unlock_level: 10, nerve_cost: 5 }))).toThrow(ForbiddenError);
  });

  it("handles level/nerve as string (pg returns strings for numeric columns)", () => {
    const user = makeUser({ level: "5" as unknown as number, nerve: "10" as unknown as number });
    expect(() => assertCrimeRequirements(user, makeCrime({ unlock_level: 5, nerve_cost: 10 }))).not.toThrow();
  });
});

// ============================================================
// calculateOutcome
// ============================================================

describe("calculateOutcome", () => {

  beforeEach(() => {
    mocks.applyShadowPunishment.mockClear();
    mocks.applyShadowPunishment.mockImplementation((outcome: unknown) => outcome);
  });

  it("returns an outcome result for a clean user", () => {
    const result = calculateOutcome(makeCrime(), makeProgress(), null, makeUser(), trustClean);
    expect(result).toMatchObject({
      outcome:      expect.stringMatching(/success|fail|crit_fail|special/),
      reward_money: expect.any(Number),
      xp_gained:    expect.any(Number),
      jail_seconds: expect.any(Number),
    });
  });

  it("does not apply shadow punishment for CLEAN users", () => {
    const user = makeUser({ is_shadow_banned: false });
    calculateOutcome(makeCrime(), makeProgress(), null, user, { isShadowBanned: false, trustScore: 100 });
    expect(mocks.applyShadowPunishment).not.toHaveBeenCalled();
  });

  it("applies shadow punishment for shadow-banned non-admin users", () => {
    const user = makeUser({ is_shadow_banned: true, is_developer: false, is_admin: false });
    calculateOutcome(makeCrime(), makeProgress(), null, user, { isShadowBanned: true, trustScore: 10 });
    expect(mocks.applyShadowPunishment).toHaveBeenCalled();
  });

  it("does NOT apply shadow punishment for admin even if shadow-banned flag is set", () => {
    const user = makeUser({ is_shadow_banned: true, is_admin: true });
    calculateOutcome(makeCrime(), makeProgress(), null, user, { isShadowBanned: true, trustScore: 10 });
    expect(mocks.applyShadowPunishment).not.toHaveBeenCalled();
  });

  it("does NOT apply shadow punishment for developer even if shadow-banned flag is set", () => {
    const user = makeUser({ is_shadow_banned: true, is_developer: true });
    calculateOutcome(makeCrime(), makeProgress(), null, user, { isShadowBanned: true, trustScore: 5 });
    expect(mocks.applyShadowPunishment).not.toHaveBeenCalled();
  });

  it("accepts an available special", () => {
    const special = {
      id: 1, crime_id: 1, title: "Big Score",
      description: "You found something rare",
      reward_money: 5000, reward_points: 50,
      unlock_crime_level: 0,
    };
    const result = calculateOutcome(makeCrime(), makeProgress(), special, makeUser(), trustClean);
    expect(result).toBeDefined();
  });
});

// ============================================================
// buildUpdatedStats
// ============================================================

describe("buildUpdatedStats", () => {

  const baseOutcome = {
    outcome:       "success" as const,
    reward_money:  500,
    reward_points: 5,
    xp_gained:     100,
    xp_lost:       0,
    cpl_change:    2,
    jail_seconds:  0,
    life_loss:     0,
    money_loss:    0,
    special:       null,
    message:       "Success",
  };

  it("deducts nerve_cost from current nerve", () => {
    const stats = buildUpdatedStats(makeUser({ nerve: 30 }), makeCrime({ nerve_cost: 5 }), makeProgress(), baseOutcome, 0);
    expect(stats.nerve).toBe(25);
  });

  it("nerve never goes below 0", () => {
    const stats = buildUpdatedStats(makeUser({ nerve: 3 }), makeCrime({ nerve_cost: 10 }), makeProgress(), baseOutcome, 0);
    expect(stats.nerve).toBe(0);
  });

  it("adds reward_money to current money", () => {
    const stats = buildUpdatedStats(makeUser({ money: 1000 }), makeCrime(), makeProgress(), { ...baseOutcome, reward_money: 500 }, 0);
    expect(stats.money).toBe(1500);
  });

  it("deducts money_loss from current money", () => {
    const stats = buildUpdatedStats(makeUser({ money: 1000 }), makeCrime(), makeProgress(), { ...baseOutcome, reward_money: 0, money_loss: 200 }, 0);
    expect(stats.money).toBe(800);
  });

  it("money CAN go negative (debt mechanic)", () => {
    const stats = buildUpdatedStats(
      makeUser({ money: 100 }),
      makeCrime({ tier: 3 }),
      makeProgress(),
      { ...baseOutcome, outcome: "crit_fail", reward_money: 0, money_loss: 500 },
      0
    );
    expect(stats.money).toBe(-400);
  });

  it("life loss reduces current life, minimum 1", () => {
    const stats = buildUpdatedStats(
      makeUser({ life: 50 }),
      makeCrime(),
      makeProgress(),
      { ...baseOutcome, outcome: "crit_fail", life_loss: 80 },
      0
    );
    expect(stats.life).toBe(1);
  });

  it("adds XP on success", () => {
    const stats = buildUpdatedStats(makeUser(), makeCrime(), makeProgress({ crime_xp: 100 }), { ...baseOutcome, xp_gained: 50 }, 0);
    expect(stats.crimeXp).toBe(150);
  });

  it("deducts XP on failure, never below 0", () => {
    const stats = buildUpdatedStats(
      makeUser(), makeCrime(), makeProgress({ crime_xp: 30 }),
      { ...baseOutcome, outcome: "fail", xp_gained: 0, xp_lost: 50 },
      0
    );
    expect(stats.crimeXp).toBe(0);
  });

  it("increments attempts by 1", () => {
    const stats = buildUpdatedStats(makeUser(), makeCrime(), makeProgress({ attempts: 5 }), baseOutcome, 0);
    expect(stats.attempts).toBe(6);
  });

  it("increments successes on success outcome", () => {
    const stats = buildUpdatedStats(makeUser(), makeCrime(), makeProgress({ successes: 3 }), baseOutcome, 0);
    expect(stats.successes).toBe(4);
  });

  it("increments successes on special outcome", () => {
    const stats = buildUpdatedStats(makeUser(), makeCrime(), makeProgress({ successes: 2 }), { ...baseOutcome, outcome: "special" }, 0);
    expect(stats.successes).toBe(3);
  });

  it("increments failures on fail outcome", () => {
    const stats = buildUpdatedStats(
      makeUser(), makeCrime(), makeProgress({ failures: 1 }),
      { ...baseOutcome, outcome: "fail", reward_money: 0 },
      0
    );
    expect(stats.failures).toBe(2);
  });

  it("increments crit_failures on crit_fail outcome", () => {
    const stats = buildUpdatedStats(
      makeUser(), makeCrime(), makeProgress({ crit_failures: 2 }),
      { ...baseOutcome, outcome: "crit_fail", reward_money: 0 },
      0
    );
    expect(stats.critFailures).toBe(3);
  });

  it("sets jailUntil for normal crime crit_fail with jail_seconds > 0", () => {
    const stats = buildUpdatedStats(
      makeUser(), makeCrime({ is_federal: false }), makeProgress(),
      { ...baseOutcome, outcome: "crit_fail", jail_seconds: 300 },
      0
    );
    expect(stats.jailUntil).toBeInstanceOf(Date);
    expect(stats.federalJailUntil).toBeNull();
  });

  it("sets federalJailUntil for federal crime crit_fail", () => {
    const stats = buildUpdatedStats(
      makeUser(), makeCrime({ is_federal: true }), makeProgress(),
      { ...baseOutcome, outcome: "crit_fail", jail_seconds: 600 },
      0
    );
    expect(stats.federalJailUntil).toBeInstanceOf(Date);
    expect(stats.jailUntil).toBeNull();
  });

  it("jailUntil is approximately now + jail_seconds", () => {
    const before = Date.now();
    const stats  = buildUpdatedStats(
      makeUser(), makeCrime({ is_federal: false }), makeProgress(),
      { ...baseOutcome, outcome: "crit_fail", jail_seconds: 300 },
      0
    );
    const after  = Date.now();
    const jailMs = stats.jailUntil!.getTime();
    expect(jailMs).toBeGreaterThanOrEqual(before + 300_000 - 100);
    expect(jailMs).toBeLessThanOrEqual(after  + 300_000 + 100);
  });

  it("no jailUntil when jail_seconds is 0", () => {
    const stats = buildUpdatedStats(makeUser(), makeCrime(), makeProgress(), { ...baseOutcome, jail_seconds: 0 }, 0);
    expect(stats.jailUntil).toBeNull();
  });

  it("nerve is capped at maxNerve", () => {
    const stats = buildUpdatedStats(makeUser({ nerve: 30, max_nerve: 30 }), makeCrime({ nerve_cost: 5 }), makeProgress(), baseOutcome, 0);
    expect(stats.nerve).toBeLessThanOrEqual(stats.maxNerve);
  });

  it("points accumulate correctly", () => {
    const stats = buildUpdatedStats(makeUser({ points: 100 }), makeCrime(), makeProgress(), { ...baseOutcome, reward_points: 50 }, 0);
    expect(stats.points).toBe(150);
  });

  it("calculates maxLife from player level: 100 + (level-1)*25", () => {
    const stats = buildUpdatedStats(makeUser({ level: 2 }), makeCrime(), makeProgress(), baseOutcome, 0);
    expect(stats.maxLife).toBe(125);
  });

  it("crime level is recalculated from updated XP", () => {
    const stats = buildUpdatedStats(makeUser(), makeCrime(), makeProgress({ crime_xp: 0 }), { ...baseOutcome, xp_gained: 1000 }, 0);
    expect(typeof stats.crimeLevel).toBe("number");
    expect(stats.crimeLevel).toBeGreaterThanOrEqual(0);
  });

  it("hiddenCpl increases on success", () => {
    const stats = buildUpdatedStats(makeUser(), makeCrime(), makeProgress({ hidden_cpl: 5 }), { ...baseOutcome, cpl_change: 3 }, 0);
    expect(stats.hiddenCpl).toBeGreaterThan(5);
  });

  it("hiddenCpl never goes below 0", () => {
    const stats = buildUpdatedStats(
      makeUser(), makeCrime(), makeProgress({ hidden_cpl: 1 }),
      { ...baseOutcome, outcome: "fail", cpl_change: -10 },
      0
    );
    expect(stats.hiddenCpl).toBeGreaterThanOrEqual(0);
  });
});
