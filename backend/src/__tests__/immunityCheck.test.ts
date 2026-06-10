import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/database", () => ({
  pool: { query: vi.fn() },
}));

vi.mock("../config/redis", () => ({
  redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
}));

vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { pool }   from "../config/database";
import { redis }  from "../config/redis";
import {
  isImmuneFromUAC,
  invalidateImmunityCache,
} from "../services/immunityCheck";

beforeEach(() => vi.resetAllMocks());

describe("isImmuneFromUAC", () => {
  it("returns false for empty uid", async () => {
    expect(await isImmuneFromUAC("")).toBe(false);
  });

  it("returns cached true from Redis", async () => {
    vi.mocked(redis.get).mockResolvedValueOnce("1");
    expect(await isImmuneFromUAC("uid-123")).toBe(true);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("returns cached false from Redis", async () => {
    vi.mocked(redis.get).mockResolvedValueOnce("0");
    expect(await isImmuneFromUAC("uid-123")).toBe(false);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("queries DB on cache miss and returns true for admin", async () => {
    vi.mocked(redis.get).mockResolvedValueOnce(null);
    vi.mocked(redis.set).mockResolvedValueOnce("OK" as never);
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ is_admin: true, is_developer: false }],
    } as never);

    expect(await isImmuneFromUAC("admin-uid")).toBe(true);
  });

  it("queries DB on cache miss and returns true for developer", async () => {
    vi.mocked(redis.get).mockResolvedValueOnce(null);
    vi.mocked(redis.set).mockResolvedValueOnce("OK" as never);
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ is_admin: false, is_developer: true }],
    } as never);

    expect(await isImmuneFromUAC("dev-uid")).toBe(true);
  });

  it("returns false for regular player", async () => {
    vi.mocked(redis.get).mockResolvedValueOnce(null);
    vi.mocked(redis.set).mockResolvedValueOnce("OK" as never);
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ is_admin: false, is_developer: false }],
    } as never);

    expect(await isImmuneFromUAC("player-uid")).toBe(false);
  });

  it("returns false when user not found in DB", async () => {
    vi.mocked(redis.get).mockResolvedValueOnce(null);
    vi.mocked(redis.set).mockResolvedValueOnce("OK" as never);
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);

    expect(await isImmuneFromUAC("unknown-uid")).toBe(false);
  });

  it("fails open (returns false) on Redis error", async () => {
    vi.mocked(redis.get).mockRejectedValueOnce(new Error("Redis down"));
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ is_admin: false, is_developer: false }],
    } as never);

    expect(await isImmuneFromUAC("uid-123")).toBe(false);
  });

  it("fails safe (returns false) on DB error", async () => {
    vi.mocked(redis.get).mockResolvedValueOnce(null);
    vi.mocked(pool.query).mockRejectedValueOnce(new Error("DB down"));

    expect(await isImmuneFromUAC("uid-123")).toBe(false);
  });
});

describe("invalidateImmunityCache", () => {
  it("calls redis.del with correct key", async () => {
    vi.mocked(redis.del).mockResolvedValueOnce(1);
    await invalidateImmunityCache("uid-123");
    expect(redis.del).toHaveBeenCalledWith("immune:uid-123");
  });

  it("swallows redis errors silently", async () => {
    vi.mocked(redis.del).mockRejectedValueOnce(new Error("Redis down"));
    await expect(invalidateImmunityCache("uid-123")).resolves.toBeUndefined();
  });
});
