// ============================================================
// CRIME SERVICE — UNIT TESTS
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────

const mocks = vi.hoisted(() => {
  const mockClientQuery = vi.fn();
  const mockPoolQuery = vi.fn();
  const mockClient = { query: mockClientQuery };
  const mockApplyShadowPunishment = vi.fn((outcome: unknown) => outcome);

  return {
    mockClientQuery,
    mockPoolQuery,
    mockClient,
    mockApplyShadowPunishment,
  };
});

vi.mock("../config/database", () => ({
  pool: {
    query: mocks.mockPoolQuery,
    connect: vi.fn().mockResolvedValue(mocks.mockClient),
    on: vi.fn(),
    totalCount: 1,
    idleCount: 1,
    waitingCount: 0,
  },
  withTransaction: vi.fn(),
  getPoolStats: vi.fn().mockReturnValue({ total: 1, idle: 1, waiting: 0 }),
}));

vi.mock("../config/redis", () => ({
  default: { get: vi.fn(), set: vi.fn(), on: vi.fn(), status: "ready" },
  redis: { get: vi.fn(), set: vi.fn(), on: vi.fn(), status: "ready" },
}));

vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  getRequestLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock("../services/shadowPunish", () => ({
  applyShadowPunishment: mocks.mockApplyShadowPunishment,
}));

// ── Import after mocks ─────────────────────────────────────

import {
  assertCanAttempt,
  assertCrimeRequirements,
  buildUpdatedStats,
  calculateOutcome,
} from "../services/crimeService";
import type { UserRow } from "../models/userModels";
import type { CrimeDefinition, CrimeProgress } from "../models/crimeModels";
import type { OutcomeResult } from "../services/crimeEngine";
import {
  JailError,
  HospitalError,
  RateLimitError,
  ForbiddenError,
  ValidationError,
} from "../utils/errors";

// ============================================================
// HELPERS
// ============================================================

function makeUser(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: 1,
    firebase_uid: "test-uid-abc123",
    email: "test@test.com",
    username: "testuser",
    level: 1,
    money: 1000,
    points: 0,
    nerve: 30,
    max_nerve: 30,
    energy: 100,
    max_energy: 100,
    life: 100,
    max_life: 100,
    happiness: 50,
    hospital_until: null,
    jail_until: null,
    federal_jail_until: null,
    last_crime_at: null,
    is_shadow_banned: false,
    is_hard_banned: false,
    is_admin: false,
    is_developer: false,
    trust_score: 100,
    total_flags: 0,
    created_at: new Date().toISOString(),
    user_tier: "player",
    tier_expires_at: null,
    tier_granted_at: null,
    tier_granted_by: null,
    last_nerve_update: null,
    ...overrides,
  };
}

function makeCrime(overrides: Partial<CrimeDefinition> = {}): CrimeDefinition {
  return {
    id: 1,
    crime_key: "shoplift",
    name: "Shoplift",
    tier: 1,
    unlock_level: 1,
    nerve_cost: 2,
    min_reward: 100,
    max_reward: 500,
    jail_min_seconds: 0,
    jail_max_seconds: 0,
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

function makeOutcome(overrides: Partial<OutcomeResult> = {}): OutcomeResult {
  return {
    outcome: "success",
    reward_money: 200,
    reward_points: 0,
    xp_gained: 100,
    xp_lost: 0,
    cpl_change: 2,
    jail_seconds: 0,
    life_loss: 0,
    money_loss: 0,
    special: null,
    message: "You succeeded!",
    ...overrides,
  };
}

// ============================================================
// assertCanAttempt
// ============================================================

describe("assertCanAttempt", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not throw for a clean user", () => {
    expect(() => assertCanAttempt(makeUser())).not.toThrow();
  });

  it("throws RateLimitError when crime cooldown active", () => {
    const user = makeUser({ last_crime_at: new Date().toISOString() });
    expect(() => assertCanAttempt(user)).toThrow(RateLimitError);
  });

  it("throws HospitalError when user is hospitalized", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(() => assertCanAttempt(makeUser({ hospital_until: future }))).toThrow(HospitalError);
  });

  it("throws JailError (federal) when in federal jail", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(() => assertCanAttempt(makeUser({ federal_jail_until: future }))).toThrow(JailError);
  });

  it("throws JailError (normal) when in regular jail", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(() => assertCanAttempt(makeUser({ jail_until: future }))).toThrow(JailError);
  });

  it("does not throw when jail_until is in the past", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(() => assertCanAttempt(makeUser({ jail_until: past }))).not.toThrow();
  });

  it("hospital check takes priority over jail check", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const user = makeUser({ hospital_until: future, jail_until: future });
    expect(() => assertCanAttempt(user)).toThrow(HospitalError);
  });

  it("JailError for federal jail has correct jailType", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    try {
      assertCanAttempt(makeUser({ federal_jail_until: future }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(JailError);
      expect((err as JailError).jailType).toBe("federal");
    }
  });

  it("JailError for normal jail has correct jailType", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    try {
      assertCanAttempt(makeUser({ jail_until: future }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(JailError);
      expect((err as JailError).jailType).toBe("normal");
    }
  });
});

