// ============================================================
// TYPED API ERROR
// Preserves HTTP status code and error code from API
// ============================================================

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: any;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    details?: any
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  get isJailError()       { return this.code === "IN_JAIL"; }
  get isRateLimited()     { return this.statusCode === 429; }
  get isUnauthorized()    { return this.statusCode === 401; }
  get isBanned()          { return this.statusCode === 403; }
  get isValidationError() { return this.code === "VALIDATION_ERROR"; }
}
