import { describe, it, expect } from "vitest";
import {
  AppError,
  isAppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  BannedError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  JailError,
  HospitalError,
  NerveError,
  EnergyError,
  CrimeLockError,
  CrimeCooldownError,
  InsufficientFundsError,
  DebtError,
  MaintenanceError,
  InternalError,
} from "../utils/errors";

// ── AppError ──────────────────────────────────────────────

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

  it("sets default errorCode ERR_10000 when not provided", () => {
    const err = new AppError("msg", 500, "CODE");
    expect(err.errorCode).toBe("ERR_10000");
  });

  it("accepts custom errorCode", () => {
    const err = new AppError("msg", 400, "CODE", "ERR_1234");
    expect(err.errorCode).toBe("ERR_1234");
  });

  it("toJSON returns message, code, errorCode", () => {
    const err = new AppError("msg", 500, "MY_CODE", "ERR_9999");
    const json = err.toJSON();
    expect(json).toEqual({
      message:   "msg",
      code:      "MY_CODE",
      errorCode: "ERR_9999",
    });
  });

  it("name is set to constructor name", () => {
    const err = new AppError("msg", 500, "CODE");
    expect(err.name).toBe("AppError");
  });
});

// ── isAppError ────────────────────────────────────────────

describe("isAppError", () => {
  it("returns true for AppError instances", () => {
    expect(isAppError(new AppError("x", 500, "X"))).toBe(true);
  });

  it("returns true for subclass instances", () => {
    expect(isAppError(new NotFoundError())).toBe(true);
    expect(isAppError(new ValidationError("bad"))).toBe(true);
  });

  it("returns false for plain Error", () => {
    expect(isAppError(new Error("plain"))).toBe(false);
  });

  it("returns false for null and undefined", () => {
    expect(isAppError(null)).toBe(false);
    expect(isAppError(undefined)).toBe(false);
  });

  it("returns false for strings and objects", () => {
    expect(isAppError("error string")).toBe(false);
    expect(isAppError({ message: "fake" })).toBe(false);
  });
});

// ── ValidationError ───────────────────────────────────────

describe("ValidationError", () => {
  it("has 400 status and VALIDATION_ERROR code", () => {
    const err = new ValidationError("bad input");
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.errorCode).toBe("ERR_2001");
  });

  it("stores optional details", () => {
    const err = new ValidationError("bad input", { field: "name" });
    expect(err.details).toEqual({ field: "name" });
  });

  it("details is undefined when not provided", () => {
    const err = new ValidationError("bad input");
    expect(err.details).toBeUndefined();
  });

  it("toJSON includes details when present", () => {
    const err = new ValidationError("bad input", { field: "email" });
    const json = err.toJSON() as Record<string, unknown>;
    expect(json["details"]).toEqual({ field: "email" });
  });

  it("toJSON includes undefined details when absent", () => {
    const err = new ValidationError("bad");
    const json = err.toJSON() as Record<string, unknown>;
    expect(json["details"]).toBeUndefined();
  });
});

// ── UnauthorizedError ─────────────────────────────────────

describe("UnauthorizedError", () => {
  it("has 401 status and UNAUTHORIZED code", () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
    expect(err.errorCode).toBe("ERR_1001");
  });

  it("defaults message to Unauthorized", () => {
    expect(new UnauthorizedError().message).toBe("Unauthorized");
  });

  it("accepts custom message", () => {
    const err = new UnauthorizedError("Token expired");
    expect(err.message).toBe("Token expired");
  });
});

// ── ForbiddenError ────────────────────────────────────────

describe("ForbiddenError", () => {
  it("has 403 status and FORBIDDEN code", () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
    expect(err.errorCode).toBe("ERR_1002");
  });

  it("defaults message to Forbidden", () => {
    expect(new ForbiddenError().message).toBe("Forbidden");
  });

  it("accepts custom message", () => {
    expect(new ForbiddenError("Admin only").message).toBe("Admin only");
  });
});

// ── BannedError ───────────────────────────────────────────

