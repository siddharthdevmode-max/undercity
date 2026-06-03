import { Request, Response, NextFunction } from "express";
import { pool } from "../config/database";
import { logger } from "../utils/logger";

const TTL_SECONDS = 60;

export const idempotencyCheck = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const key = req.headers["x-idempotency-key"] as string | undefined;
  const uid = req.firebaseUser?.uid;

  if (!key || !uid) return next();

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(key)) {
    return res.status(400).json({
      message: "Invalid idempotency key format. Must be UUID v4.",
      code: "INVALID_IDEMPOTENCY_KEY",
    });
  }

  try {
    const userResult = await pool.query(
      `SELECT id FROM users WHERE firebase_uid = $1 LIMIT 1`,
      [uid]
    );

    if (userResult.rows.length === 0) return next();

    const userId = userResult.rows[0].id as number;

    const existing = await pool.query(
      `SELECT response_body FROM idempotency_keys
       WHERE user_id = $1
         AND idempotency_key = $2
         AND expires_at > NOW()
       LIMIT 1`,
      [userId, key]
    );

    if (existing.rows.length > 0) {
      logger.warn("🔁 Duplicate request blocked via idempotency key", {
        uid:  uid.substring(0, 8),
        key:  key.substring(0, 8),
        path: req.path,
      });
      return res.status(200).json({
        ...existing.rows[0].response_body,
        _idempotent: true,
      });
    }

    const originalJson = res.json.bind(res);

    res.json = (body: unknown) => {
      pool
        .query(
          `INSERT INTO idempotency_keys
             (user_id, idempotency_key, endpoint, response_body, expires_at)
           VALUES ($1, $2, $3, $4, NOW() + INTERVAL '${TTL_SECONDS} seconds')
           ON CONFLICT (user_id, idempotency_key) DO NOTHING`,
          [userId, key, req.path, JSON.stringify(body)]
        )
        .catch((err: Error) =>
          logger.error("Idempotency save error", { error: err.message })
        );
      return originalJson(body);
    };

    next();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Idempotency check error", { error: message });
    next();
  }
};