// ============================================================
// assertCrimeRequirements
// ============================================================

describe("assertCrimeRequirements", () => {
  it("does not throw when all requirements are met", () => {
    const user = makeUser({ level: 10, nerve: 30 });
    const crime = makeCrime({ unlock_level: 5, nerve_cost: 10 });
    expect(() => assertCrimeRequirements(user, crime)).not.toThrow();
  });

  it("throws ForbiddenError when level too low", () => {
    const user = makeUser({ level: 1 });
    const crime = makeCrime({ unlock_level: 5 });
    expect(() => assertCrimeRequirements(user, crime)).toThrow(ForbiddenError);
  });

  it("throws ValidationError when not enough nerve", () => {
    const user = makeUser({ nerve: 1 });
    const crime = makeCrime({ nerve_cost: 10 });
    expect(() => assertCrimeRequirements(user, crime)).toThrow(ValidationError);
  });

  it("does not throw when level exactly equals unlock_level", () => {
    const user = makeUser({ level: 5, nerve: 20 });
    const crime = makeCrime({ unlock_level: 5, nerve_cost: 5 });
    expect(() => assertCrimeRequirements(user, crime)).not.toThrow();
  });

  it("does not throw when nerve exactly equals nerve_cost", () => {
    const user = makeUser({ level: 10, nerve: 5 });
    const crime = makeCrime({ unlock_level: 1, nerve_cost: 5 });
    expect(() => assertCrimeRequirements(user, crime)).not.toThrow();
  });

  it("ForbiddenError message mentions required level", () => {
    const user = makeUser({ level: 1 });
    const crime = makeCrime({ unlock_level: 15 });
    try {
      assertCrimeRequirements(user, crime);
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as Error).message).toContain("15");
    }
  });

  it("ValidationError includes nerve details", () => {
    const user = makeUser({ nerve: 2 });
    const crime = makeCrime({ nerve_cost: 10 });
    try {
      assertCrimeRequirements(user, crime);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
    }
  });
});

// ============================================================
// buildUpdatedStats
// ============================================================

