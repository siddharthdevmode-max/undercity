// ============================================================
// ROLE MIDDLEWARE — UNDERCITY
// Factory-based role checking with Redis caching.
// Roles are cached per-user for 60s (admin roles: 15s).
// Attaches roles to req.userRoles for downstream use.
//
// SECURITY NOTE on requireAny():
//   Custom checkers via requireAny() are ISOLATED — they do NOT
//   grant access to adminUids/devUids automatically.
//   Only requireAdmin/requireModerator/requireDeveloper do that.
// ============================================================

import { Request, Response, NextFunction } from "express";
import { pool }   from "../config/database";
import { redis }  from "../config/redis";
import { config } from "../config";
import { ForbiddenError, UnauthorizedError } from "../utils/errors";
import { logger } from "../utils/logger";

export interface UserRoles {
  is_admin:     boolean;
  is_developer: boolean;
  is_moderator: boolean;
}

const ROLE_CACHE_TTL_SEC       = 60;
const ADMIN_ROLE_CACHE_TTL_SEC = 15;  // BUG FIX: shorter TTL for admin roles
const ROLE_CACHE_PREFIX        = "roles:";

async function getUserRoles(uid: string): Promise<UserRoles | null> {
  const cacheKey = `${ROLE_CACHE_PREFIX}${uid}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached !== null) {
      return JSON.parse(cached) as UserRoles;
    }
  } catch {
    // BUG FIX: log Redis fallback for ops visibility
    logger.warn("requireAdmin: Redis unavailable — falling through to DB", {
      uid: uid.slice(0, 8),
    });
  }

  // BUG FIX: include deleted_at filter — soft-deleted users lose roles
  const result = await pool.query<UserRoles>(
    `SELECT is_admin, is_developer, is_moderator
     FROM   users
     WHERE  firebase_uid = $1
       AND  deleted_at   IS NULL
     LIMIT  1`,
    [uid]
  );

  if (result.rows.length === 0) return null;

  const roles = result.rows[0]!;

  // BUG FIX: use shorter TTL for admin/developer roles
  const ttl = (roles.is_admin || roles.is_developer)
    ? ADMIN_ROLE_CACHE_TTL_SEC
    : ROLE_CACHE_TTL_SEC;

  try {
    await redis.set(cacheKey, JSON.stringify(roles), "EX", ttl);
  } catch { /* Non-critical */ }

  return roles;
}

export async function invalidateRoleCache(uid: string): Promise<void> {
  try {
    await redis.del(`${ROLE_CACHE_PREFIX}${uid}`);
  } catch { /* Non-critical */ }
}

type RoleChecker = (roles: UserRoles, uid: string) => boolean;

interface RoleMiddlewareOptions {
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

    if (!uid) return next(new UnauthorizedError());

    try {
      const roles = req.userRoles ?? (await getUserRoles(uid));

      if (!roles) {
        logger.warn(`${name}: user not found in DB`, {
          uid:  uid.slice(0, 8),
          path: req.path,
        });
        return next(new ForbiddenError());
      }

      req.userRoles = roles;

      if (options.allowEnvListBypass) {
        const inEnvList =
          config.adminUids.includes(uid) || config.devUids.includes(uid);
        if (inEnvList) return next();
      }

      if (checkFn(roles, uid)) return next();

      logger.warn(`${name}: access denied`, {
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
      return next(new ForbiddenError());
    }
  };
}

// BUG FIX: removed duplicate 'declare global' block
// userRoles is already declared in types/express.d.ts

export const requireAdmin = makeRoleMiddleware(
  "requireAdmin",
  (roles) => roles.is_admin || roles.is_developer,
  { allowEnvListBypass: true }
);

export const requireModerator = makeRoleMiddleware(
  "requireModerator",
  (roles) => roles.is_admin || roles.is_developer || roles.is_moderator,
  { allowEnvListBypass: true }
);

// BUG FIX: removed redundant config.devUids check in checkFn
// allowEnvListBypass already handles devUids
export const requireDeveloper = makeRoleMiddleware(
  "requireDeveloper",
  (roles) => roles.is_developer,
  { allowEnvListBypass: true }
);

export function requireAny(checkFn: RoleChecker) {
  return makeRoleMiddleware(
    "requireAny",
    checkFn,
    { allowEnvListBypass: false }
  );
}
