import { Request, Response, NextFunction } from "express";
import { authAdmin } from "../config/firebase";
import { logger } from "../utils/logger";
import { pool } from "../config/database";

// ============================================================
// FIREBASE AUTH MIDDLEWARE
// - Token verification
// - Session revocation check
// - Email verification enforcement
// - Login attempt logging
// - New IP detection
// ============================================================

// Routes that don't need email verification
const EMAIL_VERIFY_EXEMPT = ["/sync"];

export const verifyFirebaseToken = async (
  req:  Request,
  res:  Response,
  next: NextFunction
) => {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = header.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Malformed token" });
  }

  try {
    // checkRevoked: true — blocks banned users with valid tokens
    const decoded = await authAdmin.verifyIdToken(token, true);

    // ── Email verification enforcement ──
    const isExempt = EMAIL_VERIFY_EXEMPT.some((path) =>
      req.path.endsWith(path)
    );

    if (!decoded.email_verified && !isExempt) {
      logger.warn("📧 Unverified email blocked", {
        uid:  decoded.uid.substring(0, 8),
        path: req.path,
      });
      return res.status(403).json({
        message: "Please verify your email address before continuing.",
        code:    "EMAIL_NOT_VERIFIED",
      });
    }

    req.firebaseUser = {
      uid:   decoded.uid,
      email: decoded.email,
      name:  decoded.name,
    };

    // ── Fire-and-forget: log auth access ──
    logAuthAccess(decoded.uid, req).catch(() => {});

    next();
  } catch (err: unknown) {
    const error = err as { message?: string; code?: string };

    if (error.code === "auth/id-token-revoked") {
      logger.warn("🔐 Revoked token used", {
        path: req.path,
        ip:   req.ip,
      });
      return res.status(401).json({
        message: "Session revoked. Please sign in again.",
      });
    }

    logger.warn("🔐 Firebase token verification failed", {
      error: error.message,
      code:  error.code,
      path:  req.path,
    });
    return res.status(401).json({ message: "Invalid token" });
  }
};

// ============================================================
// AUTH ACCESS LOGGER
// Tracks login IPs — new IP detection
// ============================================================
async function logAuthAccess(uid: string, req: Request): Promise<void> {
  try {
    const ip        = (req.ip ?? "").replace(/^::ffff:/, "");
    const userAgent = req.headers["user-agent"] ?? "";

    const seen = await pool.query(
      `SELECT id FROM auth_access_log
       WHERE firebase_uid = $1 AND ip_address = $2
       LIMIT 1`,
      [uid, ip]
    ).catch(() => ({ rows: [] }));

    const isNewIp = seen.rows.length === 0;

    await pool.query(
      `INSERT INTO auth_access_log
       (firebase_uid, ip_address, user_agent, is_new_ip, accessed_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT DO NOTHING`,
      [uid, ip, userAgent, isNewIp]
    ).catch(() => {});

    if (isNewIp) {
      logger.info("🔔 New IP login detected", {
        uid:  uid.substring(0, 8),
        ip,
        path: req.path,
      });
    }
  } catch {
    // Non-critical — swallow
  }
}

// ============================================================
// REVOKE USER SESSION
// ============================================================
export async function revokeUserSession(uid: string): Promise<void> {
  try {
    await authAdmin.revokeRefreshTokens(uid);
    logger.info("🔒 Firebase session revoked", {
      uid: uid.substring(0, 8),
    });
  } catch (error: unknown) {
    logger.error("Session revocation failed", {
      uid:   uid.substring(0, 8),
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
