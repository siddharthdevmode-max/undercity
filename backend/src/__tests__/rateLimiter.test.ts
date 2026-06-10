import { describe, it, expect, vi, beforeEach } from "vitest";

const configState = vi.hoisted(() => ({ isTest: true }));

vi.mock("../config/redis", () => ({
  redis: { get: vi.fn(), set: vi.fn(), call: vi.fn(), multi: vi.fn() },
  default: { get: vi.fn(), set: vi.fn() },
}));

vi.mock("../config", () => ({
  config: {
    get isTest() { return configState.isTest; },
    isProduction: false,
    isDevelopment: true,
    rateLimit: {
      windowMs: 60_000,
      maxRequests: 100,
      authWindowMs: 900_000,
      authMaxRequests: 10,
    },
  },
}));

vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../utils/alerts", () => ({
  sendAlert: vi.fn(),
}));

import { redis } from "../config/redis";
import { ipBlacklist, bruteForceProtection } from "../middleware/rateLimiter";
import type { Request, Response, NextFunction } from "express";

let req: Partial<Request>;
let res: Partial<Response>;
let next: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  req = { ip: "::ffff:1.2.3.4", path: "/api/v1/crimes" };
  res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    on: vi.fn(),
  };
  next = vi.fn();
});

describe("ipBlacklist", () => {
  beforeEach(() => { configState.isTest = false; });

  it("calls next() if not blocked", async () => {
    vi.mocked(redis.get).mockResolvedValueOnce(null);
    await ipBlacklist(req as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 403 if IP is blacklisted", async () => {
    vi.mocked(redis.get).mockResolvedValueOnce("1");
    await ipBlacklist(req as Request, res as Response, next as NextFunction);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "FORBIDDEN" })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() on redis error", async () => {
    vi.mocked(redis.get).mockRejectedValueOnce(new Error("Redis down"));
    await ipBlacklist(req as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("strips IPv6 prefix before lookup", async () => {
    vi.mocked(redis.get).mockResolvedValueOnce(null);
    await ipBlacklist(req as Request, res as Response, next as NextFunction);
    expect(redis.get).toHaveBeenCalledWith("blacklist:ip:1.2.3.4");
  });
});

describe("bruteForceProtection", () => {
  beforeEach(() => { configState.isTest = false; });

  it("calls next() when not locked out", async () => {
    vi.mocked(redis.get).mockResolvedValueOnce(null);
    await bruteForceProtection(req as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("returns 429 when locked out", async () => {
    vi.mocked(redis.get).mockResolvedValueOnce("1");
    await bruteForceProtection(req as Request, res as Response, next as NextFunction);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "RATE_LIMIT" })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("attaches finish listener for fail counting", async () => {
    vi.mocked(redis.get).mockResolvedValueOnce(null);
    await bruteForceProtection(req as Request, res as Response, next as NextFunction);
    expect(res.on).toHaveBeenCalledWith("finish", expect.any(Function));
  });

  it("calls next() on redis error", async () => {
    vi.mocked(redis.get).mockRejectedValueOnce(new Error("Redis down"));
    await bruteForceProtection(req as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