describe("BannedError", () => {
  it("has 403 status and BANNED code", () => {
    const err = new BannedError("hard", "cheating");
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe("BANNED");
    expect(err.errorCode).toBe("ERR_1003");
  });

  it("stores banReason and banType", () => {
    const err = new BannedError("soft", "spam", new Date());
    expect(err.banReason).toBe("spam");
    expect(err.banType).toBe("soft");
  });

  it("shadow ban message is generic — does not reveal ban type", () => {
    const err = new BannedError("shadow", "botting");
    expect(err.message).toBe("Your account has been restricted.");
  });

  it("hard ban with no expiry = permanent message", () => {
    const err = new BannedError("hard", "cheating");
    expect(err.message).toContain("permanently banned");
  });

  it("soft ban with expiry includes expiry ISO string", () => {
    const expiry = new Date(Date.now() + 86400000);
    const err    = new BannedError("soft", "abuse", expiry);
    expect(err.message).toContain(expiry.toISOString());
  });

  it("toJSON hides banType for shadow banned users", () => {
    const err  = new BannedError("shadow", "botting");
    const json = err.toJSON() as Record<string, unknown>;
    expect(json["banType"]).toBeUndefined();
  });

  it("toJSON includes banType for hard ban", () => {
    const err  = new BannedError("hard", "cheating");
    const json = err.toJSON() as Record<string, unknown>;
    expect(json["banType"]).toBe("hard");
  });

  it("toJSON includes banType for soft ban", () => {
    const err  = new BannedError("soft", "abuse", new Date());
    const json = err.toJSON() as Record<string, unknown>;
    expect(json["banType"]).toBe("soft");
  });

  it("toJSON includes expiresAt for soft ban", () => {
    const expiry = new Date(Date.now() + 86400000);
    const err    = new BannedError("soft", "abuse", expiry);
    const json   = err.toJSON() as Record<string, unknown>;
    expect(json["expiresAt"]).toBe(expiry.toISOString());
  });

  it("toJSON expiresAt undefined when no expiry", () => {
    const err  = new BannedError("hard", "cheating");
    const json = err.toJSON() as Record<string, unknown>;
    expect(json["expiresAt"]).toBeUndefined();
  });
});

// ── JailError ─────────────────────────────────────────────

describe("JailError", () => {
  it("has 423 status and IN_JAIL code for normal jail", () => {
    const err = new JailError(120, "normal");
    expect(err.statusCode).toBe(423);
    expect(err.code).toBe("IN_JAIL");
    expect(err.errorCode).toBe("ERR_3001");
  });

  it("has ERR_3002 for federal jail", () => {
    const err = new JailError(300, "federal");
    expect(err.errorCode).toBe("ERR_3002");
  });

  it("stores secondsRemaining and jailType", () => {
    const err = new JailError(300, "federal");
    expect(err.secondsRemaining).toBe(300);
    expect(err.jailType).toBe("federal");
  });

  it("message includes 'federal' for federal jail", () => {
    expect(new JailError(60, "federal").message).toContain("federal");
  });

  it("message omits 'federal' for normal jail", () => {
    expect(new JailError(60, "normal").message).not.toContain("federal");
  });

  it("toJSON includes secondsRemaining and jailType", () => {
    const err  = new JailError(90, "normal");
    const json = err.toJSON() as Record<string, unknown>;
    expect(json["secondsRemaining"]).toBe(90);
    expect(json["jailType"]).toBe("normal");
  });
});

// ── HospitalError ─────────────────────────────────────────

describe("HospitalError", () => {
  it("has 423 status and IN_HOSPITAL code", () => {
    const err = new HospitalError(60);
    expect(err.statusCode).toBe(423);
    expect(err.code).toBe("IN_HOSPITAL");
    expect(err.errorCode).toBe("ERR_3003");
  });

  it("stores secondsRemaining", () => {
    const err = new HospitalError(120);
    expect(err.secondsRemaining).toBe(120);
  });

  it("toJSON includes secondsRemaining", () => {
    const json = new HospitalError(45).toJSON() as Record<string, unknown>;
    expect(json["secondsRemaining"]).toBe(45);
  });

  it("message describes hospital restriction", () => {
    expect(new HospitalError(60).message).toContain("hospital");
  });
});

// ── NerveError ────────────────────────────────────────────

