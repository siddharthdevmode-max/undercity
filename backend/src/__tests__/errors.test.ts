// ============================================================
// ERROR CLASS TESTS
// ============================================================

import { describe, it, expect } from "vitest";
import {
  AppError,
  isAppError,
  UnauthorizedError,
  ForbiddenError,
  BannedError,
  ValidationError,
  JailError,
  HospitalError,
  NerveError,
  EnergyError,
  CrimeLockError,
  CrimeCooldownError,
  InsufficientFundsError,
  DebtError,
  MaintenanceError,
  RateLimitError,
  NotFoundError,
  ConflictError,
  InternalError,
} from "../utils/errors";

// ── AppError base ─────────────────────────────────────────

describe("AppError", () => {
  it("sets all properties correctly", () => {
    const err = new AppError("test", 400, "TEST_CODE", "ERR_0000");
    expect(err.message).toBe("test");
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("TEST_CODE");
    expect(err.errorCode).toBe("ERR_0000");
    expect(err.isOperational).toBe(true);
  });

  it("defaults errorCode to ERR_10000", () => {
    const err = new AppError("test", 400, "CODE");
    expect(err.errorCode).toBe("ERR_10000");
  });

  it("toJSON returns message, code, errorCode", () => {
    const err = new AppError("msg", 500, "CODE", "ERR_1");
    expect(err.toJSON()).toEqual({
      message:   "msg",
      code:      "CODE",
      errorCode: "ERR_1",
    });
  });

  it("is an instance of Error", () => {
    expect(new AppError("x", 500, "X")).toBeInstanceOf(Error);
  });
});

// ── isAppError ────────────────────────────────────────────

describe("isAppError", () => {
  it("returns true for AppError instances", () => {
    expect(isAppError(new AppError("x", 500, "X"))).toBe(true);
  });

  it("returns true for subclasses", () => {
    expect(isAppError(new UnauthorizedError())).toBe(true);
  });

  it("returns false for plain Error", () => {
    expect(isAppError(new Error("x"))).toBe(false);
  });

  it("returns false for non-errors", () => {
    expect(isAppError(null)).toBe(false);
    expect(isAppError("string")).toBe(false);
    expect(isAppError(42)).toBe(false);
  });
});

// ── Auth errors ───────────────────────────────────────────

describe("UnauthorizedError", () => {
  it("has status 401 and code UNAUTHORIZED", () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
    expect(err.errorCode).toBe("ERR_1001");
  });

  it("accepts custom message", () => {
    expect(new UnauthorizedError("custom").message).toBe("custom");
  });
});

describe("ForbiddenError", () => {
  it("has status 403 and code FORBIDDEN", () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
    expect(err.errorCode).toBe("ERR_1002");
  });
});

describe("BannedError", () => {
  it("hard ban — sets correct properties", () => {
    const err = new BannedError("hard", "ToS violation");
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe("BANNED");
    expect(err.banType).toBe("hard");
    expect(err.banReason).toBe("ToS violation");
  });

  it("soft ban — includes expiresAt", () => {
    const expiry = new Date(Date.now() + 3_600_000);
    const err    = new BannedError("soft", "spam", expiry);
    expect(err.expiresAt).toEqual(expiry);
    expect(err.toJSON()).toHaveProperty("expiresAt");
  });

  it("shadow ban — hides ban type in JSON", () => {
    const err  = new BannedError("shadow", "suspicious");
    const json = err.toJSON();
    expect(json.banType).toBeUndefined();
  });
});

// ── Validation ────────────────────────────────────────────

describe("ValidationError", () => {
  it("has status 400", () => {
    expect(new ValidationError("bad input").statusCode).toBe(400);
  });

  it("includes details in toJSON", () => {
    const err  = new ValidationError("bad", [{ field: "name", message: "too short" }]);
    const json = err.toJSON();
    expect(json.details).toEqual([{ field: "name", message: "too short" }]);
  });
});

