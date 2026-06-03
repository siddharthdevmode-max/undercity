import { Router, Request, Response } from "express";
import crypto from "crypto";
import redis from "../config/redis";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { checkBanStatus } from "../middleware/banCheck";
import { challengeLimiter } from "../middleware/rateLimiter";
import { asyncHandler } from "../utils/asyncHandler";
import { UnauthorizedError } from "../utils/errors";

const router = Router();

router.get(
  "/",
  verifyFirebaseToken,
  checkBanStatus,
  challengeLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const uid = req.firebaseUser?.uid;
    if (!uid) throw new UnauthorizedError();

    const token = crypto.randomBytes(32).toString("hex");
    const redisKey = `challenge:${uid}:${token}`;
    await redis.set(redisKey, "1", "EX", 30);

    return res.json({ token });
  })
);

export default router;