describe("buildUpdatedStats", () => {
  beforeEach(() => vi.clearAllMocks());

  it("correctly adds reward money to user balance", () => {
    const stats = buildUpdatedStats(
      makeUser({ money: 500 }),
      makeCrime({ nerve_cost: 5, tier: 1 }),
      makeProgress(),
      makeOutcome({ reward_money: 200, money_loss: 0 }),
      0
    );
    expect(stats.money).toBe(700);
  });

  it("correctly deducts money_loss from user balance", () => {
    const stats = buildUpdatedStats(
      makeUser({ money: 1000 }),
      makeCrime({ nerve_cost: 5, tier: 1 }),
      makeProgress(),
      makeOutcome({ reward_money: 0, money_loss: 200 }),
      0
    );
    expect(stats.money).toBe(800);
  });

  it("tier 1 money NEVER goes below 0 (defense in depth)", () => {
    const stats = buildUpdatedStats(
      makeUser({ money: 100, nerve: 30 }),
      makeCrime({ nerve_cost: 2, tier: 1 }),
      makeProgress(),
      makeOutcome({ reward_money: 0, money_loss: 500 }),
      0
    );
    expect(stats.money).toBeGreaterThanOrEqual(0);
  });

  it("tier 2 money NEVER goes below 0 (defense in depth)", () => {
    const stats = buildUpdatedStats(
      makeUser({ money: 50, nerve: 30 }),
      makeCrime({ nerve_cost: 7, tier: 2 }),
      makeProgress(),
      makeOutcome({ reward_money: 0, money_loss: 500 }),
      0
    );
    expect(stats.money).toBeGreaterThanOrEqual(0);
  });

  it("tier 3 money CAN go negative (debt mechanic)", () => {
    const stats = buildUpdatedStats(
      makeUser({ money: 100, nerve: 30 }),
      makeCrime({ nerve_cost: 12, tier: 3 }),
      makeProgress(),
      makeOutcome({ reward_money: 0, money_loss: 100_000 }),
      0
    );
    expect(stats.money).toBeLessThan(0);
  });

  it("tier 4 money CAN go negative (debt mechanic)", () => {
    const stats = buildUpdatedStats(
      makeUser({ money: 0, nerve: 30 }),
      makeCrime({ nerve_cost: 17, tier: 4 }),
      makeProgress(),
      makeOutcome({ reward_money: 0, money_loss: 750_000 }),
      0
    );
    expect(stats.money).toBeLessThan(0);
  });

  it("tier 5 money CAN go negative (debt mechanic)", () => {
    const stats = buildUpdatedStats(
      makeUser({ money: 0, nerve: 30 }),
      makeCrime({ nerve_cost: 22, tier: 5 }),
      makeProgress(),
      makeOutcome({ reward_money: 0, money_loss: 3_000_000 }),
      0
    );
    expect(stats.money).toBeLessThan(0);
  });

  it("nerve is deducted by crime nerve_cost", () => {
    const stats = buildUpdatedStats(
      makeUser({ nerve: 30 }),
      makeCrime({ nerve_cost: 5 }),
      makeProgress(),
      makeOutcome(),
      0
    );
    expect(stats.nerve).toBe(25);
  });

  it("nerve never goes below 0", () => {
    const stats = buildUpdatedStats(
      makeUser({ nerve: 2 }),
      makeCrime({ nerve_cost: 10 }),
      makeProgress(),
      makeOutcome(),
      0
    );
    expect(stats.nerve).toBeGreaterThanOrEqual(0);
  });

  it("nerve is capped at updatedMaxNerve", () => {
    const stats = buildUpdatedStats(
      makeUser({ nerve: 30, max_nerve: 30 }),
      makeCrime({ nerve_cost: 0 }),
      makeProgress(),
      makeOutcome(),
      0
    );
    expect(stats.nerve).toBeLessThanOrEqual(stats.maxNerve);
  });

  it("life never goes below 1 (players cannot die)", () => {
    const stats = buildUpdatedStats(
      makeUser({ life: 5 }),
      makeCrime(),
      makeProgress(),
      makeOutcome({ life_loss: 100 }),
      0
    );
    expect(stats.life).toBe(1);
  });

  it("life decreases by life_loss amount (when above 1)", () => {
    const stats = buildUpdatedStats(
      makeUser({ life: 80 }),
      makeCrime(),
      makeProgress(),
      makeOutcome({ life_loss: 20 }),
      0
    );
    expect(stats.life).toBe(60);
  });

  it("sets jail_until for non-federal crime crit_fail", () => {
    const stats = buildUpdatedStats(
      makeUser(),
      makeCrime({ is_federal: false }),
      makeProgress(),
      makeOutcome({ outcome: "crit_fail", jail_seconds: 3600 }),
      0
    );
    expect(stats.jailUntil).not.toBeNull();
    expect(stats.federalJailUntil).toBeNull();
  });

  it("sets federalJailUntil for federal crime crit_fail", () => {
    const stats = buildUpdatedStats(
      makeUser(),
      makeCrime({ is_federal: true }),
      makeProgress(),
      makeOutcome({ outcome: "crit_fail", jail_seconds: 3600 }),
      0
    );
    expect(stats.federalJailUntil).not.toBeNull();
    expect(stats.jailUntil).toBeNull();
  });

  it("does NOT set jail when jail_seconds is 0", () => {
    const stats = buildUpdatedStats(
      makeUser(),
      makeCrime(),
      makeProgress(),
      makeOutcome({ outcome: "crit_fail", jail_seconds: 0 }),
      0
    );
    expect(stats.jailUntil).toBeNull();
    expect(stats.federalJailUntil).toBeNull();
  });

  it("jail expiry time is approximately now + jail_seconds", () => {
    const before = Date.now();
    const stats = buildUpdatedStats(
      makeUser(),
      makeCrime({ is_federal: false }),
      makeProgress(),
      makeOutcome({ outcome: "crit_fail", jail_seconds: 3600 }),
      0
    );
    const after = Date.now();

    expect(stats.jailUntil).not.toBeNull();
    const jailMs = stats.jailUntil!.getTime();
    expect(jailMs).toBeGreaterThanOrEqual(before + 3600 * 1000 - 100);
    expect(jailMs).toBeLessThanOrEqual(after + 3600 * 1000 + 100);
  });

  it("increments attempts counter on every crime", () => {
    const stats = buildUpdatedStats(
      makeUser(),
      makeCrime(),
      makeProgress({ attempts: 5 }),
      makeOutcome(),
      0
    );
    expect(stats.attempts).toBe(6);
  });

  it("increments successes on success outcome", () => {
    const stats = buildUpdatedStats(
      makeUser(),
      makeCrime(),
      makeProgress({ successes: 3 }),
      makeOutcome({ outcome: "success" }),
      0
    );
    expect(stats.successes).toBe(4);
  });

  it("increments successes on special outcome", () => {
    const stats = buildUpdatedStats(
      makeUser(),
      makeCrime(),
      makeProgress({ successes: 2 }),
      makeOutcome({ outcome: "special" }),
      0
    );
    expect(stats.successes).toBe(3);
  });

  it("increments failures on fail outcome", () => {
    const stats = buildUpdatedStats(
      makeUser(),
      makeCrime(),
      makeProgress({ failures: 1 }),
      makeOutcome({ outcome: "fail" }),
      0
    );
    expect(stats.failures).toBe(2);
  });

  it("increments critFailures on crit_fail outcome", () => {
    const stats = buildUpdatedStats(
      makeUser(),
      makeCrime(),
      makeProgress({ crit_failures: 2 }),
      makeOutcome({ outcome: "crit_fail", jail_seconds: 0 }),
      0
    );
    expect(stats.critFailures).toBe(3);
  });

  it("crime XP never goes below 0", () => {
    const stats = buildUpdatedStats(
      makeUser(),
      makeCrime(),
      makeProgress({ crime_xp: 10 }),
      makeOutcome({ xp_gained: 0, xp_lost: 10_000 }),
      0
    );
    expect(stats.crimeXp).toBeGreaterThanOrEqual(0);
  });

  it("crime XP increases on success", () => {
    const stats = buildUpdatedStats(
      makeUser(),
      makeCrime(),
      makeProgress({ crime_xp: 500 }),
      makeOutcome({ xp_gained: 150, xp_lost: 0 }),
      0
    );
    expect(stats.crimeXp).toBe(650);
  });

  it("points never go below 0", () => {
    const stats = buildUpdatedStats(
      makeUser({ points: 0 }),
      makeCrime(),
      makeProgress(),
      makeOutcome({ reward_points: 0 }),
      0
    );
    expect(stats.points).toBeGreaterThanOrEqual(0);
  });

  it("hiddenCpl never goes below 0", () => {
    const stats = buildUpdatedStats(
      makeUser(),
      makeCrime(),
      makeProgress({ hidden_cpl: 0 }),
      makeOutcome({ outcome: "crit_fail", cpl_change: -999 }),
      0
    );
    expect(stats.hiddenCpl).toBeGreaterThanOrEqual(0);
  });

  it("maxLife is correct for player level 1", () => {
    const stats = buildUpdatedStats(
      makeUser({ level: 1 }),
      makeCrime(),
      makeProgress(),
      makeOutcome(),
      0
    );
    expect(stats.maxLife).toBe(100);
  });

  it("maxLife increases with player level", () => {
    const stats10 = buildUpdatedStats(
      makeUser({ level: 10 }),
      makeCrime(),
      makeProgress(),
      makeOutcome(),
      0
    );
    const stats1 = buildUpdatedStats(
      makeUser({ level: 1 }),
      makeCrime(),
      makeProgress(),
      makeOutcome(),
      0
    );
    expect(stats10.maxLife).toBeGreaterThan(stats1.maxLife);
  });
});

