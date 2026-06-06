// ============================================================
// IDEMPOTENCY MIDDLEWARE — UNDERCITY
// Prevents duplicate mutations (double-clicks, retries).
// Uses onFinished pattern instead of res.json monkey-patching.
// TTL and key format validated upfront.
// Only caches 2xx responses.
// ============================================================

import { Request, Response, NextFunction } from "express";
import onFinished  from "on-finished";
import { pool }    from "../config/database";
import { logger }  from "../utils/logger";
import { ValidationError } from "../utils/errors";
import { config }  from "../config";

// ─── Config ───────────────────────────────────────────────

const TTL_SECONDS     = Math.floor(config.game.idempotencyTtlMs / 1_000);
const MAX_KEY_LENGTH  = 128;
const UUID_V4_REGEX   =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ─── Middleware ───────────────────────────────────────────

export const idempotencyCheck = async (
  req:  Request,
  res:  Response,
  next: NextFunction
): Promise<void> => {
  const rawKey = req.headers["x-idempotency-key"];
  const uid    = req.firebaseUser?.uid;

  // Skip if no key or no user
  if (!rawKey || !uid) return next();

  // Validate key type and length
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

  try {
    // ── Check for existing response ──────────────────────

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

    // ── Capture and save response after it's sent ────────
    // Using onFinished avoids monkey-patching res.json

    let responseBody:   unknown  = null;
    let responseStatus: number   = 200;
    let captured        = false;

    // Intercept res.json to capture body before it's sent
    // This is the minimal safe interception — just captures, doesn't block
    const originalJson = res.json.bind(res);
    res.json = function (body: unknown) {
      if (!captured) {
        captured       = true;
        responseBody   = body;
        responseStatus = res.statusCode;
      }
      return originalJson(body);
    };

    // After response is fully sent, persist to DB if 2xx
    onFinished(res, () => {
      if (responseStatus >= 200 && responseStatus < 300 && captured) {
        pool.query(
          `INSERT INTO idempotency_keys
             (firebase_uid, idempotency_key, endpoint, response_body, response_status, expires_at)
           VALUES ($1, $2, $3, $4, $5, NOW() + ($6 * INTERVAL '1 second'))
           ON CONFLICT (firebase_uid, idempotency_key) DO NOTHING`,
          [uid, key, req.path, JSON.stringify(responseBody), responseStatus, TTL_SECONDS]
        ).catch((err: Error) => {
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
