import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/database", () => ({
  pool: { query: vi.fn(), totalCount: 5, idleCount: 3, waitingCount: 0 },
  withTransaction: vi.fn(),
}));

vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { pool, withTransaction } from "../config/database";
import {
  query,
  queryOne,
  queryCount,
  queryExists,
  clientQuery,
  withRetry,
  retryTransaction,
  getPoolStats,
} from "../utils/dbHelpers";
import type { PoolClient } from "pg";

beforeEach(() => vi.resetAllMocks());

describe("query", () => {
  it("returns rows on success", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows:      [{ id: 1 }, { id: 2 }],
      rowCount:  2,
    } as never);

    const rows = await query("SELECT * FROM users");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ id: 1 });
  });

  it("throws on DB error", async () => {
    vi.mocked(pool.query).mockRejectedValueOnce(new Error("DB error"));
    await expect(query("SELECT bad")).rejects.toThrow("DB error");
  });

  it("passes params to pool.query", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [], rowCount: 0,
    } as never);

    await query("SELECT * FROM users WHERE id = $1", [1]);
    expect(pool.query).toHaveBeenCalledWith(
      "SELECT * FROM users WHERE id = $1",
      [1]
    );
  });
});

describe("queryOne", () => {
  it("returns first row", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ id: 1 }, { id: 2 }], rowCount: 2,
    } as never);

    const row = await queryOne("SELECT * FROM users LIMIT 1");
    expect(row).toEqual({ id: 1 });
  });

  it("returns null when no rows", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [], rowCount: 0,
    } as never);

    const row = await queryOne("SELECT * FROM users WHERE id = 999");
    expect(row).toBeNull();
  });
});

describe("queryCount", () => {
  it("returns parsed count", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ count: "42" }], rowCount: 1,
    } as never);

    const count = await queryCount("SELECT COUNT(*) FROM users");
    expect(count).toBe(42);
  });

  it("returns 0 when no row returned", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [], rowCount: 0,
    } as never);

    const count = await queryCount("SELECT COUNT(*) FROM users");
    expect(count).toBe(0);
  });
});

describe("queryExists", () => {
  it("returns true when record exists", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ exists: true }], rowCount: 1,
    } as never);

    const exists = await queryExists("SELECT 1 FROM users WHERE id = $1", [1]);
    expect(exists).toBe(true);
  });

  it("returns false when no record", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ exists: false }], rowCount: 1,
    } as never);

    const exists = await queryExists("SELECT 1 FROM users WHERE id = $1", [999]);
    expect(exists).toBe(false);
  });
});

describe("clientQuery", () => {
  it("uses provided client instead of pool", async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [{ id: 99 }], rowCount: 1,
      }),
    } as unknown as PoolClient;

    const rows = await clientQuery(mockClient, "SELECT * FROM users WHERE id = $1", [99]);
    expect(rows).toEqual([{ id: 99 }]);
    expect(mockClient.query).toHaveBeenCalled();
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("throws on client error", async () => {
    const mockClient = {
      query: vi.fn().mockRejectedValueOnce(new Error("client error")),
    } as unknown as PoolClient;

    await expect(
      clientQuery(mockClient, "SELECT bad")
    ).rejects.toThrow("client error");
  });
});

describe("withRetry", () => {
  it("returns result on first success", async () => {
    const op = vi.fn().mockResolvedValueOnce("success");
    const result = await withRetry(op);
    expect(result).toBe("success");
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("retries on serialization_failure (40001)", async () => {
    const pgError = Object.assign(new Error("serialization failure"), { code: "40001" });
    const op = vi.fn()
      .mockRejectedValueOnce(pgError)
      .mockResolvedValueOnce("success after retry");

    const result = await withRetry(op, { baseDelayMs: 0 });
    expect(result).toBe("success after retry");
    expect(op).toHaveBeenCalledTimes(2);
  });

  it("retries on deadlock_detected (40P01)", async () => {
    const pgError = Object.assign(new Error("deadlock"), { code: "40P01" });
    const op = vi.fn()
      .mockRejectedValueOnce(pgError)
      .mockResolvedValueOnce("ok");

    const result = await withRetry(op, { baseDelayMs: 0 });
    expect(result).toBe("ok");
  });

  it("does not retry on non-retryable errors", async () => {
    const op = vi.fn().mockRejectedValue(new Error("non-retryable"));
    await expect(withRetry(op, { baseDelayMs: 0 })).rejects.toThrow("non-retryable");
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("throws after maxRetries exhausted", async () => {
    const pgError = Object.assign(new Error("deadlock"), { code: "40P01" });
    const op = vi.fn().mockRejectedValue(pgError);

    await expect(
      withRetry(op, { maxRetries: 2, baseDelayMs: 0 })
    ).rejects.toThrow("deadlock");
    expect(op).toHaveBeenCalledTimes(2);
  });

  it("retries on ETIMEDOUT message", async () => {
    const err = new Error("ETIMEDOUT connection");
    const op = vi.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce("ok");

    const result = await withRetry(op, { baseDelayMs: 0 });
    expect(result).toBe("ok");
  });
});

describe("retryTransaction", () => {
  it("calls withTransaction inside withRetry", async () => {
    vi.mocked(withTransaction).mockResolvedValueOnce("tx_result" as never);

    const result = await retryTransaction(async (_client) => "tx_result");
    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(result).toBe("tx_result");
  });
});

describe("getPoolStats", () => {
  it("returns pool stats", () => {
    const stats = getPoolStats();
    expect(stats).toHaveProperty("total");
    expect(stats).toHaveProperty("idle");
    expect(stats).toHaveProperty("waiting");
    expect(stats.total).toBe(5);
    expect(stats.idle).toBe(3);
    expect(stats.waiting).toBe(0);
  });
});
