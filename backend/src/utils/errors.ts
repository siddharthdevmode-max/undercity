// ============================================================
// APP ERRORS — UNDERCITY
// Consistent error hierarchy with type guard and serialization.
//
// Error Code Ranges:
//   ERR_1xxx  — Auth & Access
//   ERR_2xxx  — Validation & Input
//   ERR_3xxx  — Game State (jail, nerve, energy, hospital)
//   ERR_4xxx  — Resources (items, inventory)
//   ERR_5xxx  — Social (gangs, players)
//   ERR_6xxx  — Economy (funds, market, debt)
//   ERR_7xxx  — System (maintenance, feature flags)
//   ERR_8xxx  — Idempotency & Concurrency
//   ERR_9xxx  — Rate & Abuse
//   ERR_10xxx — Generic (not found, conflict, internal)
// ============================================================

// ─── Money type ───────────────────────────────────────────
// BUG FIX: DB BIGINT returns as string — money must support
// string | number | bigint to avoid precision loss

type MoneyValue = string | number | bigint;

function formatMoney(val: MoneyValue): string {
  return typeof val === "bigint"
    ? val.toLocaleString()
    : Number(val).toLocaleString();
}

// ─── Base Error ───────────────────────────────────────────

export class AppError extends Error {
  public readonly statusCode:    number;
  public readonly code:          string;
  public readonly errorCode:     string;
  public readonly isOperational: boolean;

  constructor(
    message:    string,
    statusCode: number,
    code:       string,
    errorCode:  string = "ERR_10000"
  ) {
    super(message);
    this.name          = this.constructor.name;
    this.statusCode    = statusCode;
    this.code          = code;
    this.errorCode     = errorCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      // BUG FIX: include statusCode so frontend can use it without parsing body
      statusCode: this.statusCode,
      message:    this.message,
      code:       this.code,
      errorCode:  this.errorCode,
    };
  }
}

// ─── Type Guard ───────────────────────────────────────────

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

// ─── Auth & Access (ERR_1xxx) ─────────────────────────────

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED", "ERR_1001");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403, "FORBIDDEN", "ERR_1002");
  }
}

export class BannedError extends AppError {
  public readonly banReason:  string;
  public readonly banType:    "soft" | "hard" | "shadow";
  public readonly expiresAt?: Date;

  constructor(
    banType:    "soft" | "hard" | "shadow",
    reason:     string,
    expiresAt?: Date
  ) {
    const message =
      banType === "shadow"
        ? "Your account has been restricted."
        : expiresAt
          ? `Your account is banned until ${expiresAt.toISOString()}.`
          : "Your account has been permanently banned.";

    super(message, 403, "BANNED", "ERR_1003");
    this.banReason = reason;
    this.banType   = banType;
    this.expiresAt = expiresAt;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      // Security: never reveal ban type to shadow-banned players
      banType:   this.banType === "shadow" ? undefined : this.banType,
      expiresAt: this.expiresAt?.toISOString(),
    };
  }
}

// BUG FIX: specific error for onboarding-not-completed
// Frontend uses this to redirect to /onboarding instead of /login
export class OnboardingRequiredError extends AppError {
  constructor() {
    super(
      "Please complete onboarding before accessing this feature.",
      403,
      "ONBOARDING_REQUIRED",
      "ERR_1004"
    );
  }
}

// ─── Validation & Input (ERR_2xxx) ────────────────────────

export class ValidationError extends AppError {
  public readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", "ERR_2001");
    this.details = details;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      details: this.details,
    };
  }
}

// ─── Game State (ERR_3xxx) ────────────────────────────────

export class JailError extends AppError {
  public readonly secondsRemaining: number;
  public readonly jailType:         "normal" | "federal";

  constructor(secondsRemaining: number, jailType: "normal" | "federal") {
    const prefix = jailType === "federal" ? "federal " : "";
    super(
      `You are currently in ${prefix}jail.`,
      // Using 403 (not 423 WebDAV) — more standard, fewer client issues
      403,
      "IN_JAIL",
      jailType === "federal" ? "ERR_3002" : "ERR_3001"
    );
    this.secondsRemaining = secondsRemaining;
    this.jailType         = jailType;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      secondsRemaining: this.secondsRemaining,
      jailType:         this.jailType,
    };
  }
}

export class HospitalError extends AppError {
  public readonly secondsRemaining: number;

  constructor(secondsRemaining: number) {
    super(
      "You are in the hospital and cannot perform this action.",
      403,
      "IN_HOSPITAL",
      "ERR_3003"
    );
    this.secondsRemaining = secondsRemaining;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      secondsRemaining: this.secondsRemaining,
    };
  }
}

export class NerveError extends AppError {
  public readonly currentNerve:  number;
  public readonly requiredNerve: number;

  constructor(currentNerve: number, requiredNerve: number) {
    super(
      `Not enough nerve. You have ${currentNerve}, need ${requiredNerve}.`,
      422,
      "NO_NERVE",
      "ERR_3004"
    );
    this.currentNerve  = currentNerve;
    this.requiredNerve = requiredNerve;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      currentNerve:  this.currentNerve,
      requiredNerve: this.requiredNerve,
    };
  }
}

