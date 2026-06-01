import { Router, Request, Response } from "express";
import crypto from "crypto";
import redis from "../config/redis";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { checkBanStatus } from "../middleware/banCheck";
import { challengeLimiter } from "../middleware/rateLimiter";

const router = Router();

router.get(
  "/",
  verifyFirebaseToken,
  checkBanStatus,        // Banned users can't even get tokens
  challengeLimiter,
  async (req: Request, res: Response) => {
    try {
      const firebaseUser = (req as any).firebaseUser;
      const uid = firebaseUser?.uid;

      if (!uid) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const redisKey = `challenge:${uid}:${token}`;
      await redis.set(redisKey, "1", "EX", 30);

      return res.json({ token });
    } catch (error: any) {
      console.error("Challenge generation error:", error);
      return res.status(500).json({ message: "Failed to generate challenge" });
    }
  }
);

export default router;
