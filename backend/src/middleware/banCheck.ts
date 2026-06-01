import { Request, Response, NextFunction } from "express";
import { pool } from "../config/database";

// ============================================================
// checkBanStatus
// Blocks hard-banned users from any API access
// Allows shadow-banned users through (they play but get nothing)
// ============================================================

export const checkBanStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const firebaseUser = (req as any).firebaseUser;
    const uid = firebaseUser?.uid;

    if (!uid) {
      return next(); // Let other middleware handle auth
    }

    const result = await pool.query(
      `SELECT is_hard_banned, is_shadow_banned, trust_score 
       FROM users 
       WHERE firebase_uid = $1 
       LIMIT 1`,
      [uid]
    );

    if (result.rows.length === 0) {
      return next(); // User not in DB yet, let other middleware handle
    }

    const { is_hard_banned, is_shadow_banned, trust_score } = result.rows[0];

    // HARD BAN - Block everything
    if (is_hard_banned) {
      console.log(`🚫 Blocked hard-banned user: ${uid.substring(0, 8)}...`);
      return res.status(403).json({ 
        message: "Account suspended for violations of terms of service." 
      });
    }

    // Attach trust info to request for downstream use
    (req as any).trustInfo = {
      isShadowBanned: !!is_shadow_banned,
      trustScore: trust_score ?? 100,
    };

    next();
  } catch (error: any) {
    console.error("Ban check error:", error.message);
    next(); // Don't break the API if ban check fails
  }
};
