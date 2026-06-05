// ============================================================
// APP ERRORS
// All errors extend AppError for consistent handling
// Each has: statusCode, code (string), numeric errorCode
// ============================================================

export class AppError extends Error {
  public readonly statusCode:  number;
  public readonly code:        string;
  public readonly errorCode:   string;
  public readonly isOperational: boolean;

  constructor(
    message:   string,
    statusCode: number,
    code:       string,
    errorCode = "ERR_10004"
  ) {
    super(message);
    this.statusCode    = statusCode;
    this.code          = code;
    this.errorCode     = errorCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  public readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", "ERR_10001");
    this.details = details;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED", "ERR_1001");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403, "FORBIDDEN", "ERR_1004");
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, 404, "NOT_FOUND", "ERR_10002");
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT", "ERR_10003");
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests") {
    super(message, 429, "RATE_LIMIT", "ERR_9001");
  }
}

export class JailError extends AppError {
  public readonly secondsRemaining: number;
  public readonly jailType: "normal" | "federal";

  constructor(secondsRemaining: number, jailType: "normal" | "federal") {
    const prefix = jailType === "federal" ? "federal " : "";
    super(
      `You are currently in ${prefix}jail.`,
      423,
      "IN_JAIL",
      jailType === "federal" ? "ERR_3005" : "ERR_3004"
    );
    this.secondsRemaining = secondsRemaining;
    this.jailType         = jailType;
  }
}

export class NerveError extends AppError {
  public readonly currentNerve: number;
  public readonly requiredNerve: number;

  constructor(currentNerve: number, requiredNerve: number) {
    super(
      `Not enough nerve. You have ${currentNerve}, need ${requiredNerve}.`,
      422,
      "NO_NERVE",
      "ERR_3003"
    );
    this.currentNerve  = currentNerve;
    this.requiredNerve = requiredNerve;
  }
}

export class CrimeLockError extends AppError {
  public readonly unlockLevel: number;

  constructor(unlockLevel: number) {
    super(
      `This crime requires level ${unlockLevel}.`,
      403,
      "CRIME_LOCKED",
      "ERR_3002"
    );
    this.unlockLevel = unlockLevel;
  }
}

export class InsufficientFundsError extends AppError {
  public readonly currentMoney: number;
  public readonly requiredMoney: number;

  constructor(currentMoney: number, requiredMoney: number) {
    super(
      `Not enough money. You have $${currentMoney.toLocaleString()}, need $${requiredMoney.toLocaleString()}.`,
      422,
      "INSUFFICIENT_FUNDS",
      "ERR_6002"
    );
    this.currentMoney  = currentMoney;
    this.requiredMoney = requiredMoney;
  }
}