// ── Game state errors ─────────────────────────────────────

describe("JailError", () => {
  it("sets secondsRemaining and jailType", () => {
    const err = new JailError(300, "normal");
    expect(err.statusCode).toBe(423);
    expect(err.secondsRemaining).toBe(300);
    expect(err.jailType).toBe("normal");
    expect(err.toJSON()).toHaveProperty("secondsRemaining", 300);
  });

  it("federal jail has different errorCode", () => {
    const normal  = new JailError(100, "normal");
    const federal = new JailError(100, "federal");
    expect(normal.errorCode).toBe("ERR_3001");
    expect(federal.errorCode).toBe("ERR_3002");
  });
});

describe("HospitalError", () => {
  it("sets secondsRemaining", () => {
    const err = new HospitalError(120);
    expect(err.statusCode).toBe(423);
    expect(err.secondsRemaining).toBe(120);
  });
});

describe("NerveError", () => {
  it("includes nerve values in toJSON", () => {
    const err  = new NerveError(5, 10);
    const json = err.toJSON();
    expect(json.currentNerve).toBe(5);
    expect(json.requiredNerve).toBe(10);
    expect(err.statusCode).toBe(422);
  });
});

describe("EnergyError", () => {
  it("includes energy values in toJSON", () => {
    const err  = new EnergyError(20, 50);
    const json = err.toJSON();
    expect(json.currentEnergy).toBe(20);
    expect(json.requiredEnergy).toBe(50);
  });
});

describe("CrimeLockError", () => {
  it("includes unlockLevel", () => {
    const err = new CrimeLockError(15);
    expect(err.statusCode).toBe(403);
    expect(err.toJSON()).toHaveProperty("unlockLevel", 15);
  });
});

describe("CrimeCooldownError", () => {
  it("includes secondsRemaining", () => {
    const err = new CrimeCooldownError(45);
    expect(err.statusCode).toBe(429);
    expect(err.toJSON()).toHaveProperty("secondsRemaining", 45);
  });
});

// ── Economy errors ────────────────────────────────────────

describe("InsufficientFundsError", () => {
  it("includes money values", () => {
    const err  = new InsufficientFundsError(100, 500);
    const json = err.toJSON();
    expect(json.currentMoney).toBe(100);
    expect(json.requiredMoney).toBe(500);
    expect(err.statusCode).toBe(422);
  });
});

describe("DebtError", () => {
  it("includes currentBalance", () => {
    const err = new DebtError(-5000);
    expect(err.toJSON()).toHaveProperty("currentBalance", -5000);
    expect(err.statusCode).toBe(422);
  });
});

// ── System errors ─────────────────────────────────────────

describe("MaintenanceError", () => {
  it("has status 503", () => {
    expect(new MaintenanceError().statusCode).toBe(503);
  });

  it("includes estimatedDuration if provided", () => {
    const err = new MaintenanceError("30 minutes");
    expect(err.toJSON()).toHaveProperty("estimatedDuration", "30 minutes");
  });
});

describe("RateLimitError", () => {
  it("has status 429", () => {
    expect(new RateLimitError().statusCode).toBe(429);
  });

  it("includes retryAfter in toJSON", () => {
    const err = new RateLimitError("slow down", 60);
    expect(err.toJSON()).toHaveProperty("retryAfter", 60);
  });
});

// ── Generic errors ────────────────────────────────────────

describe("NotFoundError", () => {
  it("has status 404", () => {
    expect(new NotFoundError().statusCode).toBe(404);
  });

  it("includes resource name", () => {
    expect(new NotFoundError("Crime").message).toContain("Crime");
  });
});

describe("ConflictError", () => {
  it("has status 409", () => {
    expect(new ConflictError("duplicate").statusCode).toBe(409);
  });
});

describe("InternalError", () => {
  it("has status 500", () => {
    expect(new InternalError().statusCode).toBe(500);
  });
});
