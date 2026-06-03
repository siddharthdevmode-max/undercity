import { Request, Response, NextFunction } from "express";
import { AppError, ValidationError, JailError } from "../utils/errors";
import { logger } from "../utils/logger";
import { config } from "../config";

// ============================================================
// CENTRALIZED ERROR HANDLER
// - AppError subclasses → structured JSON with correct status
// - Unknown errors → 500, stack only logged in dev
// - requestId attached to every error response for tracing
// ============================================================

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction  // 4-arg signature required by Express
) => {
  const requestId = req.requestId;

  // ─── Operational errors (AppError subclasses) ───
  if (err instanceof AppError) {
    logger.warn(`${err.code}: ${err.message}`, {
      requestId,
      path:       req.path,
      method:     req.method,
      statusCode: err.statusCode,
    });

    const response: Record<string, unknown> = {
      message:   err.message,
      code:      err.code,
      requestId,
    };

    if (err instanceof ValidationError && err.details) {
      response.details = err.details;
    }

    if (err instanceof JailError) {
      response.secondsRemaining = err.secondsRemaining;
      response.jailType         = err.jailType;
    }

    return res.status(err.statusCode).json(response);
  }

  // ─── Unknown / programmer errors ───
  logger.error("Unhandled error", {
    requestId,
    path:   req.path,
    method: req.method,
    error:  err.message,
    // Only expose stack in dev — never in production
    stack:  config.isProduction ? undefined : err.stack,
  });

  return res.status(500).json({
    message:   "Internal server error",
    code:      "INTERNAL_ERROR",
    requestId,
  });
};

// ============================================================
// 404 HANDLER
// Catches all unmatched routes — must be registered before errorHandler
// ============================================================
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    message:   `Cannot ${req.method} ${req.path}`,
    code:      "NOT_FOUND",
    requestId: req.requestId,
  });
};