describe("NerveError", () => {
  it("has 422 status and NO_NERVE code", () => {
    const err = new NerveError(5, 10);
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe("NO_NERVE");
    expect(err.errorCode).toBe("ERR_3004");
  });

  it("stores currentNerve and requiredNerve", () => {
    const err = new NerveError(3, 8);
    expect(err.currentNerve).toBe(3);
    expect(err.requiredNerve).toBe(8);
  });

  it("message includes both nerve values", () => {
    const err = new NerveError(3, 8);
    expect(err.message).toContain("3");
    expect(err.message).toContain("8");
  });

  it("toJSON includes currentNerve and requiredNerve", () => {
    const json = new NerveError(3, 8).toJSON() as Record<string, unknown>;
    expect(json["currentNerve"]).toBe(3);
    expect(json["requiredNerve"]).toBe(8);
  });
});

// ── EnergyError ───────────────────────────────────────────

describe("EnergyError", () => {
  it("has 422 status and NO_ENERGY code", () => {
    const err = new EnergyError(10, 50);
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe("NO_ENERGY");
    expect(err.errorCode).toBe("ERR_3005");
  });

  it("stores currentEnergy and requiredEnergy", () => {
    const err = new EnergyError(10, 50);
    expect(err.currentEnergy).toBe(10);
    expect(err.requiredEnergy).toBe(50);
  });

  it("message includes both energy values", () => {
    const err = new EnergyError(10, 50);
    expect(err.message).toContain("10");
    expect(err.message).toContain("50");
  });

  it("toJSON includes currentEnergy and requiredEnergy", () => {
    const json = new EnergyError(10, 50).toJSON() as Record<string, unknown>;
    expect(json["currentEnergy"]).toBe(10);
    expect(json["requiredEnergy"]).toBe(50);
  });
});

// ── CrimeLockError ────────────────────────────────────────

describe("CrimeLockError", () => {
  it("has 403 status and CRIME_LOCKED code", () => {
    const err = new CrimeLockError(10);
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe("CRIME_LOCKED");
    expect(err.errorCode).toBe("ERR_3006");
  });

  it("stores unlockLevel", () => {
    expect(new CrimeLockError(15).unlockLevel).toBe(15);
  });

  it("message includes unlock level", () => {
    expect(new CrimeLockError(10).message).toContain("10");
  });

  it("toJSON includes unlockLevel", () => {
    const json = new CrimeLockError(20).toJSON() as Record<string, unknown>;
    expect(json["unlockLevel"]).toBe(20);
  });
});

// ── CrimeCooldownError ────────────────────────────────────

describe("CrimeCooldownError", () => {
  it("has 429 status and CRIME_COOLDOWN code", () => {
    const err = new CrimeCooldownError(5);
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe("CRIME_COOLDOWN");
    expect(err.errorCode).toBe("ERR_3007");
  });

  it("stores secondsRemaining", () => {
    expect(new CrimeCooldownError(5).secondsRemaining).toBe(5);
  });

  it("message includes seconds", () => {
    expect(new CrimeCooldownError(5).message).toContain("5");
  });

  it("toJSON includes secondsRemaining", () => {
    const json = new CrimeCooldownError(3).toJSON() as Record<string, unknown>;
    expect(json["secondsRemaining"]).toBe(3);
  });
});

// ── InsufficientFundsError ────────────────────────────────

describe("InsufficientFundsError", () => {
  it("has 422 status and INSUFFICIENT_FUNDS code", () => {
    const err = new InsufficientFundsError(100, 500);
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe("INSUFFICIENT_FUNDS");
    expect(err.errorCode).toBe("ERR_6001");
  });

  it("stores currentMoney and requiredMoney", () => {
    const err = new InsufficientFundsError(100, 500);
    expect(err.currentMoney).toBe(100);
    expect(err.requiredMoney).toBe(500);
  });

  it("toJSON includes both money values", () => {
    const json = new InsufficientFundsError(100, 500).toJSON() as Record<string, unknown>;
    expect(json["currentMoney"]).toBe(100);
    expect(json["requiredMoney"]).toBe(500);
  });

  it("message contains formatted money amounts", () => {
    const err = new InsufficientFundsError(1000, 5000);
    expect(err.message).toContain("1,000");
    expect(err.message).toContain("5,000");
  });
});

// ── DebtError ─────────────────────────────────────────────

