import { describe, it, expect, vi, beforeEach } from "vitest";

const mockQuery = vi.fn();
vi.mock("../config/database", () => ({
  pool: { query: (...args: unknown[]) => mockQuery(...args) },
}));

vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../services/crimeEngine", () => ({
  calcCrimeLevel: vi.fn(() => 1),
  resolveCrimeOutcome: vi.fn(() => ({
    outcome: "success",
    reward_money: 100,
    money_loss: 0,
    xp_gained: 50,
    xp_lost: 0,
    reward_points: 10,
    life_loss: 0,
    cpl_change: 0,
    jail_seconds: 0,
    special_found: null,
  })),
  applySanityCap: vi.fn((o) => o),
  calcMaxNerve: vi.fn(() => 100),
  calcMaxLife: vi.fn(() => 100),
  calcCrimeLevel: vi.fn(() => 1),
  calcReward: vi.fn(() => 100),
}));

vi.mock("../services/shadowPunish", () => ({
  applyShadowPunishment: vi.fn((o) => o),
}));

import {
  assertCanAttempt,
  assertCrimeRequirements,
  loadCrime,
  calculateOutcome,
} from "../services/crimeService";
import {
  NerveError,
  CrimeLockError,
  JailError,
  HospitalError,
  RateLimitError,
} from "../utils/errors";
import type { CrimeDefinition } from "../models/crimeModels";
import type { UserRow } from "../models/userModels";

function makeUser(overrides: Partial<Record<string, unknown>> = {}): UserRow {
  return {
    id: 1,
    firebase_uid: "test-uid",
    username: "test",
    level: "5",
    nerve: "50",
    max_nerve: 100,
    life: 100,
    max_life: 100,
    money: "1000",
    points: 0,
    user_tier: "player",
    energy: 100,
    max_energy: 100,
    last_crime_at: null,
    last_nerve_update: null,
    last_energy_update: null,
    hospital_until: null,
    jail_until: null,
    federal_jail_until: null,
    is_hard_banned: false,
    is_shadow_banned: false,
    trust_score: 100,
    total_flags: 0,
    last_flag_reason: null,
    last_flag_at: null,
    deleted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  } as UserRow;
}

function makeCrime(overrides: Partial<Record<string, unknown>> = {}): CrimeDefinition {
  return {
    id: 1,
    crime_key: "test_crime",
    name: "Test Crime",
    tier: 1,
    unlock_level: 1,
    nerve_cost: 10,
    energy_cost: 0,
    min_level: 1,
    max_level: 100,
    cooldown_ms: 10_000,
    is_federal: false,
    is_active: true,
    xp_reward_min: 10,
    xp_reward_max: 50,
    money_reward_min: 100,
    money_reward_max: 500,
    jail_seconds_min: 0,
    jail_seconds_max: 0,
    jail_chance: 0,
    outcome_weights: { success: 0.7, fail: 0.2, crit_fail: 0.1 },
    created_at: new Date(),
    ...overrides,
  } as CrimeDefinition;
}

describe("assertCanAttempt", () => {
  it("passes when user is not in jail or hospital and off cooldown", () => {
    expect(() => assertCanAttempt(makeUser())).not.toThrow();
  });

  it("throws RateLimitError when on cooldown", () => {
    const user = makeUser({ last_crime_at: new Date() });
    expect(() => assertCanAttempt(user)).toThrow(RateLimitError);
  });

  it("throws HospitalError when in hospital", () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    expect(() => assertCanAttempt(makeUser({ hospital_until: future }))).toThrow(HospitalError);
  });

  it("throws JailError when in federal jail", () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    expect(() => assertCanAttempt(makeUser({ federal_jail_until: future }))).toThrow(JailError);
  });

  it("throws JailError when in normal jail", () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    expect(() => assertCanAttempt(makeUser({ jail_until: future }))).toThrow(JailError);
  });
});

describe("assertCrimeRequirements", () => {
  it("passes when user meets level and nerve requirements", () => {
    const user = makeUser({ level: "5", nerve: "50" });
    const crime = makeCrime({ unlock_level: 3, nerve_cost: 30 });
    expect(() => assertCrimeRequirements(user, crime)).not.toThrow();
  });

  it("throws CrimeLockError when level too low", () => {
    const user = makeUser({ level: "2" });
    const crime = makeCrime({ unlock_level: 5 });
    expect(() => assertCrimeRequirements(user, crime)).toThrow(CrimeLockError);
  });

  it("throws NerveError when not enough nerve", () => {
    const user = makeUser({ nerve: "5" });
    const crime = makeCrime({ nerve_cost: 20 });
    expect(() => assertCrimeRequirements(user, crime)).toThrow(NerveError);
  });
});

describe("loadCrime", () => {
  it("returns parsed crime when found", async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 1, crime_key: "test" }] });
    const client = { query: mockQuery } as never;
    const crime = await loadCrime(client, "test");
    expect(crime).toBeDefined();
    expect(crime.crime_key).toBe("test");
  });

  it("throws NotFoundError when crime not found", async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const client = { query: mockQuery } as never;
    await expect(loadCrime(client, "missing")).rejects.toThrow("Crime not found");
  });
});

describe("calculateOutcome", () => {
  it("returns outcome with reward fields", () => {
    const user = makeUser();
    const crime = makeCrime();
    const progress = { crime_xp: 0, crime_level: 1, hidden_cpl: 0, attempts: 0, successes: 0, failures: 0, crit_failures: 0, specials_found_count: 0 };
    const result = calculateOutcome(crime, progress, null, user, { isShadowBanned: false, trustScore: 100 });
    expect(result.outcome).toBe("success");
    expect(result.reward_money).toBe(100);
    expect(result.xp_gained).toBe(50);
  });
});
