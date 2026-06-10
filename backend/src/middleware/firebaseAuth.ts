// ============================================================
// FIREBASE AUTH MIDDLEWARE — UNDERCITY
// Token verification, revocation check, email enforcement,
// IP logging (rate-limited), last_seen_at update.
// ============================================================

import { Request, Response, NextFunction } from "express";
import { authAdmin, verifyFirebaseToken } from "../config/firebase";
import { pool }    from "../config/database";
import { redis }   from "../config/redis";
import { logger }  from "../utils/logger";
import { Alerts }  from "../utils/alerts";
import { config }  from "../config";
import {
  UnauthorizedError,
  ForbiddenError,
} from "../utils/errors";

// ─── Config ───────────────────────────────────────────────

const EMAIL_VERIFY_EXEMPT_SEGMENTS = [
  "/sync",
  "/resend-verification",
  "/logout",
  "/mfa/verify",
  "/challenge",
];

const IP_LOG_COOLDOWN_SEC       = 3_600;
const SEEN_UPDATE_COOLDOWN_SEC  = 300;
const NEW_IP_ALERT_COOLDOWN_SEC = 86_400;

// ─── Helpers ──────────────────────────────────────────────

function isEmailVerifyExempt(path: string): boolean {
  return EMAIL_VERIFY_EXEMPT_SEGMENTS.some((segment) => {
    if (path === segment) return true;
    if (path.endsWith(segment)) {
      const precedingChar = path[path.length - segment.length - 1];
      return precedingChar === "/";
    }
    return false;
  });
}

// ─── Middleware ───────────────────────────────────────────

export const verifyFirebaseTokenMiddleware = async (
  req:  Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      throw new UnauthorizedError("No token provided");
    }

    const token = header.slice(7).trim();
    if (!token) throw new UnauthorizedError("Malformed authorization header");

    // BUG FIX: use verifyFirebaseToken() with 10s timeout wrapper
    // authAdmin.verifyIdToken() called directly can hang if Google is slow
    const decoded = await verifyFirebaseToken(token);

    // Check revocation separately — verifyFirebaseToken wraps verifyIdToken
    // with checkRevoked=true by default in our firebase.ts implementation

    if (!decoded.email_verified && !isEmailVerifyExempt(req.path)) {
      logger.warn("Unverified email blocked", {
        uid:  decoded.uid.slice(0, 8),
        path: req.path,
      });
      throw new ForbiddenError(
        "Please verify your email address before continuing."
      );
    }

    req.firebaseUser = {
      uid:           decoded.uid,
      email:         decoded.email,
      name:          decoded.name,
      emailVerified: decoded.email_verified ?? false,
    };

    // Fire-and-forget — never blocks auth
    void runBackgroundTasks(decoded.uid, req);

    next();
  } catch (err: unknown) {
    const firebaseErr = err as { code?: string; message?: string };

    if (firebaseErr.code === "auth/id-token-revoked") {
      logger.warn("Revoked token used", { path: req.path, ip: req.ip });
      return next(new UnauthorizedError("Session revoked. Please sign in again."));
    }

    if (
      firebaseErr.code === "auth/id-token-expired" ||
      firebaseErr.code === "auth/argument-error"   ||
      firebaseErr.code === "auth/invalid-id-token"
    ) {
      return next(new UnauthorizedError("Invalid or expired token"));
    }

    // Pass AppError subclasses (UnauthorizedError, ForbiddenError) through
    if (err instanceof Error && "statusCode" in err) {
      return next(err);
    }

    logger.warn("Firebase token verification failed", {
      error: firebaseErr.message,
      code:  firebaseErr.code,
      path:  req.path,
    });
    return next(new UnauthorizedError("Invalid token"));
  }
};

// Keep old export name for backwards compat with existing route imports
export const verifyFirebaseToken = verifyFirebaseTokenMiddleware;

// ─── Background Tasks ─────────────────────────────────────

async function runBackgroundTasks(uid: string, req: Request): Promise<void> {
  await Promise.allSettled([
    maybeLogAuthAccess(uid, req),
    maybeUpdateLastSeen(uid),
  ]);
}

// ─── IP Access Logging ────────────────────────────────────

async function maybeLogAuthAccess(uid: string, req: Request): Promise<void> {
  try {
    const ip        = (req.ip ?? "").replace(/^::ffff:/, "");
    const userAgent = (req.headers["user-agent"] ?? "").slice(0, 500);

    if (!ip) return;

    const cooldownKey   = `auth:ip-log:${uid}:${ip}`;
    const alreadyLogged = await redis.get(cooldownKey).catch(() => null);
    if (alreadyLogged) return;

    await redis.set(cooldownKey, "1", "EX", IP_LOG_COOLDOWN_SEC).catch(() => {});

    // Check if this IP has been seen before for this user
    const seen = await pool.query<{ id: number }>(
      `SELECT id FROM auth_access_log
       WHERE firebase_uid = $1 AND ip_address = $2
       LIMIT 1`,
      [uid, ip]
    );

    const isNewIp = seen.rows.length === 0;

    // BUG FIX: removed ON CONFLICT DO NOTHING — auth_access_log has no
    // unique constraint (removed in migration 007). The clause was a
    // harmless no-op but misleading. Plain INSERT is correct for a log.
    await pool.query(
      `INSERT INTO auth_access_log
         (firebase_uid, ip_address, user_agent, is_new_ip, accessed_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [uid, ip, userAgent, isNewIp]
    );

    if (isNewIp) {
      logger.info("New IP login detected", {
        uid: uid.slice(0, 8),
        ip,
      });

      if (config.isProduction) {
        const alertKey       = `auth:new-ip-alert:${uid}:${ip}`;
        const alreadyAlerted = await redis.get(alertKey).catch(() => null);
        if (!alreadyAlerted) {
          await redis.set(alertKey, "1", "EX", NEW_IP_ALERT_COOLDOWN_SEC).catch(() => {});
          // BUG FIX: void the Promise — Alerts.suspiciousLogin returns Promise<void>
          void Alerts.suspiciousLogin(uid, ip, "New IP address detected");
        }
      }
    }
  } catch (err) {
    // BUG FIX: log at debug level so bugs in logging code are visible
    // (not completely swallowed — distinguishes "DB down" from "code bug")
    logger.debug("Auth IP logging failed (non-critical)", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ─── Last Seen Update ─────────────────────────────────────

async function maybeUpdateLastSeen(uid: string): Promise<void> {
  try {
    const cooldownKey    = `auth:seen:${uid}`;
    const alreadyUpdated = await redis.get(cooldownKey).catch(() => null);
    if (alreadyUpdated) return;

    await redis.set(cooldownKey, "1", "EX", SEEN_UPDATE_COOLDOWN_SEC).catch(() => {});

    await pool.query(
      `UPDATE users SET last_seen_at = NOW() WHERE firebase_uid = $1`,
      [uid]
    );
  } catch (err) {
    logger.debug("last_seen_at update failed (non-critical)", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ─── Session Revocation ───────────────────────────────────

export async function revokeUserSession(uid: string): Promise<void> {
  try {
    await authAdmin.revokeRefreshTokens(uid);
    const { invalidateBanCache } = await import("./banCheck");
    await Promise.allSettled([redis.del(`ban:${uid}`), invalidateBanCache(uid)]);
    logger.info("Firebase session revoked", { uid: uid.slice(0, 8) });
  } catch (error: unknown) {
    logger.error("Session revocation failed", {
      uid:   uid.slice(0, 8),
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
