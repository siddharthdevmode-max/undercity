import { describe, it, expect, vi, beforeEach } from "vitest";
import { ZodError } from "zod";
import type { Request, Response, NextFunction } from "express";

vi.mock("../config", () => ({
  config: {
    isTest: true,
    isProduction: false,
    isDevelopment: true,
  },
}));

vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@sentry/node", () => {
  const sentry = { captureException: vi.fn(), setupExpressErrorHandler: vi.fn() };
  return { default: sentry, ...sentry };
});

import { errorHandler, notFoundHandler } from "../middleware/errorHandler";
import { AppError, ValidationError, NotFoundError, ConflictError, RateLimitError, CrimeCooldownError, MaintenanceError } from "../utils/errors";

function makeReq(overrides?: Partial<Request>): Request {
  return { path: "/test", method: "GET", requestId: "req-123", ...overrides } as Request;
}

function makeRes(): Response {
  const r: Partial<Response> = {};
  r.status = vi.fn().mockReturnValue(r);
  r.json = vi.fn().mockReturnValue(r);
  r.setHeader = vi.fn().mockReturnValue(r);
  return r as Response;
}

describe("errorHandler", () => {
  let req: Request;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    req = makeReq();
    res = makeRes();
    next = vi.fn();
  });

  it("handles ZodError as 400 ValidationError", () => {
    const zodErr = new ZodError([{ code: "invalid_type", expected: "string", received: "number", path: ["name"], message: "Expected string" }]);
    errorHandler(zodErr, req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, code: "VALIDATION_ERROR" })
    );
  });

  it("handles NotFoundError as 404", () => {
    const err = new NotFoundError("User not found");
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404, code: "NOT_FOUND" })
    );
  });

  it("handles ConflictError as 409", () => {
    const err = new ConflictError("Duplicate entry");
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 409, code: "CONFLICT" })
    );
  });

  it("handles RateLimitError with Retry-After header", () => {
    const err = new RateLimitError("Slow down", 120);
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "120");
  });

  it("handles CrimeCooldownError with Retry-After header", () => {
    const err = new CrimeCooldownError(30);
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "30");
  });

  it("handles MaintenanceError with Retry-After header", () => {
    const err = new MaintenanceError();
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "300");
  });

  it("includes requestId in response when available", () => {
    const err = new NotFoundError("Not found");
    errorHandler(err, req, res, next);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "req-123" })
    );
  });

  it("handles unknown errors as 500 and captures to Sentry", () => {
    const err = new Error("Something broke");
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, code: "INTERNAL_ERROR" })
    );
  });
});

describe("notFoundHandler", () => {
  it("calls next with NotFoundError", () => {
    const req = makeReq({ method: "POST" });
    const next = vi.fn();
    notFoundHandler(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
  });
});
