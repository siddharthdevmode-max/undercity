import { describe, it, expect } from "vitest";
import { ApiError } from "../apiError";

describe("ApiError", () => {
  it("creates error with correct properties", () => {
    const err = new ApiError("Not found", 404, "NOT_FOUND");
    expect(err.message).toBe("Not found");
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.name).toBe("ApiError");
  });

  it("isJailError returns true for IN_JAIL code", () => {
    const err = new ApiError("In jail", 423, "IN_JAIL");
    expect(err.isJailError).toBe(true);
  });

  it("isRateLimited returns true for 429", () => {
    const err = new ApiError("Rate limited", 429, "RATE_LIMIT");
    expect(err.isRateLimited).toBe(true);
  });

  it("isUnauthorized returns true for 401", () => {
    const err = new ApiError("Unauthorized", 401, "UNAUTHORIZED");
    expect(err.isUnauthorized).toBe(true);
  });

  it("isBanned returns true for 403", () => {
    const err = new ApiError("Banned", 403, "FORBIDDEN");
    expect(err.isBanned).toBe(true);
  });

  it("isValidationError returns true for VALIDATION_ERROR", () => {
    const err = new ApiError("Invalid", 400, "VALIDATION_ERROR");
    expect(err.isValidationError).toBe(true);
  });

  it("stores details when provided", () => {
    const details = [{ path: "username", message: "Too short" }];
    const err = new ApiError("Invalid", 400, "VALIDATION_ERROR", details);
    expect(err.details).toEqual(details);
  });

  it("is instance of Error", () => {
    const err = new ApiError("Error", 500, "INTERNAL");
    expect(err instanceof Error).toBe(true);
  });
});
