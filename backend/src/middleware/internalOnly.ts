import { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "../utils/errors";

// ============================================================
// internalOnly
// Restricts endpoints to localhost / internal networks
// Use for metrics, debug endpoints
// ============================================================

const INTERNAL_RANGES = [
  "127.0.0.1",
  "::1",
  "::ffff:127.0.0.1",
];

export const internalOnly = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const ip = req.ip || "";
  const isInternal =
    INTERNAL_RANGES.some((r) => ip === r) ||
    ip.startsWith("10.") ||
    ip.startsWith("172.16.") ||
    ip.startsWith("192.168.");

  if (!isInternal && process.env.NODE_ENV === "production") {
    return next(new ForbiddenError("Internal endpoint only."));
  }

  next();
};
