import { Request, Response, NextFunction } from "express";
import { AppError, ValidationError, JailError, NerveError, CrimeLockError, InsufficientFundsError } from "../utils/errors";
import { logger } from "../utils/logger";
import { config } from "../config";

// ============================================================
// CENTRALIZED ERROR HANDLER
// Every AppError subclass now includes:
//   - message    (human readable)
//   - code       (string for legacy compat)
//   - errorCode  (ERR_XXXX for frontend switching)
//   - requestId  (for tracing)
// ============================================================

export const errorHandler = (
  err:  Error,
  req:  Request,
  res:  Response,
  _next: NextFunction
) => {
  const requestId = req.requestId;

  // ─── Operational errors (AppError subclasses) ───
  if (err instanceof AppError) {
    logger.warn(`${err.code}: ${err.message}`, {
      requestId,
      path:       req.path,
      method:     req.method,
      statusCode: err.statusCode,
      errorCode:  err.errorCode,
    });

    const response: Record<string, unknown> = {
      message:   err.message,
      code:      err.code,
      errorCode: err.errorCode,
      requestId,
    };

    // Attach subclass-specific fields
    if (err instanceof ValidationError && err.details) {
      response.details = err.details;
    }

    if (err instanceof JailError) {
      response.secondsRemaining = err.secondsRemaining;
      response.jailType         = err.jailType;
    }

    if (err instanceof NerveError) {
      response.currentNerve  = err.currentNerve;
      response.requiredNerve = err.requiredNerve;
    }

    if (err instanceof CrimeLockError) {
      response.unlockLevel = err.unlockLevel;
    }

    if (err instanceof InsufficientFundsError) {
      response.currentMoney  = err.currentMoney;
      response.requiredMoney = err.requiredMoney;
    }

    return res.status(err.statusCode).json(response);
  }

  // ─── Unknown / programmer errors ───
  logger.error("Unhandled error", {
    requestId,
    path:   req.path,
    method: req.method,
    error:  err.message,
    stack:  config.isProduction ? undefined : err.stack,
  });

  return res.status(500).json({
    message:   "Internal server error",
    code:      "INTERNAL_ERROR",
    errorCode: "ERR_10004",
    requestId,
  });
};

// ============================================================
// 404 HANDLER
// ============================================================
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    message:   `Cannot ${req.method} ${req.path}`,
    code:      "NOT_FOUND",
    errorCode: "ERR_10002",
    requestId: req.requestId,
  });
};
