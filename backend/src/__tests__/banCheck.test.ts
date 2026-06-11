import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

const configState = vi.hoisted(() => ({ isTest: false }));
const mockRedis = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), del: vi.fn() }));

vi.mock("../config/redis", () => ({ default: mockRedis }));
vi.mock("../config/database", () => ({ pool: { query: vi.fn() } }));
vi.mock("../config", () => ({
  config: {
    get isTest() { return configState.isTest; },
    isProduction: false,
    isDevelopment: true,
  },
}));
vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("../services/trustEngine", () => ({
  getTrustTier: vi.fn(() => "CLEAN"),
}));

import { pool } from "../config/database";
import { checkBanStatus, invalidateBanCache } from "../middleware/banCheck";

const mockPoolQuery = vi.mocked(pool.query);
let req: Partial<Request>;
let res: Partial<Response>;
let next: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  req = { firebaseUser: { uid: "test-uid-123" } } as Partial<Request>;
  res = {};
  next = vi.fn();
});

describe("checkBanStatus", () => {
  it("calls next() if no firebaseUser", async () => {
    await checkBanStatus({} as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("calls next() if user not found in DB", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await checkBanStatus(req as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("calls next() when user has no ban flags", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ is_hard_banned: false, is_shadow_banned: false, ban_type: null, ban_reason: null, ban_expires_at: null, trust_score: 100 }],
      rowCount: 1,
    });
    await checkBanStatus(req as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("returns BannedError for hard-banned user", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ is_hard_banned: true, is_shadow_banned: false, ban_type: "hard", ban_reason: "Cheating", ban_expires_at: null, trust_score: 0 }],
      rowCount: 1,
    });
    await checkBanStatus(req as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    const err = next.mock.calls[0][0];
    expect(err.message).toMatch(/banned/i);
  });

  it("returns BannedError for active soft ban", async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ is_hard_banned: false, is_shadow_banned: false, ban_type: "soft", ban_reason: "Suspended", ban_expires_at: future, trust_score: 50 }],
      rowCount: 1,
    });
    await checkBanStatus(req as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it("calls next() for expired soft ban", async () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ is_hard_banned: false, is_shadow_banned: false, ban_type: "soft", ban_reason: "Suspended", ban_expires_at: past, trust_score: 50 }],
      rowCount: 1,
    });
    await checkBanStatus(req as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("sets trustInfo on req for shadow-banned user", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ is_hard_banned: false, is_shadow_banned: true, ban_type: null, ban_reason: null, ban_expires_at: null, trust_score: 15 }],
      rowCount: 1,
    });
    const reqWithInfo = { firebaseUser: { uid: "test-uid-123" } } as Request;
    await checkBanStatus(reqWithInfo, res as Response, next as NextFunction);
    expect(reqWithInfo.trustInfo).toBeDefined();
    expect(reqWithInfo.trustInfo!.isShadowBanned).toBe(true);
    expect(reqWithInfo.trustInfo!.trustScore).toBe(15);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("calls next() on Redis error (fail open)", async () => {
    mockPoolQuery.mockRejectedValueOnce(new Error("DB down"));
    await checkBanStatus(req as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("reads from Redis cache if available", async () => {
    mockRedis.get.mockResolvedValueOnce(JSON.stringify({ is_hard_banned: true, is_shadow_banned: false, ban_type: "hard", ban_reason: "Cheating", ban_expires_at: null, trust_score: 0 }));
    await checkBanStatus(req as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    expect(mockPoolQuery).not.toHaveBeenCalled();
  });
});

describe("invalidateBanCache", () => {
  it("clears both soft and hard ban cache keys", async () => {
    await invalidateBanCache("uid-1");
    expect(mockRedis.del).toHaveBeenCalledTimes(2);
  });

  it("handles Redis error gracefully", async () => {
    mockRedis.del.mockRejectedValueOnce(new Error("Redis down"));
    await expect(invalidateBanCache("uid-1")).resolves.toBeUndefined();
  });
});
