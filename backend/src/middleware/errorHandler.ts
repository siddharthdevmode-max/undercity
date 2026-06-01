import { Request, Response, NextFunction } from "express";
import { AppError, ValidationError, JailError } from "../utils/errors";
import { logger } from "../utils/logger";

// ============================================================
// CENTRALIZED ERROR HANDLER
// Catches all errors thrown in routes/controllers
// Returns consistent JSON error responses
// ============================================================

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const requestId = (req as any).requestId;

  // Known operational errors
  if (err instanceof AppError) {
    logger.warn(`${err.code}: ${err.message}`, {
      requestId,
      path: req.path,
      method: req.method,
      statusCode: err.statusCode,
    });

    const response: any = {
      message: err.message,
      code: err.code,
    };

    // Add extra context for specific error types
    if (err instanceof ValidationError && err.details) {
      response.details = err.details;
    }
    if (err instanceof JailError) {
      response.secondsRemaining = err.secondsRemaining;
      response.jailType = err.jailType;
    }

    return res.status(err.statusCode).json(response);
  }

  // Unknown errors = real bugs, log full stack
  logger.error("Unhandled error", {
    requestId,
    path: req.path,
    method: req.method,
    error: err.message,
    stack: err.stack,
  });

  return res.status(500).json({
    message: "Internal server error",
    code: "INTERNAL_ERROR",
    requestId,
  });
};

// ============================================================
// 404 handler (for unmatched routes)
// ============================================================
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    message: "Endpoint not found",
    code: "NOT_FOUND",
  });
};
