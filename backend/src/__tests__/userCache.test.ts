import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/redis", () => ({ redis: { get: vi.fn(), setex: vi.fn(), del: vi.fn() } }));
vi.mock("../config/database", () => ({ pool: { query: vi.fn() } }));
vi.mock("../utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { redis } from "../config/redis";
import { pool } from "../config/database";
import {
  getCachedUser,
  setCachedUser,
  invalidateUserCache,
  getCachedUserWithFallback,
  buildCacheKey,
} from "../services/userCache";

describe("userCache", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe("getCachedUser", () => {
    it("returns null in test mode", async () => {
      const result = await getCachedUser("uid123");
      expect(result).toBeNull();
      expect(redis.get).not.toHaveBeenCalled();
    });
  });

  describe("setCachedUser", () => {
    it("does nothing in test mode", async () => {
      await setCachedUser("uid123", {} as never);
      expect(redis.setex).not.toHaveBeenCalled();
    });
  });

  describe("invalidateUserCache", () => {
    it("does nothing in test mode", async () => {
      await invalidateUserCache("uid123");
      expect(redis.del).not.toHaveBeenCalled();
    });
  });

  describe("buildCacheKey", () => {
    it("returns prefixed key", () => {
      expect(buildCacheKey("abc")).toBe("user:cache:abc");
    });
  });

  describe("getCachedUserWithFallback", () => {
    it("fetches from db when cache is empty (test mode)", async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ id: 1, username: "test", level: 5 }], rowCount: 1 } as never);
      const result = await getCachedUserWithFallback("uid123");
      expect(result.user).toBeDefined();
      expect(result.cached).toBe(false);
    });

    it("throws when user not found", async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      await expect(getCachedUserWithFallback("missing")).rejects.toThrow("User not found");
    });
  });
});
