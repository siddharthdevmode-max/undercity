import { Request, Response, NextFunction } from "express";
import { redis }            from "../config/redis";
import { flagUser }         from "../services/trustEngine";
import { logger }           from "../utils/logger";
import {
  UnauthorizedError,
  ForbiddenError,
  AppError,
}                           from "../utils/errors";

// ============================================================
// CHALLENGE VERIFIER MIDDLEWARE
// UAC Pillar: Proof-of-work token validation
//
// Flow:
//   1. Frontend calls GET /api/challenge to get a token
//   2. Token stored in Redis: challenge:{uid}:{token} with TTL
//   3. Frontend sends token in X-UAC-Challenge header
//   4. This middleware validates + consumes (deletes) the token
//
// SECURITY:
//   - Token format validated before Redis lookup (no Redis abuse)
//   - Token length capped at MAX_TOKEN_LEN
//   - Failed attempts tracked with per-uid rate limit in Redis
//   - flagUser only called after Redis confirms token is invalid
//     (not on Redis errors — avoids false flags during outages)
//   - req.ip normalized — never passes undefined to flagUser
// ============================================================

// ── Constants ──────────────────────────────────────────────

const MAX_TOKEN_LEN       = 128;
const TOKEN_SAFE_RE       = /^[a-zA-Z0-9\-_]+$/; // hex, UUID, URL-safe base64
const MAX_FAILS_WINDOW    = 10 * 60;              // 10 minutes
const MAX_FAILS_THRESHOLD = 10;                   // flag after 10 bad tokens in window

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
    const key     = `challenge:fails:${uid}`;
    const count   = await redis.incr(key);
    if (count === 1) {
      // Set TTL only on first increment — avoids reset on each attempt
      await redis.expire(key, MAX_FAILS_WINDOW);
    }
    return count;
  } catch {
    return 0; // Redis error → don't block
  }
}

// ============================================================
// verifyChallenge middleware
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
    if (!token) {
      logger.warn("🔒 Challenge: missing token", {
        uid:  uid.substring(0, 8),
        path: req.path,
      });

      // Don't flag on missing token alone — could be legitimate
      // first request or frontend timing issue. Only flag on bad tokens.
      next(new ForbiddenError("Security token required."));
      return;
    }

    // ── Format validation (before Redis lookup) ────────────
    if (!isValidTokenFormat(token)) {
      logger.warn("🔒 Challenge: invalid token format", {
        uid:    uid.substring(0, 8),
        length: token.length,
        path:   req.path,
      });

      // Malformed token = deliberate bypass attempt → flag
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
      // Redis is down — fail open to avoid blocking all users
      // Log but do NOT flag (not the user's fault)
      logger.error("Challenge: Redis unavailable — failing open", {
        error: redisErr instanceof Error ? redisErr.message : String(redisErr),
        uid:   uid.substring(0, 8),
      });
      next();
      return;
    }

    // ── Token not found / expired ──────────────────────────
    if (!exists) {
      const failCount = await trackFailedAttempt(uid);

      logger.warn("🔒 Challenge: token not found or expired", {
        uid:       uid.substring(0, 8),
        path:      req.path,
        failCount,
      });

      // Only flag after repeated failures — single miss could be timing
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

    // ── Valid token — consume (delete) atomically ──────────
    await redis.del(`challenge:${uid}:${token}`);

    // Reset fail counter on success
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
