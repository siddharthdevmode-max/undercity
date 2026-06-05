import { Request, Response, NextFunction } from "express";
import { pool } from "../config/database";
import { config } from "../config";
import { ForbiddenError } from "../utils/errors";
import { logger } from "../utils/logger";

// ============================================================
// ROLE MIDDLEWARE
// Three levels:
//   requireAdmin     — admin OR developer only
//   requireModerator — admin OR developer OR moderator
//   requireDeveloper — developer only
// All fail-CLOSED on errors
// ============================================================

type RoleRow = {
  is_admin:     boolean;
  is_developer: boolean;
  is_moderator: boolean;
};

async function getRoles(uid: string): Promise<RoleRow | null> {
  const result = await pool.query<RoleRow>(
    `SELECT is_admin, is_developer, is_moderator
     FROM users WHERE firebase_uid = $1 LIMIT 1`,
    [uid]
  );
  return result.rows[0] ?? null;
}

// ── Admin or Developer only ────────────────────────────────
export const requireAdmin = async (
  req:  Request,
  _res: Response,
  next: NextFunction
) => {
  const uid = req.firebaseUser?.uid;
  if (!uid) return next(new ForbiddenError());

  try {
    const row        = await getRoles(uid);
    const hasDbRole  = !!row && (row.is_admin || row.is_developer);
    const inEnvList  = config.adminUids.includes(uid);

    if (hasDbRole || inEnvList) return next();

    logger.warn("🚫 requireAdmin: denied", {
      uid:  uid.substring(0, 8),
      path: req.path,
    });
    return next(new ForbiddenError());
  } catch (err) {
    logger.error("requireAdmin: DB error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return next(new ForbiddenError());
  }
};

// ── Moderator or above ─────────────────────────────────────
export const requireModerator = async (
  req:  Request,
  _res: Response,
  next: NextFunction
) => {
  const uid = req.firebaseUser?.uid;
  if (!uid) return next(new ForbiddenError());

  try {
    const row       = await getRoles(uid);
    const hasDbRole = !!row && (
      row.is_admin || row.is_developer || row.is_moderator
    );
    const inEnvList = config.adminUids.includes(uid);

    if (hasDbRole || inEnvList) return next();

    logger.warn("🚫 requireModerator: denied", {
      uid:  uid.substring(0, 8),
      path: req.path,
    });
    return next(new ForbiddenError());
  } catch (err) {
    logger.error("requireModerator: DB error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return next(new ForbiddenError());
  }
};

// ── Developer only ─────────────────────────────────────────
export const requireDeveloper = async (
  req:  Request,
  _res: Response,
  next: NextFunction
) => {
  const uid = req.firebaseUser?.uid;
  if (!uid) return next(new ForbiddenError());

  try {
    const row       = await getRoles(uid);
    const isDev     = !!row && row.is_developer;
    const inEnvList = config.adminUids.includes(uid);

    if (isDev || inEnvList) return next();

    logger.warn("🚫 requireDeveloper: denied", {
      uid:  uid.substring(0, 8),
      path: req.path,
    });
    return next(new ForbiddenError());
  } catch (err) {
    logger.error("requireDeveloper: DB error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return next(new ForbiddenError());
  }
};
