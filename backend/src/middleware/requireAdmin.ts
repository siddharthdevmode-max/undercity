import { Request, Response, NextFunction } from "express";
import { pool } from "../config/database";
import { config } from "../config";
import { ForbiddenError } from "../utils/errors";
import { logger } from "../utils/logger";

// ============================================================
// requireAdmin
//
// Access granted if:
//   1. User's is_admin = true in DB, OR
//   2. User's is_developer = true in DB, OR
//   3. User's firebase_uid is in config.adminUids (emergency override)
//
// Order: try DB first (dynamic, current), env list is fallback.
// ============================================================

export const requireAdmin = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const uid = req.firebaseUser?.uid;
  if (!uid) {
    return next(new ForbiddenError());
  }

  try {
    const result = await pool.query<{
      is_admin: boolean;
      is_developer: boolean;
    }>(
      `SELECT is_admin, is_developer FROM users WHERE firebase_uid = $1 LIMIT 1`,
      [uid]
    );

    const row = result.rows[0];
    const hasDbRole = !!row && (row.is_admin || row.is_developer);
    const inEnvList = config.adminUids.includes(uid);

    if (hasDbRole || inEnvList) {
      return next();
    }

    logger.warn("🚫 requireAdmin: denied", {
      uid: uid.substring(0, 8),
      path: req.path,
      dbRole: { is_admin: row?.is_admin, is_developer: row?.is_developer },
    });
    return next(new ForbiddenError());
  } catch (err) {
    logger.error("requireAdmin: DB error", {
      error: err instanceof Error ? err.message : String(err),
    });
    // Fail-CLOSED: any error = denied. Never accidentally grant access.
    return next(new ForbiddenError());
  }
};
