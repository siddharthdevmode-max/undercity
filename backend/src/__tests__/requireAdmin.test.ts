import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPoolQuery = vi.hoisted(() => vi.fn());
const mockRedis = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), del: vi.fn() }));

vi.mock("../config/redis", () => ({ redis: mockRedis }));
vi.mock("../config/database", () => ({ pool: { query: mockPoolQuery } }));
vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { requireAdmin, requireModerator, requireDeveloper, invalidateRoleCache } from "../middleware/requireAdmin";
import type { Request, Response, NextFunction } from "express";
import { ForbiddenError, UnauthorizedError } from "../utils/errors";

let req: Partial<Request>;
let res: Partial<Response>;
let next: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  req = { firebaseUser: { uid: "user-1" } };
  res = {};
  next = vi.fn();
});

describe("requireAdmin", () => {
  it("calls next() for admin user", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ is_admin: true, is_developer: false, is_moderator: false }], rowCount: 1 });
    await requireAdmin(req as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalledWith(expect.any(Error));
  });

  it("calls next() for developer user", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ is_admin: false, is_developer: true, is_moderator: false }], rowCount: 1 });
    await requireAdmin(req as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("returns ForbiddenError for regular user", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ is_admin: false, is_developer: false, is_moderator: false }], rowCount: 1 });
    await requireAdmin(req as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it("returns ForbiddenError for moderator only", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ is_admin: false, is_developer: false, is_moderator: true }], rowCount: 1 });
    await requireAdmin(req as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it("returns UnauthorizedError if no firebaseUser", async () => {
    await requireAdmin({} as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it("returns ForbiddenError if user not found in DB", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await requireAdmin(req as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it("returns ForbiddenError on DB error (fail closed)", async () => {
    mockPoolQuery.mockRejectedValueOnce(new Error("DB down"));
    await requireAdmin(req as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });
});

describe("requireModerator", () => {
  it("calls next() for moderator user", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ is_admin: false, is_developer: false, is_moderator: true }], rowCount: 1 });
    await requireModerator(req as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("calls next() for admin user", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ is_admin: true, is_developer: false, is_moderator: false }], rowCount: 1 });
    await requireModerator(req as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("returns ForbiddenError for regular user", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ is_admin: false, is_developer: false, is_moderator: false }], rowCount: 1 });
    await requireModerator(req as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });
});

describe("requireDeveloper", () => {
  it("calls next() for developer user", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ is_admin: false, is_developer: true, is_moderator: false }], rowCount: 1 });
    await requireDeveloper(req as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("returns ForbiddenError for admin (not developer)", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ is_admin: true, is_developer: false, is_moderator: false }], rowCount: 1 });
    await requireDeveloper(req as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });
});

describe("invalidateRoleCache", () => {
  it("deletes the role cache key", async () => {
    await invalidateRoleCache("uid-1");
    expect(mockRedis.del).toHaveBeenCalledWith("roles:uid-1");
  });

  it("handles Redis error gracefully", async () => {
    mockRedis.del.mockRejectedValueOnce(new Error("Redis down"));
    await expect(invalidateRoleCache("uid-1")).resolves.toBeUndefined();
  });
});
