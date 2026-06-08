// ============================================================
// ERROR HANDLER — UNDERCITY
// Centralized error handling with Sentry, pg error mapping,
// Zod support, Retry-After headers, and dev stack traces.
// ============================================================

import { Request, Response, NextFunction } from "express";
import * as Sentry   from "@sentry/node";
import { DatabaseError } from "pg";
import { ZodError }      from "zod";
import {
  AppError,
  ValidationError,
  ConflictError,
  NotFoundError,
  CrimeCooldownError,
  MaintenanceError,
  RateLimitError,
  isAppError,
} from "../utils/errors";
import { logger } from "../utils/logger";
import { config } from "../config";

// ─── PG Error → AppError ──────────────────────────────────

function mapDatabaseError(err: DatabaseError): AppError {
  switch (err.code) {
    case "23505":
      return new ConflictError(
        err.detail
          ? `Duplicate entry: ${err.detail}`
          : "A record with this value already exists."
      );
    case "23503":
      return new ValidationError("Referenced record does not exist.");
    case "23502":
      return new ValidationError(`Missing required field: ${err.column ?? "unknown"}`);
    case "22001":
      return new ValidationError("Input value is too long.");
    case "57014":
      return new AppError("Database query timed out.", 503, "DB_TIMEOUT", "ERR_10004");
    default:
      return new AppError("Database error.", 500, "DB_ERROR", "ERR_10005");
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
    requestId,
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
    res.status(400).json(buildResponseBody(appErr, requestId, config.isDevelopment));
    return;
  }

  // ── PostgreSQL error ──────────────────────────────────
  if (err instanceof DatabaseError) {
    const appErr = mapDatabaseError(err);
    logger.warn(`DB Error [${err.code}]: ${err.message}`, {
      requestId,
      pgCode: err.code,
      detail: err.detail,
      table:  err.table,
    });
    res.status(appErr.statusCode).json(
      buildResponseBody(appErr, requestId, config.isDevelopment)
    );
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

    if (err instanceof RateLimitError && err.retryAfterSeconds) {
      res.setHeader("Retry-After", String(err.retryAfterSeconds));
    }

    if (err instanceof CrimeCooldownError) {
      res.setHeader("Retry-After", String(err.secondsRemaining));
    }

    if (err instanceof MaintenanceError) {
      res.setHeader("Retry-After", "300");
    }

    res.status(err.statusCode).json(resBody);
    return;
  }

  // ── Unknown / programmer errors ───────────────────────
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
    message:   "Internal server error",
    code:      "INTERNAL_ERROR",
    errorCode: "ERR_10003",
    requestId,
    ...(config.isDevelopment ? { stack: err.stack } : {}),
  });
};

// ─── 404 Handler ──────────────────────────────────────────
// MUST call next(err) — not res.json() directly.
// This ensures Sentry sees 404s in the error pipeline.

export const notFoundHandler = (
  req:  Request,
  _res: Response,
  next: NextFunction
): void => {
  next(new NotFoundError(`Cannot ${req.method} ${req.path}`));
};
