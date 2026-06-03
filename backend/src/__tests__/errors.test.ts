import { describe, it, expect } from "vitest";
import {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  JailError,
} from "../utils/errors";

describe("AppError", () => {
  it("sets message, statusCode, code, isOperational", () => {
    const err = new AppError("test error", 500, "TEST_CODE");
    expect(err.message).toBe("test error");
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe("TEST_CODE");
    expect(err.isOperational).toBe(true);
  });

  it("is instanceof Error", () => {
    expect(new AppError("x", 500, "X")).toBeInstanceOf(Error);
  });
});

describe("ValidationError", () => {
  it("has 400 status and VALIDATION_ERROR code", () => {
    const err = new ValidationError("bad input");
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
  });

  it("stores optional details", () => {
    const err = new ValidationError("bad input", { field: "name" });
    expect(err.details).toEqual({ field: "name" });
  });

  it("details is undefined when not provided", () => {
    const err = new ValidationError("bad input");
    expect(err.details).toBeUndefined();
  });
});

describe("UnauthorizedError", () => {
  it("has 401 status and UNAUTHORIZED code", () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("accepts custom message", () => {
    const err = new UnauthorizedError("Token expired");
    expect(err.message).toBe("Token expired");
  });
});

describe("ForbiddenError", () => {
  it("has 403 status and FORBIDDEN code", () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
  });

  it("accepts custom message", () => {
    const err = new ForbiddenError("Admin only");
    expect(err.message).toBe("Admin only");
  });
});

describe("NotFoundError", () => {
  it("has 404 status and NOT_FOUND code", () => {
    const err = new NotFoundError("User");
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("User not found");
  });

  it("defaults resource to Resource", () => {
    const err = new NotFoundError();
    expect(err.message).toBe("Resource not found");
  });
});

describe("ConflictError", () => {
  it("has 409 status and CONFLICT code", () => {
    const err = new ConflictError("Username taken");
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe("CONFLICT");
    expect(err.message).toBe("Username taken");
  });
});

describe("RateLimitError", () => {
  it("has 429 status and RATE_LIMIT code", () => {
    const err = new RateLimitError();
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe("RATE_LIMIT");
  });

  it("accepts custom message", () => {
    const err = new RateLimitError("Slow down");
    expect(err.message).toBe("Slow down");
  });
});

describe("JailError", () => {
  it("has 423 status and IN_JAIL code", () => {
    const err = new JailError(120, "normal");
    expect(err.statusCode).toBe(423);
    expect(err.code).toBe("IN_JAIL");
  });

  it("stores secondsRemaining and jailType", () => {
    const err = new JailError(300, "federal");
    expect(err.secondsRemaining).toBe(300);
    expect(err.jailType).toBe("federal");
  });

  it("message includes federal prefix for federal jail", () => {
    const err = new JailError(60, "federal");
    expect(err.message).toContain("federal");
  });

  it("message omits federal prefix for normal jail", () => {
    const err = new JailError(60, "normal");
    expect(err.message).not.toContain("federal");
  });
});
