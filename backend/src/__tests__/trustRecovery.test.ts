import { describe, it, expect, vi, beforeEach } from "vitest";

const mockQuery = vi.fn();
const mockWithTransaction = vi.fn();

vi.mock("../config/database", () => ({
  pool: { query: (...args: unknown[]) => mockQuery(...args) },
  withTransaction: (fn: (client: { query: typeof mockQuery }) => Promise<unknown>) =>
    mockWithTransaction(fn),
}));

vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../services/trustEngine", () => ({
  getTrustTier: vi.fn(() => "CLEAN"),
}));

import { runTrustRecovery } from "../services/trustRecovery";

beforeEach(() => {
  vi.clearAllMocks();
});

function makeEligibleRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    firebase_uid: "test-uid",
    trust_score: 50,
    trust_regen_streak: 0,
    last_trust_regen_at: null,
    last_flag_at: null,
    ...overrides,
  };
}

describe("runTrustRecovery", () => {
  it("returns zeros when no eligible users", async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const result = await runTrustRecovery();
    expect(result).toEqual({ processed: 0, recovered: 0, skipped: 0, batches: 0 });
  });

  it("recovers trust for eligible users", async () => {
    const eligibleRows = [makeEligibleRow(), makeEligibleRow({ id: 2, firebase_uid: "uid-2", trust_score: 40 })];
    mockQuery.mockResolvedValue({ rows: eligibleRows });
    mockWithTransaction.mockImplementation(async (fn: (client: { query: typeof mockQuery }) => Promise<unknown>) => {
      const client = { query: vi.fn().mockResolvedValue({ rows: [] }) };
      await fn(client);
    });

    const result = await runTrustRecovery();
    expect(result.processed).toBe(2);
    expect(result.recovered).toBe(2);
    expect(result.skipped).toBe(0);
  });

  it("skips users at max auto-regen cap", async () => {
    mockQuery.mockResolvedValue({ rows: [makeEligibleRow({ trust_score: 70 })] });
    mockWithTransaction.mockImplementation(async (fn: (client: { query: typeof mockQuery }) => Promise<unknown>) => {
      const client = { query: vi.fn().mockResolvedValue({ rows: [] }) };
      await fn(client);
    });

    const result = await runTrustRecovery();
    expect(result.recovered).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it("handles query error gracefully", async () => {
    mockQuery.mockRejectedValue(new Error("DB down"));
    const result = await runTrustRecovery();
    expect(result.processed).toBe(0);
  });

  it("applies weekly bonus on 7th day streak", async () => {
    mockQuery.mockResolvedValue({
      rows: [makeEligibleRow({ trust_score: 60, trust_regen_streak: 6 })],
    });
    let capturedNewScore = 0;
    mockWithTransaction.mockImplementation(async (fn: (client: { query: typeof mockQuery }) => Promise<unknown>) => {
      const client = {
        query: vi.fn().mockImplementation((sql: string, params: unknown[]) => {
          if (sql.includes("UPDATE users")) capturedNewScore = params[0] as number;
          return { rows: [] };
        }),
      };
      await fn(client);
    });

    await runTrustRecovery();
    expect(capturedNewScore).toBe(66); // 60 + 1 (daily) + 5 (weekly bonus)
  });
});
