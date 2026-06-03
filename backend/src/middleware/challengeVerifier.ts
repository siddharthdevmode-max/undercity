import { Request, Response, NextFunction } from "express";
import redis from "../config/redis";
import { flagUser } from "../services/trustEngine";
import { logger } from "../utils/logger";
import { UnauthorizedError, ForbiddenError, AppError } from "../utils/errors";

export const verifyChallenge = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const challengeToken = req.headers["x-uac-challenge"] as string;
    const uid = req.firebaseUser?.uid;

    if (!uid) {
      return next(new UnauthorizedError());
    }

    if (!challengeToken) {
      await flagUser({
        firebaseUid: uid,
        violationType: "INVALID_CHALLENGE",
        details: { reason: "Missing challenge token", path: req.path },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      return next(new ForbiddenError("Access denied."));
    }

    const redisKey = `challenge:${uid}:${challengeToken}`;
    const exists   = await redis.get(redisKey);

    if (!exists) {
      await flagUser({
        firebaseUid: uid,
        violationType: "INVALID_CHALLENGE",
        details: { reason: "Token not found or expired", path: req.path },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      return next(new ForbiddenError("Invalid or expired token."));
    }

    await redis.del(redisKey);
    next();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Challenge verification error", { error: message });
    next(new AppError("Security check failed.", 500, "CHALLENGE_ERROR"));
  }
};