// ============================================================
// calculateOutcome — trust score punishment
// ============================================================

describe("calculateOutcome — trust score punishment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockApplyShadowPunishment.mockImplementation((outcome: unknown) => outcome);
  });

  it("does NOT apply punishment for CLEAN users (score >= 70)", () => {
    calculateOutcome(
      makeCrime(),
      makeProgress(),
      null,
      makeUser({ trust_score: 100, is_admin: false, is_developer: false }),
      { isShadowBanned: false, trustScore: 100 }
    );
    expect(mocks.mockApplyShadowPunishment).not.toHaveBeenCalled();
  });

  it("does NOT apply punishment for CLEAN users at boundary (score = 70)", () => {
    calculateOutcome(
      makeCrime(),
      makeProgress(),
      null,
      makeUser({ trust_score: 70, is_admin: false, is_developer: false }),
      { isShadowBanned: false, trustScore: 70 }
    );
    expect(mocks.mockApplyShadowPunishment).not.toHaveBeenCalled();
  });

  it("DOES apply punishment for WATCHED users (score = 69)", () => {
    calculateOutcome(
      makeCrime(),
      makeProgress(),
      null,
      makeUser({ trust_score: 69, is_admin: false, is_developer: false }),
      { isShadowBanned: false, trustScore: 69 }
    );
    expect(mocks.mockApplyShadowPunishment).toHaveBeenCalled();
  });

  it("DOES apply punishment for SUSPICIOUS users (score = 40)", () => {
    calculateOutcome(
      makeCrime(),
      makeProgress(),
      null,
      makeUser({ trust_score: 40, is_admin: false, is_developer: false }),
      { isShadowBanned: false, trustScore: 40 }
    );
    expect(mocks.mockApplyShadowPunishment).toHaveBeenCalled();
  });

  it("DOES apply punishment for SHADOW_BANNED users (score = 10)", () => {
    calculateOutcome(
      makeCrime(),
      makeProgress(),
      null,
      makeUser({ trust_score: 10, is_shadow_banned: true, is_admin: false, is_developer: false }),
      { isShadowBanned: true, trustScore: 10 }
    );
    expect(mocks.mockApplyShadowPunishment).toHaveBeenCalled();
  });

  it("does NOT apply punishment for admins (immune)", () => {
    calculateOutcome(
      makeCrime(),
      makeProgress(),
      null,
      makeUser({ trust_score: 10, is_admin: true, is_developer: false }),
      { isShadowBanned: false, trustScore: 10 }
    );
    expect(mocks.mockApplyShadowPunishment).not.toHaveBeenCalled();
  });

  it("does NOT apply punishment for developers (immune)", () => {
    calculateOutcome(
      makeCrime(),
      makeProgress(),
      null,
      makeUser({ trust_score: 10, is_admin: false, is_developer: true }),
      { isShadowBanned: false, trustScore: 10 }
    );
    expect(mocks.mockApplyShadowPunishment).not.toHaveBeenCalled();
  });
});

