import { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "../utils/errors";

// ============================================================
// requireAdmin
// Extracted middleware — works correctly with asyncHandler
// ============================================================

const ADMIN_UIDS = (process.env.ADMIN_UIDS || "").split(",").filter(Boolean);

export const requireAdmin = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const uid = req.firebaseUser?.uid;
  if (!uid || !ADMIN_UIDS.includes(uid)) {
    return next(new ForbiddenError());
  }
  next();
};
