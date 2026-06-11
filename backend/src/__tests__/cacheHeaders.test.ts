import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { noCache, privateCache, shortCache, mediumCache, staticCache, apiCache, conditionalCache, etagCache } from "../middleware/cacheHeaders";
import type { Request, Response, NextFunction } from "express";

let req: Partial<Request>;
let res: Partial<Response>;
let next: ReturnType<typeof vi.fn>;
let headers: Record<string, string>;

beforeEach(() => {
  vi.clearAllMocks();
  headers = {};
  req = { path: "/test", headers: {} };
  res = {
    setHeader: vi.fn((key: string, value: string) => { headers[key] = value; }),
    json: vi.fn().mockReturnThis(),
  };
  next = vi.fn();
});

describe("noCache", () => {
  it("sets Cache-Control: no-store", () => {
    noCache(req as Request, res as Response, next as NextFunction);
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(res.setHeader).toHaveBeenCalledWith("Pragma", "no-cache");
    expect(res.setHeader).toHaveBeenCalledWith("Expires", "0");
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe("privateCache", () => {
  it("sets private cache headers", () => {
    privateCache(req as Request, res as Response, next as NextFunction);
    expect(res.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      expect.stringContaining("private")
    );
    expect(res.setHeader).toHaveBeenCalledWith("Vary", "Authorization");
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe("shortCache", () => {
  it("sets public cache for unauthenticated requests", () => {
    shortCache(req as Request, res as Response, next as NextFunction);
    expect(res.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      expect.stringContaining("public")
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("falls back to privateCache for authenticated requests", () => {
    req.headers!["authorization"] = "Bearer token";
    shortCache(req as Request, res as Response, next as NextFunction);
    expect(res.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      expect.stringContaining("private")
    );
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe("mediumCache", () => {
  it("sets medium cache headers", () => {
    mediumCache(req as Request, res as Response, next as NextFunction);
    expect(res.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      expect.stringContaining("max-age=300")
    );
  });
});

describe("staticCache", () => {
  it("sets immutable cache headers", () => {
    staticCache(req as Request, res as Response, next as NextFunction);
    expect(res.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      expect.stringContaining("immutable")
    );
  });
});

describe("apiCache", () => {
  it("sets API cache headers", () => {
    apiCache(req as Request, res as Response, next as NextFunction);
    expect(res.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      expect.stringContaining("private")
    );
  });
});

describe("conditionalCache", () => {
  it("uses privateCache for authenticated requests", () => {
    req.headers!["authorization"] = "Bearer token";
    conditionalCache(req as Request, res as Response, next as NextFunction);
    expect(res.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      expect.stringContaining("private")
    );
  });

  it("uses shortCache for unauthenticated requests", () => {
    conditionalCache(req as Request, res as Response, next as NextFunction);
    expect(res.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      expect.stringContaining("public")
    );
  });
});

describe("etagCache", () => {
  it("intercepts res.json to set ETag", () => {
    const middleware = etagCache(req as Request, res as Response, next as NextFunction);
    const jsonSpy = vi.spyOn(res, "json" as never);

    (res.json as ReturnType<typeof vi.fn>)({ data: "test" });

    expect(res.setHeader).toHaveBeenCalledWith("ETag", expect.stringMatching(/^"/));
    expect(next).toHaveBeenCalledTimes(1);
  });
});