// ============================================================
// crimeService — DB LOADER FUNCTIONS
// ============================================================

describe("loadCrime", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns parsed crime when found", async () => {
    const { loadCrime } = await import("../services/crimeService");
    mocks.mockClientQuery.mockResolvedValueOnce({
      rows: [{
        id: 1, crime_key: "shoplift", name: "Shoplift",
        tier: 1, unlock_level: 1, nerve_cost: 2,
        min_reward: 100, max_reward: 500,
        jail_min_seconds: 0, jail_max_seconds: 0,
        is_federal: false,
      }],
      rowCount: 1,
    });
    const crime = await loadCrime(mocks.mockClient as never, "shoplift");
    expect(crime.crime_key).toBe("shoplift");
    expect(crime.tier).toBe(1);
  });

  it("throws NotFoundError when crime not found", async () => {
    const { loadCrime } = await import("../services/crimeService");
    const { NotFoundError } = await import("../utils/errors");
    mocks.mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await expect(loadCrime(mocks.mockClient as never, "nonexistent")).rejects.toThrow(NotFoundError);
  });

  it("queries by crime_key with is_active = TRUE", async () => {
    const { loadCrime } = await import("../services/crimeService");
    mocks.mockClientQuery.mockResolvedValueOnce({
      rows: [{
        id: 1, crime_key: "pickpocket", name: "Pickpocket",
        tier: 1, unlock_level: 1, nerve_cost: 3,
        min_reward: 50, max_reward: 200,
        jail_min_seconds: 0, jail_max_seconds: 0, is_federal: false,
      }],
      rowCount: 1,
    });
    await loadCrime(mocks.mockClient as never, "pickpocket");
    expect(mocks.mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("is_active = TRUE"),
      ["pickpocket"]
    );
  });
});

