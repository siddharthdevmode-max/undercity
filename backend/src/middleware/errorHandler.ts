import { Request, Response, NextFunction } from "express";
import { AppError, ValidationError, JailError } from "../utils/errors";
import { logger } from "../utils/logger";

// ============================================================
// CENTRALIZED ERROR HANDLER
// ============================================================

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction   // Required 4-arg signature for Express error handler
) => {
  const requestId = req.requestId;

  if (err instanceof AppError) {
    logger.warn(`${err.code}: ${err.message}`, {
      requestId,
      path:       req.path,
      method:     req.method,
      statusCode: err.statusCode,
    });

    const response: Record<string, unknown> = {
      message: err.message,
      code:    err.code,
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

  logger.error("Unhandled error", {
    requestId,
    path:   req.path,
    method: req.method,
    error:  err.message,
    stack:  err.stack,
  });

  return res.status(500).json({
    message:   "Internal server error",
    code:      "INTERNAL_ERROR",
    requestId,
  });
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    message: "Endpoint not found",
    code:    "NOT_FOUND",
  });
};
