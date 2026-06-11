// ============================================================
// ERROR HANDLER — UNDERCITY
// Centralized error handling with Sentry, pg error mapping,
// Zod support, Retry-After headers, and dev stack traces.
// ============================================================

import { Request, Response, NextFunction } from "express";
import * as Sentry       from "@sentry/node";
import pg                from "pg";
import { ZodError }      from "zod";
import {
  AppError,
  ValidationError,
  ConflictError,
  NotFoundError,
  CrimeCooldownError,
  MaintenanceError,
  RateLimitError,
  DatabaseTimeoutError,
  DatabaseInternalError,
  isAppError,
} from "../utils/errors";
import { logger } from "../utils/logger";
import { config } from "../config";

// BUG FIX: use pg.DatabaseError (namespace access) for
// compatibility across pg versions
const { DatabaseError } = pg;

// ─── PG Error → AppError ──────────────────────────────────

function mapDatabaseError(err: pg.DatabaseError): AppError {
  switch (err.code) {
    case "23505":
      // BUG FIX: never include err.detail in response — leaks column + value
      return new ConflictError("A record with this value already exists.");
    case "23503":
      return new ValidationError("Referenced record does not exist.");
    case "23502":
      // Safe — column name is internal schema, acceptable to show
      return new ValidationError(
        `Missing required field: ${err.column ?? "unknown"}`
      );
    case "22001":
      return new ValidationError("Input value is too long.");
    case "57014":
      return new DatabaseTimeoutError();
    default:
      return new DatabaseInternalError();
  }
}

// ─── Build Response Body ──────────────────────────────────

function buildResponseBody(
  err:       AppError,
  requestId: string | undefined,
  isDev:     boolean
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    ...err.toJSON(),
    // BUG FIX: only include requestId if defined — consistent shape
    ...(requestId ? { requestId } : {}),
  };

  if (err instanceof RateLimitError && err.retryAfterSeconds) {
    base.retryAfter = err.retryAfterSeconds;
  }

  if (isDev) {
    base.stack = err.stack;
  }

  return base;
}

// ─── Error Handler ────────────────────────────────────────

export const errorHandler = (
  err:   Error,
  req:   Request,
  res:   Response,
  _next: NextFunction
): void => {
  const requestId = req.requestId;

  // ── Zod validation error ─────────────────────────────
  if (err instanceof ZodError) {
    const appErr = new ValidationError(
      "Validation failed",
      err.flatten().fieldErrors
    );
    res
      .status(400)
      .json(buildResponseBody(appErr, requestId, config.isDevelopment));
    return;
  }

  // ── PostgreSQL error ──────────────────────────────────
  if (err instanceof DatabaseError) {
    const appErr = mapDatabaseError(err);
    logger.warn(`DB Error [${err.code}]: ${err.message}`, {
      requestId,
      pgCode: err.code,
      // Never log err.detail to avoid leaking user data
      table:  err.table,
    });
    res
      .status(appErr.statusCode)
      .json(buildResponseBody(appErr, requestId, config.isDevelopment));
    return;
  }

  // ── Operational AppErrors ─────────────────────────────
  if (isAppError(err)) {
    logger.warn(`[${err.code}] ${err.message}`, {
      requestId,
      path:       req.path,
      method:     req.method,
      statusCode: err.statusCode,
      errorCode:  err.errorCode,
    });

    const resBody = buildResponseBody(err, requestId, config.isDevelopment);

    // Set Retry-After header where appropriate
    if (err instanceof RateLimitError && err.retryAfterSeconds) {
      res.setHeader("Retry-After", String(err.retryAfterSeconds));
    } else if (err instanceof CrimeCooldownError) {
      res.setHeader("Retry-After", String(err.secondsRemaining));
    } else if (err instanceof MaintenanceError) {
      res.setHeader("Retry-After", "300");
    }
    // BUG FIX: IdempotencyError — explicitly NO Retry-After
    // A duplicate request should not be retried — it already succeeded

    res.status(err.statusCode).json(resBody);
    return;
  }

  // ── Unknown / programmer errors ───────────────────────
  // These are not operational — they're bugs. Capture to Sentry.
  Sentry.captureException(err, {
    extra: {
      requestId,
      path:   req.path,
      method: req.method,
      uid:    req.firebaseUser?.uid,
    },
  });

  logger.error("Unhandled error", {
    requestId,
    path:   req.path,
    method: req.method,
    error:  err.message,
    stack:  err.stack,
  });

  res.status(500).json({
    statusCode: 500,
    message:    "Internal server error",
    code:       "INTERNAL_ERROR",
    errorCode:  "ERR_10003",
    ...(requestId ? { requestId } : {}),
    ...(config.isDevelopment ? { stack: err.stack } : {}),
  });
};

// ─── 404 Handler ──────────────────────────────────────────

export const notFoundHandler = (
  req:  Request,
  _res: Response,
  next: NextFunction
): void => {
  next(new NotFoundError(`Cannot ${req.method} ${req.path}`));
};
