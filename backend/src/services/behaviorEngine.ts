import redis from "../config/redis";
import { flagUser } from "./trustEngine";
import { logger } from "../utils/logger";

// ============================================================
// BEHAVIORAL DETECTION CONFIG
// ============================================================

const CONFIG = {
  WINDOW_SIZE: 10,
  MIN_ATTEMPTS_TO_ANALYZE: 8,
  BOT_STDDEV_THRESHOLD: 150,
  REDIS_TTL: 600,
};

export async function recordAndAnalyze(firebaseUid: string): Promise<{
  isBotLike: boolean;
  stddev: number;
  attemptCount: number;
} | null> {
  try {
    const redisKey = `timing:${firebaseUid}`;
    const now = Date.now();

    await redis.rpush(redisKey, now.toString());
    await redis.ltrim(redisKey, -CONFIG.WINDOW_SIZE, -1);
    await redis.expire(redisKey, CONFIG.REDIS_TTL);

    const timestamps = await redis.lrange(redisKey, 0, -1);

    if (timestamps.length < CONFIG.MIN_ATTEMPTS_TO_ANALYZE) {
      return null;
    }

    const gaps: number[] = [];
    for (let i = 1; i < timestamps.length; i++) {
      const gap = parseInt(timestamps[i]) - parseInt(timestamps[i - 1]);
      gaps.push(gap);
    }

    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const variance =
      gaps.reduce((sum, gap) => sum + Math.pow(gap - mean, 2), 0) / gaps.length;
    const stddev = Math.sqrt(variance);

    return {
      isBotLike: stddev < CONFIG.BOT_STDDEV_THRESHOLD,
      stddev: Math.round(stddev),
      attemptCount: timestamps.length,
    };
  } catch (error: any) {
    logger.error("Behavior analysis error", { error: error.message });
    return null;
  }
}

export async function analyzeBehavior(
  firebaseUid: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const analysis = await recordAndAnalyze(firebaseUid);
  if (!analysis) return;

  if (analysis.isBotLike) {
    logger.warn("🤖 Bot-like behavior detected", {
      uid: firebaseUid.substring(0, 8),
      stddev_ms: analysis.stddev,
      threshold_ms: CONFIG.BOT_STDDEV_THRESHOLD,
      attempts_analyzed: analysis.attemptCount,
    });

    await flagUser({
      firebaseUid,
      violationType: "SUSPICIOUS_TIMING",
      details: {
        stddev_ms: analysis.stddev,
        threshold_ms: CONFIG.BOT_STDDEV_THRESHOLD,
        attempts_analyzed: analysis.attemptCount,
      },
      ipAddress,
      userAgent,
    });
  }
}