describe("loadOrCreateProgress", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns progress row after upsert", async () => {
    const { loadOrCreateProgress } = await import("../services/crimeService");
    // First call: INSERT ON CONFLICT
    mocks.mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    // Second call: SELECT
    mocks.mockClientQuery.mockResolvedValueOnce({
      rows: [{
        id: 1, user_id: 1, crime_id: 1,
        crime_xp: 0, crime_level: 0, hidden_cpl: 0,
        attempts: 5, successes: 3, failures: 1,
        crit_failures: 1, specials_found_count: 0,
      }],
      rowCount: 1,
    });
    const progress = await loadOrCreateProgress(mocks.mockClient as never, 1, 1);
    expect(progress.attempts).toBe(5);
    expect(progress.user_id).toBe(1);
  });

  it("uses ON CONFLICT DO NOTHING for idempotent insert", async () => {
    const { loadOrCreateProgress } = await import("../services/crimeService");
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [{ id: 1, user_id: 2, crime_id: 3, crime_xp: 0, crime_level: 0, hidden_cpl: 0, attempts: 0, successes: 0, failures: 0, crit_failures: 0, specials_found_count: 0 }],
        rowCount: 1,
      });
    await loadOrCreateProgress(mocks.mockClient as never, 2, 3);
    expect(mocks.mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("ON CONFLICT"),
      [2, 3]
    );
  });
});

describe("pickAvailableSpecial", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when no specials available", async () => {
    const { pickAvailableSpecial } = await import("../services/crimeService");
    mocks.mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const result = await pickAvailableSpecial(mocks.mockClient as never, 1, 1, 0);
    expect(result).toBeNull();
  });

  it("returns a parsed special when available", async () => {
    const { pickAvailableSpecial } = await import("../services/crimeService");
    mocks.mockClientQuery.mockResolvedValueOnce({
      rows: [{
        id: 5, crime_id: 1,
        title: "Lucky Break", description: "You found extra cash!",
        reward_money: 1000, reward_points: 10, unlock_crime_level: 0,
      }],
      rowCount: 1,
    });
    const special = await pickAvailableSpecial(mocks.mockClient as never, 1, 1, 5);
    expect(special).not.toBeNull();
    expect(special!.title).toBe("Lucky Break");
    expect(special!.reward_money).toBe(1000);
  });

  it("returns one of multiple available specials (random selection)", async () => {
    const { pickAvailableSpecial } = await import("../services/crimeService");
    const specials = [
      { id: 1, crime_id: 1, title: "A", description: "desc A", reward_money: 100, reward_points: 5, unlock_crime_level: 0 },
      { id: 2, crime_id: 1, title: "B", description: "desc B", reward_money: 200, reward_points: 10, unlock_crime_level: 0 },
      { id: 3, crime_id: 1, title: "C", description: "desc C", reward_money: 300, reward_points: 15, unlock_crime_level: 0 },
    ];
    mocks.mockClientQuery.mockResolvedValue({ rows: specials, rowCount: 3 });

    const titles = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const special = await pickAvailableSpecial(mocks.mockClient as never, 1, 1, 10);
      if (special) titles.add(special.title);
    }
    // With 3 options and 30 tries, should see more than 1 unique title
    expect(titles.size).toBeGreaterThan(1);
  });

  it("filters by unlock_crime_level", async () => {
    const { pickAvailableSpecial } = await import("../services/crimeService");
    mocks.mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await pickAvailableSpecial(mocks.mockClient as never, 1, 1, 3);
    expect(mocks.mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("unlock_crime_level"),
      [1, 3, 1]
    );
  });
});

describe("saveSpecialDiscovery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when special is newly discovered", async () => {
    const { saveSpecialDiscovery } = await import("../services/crimeService");
    mocks.mockClientQuery.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });
    const result = await saveSpecialDiscovery(mocks.mockClient as never, 1, 5);
    expect(result).toBe(true);
  });

  it("returns false when special was already discovered (ON CONFLICT)", async () => {
    const { saveSpecialDiscovery } = await import("../services/crimeService");
    mocks.mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const result = await saveSpecialDiscovery(mocks.mockClient as never, 1, 5);
    expect(result).toBe(false);
  });

  it("uses ON CONFLICT DO NOTHING", async () => {
    const { saveSpecialDiscovery } = await import("../services/crimeService");
    mocks.mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await saveSpecialDiscovery(mocks.mockClient as never, 1, 5);
    expect(mocks.mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("ON CONFLICT"),
      [1, 5]
    );
  });
});

