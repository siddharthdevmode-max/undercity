import { describe, it, expect } from "vitest";
import {
  AppError,
  ValidationError,
  UnauthorizedError,
  NotFoundError,
  JailError,
} from "../utils/errors";

describe("Custom Errors", () => {
  it("AppError has correct shape", () => {
    const err = new AppError("Test", 400, "TEST");
    expect(err.message).toBe("Test");
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("TEST");
    expect(err.isOperational).toBe(true);
  });

  it("ValidationError defaults to 400", () => {
    const err = new ValidationError("Bad input", { field: "name" });
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.details).toEqual({ field: "name" });
  });

  it("UnauthorizedError defaults to 401", () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("NotFoundError formats resource name", () => {
    const err = new NotFoundError("Crime");
    expect(err.message).toBe("Crime not found");
    expect(err.statusCode).toBe(404);
  });

  it("JailError carries jail info", () => {
    const err = new JailError(120, "federal");
    expect(err.statusCode).toBe(423);
    expect(err.secondsRemaining).toBe(120);
    expect(err.jailType).toBe("federal");
    expect(err.message).toContain("federal");
  });
});
