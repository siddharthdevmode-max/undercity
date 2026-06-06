// ============================================================
// ROLE MIDDLEWARE — UNDERCITY
// Factory-based role checking with Redis caching.
// Roles are cached per-user for 60 seconds.
// Attaches roles to req.userRoles for downstream use.
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

// Extend Express Request
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

// ─── Role Fetcher (Cache → DB) ────────────────────────────

async function getUserRoles(uid: string): Promise<UserRoles | null> {
  const cacheKey = `${ROLE_CACHE_PREFIX}${uid}`;

  // Try cache first
  try {
    const cached = await redis.get(cacheKey);
    if (cached !== null) {
      return JSON.parse(cached) as UserRoles;
    }
  } catch {
    // Redis down — fall through to DB
  }

  // DB lookup
  const result = await pool.query<UserRoles>(
    `SELECT is_admin, is_developer, is_moderator
     FROM users
     WHERE firebase_uid = $1
     LIMIT 1`,
    [uid]
  );

  if (result.rows.length === 0) return null;

  const roles = result.rows[0];

  // Cache the result
  try {
    await redis.set(cacheKey, JSON.stringify(roles), "EX", ROLE_CACHE_TTL_SEC);
  } catch {
    // Cache write failure is non-critical
  }

  return roles;
}

// ─── Cache Invalidation ───────────────────────────────────
// Call this when you change a user's role

export async function invalidateRoleCache(uid: string): Promise<void> {
  try {
    await redis.del(`${ROLE_CACHE_PREFIX}${uid}`);
  } catch {
    // Non-critical
  }
}

// ─── Role Check Factory ───────────────────────────────────

type RoleChecker = (roles: UserRoles, uid: string) => boolean;

function makeRoleMiddleware(
  name:        string,
  checkFn:     RoleChecker
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
      // Use cached roles if already fetched this request
      const roles = req.userRoles ?? await getUserRoles(uid);

      if (!roles) {
        logger.warn(`🚫 ${name}: user not found in DB`, {
          uid:  uid.slice(0, 8),
          path: req.path,
        });
        return next(new ForbiddenError());
      }

      // Attach roles to request for downstream use
      req.userRoles = roles;

      // Check env list first (fastest)
      const inAdminEnvList = config.adminUids.includes(uid);
      const inDevEnvList   = config.devUids.includes(uid);

      if (checkFn(roles, uid) || inAdminEnvList || inDevEnvList) {
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
      // Fail CLOSED — deny access on error
      return next(new ForbiddenError());
    }
  };
}

// ─── Middleware Exports ───────────────────────────────────

/** Admin or Developer only */
export const requireAdmin = makeRoleMiddleware(
  "requireAdmin",
  (roles) => roles.is_admin || roles.is_developer
);

/** Moderator, Admin, or Developer */
export const requireModerator = makeRoleMiddleware(
  "requireModerator",
  (roles) => roles.is_admin || roles.is_developer || roles.is_moderator
);

/** Developer only */
export const requireDeveloper = makeRoleMiddleware(
  "requireDeveloper",
  (roles, uid) => roles.is_developer || config.devUids.includes(uid)
);

// ─── Composable Role Checker ──────────────────────────────

/**
 * Create custom role middleware for specific requirements.
 *
 * Usage:
 *   const requireGangLeader = requireAny(
 *     (roles) => roles.is_admin || someCustomCheck
 *   );
 */
export function requireAny(checkFn: RoleChecker) {
  return makeRoleMiddleware("requireAny", checkFn);
}
