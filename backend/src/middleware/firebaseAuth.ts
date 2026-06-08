// ============================================================
// FIREBASE AUTH MIDDLEWARE — UNDERCITY
// Token verification, revocation check, email enforcement,
// IP logging (rate-limited), last_seen_at update.
// ============================================================

import { Request, Response, NextFunction } from "express";
import { authAdmin }  from "../config/firebase";
import { pool }       from "../config/database";
import { redis }      from "../config/redis";
import { logger }     from "../utils/logger";
import { Alerts }     from "../utils/alerts";
import { config }     from "../config";
import {
  UnauthorizedError,
  ForbiddenError,
} from "../utils/errors";

// ─── Config ───────────────────────────────────────────────

// Exact path segments that bypass email verification.
// These are matched against req.path using exact equality or
// strict suffix matching (must follow a "/" boundary).
const EMAIL_VERIFY_EXEMPT_SEGMENTS = [
  "/sync",
  "/resend-verification",
  "/logout",
  "/mfa/verify",
  "/challenge",
];

const IP_LOG_COOLDOWN_SEC      = 3_600;
const SEEN_UPDATE_COOLDOWN_SEC = 300;
const NEW_IP_ALERT_COOLDOWN_SEC = 86_400;

// ─── Helpers ──────────────────────────────────────────────

function isEmailVerifyExempt(path: string): boolean {
  return EMAIL_VERIFY_EXEMPT_SEGMENTS.some((segment) => {
    if (path === segment) return true;
    // FIX: must be preceded by "/" boundary to prevent
    // "/admin/unsync" matching "/sync"
    if (path.endsWith(segment)) {
      const precedingChar = path[path.length - segment.length - 1];
      return precedingChar === "/";
    }
    return false;
  });
}

// ─── Middleware ───────────────────────────────────────────

export const verifyFirebaseToken = async (
  req:  Request,
  res:  Response,
  next: NextFunction
): Promise<void> => {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      throw new UnauthorizedError("No token provided");
    }

    const token = header.slice(7).trim();
    if (!token) throw new UnauthorizedError("Malformed authorization header");

    const decoded = await authAdmin.verifyIdToken(token, true);

    if (!decoded.email_verified && !isEmailVerifyExempt(req.path)) {
      logger.warn("📧 Unverified email blocked", {
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

    void runBackgroundTasks(decoded.uid, req);

    next();
  } catch (err: unknown) {
    const firebaseErr = err as { code?: string; message?: string };

    if (firebaseErr.code === "auth/id-token-revoked") {
      logger.warn("🔐 Revoked token used", { path: req.path, ip: req.ip });
      return next(new UnauthorizedError("Session revoked. Please sign in again."));
    }

    if (
      firebaseErr.code === "auth/id-token-expired" ||
      firebaseErr.code === "auth/argument-error"   ||
      firebaseErr.code === "auth/invalid-id-token"
    ) {
      return next(new UnauthorizedError("Invalid or expired token"));
    }

    if (err instanceof Error && "statusCode" in err) {
      return next(err);
    }

    logger.warn("🔐 Firebase token verification failed", {
      error: firebaseErr.message,
      code:  firebaseErr.code,
      path:  req.path,
    });
    return next(new UnauthorizedError("Invalid token"));
  }
};

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

    const seen = await pool.query<{ id: number }>(
      `SELECT id FROM auth_access_log
       WHERE firebase_uid = $1 AND ip_address = $2
       LIMIT 1`,
      [uid, ip]
    );

    const isNewIp = seen.rows.length === 0;

    await pool.query(
      `INSERT INTO auth_access_log
         (firebase_uid, ip_address, user_agent, is_new_ip, accessed_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT DO NOTHING`,
      [uid, ip, userAgent, isNewIp]
    );

    if (isNewIp) {
      logger.info("🔔 New IP login detected", {
        uid: uid.slice(0, 8),
        ip,
      });

      if (config.isProduction) {
        const alertKey       = `auth:new-ip-alert:${uid}:${ip}`;
        const alreadyAlerted = await redis.get(alertKey).catch(() => null);
        if (!alreadyAlerted) {
          await redis.set(alertKey, "1", "EX", NEW_IP_ALERT_COOLDOWN_SEC).catch(() => {});
          Alerts.suspiciousLogin(uid, ip, "New IP address detected");
        }
      }
    }
  } catch {
    // Non-critical — swallow silently
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
  } catch {
    // Non-critical — swallow silently
  }
}

// ─── Session Revocation ───────────────────────────────────

export async function revokeUserSession(uid: string): Promise<void> {
  try {
    await authAdmin.revokeRefreshTokens(uid);
    await redis.del(`ban:${uid}`).catch(() => {});
    logger.info("🔒 Firebase session revoked", { uid: uid.slice(0, 8) });
  } catch (error: unknown) {
    logger.error("Session revocation failed", {
      uid:   uid.slice(0, 8),
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
