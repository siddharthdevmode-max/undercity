import { Request, Response, NextFunction } from "express";
import { config } from "../config";
import { ForbiddenError } from "../utils/errors";

// ============================================================
// requireAdmin
// Uses central config — not process.env directly
// Reads at request time so hot config changes work in tests
// ============================================================

export const requireAdmin = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const uid = req.firebaseUser?.uid;
  if (!uid || !config.adminUids.includes(uid)) {
    return next(new ForbiddenError());
  }
  next();
};