describe("getTotalCrimeXp", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns total XP sum from all crimes", async () => {
    const { getTotalCrimeXp } = await import("../services/crimeService");
    mocks.mockClientQuery.mockResolvedValueOnce({
      rows: [{ total_xp: "15750" }],
      rowCount: 1,
    });
    const total = await getTotalCrimeXp(mocks.mockClient as never, 1);
    expect(total).toBe(15750);
  });

  it("returns 0 when user has no crime progress", async () => {
    const { getTotalCrimeXp } = await import("../services/crimeService");
    mocks.mockClientQuery.mockResolvedValueOnce({
      rows: [{ total_xp: "0" }],
      rowCount: 1,
    });
    const total = await getTotalCrimeXp(mocks.mockClient as never, 999);
    expect(total).toBe(0);
  });

  it("returns 0 when total_xp is null (COALESCE)", async () => {
    const { getTotalCrimeXp } = await import("../services/crimeService");
    mocks.mockClientQuery.mockResolvedValueOnce({
      rows: [{ total_xp: null }],
      rowCount: 1,
    });
    const total = await getTotalCrimeXp(mocks.mockClient as never, 1);
    expect(total).toBe(0);
  });

  it("uses SUM and COALESCE in query", async () => {
    const { getTotalCrimeXp } = await import("../services/crimeService");
    mocks.mockClientQuery.mockResolvedValueOnce({
      rows: [{ total_xp: "500" }],
      rowCount: 1,
    });
    await getTotalCrimeXp(mocks.mockClient as never, 42);
    expect(mocks.mockClientQuery).toHaveBeenCalledWith(
      expect.stringMatching(/COALESCE.*SUM|SUM.*COALESCE/i),
      [42]
    );
  });
});

describe("updateProgress", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls UPDATE with correct params", async () => {
    const { updateProgress } = await import("../services/crimeService");
    mocks.mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await updateProgress(mocks.mockClient as never, 1, 1, {
      crimeXp: 500, crimeLevel: 5, hiddenCpl: 25,
      attempts: 10, successes: 7, failures: 2,
      critFailures: 1, specialsFoundCount: 0,
    });

    expect(mocks.mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE user_crime_progress"),
      expect.arrayContaining([500, 5, 25, 10, 7, 2, 1, 0, 1, 1])
    );
  });

  it("updates updated_at timestamp", async () => {
    const { updateProgress } = await import("../services/crimeService");
    mocks.mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await updateProgress(mocks.mockClient as never, 1, 1, {
      crimeXp: 0, crimeLevel: 0, hiddenCpl: 0,
      attempts: 1, successes: 0, failures: 1,
      critFailures: 0, specialsFoundCount: 0,
    });

    expect(mocks.mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("updated_at"),
      expect.any(Array)
    );
  });
});

describe("updateUserStats", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls UPDATE users with all stat fields", async () => {
    const { updateUserStats } = await import("../services/crimeService");
    mocks.mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await updateUserStats(mocks.mockClient as never, 1, {
      money: 5000, points: 100,
      nerve: 25, maxNerve: 30,
      life: 90, maxLife: 100,
      jailUntil: null, federalJailUntil: null,
    });

    expect(mocks.mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE users"),
      expect.arrayContaining([5000, 100, 25, 30, 90, 100, null, null, 1])
    );
  });

  it("sets last_crime_at = CURRENT_TIMESTAMP on every crime", async () => {
    const { updateUserStats } = await import("../services/crimeService");
    mocks.mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await updateUserStats(mocks.mockClient as never, 1, {
      money: 0, points: 0, nerve: 0, maxNerve: 30,
      life: 1, maxLife: 100, jailUntil: null, federalJailUntil: null,
    });

    expect(mocks.mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("last_crime_at"),
      expect.any(Array)
    );
  });

  it("passes jail dates correctly", async () => {
    const { updateUserStats } = await import("../services/crimeService");
    mocks.mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const jailDate = new Date(Date.now() + 3600_000);
    await updateUserStats(mocks.mockClient as never, 1, {
      money: 100, points: 0, nerve: 10, maxNerve: 30,
      life: 80, maxLife: 100,
      jailUntil: jailDate, federalJailUntil: null,
    });

    expect(mocks.mockClientQuery).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([jailDate])
    );
  });
});
