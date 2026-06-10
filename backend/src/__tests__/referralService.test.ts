// ============================================================
// REFERRAL SERVICE — UNIT TESTS
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const mockClientQuery = vi.fn();
  const mockClient = { query: mockClientQuery };
  const mockTx = vi.fn(async (fn: (client: unknown) => Promise<unknown>) => fn(mockClient));
  return { mockClientQuery, mockClient, mockTx };
});

vi.mock("../config/database", () => ({
  pool: { query: vi.fn() },
  withTransaction: mocks.mockTx,
}));

vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { pool, withTransaction } from "../config/database";
import { generateReferralCode, applyReferralCode, getReferralStats } from "../services/referralService";
import { ValidationError, NotFoundError, ConflictError } from "../utils/errors";

function resetMocks(): void {
  vi.clearAllMocks();
  mocks.mockClientQuery.mockReset();
}

describe("generateReferralCode", () => {
  beforeEach(() => resetMocks());

  it("returns existing code if user already has one", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ referral_code: "ABC12345" }], rowCount: 1 } as never);
    const code = await generateReferralCode(1);
    expect(code).toBe("ABC12345");
  });

  it("generates a new hex code when no existing code found", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const code = await generateReferralCode(1);
    expect(code).toMatch(/^[0-9A-F]{8}$/);
  });

  it("queries with reward_given = TRUE", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await generateReferralCode(1);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("reward_given = TRUE"),
      [1]
    );
  });
});

describe("applyReferralCode", () => {
  const referrer = { id: 2, username: "referrer" };

  beforeEach(() => resetMocks());

  it("throws ValidationError for invalid code length", async () => {
    await expect(applyReferralCode(1, "AB")).rejects.toThrow(ValidationError);
    await expect(applyReferralCode(1, "A".repeat(21))).rejects.toThrow(ValidationError);
  });

  it("applies referral code when valid referrer found", async () => {
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [{ id: 2, username: "referrer" }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 });

    const result = await applyReferralCode(1, "ABC12345");
    expect(result.bonusCash).toBe(25000);
    expect(result.bonusXp).toBe(0);
    expect(withTransaction).toHaveBeenCalled();
  });

  it("normalizes code to uppercase", async () => {
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 });

    await applyReferralCode(1, "abc12345");
    expect(mocks.mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("r.referral_code = $1"),
      ["ABC12345"]
    );
  });

  it("gives bonus to both referrer and new user when referrer found", async () => {
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [referrer], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 });

    await applyReferralCode(1, "ABC12345");

    const updateCalls = mocks.mockClientQuery.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === "string" && call[0].includes("UPDATE users SET money = money +")
    );
    expect(updateCalls).toHaveLength(2);
  });

  it("throws ValidationError when referring self", async () => {
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, username: "self" }], rowCount: 1 });

    await expect(applyReferralCode(1, "SELFCODE")).rejects.toThrow(ValidationError);
  });

  it("throws ConflictError when user already applied a code", async () => {
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [{ id: 2, username: "referrer" }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id: 99 }], rowCount: 1 });

    await expect(applyReferralCode(1, "ABC12345")).rejects.toThrow(ConflictError);
  });

  it("gives bonus to new user even when no referrer found", async () => {
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 });

    const result = await applyReferralCode(1, "UNKNOWN");
    expect(result.bonusCash).toBe(25000);
    expect(result.bonusXp).toBe(0);
  });

  it("does not insert referral row when no referrer found", async () => {
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 });

    await applyReferralCode(1, "UNKNOWN");

    const insertCalls = mocks.mockClientQuery.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === "string" && call[0].includes("INSERT INTO referrals")
    );
    expect(insertCalls).toHaveLength(0);
  });

  it("logs bank bonus transactions", async () => {
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [referrer], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 });

    await applyReferralCode(1, "ABC12345");

    const txCalls = mocks.mockClientQuery.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === "string" && call[0].includes("INSERT INTO bank_transactions")
    );
    expect(txCalls).toHaveLength(2);
  });
});

describe("getReferralStats", () => {
  beforeEach(() => resetMocks());

  it("returns stats with code when referrer has one", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ total: 3, earned: 75000 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ referral_code: "ABC12345" }], rowCount: 1 } as never);

    const stats = await getReferralStats(2);
    expect(stats.totalReferrals).toBe(3);
    expect(stats.totalEarned).toBe(75000);
    expect(stats.referralCode).toBe("ABC12345");
  });

  it("returns zero stats with null code when no referrals", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ total: 0, earned: 0 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const stats = await getReferralStats(99);
    expect(stats.totalReferrals).toBe(0);
    expect(stats.totalEarned).toBe(0);
    expect(stats.referralCode).toBeNull();
  });

  it("handles null total/earned with COALESCE", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ total: null, earned: null }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const stats = await getReferralStats(1);
    expect(stats.totalReferrals).toBe(0);
    expect(stats.totalEarned).toBe(0);
  });
});