describe("DebtError", () => {
  it("has 422 status and IN_DEBT code", () => {
    const err = new DebtError(-500);
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe("IN_DEBT");
    expect(err.errorCode).toBe("ERR_6002");
  });

  it("stores currentBalance", () => {
    expect(new DebtError(-1000).currentBalance).toBe(-1000);
  });

  it("message shows absolute debt amount", () => {
    const err = new DebtError(-50000);
    expect(err.message).toContain("50,000");
  });

  it("toJSON includes currentBalance", () => {
    const json = new DebtError(-250).toJSON() as Record<string, unknown>;
    expect(json["currentBalance"]).toBe(-250);
  });
});

// ── MaintenanceError ──────────────────────────────────────

describe("MaintenanceError", () => {
  it("has 503 status and MAINTENANCE code", () => {
    const err = new MaintenanceError();
    expect(err.statusCode).toBe(503);
    expect(err.code).toBe("MAINTENANCE");
    expect(err.errorCode).toBe("ERR_7001");
  });

  it("message mentions maintenance", () => {
    expect(new MaintenanceError().message).toContain("maintenance");
  });

  it("stores optional estimatedDuration", () => {
    const err = new MaintenanceError("30 minutes");
    expect(err.estimatedDuration).toBe("30 minutes");
  });

  it("estimatedDuration is undefined when not provided", () => {
    expect(new MaintenanceError().estimatedDuration).toBeUndefined();
  });

  it("toJSON includes estimatedDuration when provided", () => {
    const json = new MaintenanceError("1 hour").toJSON() as Record<string, unknown>;
    expect(json["estimatedDuration"]).toBe("1 hour");
  });

  it("toJSON estimatedDuration undefined when absent", () => {
    const json = new MaintenanceError().toJSON() as Record<string, unknown>;
    expect(json["estimatedDuration"]).toBeUndefined();
  });
});

// ── RateLimitError ────────────────────────────────────────

describe("RateLimitError", () => {
  it("has 429 status and RATE_LIMIT code", () => {
    const err = new RateLimitError();
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe("RATE_LIMIT");
    expect(err.errorCode).toBe("ERR_9001");
  });

  it("defaults message to Too many requests", () => {
    expect(new RateLimitError().message).toBe("Too many requests");
  });

  it("accepts custom message", () => {
    expect(new RateLimitError("Slow down").message).toBe("Slow down");
  });

  it("stores retryAfterSeconds", () => {
    expect(new RateLimitError("msg", 30).retryAfterSeconds).toBe(30);
  });

  it("retryAfterSeconds is undefined when not provided", () => {
    expect(new RateLimitError().retryAfterSeconds).toBeUndefined();
  });

  it("toJSON includes retryAfter when provided", () => {
    const json = new RateLimitError("msg", 60).toJSON() as Record<string, unknown>;
    expect(json["retryAfter"]).toBe(60);
  });
});

// ── NotFoundError ─────────────────────────────────────────

describe("NotFoundError", () => {
  it("has 404 status and NOT_FOUND code", () => {
    const err = new NotFoundError("User");
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.errorCode).toBe("ERR_10001");
  });

  it("message includes resource name", () => {
    expect(new NotFoundError("User").message).toBe("User not found");
  });

  it("defaults resource to Resource", () => {
    expect(new NotFoundError().message).toBe("Resource not found");
  });
});

// ── ConflictError ─────────────────────────────────────────

describe("ConflictError", () => {
  it("has 409 status and CONFLICT code", () => {
    const err = new ConflictError("Username taken");
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe("CONFLICT");
    expect(err.errorCode).toBe("ERR_10002");
  });

  it("stores the message", () => {
    expect(new ConflictError("Duplicate entry").message).toBe("Duplicate entry");
  });
});

// ── InternalError ─────────────────────────────────────────

describe("InternalError", () => {
  it("has 500 status and INTERNAL_ERROR code", () => {
    const err = new InternalError();
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe("INTERNAL_ERROR");
    expect(err.errorCode).toBe("ERR_10003");
  });

  it("defaults message to Internal server error", () => {
    expect(new InternalError().message).toBe("Internal server error");
  });

  it("accepts custom message", () => {
    expect(new InternalError("DB failed").message).toBe("DB failed");
  });
});
