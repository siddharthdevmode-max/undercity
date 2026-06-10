import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/database", () => ({
  pool:            { query: vi.fn() },
  withTransaction: vi.fn(async (fn: Function) => {
    const client = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    return fn(client);
  }),
}));

vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { pool }            from "../config/database";
import { runTrustRecovery } from "../services/trustRecovery";

beforeEach(() => vi.resetAllMocks());

describe("runTrustRecovery", () => {
  it("returns zero counts when no eligible users", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);

    const result = await runTrustRecovery();
    expect(result.processed).toBe(0);
    expect(result.recovered).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.batches).toBe(0);
  });

  it("processes eligible users and increments recovered count", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [
        {
          id:                  1,
          firebase_uid:        "uid-001",
          trust_score:         50,
          trust_regen_streak:  0,
          last_trust_regen_at: null,
          last_flag_at:        null,
        },
        {
          id:                  2,
          firebase_uid:        "uid-002",
          trust_score:         30,
          trust_regen_streak:  6,
          last_trust_regen_at: null,
          last_flag_at:        null,
        },
      ],
    } as never);

    const result = await runTrustRecovery();
    expect(result.processed).toBe(2);
    expect(result.recovered).toBe(2);
    expect(result.batches).toBe(1);
  });

  it("awards weekly bonus on streak divisible by 7", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{
        id:                  1,
        firebase_uid:        "uid-weekly",
        trust_score:         60,
        trust_regen_streak:  6,
        last_trust_regen_at: null,
        last_flag_at:        null,
      }],
    } as never);

    const result = await runTrustRecovery();
    expect(result.recovered).toBe(1);
  });

  it("does not recover user already at max auto-regen (70)", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{
        id:                  1,
        firebase_uid:        "uid-max",
        trust_score:         70,
        trust_regen_streak:  10,
        last_trust_regen_at: null,
        last_flag_at:        null,
      }],
    } as never);

    const result = await runTrustRecovery();
    expect(result.skipped).toBe(1);
    expect(result.recovered).toBe(0);
  });

  it("handles fatal DB error gracefully", async () => {
    vi.mocked(pool.query).mockRejectedValueOnce(new Error("DB down"));

    const result = await runTrustRecovery();
    expect(result.processed).toBe(0);
    expect(result.batches).toBe(0);
  });

  it("processes in batches of 500", async () => {
    const users = Array.from({ length: 501 }, (_, i) => ({
      id:                  i + 1,
      firebase_uid:        `uid-${i}`,
      trust_score:         50,
      trust_regen_streak:  0,
      last_trust_regen_at: null,
      last_flag_at:        null,
    }));

    vi.mocked(pool.query).mockResolvedValueOnce({ rows: users } as never);

    const result = await runTrustRecovery();
    expect(result.batches).toBe(2);
    expect(result.processed).toBe(501);
  });
});
