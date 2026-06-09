// ============================================================
// CHALLENGE VERIFIER MIDDLEWARE — UNDERCITY
// UAC Pillar: Proof-of-work token validation
//
// Flow:
//   1. Frontend calls GET /api/challenge to get a token
//   2. Token stored in Redis: challenge:{uid}:{token} with TTL
//   3. Frontend sends token in X-UAC-Challenge header
//   4. This middleware validates + consumes (deletes) the token
//
// SECURITY:
//   - Token format validated before Redis lookup
//   - Failed attempts tracked with per-uid counter
//   - flagUser only called after confirmed invalid token
//     (not on Redis errors — avoids false flags during outages)
//   - Fail counter TTL set only on first increment (sliding window)
//   - req.ip normalized before passing to flagUser
// ============================================================

import { Request, Response, NextFunction } from "express";
import { redis }            from "../config/redis";
import { flagUser }         from "../services/trustEngine";
import { logger }           from "../utils/logger";
import {
  UnauthorizedError,
  ForbiddenError,
  AppError,
}                           from "../utils/errors";

// ── Constants ──────────────────────────────────────────────

const MAX_TOKEN_LEN       = 128;
const TOKEN_SAFE_RE       = /^[a-zA-Z0-9\-_]+$/;
const MAX_FAILS_WINDOW    = 10 * 60;   // 10 minutes in seconds
const MAX_FAILS_THRESHOLD = 10;

// ── Helpers ────────────────────────────────────────────────

function normalizeIp(req: Request): string | undefined {
  const ip = req.ip ?? req.socket?.remoteAddress;
  return ip ?? undefined;
}

function isValidTokenFormat(token: string): boolean {
  return (
    token.length > 0 &&
    token.length <= MAX_TOKEN_LEN &&
    TOKEN_SAFE_RE.test(token)
  );
}

async function trackFailedAttempt(uid: string): Promise<number> {
  try {
    const key   = `challenge:fails:${uid}`;
    const count = await redis.incr(key);
    if (count === 1) {
      // Set TTL only on first increment
      // Avoids resetting the window on every failed attempt
      await redis.expire(key, MAX_FAILS_WINDOW);
    }
    return count;
  } catch {
    // Redis error → return 0 (fail open, do not flag)
    return 0;
  }
}

// ============================================================
// verifyChallenge
// ============================================================

export const verifyChallenge = async (
  req:  Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const uid = req.firebaseUser?.uid;

    if (!uid) {
      next(new UnauthorizedError());
      return;
    }

    const rawToken = req.headers["x-uac-challenge"];
    const token    = Array.isArray(rawToken) ? rawToken[0] : rawToken;

    // ── Missing token ──────────────────────────────────────
    // Do NOT flag on missing token — could be first request
    // or a legitimate frontend timing issue
    if (!token) {
      logger.warn("🔒 Challenge: missing token", {
        uid:  uid.substring(0, 8),
        path: req.path,
      });
      next(new ForbiddenError("Security token required."));
      return;
    }

    // ── Format validation ─────────────────────────────────
    // Validate before Redis lookup — prevents Redis abuse
    // Malformed token = deliberate bypass attempt → flag immediately
    if (!isValidTokenFormat(token)) {
      logger.warn("🔒 Challenge: invalid token format", {
        uid:    uid.substring(0, 8),
        length: token.length,
        path:   req.path,
      });

      await flagUser({
        firebaseUid:   uid,
        violationType: "INVALID_CHALLENGE",
        details:       { reason: "Malformed token format", path: req.path },
        ipAddress:     normalizeIp(req),
        userAgent:     req.headers["user-agent"],
      });

      next(new ForbiddenError("Invalid security token."));
      return;
    }

    // ── Redis lookup ───────────────────────────────────────
    let exists: string | null;
    try {
      exists = await redis.get(`challenge:${uid}:${token}`);
    } catch (redisErr) {
      // Redis down — fail open, do NOT flag (not user's fault)
      logger.error("Challenge: Redis unavailable — failing open", {
        error: redisErr instanceof Error ? redisErr.message : String(redisErr),
        uid:   uid.substring(0, 8),
      });
      next();
      return;
    }

    // ── Token not found or expired ─────────────────────────
    if (!exists) {
      const failCount = await trackFailedAttempt(uid);

      logger.warn("🔒 Challenge: token not found or expired", {
        uid:       uid.substring(0, 8),
        path:      req.path,
        failCount,
      });

      // Only flag after repeated failures
      // Single miss could be clock skew or token expiry
      if (failCount >= MAX_FAILS_THRESHOLD) {
        await flagUser({
          firebaseUid:   uid,
          violationType: "INVALID_CHALLENGE",
          details: {
            reason:    "Repeated invalid challenge tokens",
            failCount,
            path:      req.path,
          },
          ipAddress: normalizeIp(req),
          userAgent: req.headers["user-agent"],
        });
      }

      next(new ForbiddenError("Invalid or expired security token."));
      return;
    }

    // ── Valid — consume atomically ─────────────────────────
    await redis.del(`challenge:${uid}:${token}`);
    await redis.del(`challenge:fails:${uid}`).catch(() => {});

    logger.debug("✅ Challenge token verified", {
      uid:  uid.substring(0, 8),
      path: req.path,
    });

    next();
  } catch (err) {
    logger.error("Challenge: unexpected error", {
      error: err instanceof Error ? err.message : String(err),
    });
    next(new AppError("Security check failed.", 500, "ERR_10003"));
  }
};
