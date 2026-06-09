// ============================================================
// ROLE MIDDLEWARE — UNDERCITY
// Factory-based role checking with Redis caching.
// Roles are cached per-user for 60 seconds.
// Attaches roles to req.userRoles for downstream use.
//
// SECURITY NOTE on requireAny():
//   Custom role checkers created via requireAny() are ISOLATED —
//   they do NOT automatically grant access to adminUids/devUids.
//   Only requireAdmin/requireModerator/requireDeveloper grant
//   env-list access. This is intentional: requireAny() is for
//   game-specific role checks (gang leader, etc.) that must not
//   silently elevate admins.
// ============================================================

import { Request, Response, NextFunction } from "express";
import { pool }   from "../config/database";
import redis      from "../config/redis";
import { config } from "../config";
import { ForbiddenError, UnauthorizedError } from "../utils/errors";
import { logger } from "../utils/logger";

// ─── Types ────────────────────────────────────────────────

export interface UserRoles {
  is_admin:     boolean;
  is_developer: boolean;
  is_moderator: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userRoles?: UserRoles;
    }
  }
}

// ─── Config ───────────────────────────────────────────────

const ROLE_CACHE_TTL_SEC = 60;
const ROLE_CACHE_PREFIX  = "roles:";

// ─── Role Fetcher ─────────────────────────────────────────

async function getUserRoles(uid: string): Promise<UserRoles | null> {
  const cacheKey = `${ROLE_CACHE_PREFIX}${uid}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached !== null) {
      return JSON.parse(cached) as UserRoles;
    }
  } catch { /* Redis down — fall through */ }

  const result = await pool.query<UserRoles>(
    `SELECT is_admin, is_developer, is_moderator
     FROM users
     WHERE firebase_uid = $1
     LIMIT 1`,
    [uid]
  );

  if (result.rows.length === 0) return null;

  const roles = result.rows[0];

  try {
    await redis.set(cacheKey, JSON.stringify(roles), "EX", ROLE_CACHE_TTL_SEC);
  } catch { /* Non-critical */ }

  return roles;
}

// ─── Cache Invalidation ───────────────────────────────────

export async function invalidateRoleCache(uid: string): Promise<void> {
  try {
    await redis.del(`${ROLE_CACHE_PREFIX}${uid}`);
  } catch { /* Non-critical */ }
}

// ─── Role Check Factory ───────────────────────────────────

type RoleChecker = (roles: UserRoles, uid: string) => boolean;

interface RoleMiddlewareOptions {
  /**
   * When true (default for built-in middleware): users in
   * config.adminUids or config.devUids bypass the role check.
   * When false (requireAny): ONLY the checkFn decides access.
   */
  allowEnvListBypass: boolean;
}

function makeRoleMiddleware(
  name:    string,
  checkFn: RoleChecker,
  options: RoleMiddlewareOptions = { allowEnvListBypass: true }
) {
  return async (
    req:  Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    const uid = req.firebaseUser?.uid;

    if (!uid) {
      return next(new UnauthorizedError());
    }

    try {
      const roles = req.userRoles ?? (await getUserRoles(uid));

      if (!roles) {
        logger.warn(`🚫 ${name}: user not found in DB`, {
          uid:  uid.slice(0, 8),
          path: req.path,
        });
        return next(new ForbiddenError());
      }

      req.userRoles = roles;

      // Env list bypass — only for built-in middleware
      if (options.allowEnvListBypass) {
        const inEnvList =
          config.adminUids.includes(uid) || config.devUids.includes(uid);
        if (inEnvList) return next();
      }

      if (checkFn(roles, uid)) {
        return next();
      }

      logger.warn(`🚫 ${name}: access denied`, {
        uid:   uid.slice(0, 8),
        path:  req.path,
        roles: {
          admin:     roles.is_admin,
          developer: roles.is_developer,
          moderator: roles.is_moderator,
        },
      });

      return next(new ForbiddenError());
    } catch (err) {
      logger.error(`${name}: role check error — failing closed`, {
        uid:   uid.slice(0, 8),
        error: err instanceof Error ? err.message : String(err),
      });
      // Fail CLOSED — deny on error
      return next(new ForbiddenError());
    }
  };
}

// ─── Built-in Middleware ──────────────────────────────────

/** Admin or Developer (+ env list bypass) */
export const requireAdmin = makeRoleMiddleware(
  "requireAdmin",
  (roles) => roles.is_admin || roles.is_developer,
  { allowEnvListBypass: true }
);

/** Moderator, Admin, or Developer (+ env list bypass) */
export const requireModerator = makeRoleMiddleware(
  "requireModerator",
  (roles) => roles.is_admin || roles.is_developer || roles.is_moderator,
  { allowEnvListBypass: true }
);

/** Developer only (+ env list bypass) */
export const requireDeveloper = makeRoleMiddleware(
  "requireDeveloper",
  (roles, uid) => roles.is_developer || config.devUids.includes(uid),
  { allowEnvListBypass: true }
);

// ─── Custom Role Middleware ───────────────────────────────

/**
 * Create isolated role middleware for game-specific checks.
 * Does NOT grant access to adminUids/devUids automatically.
 * Only the provided checkFn decides access.
 *
 * Usage:
 *   const requireGangLeader = requireAny(
 *     (roles) => someCustomCheck(roles)
 *   );
 */
export function requireAny(checkFn: RoleChecker) {
  return makeRoleMiddleware(
    "requireAny",
    checkFn,
    { allowEnvListBypass: false }  // isolated — no env list bypass
  );
}
