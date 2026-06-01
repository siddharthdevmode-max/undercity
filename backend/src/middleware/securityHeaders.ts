import { Request, Response, NextFunction } from "express";
import redis from "../config/redis";
import { flagUser } from "../services/trustEngine";

// ============================================================
// verifyChallenge
// Checks one-time challenge token & flags cheaters
// ============================================================

export const verifyChallenge = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const challengeToken = req.headers["x-uac-challenge"] as string;
    const firebaseUser = (req as any).firebaseUser;
    const uid = firebaseUser?.uid;

    if (!uid) {
      return res.status(401).json({ message: "Unauthorized." });
    }

    if (!challengeToken) {
      // No token = likely a script/bot bypassing the frontend
      await flagUser({
        firebaseUid: uid,
        violationType: "INVALID_CHALLENGE",
        details: { reason: "Missing challenge token", path: req.path },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      return res.status(403).json({ message: "Access denied." });
    }

    const redisKey = `challenge:${uid}:${challengeToken}`;
    const exists = await redis.get(redisKey);

    if (!exists) {
      // Token fake, expired, or reused
      await flagUser({
        firebaseUid: uid,
        violationType: "INVALID_CHALLENGE",
        details: { reason: "Token not found in Redis", path: req.path },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      return res.status(403).json({ message: "Invalid or expired token." });
    }

    // DELETE token immediately - can never be reused
    await redis.del(redisKey);

    next();
  } catch (error: any) {
    console.error("Challenge verification error:", error);
    return res.status(500).json({ message: "Security check failed." });
  }
};
