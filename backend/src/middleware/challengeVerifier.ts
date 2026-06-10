// ============================================================
// CHALLENGE VERIFIER MIDDLEWARE — UNDERCITY
// UAC Pillar: Proof-of-work token validation
//
// Flow:
//   1. Frontend calls GET /api/challenge → gets a token
//   2. Token stored: challenge:{uid}:{token} with TTL in Redis
//   3. Frontend sends token in X-UAC-Challenge header
//   4. This middleware validates + consumes the token atomically
//
// SECURITY:
//   - Format validated before Redis lookup (prevents key injection)
//   - GETDEL for atomic consume (prevents race conditions)
//   - Fails open on Redis errors (infrastructure ≠ user fault)
//   - Flag only after MAX_FAILS_THRESHOLD repeated failures
// ============================================================

import { Request, Response, NextFunction } from "express";
import { redis }            from "../config/redis";
import { flagUser }         from "../services/trustEngine";
import { logger }           from "../utils/logger";
import {
  UnauthorizedError,
  ForbiddenError,
  InternalError,
}                           from "../utils/errors";

const MAX_TOKEN_LEN       = 128;
const TOKEN_SAFE_RE       = /^[a-zA-Z0-9\-_]+$/;
const MAX_FAILS_WINDOW    = 30 * 60;   // BUG FIX: 30 minutes (was 10)
const MAX_FAILS_THRESHOLD = 15;        // BUG FIX: 15 fails (was 10)

function isValidTokenFormat(token: string): boolean {
  return (
    token.length > 0 &&
    token.length <= MAX_TOKEN_LEN &&
    TOKEN_SAFE_RE.test(token)
  );
}

async function trackFailedAttempt(uid: string): Promise<number> {
  try {
    const key = `challenge:fails:${uid}`;

    // BUG FIX: atomic set-with-expiry then incr
    // Previous: incr() then expire() — crash between them = key never expires
    const isNew = await redis.set(key, "0", "EX", MAX_FAILS_WINDOW, "NX");
    const count = await redis.incr(key);

    // If key already existed (isNew = null), don't reset TTL
    // count naturally increments within the existing window
    void isNew; // used only to establish the key

    return count;
  } catch {
    return 0;
  }
}

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

    if (!token) {
      logger.warn("Challenge: missing token", {
        uid:  uid.substring(0, 8),
        path: req.path,
      });
      next(new ForbiddenError("Security token required."));
      return;
    }

    if (!isValidTokenFormat(token)) {
      logger.warn("Challenge: invalid token format", {
        uid:    uid.substring(0, 8),
        length: token.length,
        path:   req.path,
      });

      await flagUser({
        firebaseUid:   uid,
        violationType: "INVALID_CHALLENGE",
        details:       { reason: "Malformed token format", path: req.path },
        ipAddress:     req.ip,
        userAgent:     req.headers["user-agent"],
      });

      next(new ForbiddenError("Invalid security token."));
      return;
    }

    // ── Atomic GET + DELETE ───────────────────────────────
    // BUG FIX: GETDEL prevents race condition where two simultaneous
    // requests both pass the GET check before either fires DEL
    // GETDEL is atomic — only one request can consume the token
    let exists: string | null;
    try {
      exists = await redis.getdel(`challenge:${uid}:${token}`);
    } catch (redisErr) {
      // Redis down — fail open (not user's fault)
      logger.error("Challenge: Redis unavailable — failing open", {
        error: redisErr instanceof Error ? redisErr.message : String(redisErr),
        uid:   uid.substring(0, 8),
      });
      next();
      return;
    }

    if (!exists) {
      const failCount = await trackFailedAttempt(uid);

      logger.warn("Challenge: token not found or expired", {
        uid:       uid.substring(0, 8),
        path:      req.path,
        failCount,
      });

      if (failCount >= MAX_FAILS_THRESHOLD) {
        await flagUser({
          firebaseUid:   uid,
          violationType: "INVALID_CHALLENGE",
          details: {
            reason:    "Repeated invalid challenge tokens",
            failCount,
            path:      req.path,
          },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });
      }

      next(new ForbiddenError("Invalid or expired security token."));
      return;
    }

    // Token consumed — clear fail counter
    await redis.del(`challenge:fails:${uid}`).catch(() => {});

    logger.debug("Challenge token verified", {
      uid:  uid.substring(0, 8),
      path: req.path,
    });

    next();
  } catch (err) {
    logger.error("Challenge: unexpected error", {
      error: err instanceof Error ? err.message : String(err),
    });
    // BUG FIX: InternalError not raw AppError with ERR_10003 magic string
    next(new InternalError("Security check failed."));
  }
};
