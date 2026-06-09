// ============================================================
// IDEMPOTENCY MIDDLEWARE — UNDERCITY
// Prevents duplicate mutations (double-clicks, retries).
//
// RACE CONDITION FIX:
//   Uses Redis SETNX as a distributed lock before the DB check.
//   Two simultaneous identical requests:
//     - First:  acquires lock → proceeds → saves response
//     - Second: misses lock → 409 Conflict (retry-safe)
//   This is correct behaviour — the second request should retry
//   after the first completes and the response is cached.
//
// KEY FORMAT: UUID v4 only (validated upfront)
// TTL: config.game.idempotencyTtlMs (default 5 minutes)
// Only caches 2xx responses.
//
// ⚠️  WARNING: Do NOT combine with etagCache on the same route.
//   Both patch res.json — etagCache wins and capture breaks.
//   A dev-mode guard below throws if both are detected.
// ============================================================

import { Request, Response, NextFunction } from "express";
import onFinished  from "on-finished";
import { pool }    from "../config/database";
import { redis }   from "../config/redis";
import { logger }  from "../utils/logger";
import { ValidationError, ConflictError } from "../utils/errors";
import { config }  from "../config";

// ─── Config ───────────────────────────────────────────────

const TTL_SECONDS    = Math.floor(config.game.idempotencyTtlMs / 1_000);
const MAX_KEY_LENGTH = 128;
const LOCK_TTL_SEC   = 30;   // max time a lock can be held (request timeout guard)
const UUID_V4_REGEX  =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ─── Dev guard — detect etagCache + idempotency conflict ──

function assertNoEtagConflict(res: Response): void {
  if (!config.isDevelopment) return;

  // etagCache patches res.json and leaves a marker on the response
  // If it's already been patched, throw immediately in dev
  // so the developer sees it during testing — not in production
  const marker = (res as Response & { __etagCacheApplied?: boolean })
    .__etagCacheApplied;

  if (marker) {
    throw new Error(
      "[idempotency] Conflict detected: etagCache and idempotencyCheck " +
      "are both applied to this route. Remove one. " +
      "Both patch res.json — etagCache wins and idempotency capture breaks."
    );
  }
}

// ─── Middleware ───────────────────────────────────────────

export const idempotencyCheck = async (
  req:  Request,
  res:  Response,
  next: NextFunction
): Promise<void> => {
  const rawKey = req.headers["x-idempotency-key"];
  const uid    = req.firebaseUser?.uid;

  if (!rawKey || !uid) return next();

  if (typeof rawKey !== "string") {
    return next(new ValidationError("X-Idempotency-Key must be a string"));
  }

  const key = rawKey.trim();

  if (key.length > MAX_KEY_LENGTH) {
    return next(new ValidationError(
      `X-Idempotency-Key too long (max ${MAX_KEY_LENGTH} chars)`
    ));
  }

  if (!UUID_V4_REGEX.test(key)) {
    return next(new ValidationError(
      "Invalid X-Idempotency-Key format. Must be UUID v4."
    ));
  }

  // Dev guard: detect incompatible middleware combination
  try {
    assertNoEtagConflict(res);
  } catch (err) {
    return next(err);
  }

  try {
    // ── Check for existing cached response ───────────────
    const existing = await pool.query<{
      response_body:   unknown;
      response_status: number;
    }>(
      `SELECT response_body, response_status
       FROM idempotency_keys
       WHERE firebase_uid    = $1
         AND idempotency_key = $2
         AND expires_at      > NOW()
       LIMIT 1`,
      [uid, key]
    );

    if (existing.rows.length > 0) {
      const { response_body, response_status } = existing.rows[0];

      logger.info("🔁 Idempotent response served", {
        uid:  uid.slice(0, 8),
        key:  key.slice(0, 8),
        path: req.path,
      });

      res.status(response_status).json(response_body);
      return;
    }

    // ── Distributed lock (SETNX) ──────────────────────────
    // Prevents two simultaneous identical requests from both
    // executing the mutation before either saves the response.
    //
    // NX = only set if not exists
    // EX = auto-expire after LOCK_TTL_SEC (guards against crashes)
    const lockKey     = `idempotency:lock:${uid}:${key}`;
    const lockAcquired = await redis.set(lockKey, "1", "EX", LOCK_TTL_SEC, "NX");

    if (!lockAcquired) {
      // Another request with the same key is in-flight right now.
      // Tell the client to retry after the first completes.
      logger.warn("Idempotency lock contention", {
        uid:  uid.slice(0, 8),
        key:  key.slice(0, 8),
        path: req.path,
      });

      return next(
        new ConflictError(
          "A request with this idempotency key is already in progress. " +
          "Please retry in a moment."
        )
      );
    }

    // ── Capture response body ─────────────────────────────
    let responseBody:   unknown = null;
    let responseStatus: number  = 200;
    let captured                = false;

    const originalJson = res.json.bind(res);
    res.json = function (body: unknown) {
      if (!captured) {
        captured       = true;
        responseBody   = body;
        responseStatus = res.statusCode;
      }
      return originalJson(body);
    };

    // ── Persist + release lock after response sent ────────
    onFinished(res, () => {
      // Always release the lock — regardless of success/failure
      redis.del(lockKey).catch(() => {});

      if (responseStatus >= 200 && responseStatus < 300 && captured) {
        pool
          .query(
            `INSERT INTO idempotency_keys
               (firebase_uid, idempotency_key, endpoint,
                response_body, response_status, expires_at)
             VALUES ($1, $2, $3, $4, $5,
                     NOW() + ($6 * INTERVAL '1 second'))
             ON CONFLICT (firebase_uid, idempotency_key) DO NOTHING`,
            [
              uid,
              key,
              req.path,
              JSON.stringify(responseBody),
              responseStatus,
              TTL_SECONDS,
            ]
          )
          .catch((err: Error) => {
            logger.error("Idempotency save error", {
              error: err.message,
              uid:   uid.slice(0, 8),
            });
          });
      }
    });

    next();
  } catch (error: unknown) {
    logger.error("Idempotency check error", {
      error: error instanceof Error ? error.message : String(error),
      uid:   uid.slice(0, 8),
    });
    // Fail open — don't block the request
    next();
  }
};