export class EnergyError extends AppError {
  public readonly currentEnergy:  number;
  public readonly requiredEnergy: number;

  constructor(currentEnergy: number, requiredEnergy: number) {
    super(
      `Not enough energy. You have ${currentEnergy}, need ${requiredEnergy}.`,
      422,
      "NO_ENERGY",
      "ERR_3005"
    );
    this.currentEnergy  = currentEnergy;
    this.requiredEnergy = requiredEnergy;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      currentEnergy:  this.currentEnergy,
      requiredEnergy: this.requiredEnergy,
    };
  }
}

export class CrimeLockError extends AppError {
  public readonly unlockLevel: number;

  constructor(unlockLevel: number) {
    super(
      `This crime requires level ${unlockLevel}.`,
      403,
      "CRIME_LOCKED",
      "ERR_3006"
    );
    this.unlockLevel = unlockLevel;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      unlockLevel: this.unlockLevel,
    };
  }
}

export class CrimeCooldownError extends AppError {
  public readonly secondsRemaining: number;

  constructor(secondsRemaining: number) {
    super(
      `You must wait ${secondsRemaining}s before committing another crime.`,
      429,
      "CRIME_COOLDOWN",
      "ERR_3007"
    );
    this.secondsRemaining = secondsRemaining;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      secondsRemaining: this.secondsRemaining,
    };
  }
}

// ─── Idempotency & Concurrency (ERR_8xxx) ─────────────────
// BUG FIX: new named class — was previously a raw AppError(409)

export class IdempotencyError extends AppError {
  constructor(message = "Duplicate request detected. This action has already been processed.") {
    super(message, 409, "IDEMPOTENCY_CONFLICT", "ERR_8001");
  }
}

export class ConcurrentModificationError extends AppError {
  constructor(resource = "Resource") {
    super(
      `${resource} was modified by another request. Please retry.`,
      409,
      "CONCURRENT_MODIFICATION",
      "ERR_8002"
    );
  }
}

// ─── Economy (ERR_6xxx) ───────────────────────────────────

export class InsufficientFundsError extends AppError {
  // BUG FIX: MoneyValue supports string | number | bigint
  // DB BIGINT returns as string — using number causes precision loss
  public readonly currentMoney:  MoneyValue;
  public readonly requiredMoney: MoneyValue;

  constructor(currentMoney: MoneyValue, requiredMoney: MoneyValue) {
    super(
      `Not enough money. You have $${formatMoney(currentMoney)}, need $${formatMoney(requiredMoney)}.`,
      422,
      "INSUFFICIENT_FUNDS",
      "ERR_6001"
    );
    this.currentMoney  = currentMoney;
    this.requiredMoney = requiredMoney;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      currentMoney:  String(this.currentMoney),
      requiredMoney: String(this.requiredMoney),
    };
  }
}

export class DebtError extends AppError {
  public readonly currentBalance: MoneyValue;

  constructor(currentBalance: MoneyValue) {
    super(
      `You are in debt ($${formatMoney(
        typeof currentBalance === "bigint" ? -currentBalance : Math.abs(Number(currentBalance))
      )}). Earn back to $0 before spending.`,
      422,
      "IN_DEBT",
      "ERR_6002"
    );
    this.currentBalance = currentBalance;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      currentBalance: String(this.currentBalance),
    };
  }
}

// ─── System (ERR_7xxx) ────────────────────────────────────

export class MaintenanceError extends AppError {
  public readonly estimatedDuration?: string;

  constructor(estimatedDuration?: string) {
    super(
      "The Undercity is currently undergoing maintenance. Check back soon.",
      503,
      "MAINTENANCE",
      "ERR_7001"
    );
    this.estimatedDuration = estimatedDuration;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      estimatedDuration: this.estimatedDuration,
    };
  }
}

// ─── Rate & Abuse (ERR_9xxx) ──────────────────────────────

export class RateLimitError extends AppError {
  public readonly retryAfterSeconds?: number;

  constructor(message = "Too many requests", retryAfterSeconds?: number) {
    super(message, 429, "RATE_LIMIT", "ERR_9001");
    this.retryAfterSeconds = retryAfterSeconds;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      retryAfter: this.retryAfterSeconds,
    };
  }
}

// ─── Internal / System (ERR_7xxx continued) ────────────────

export class SocketNotInitializedError extends AppError {
  constructor() {
    super("Socket.io not initialized", 500, "SOCKET_NOT_INITIALIZED", "ERR_7002");
  }
}

// ─── Generic (ERR_10xxx) ──────────────────────────────────

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, 404, "NOT_FOUND", "ERR_10001");
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT", "ERR_10002");
  }
}

export class InternalError extends AppError {
  constructor(message = "Internal server error") {
    super(message, 500, "INTERNAL_ERROR", "ERR_10003");
  }
}

export class DatabaseTimeoutError extends AppError {
  constructor() {
    super("Database query timed out.", 503, "DB_TIMEOUT", "ERR_10004");
  }
}

export class DatabaseInternalError extends AppError {
  constructor() {
    super("Database error.", 500, "DB_ERROR", "ERR_10005");
  }
}
