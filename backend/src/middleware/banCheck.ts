import { Request, Response, NextFunction } from "express";
import { pool } from "../config/database";
import { logger } from "../utils/logger";

export const checkBanStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const uid = req.firebaseUser?.uid;
    if (!uid) return next();

    const result = await pool.query(
      `SELECT is_hard_banned, is_shadow_banned, trust_score
       FROM users
       WHERE firebase_uid = $1
       LIMIT 1`,
      [uid]
    );

    if (result.rows.length === 0) return next();

    const { is_hard_banned, is_shadow_banned, trust_score } = result.rows[0] as {
      is_hard_banned: boolean;
      is_shadow_banned: boolean;
      trust_score: number;
    };

    if (is_hard_banned) {
      logger.warn("🚫 Blocked hard-banned user", {
        uid: uid.substring(0, 8),
      });
      return res.status(403).json({
        message: "Account suspended for violations of terms of service.",
      });
    }

    req.trustInfo = {
      isShadowBanned: !!is_shadow_banned,
      trustScore:     trust_score ?? 100,
    };

    next();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Ban check error", { error: message });
    next();
  }
};
