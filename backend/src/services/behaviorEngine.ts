import redis from "../config/redis";
import { flagUser } from "./trustEngine";

// ============================================================
// BEHAVIORAL DETECTION CONFIG
// ============================================================

const CONFIG = {
  // How many recent attempts to analyze
  WINDOW_SIZE: 10,
  
  // Minimum attempts before we start analyzing
  MIN_ATTEMPTS_TO_ANALYZE: 8,
  
  // Standard deviation threshold (milliseconds)
  // Lower = more bot-like
  // Real humans usually have stddev > 500ms
  // Bots typically have stddev < 100ms
  BOT_STDDEV_THRESHOLD: 150,
  
  // How long Redis keeps the timing data (seconds)
  REDIS_TTL: 600, // 10 minutes
};

// ============================================================
// RECORD A CRIME ATTEMPT TIMESTAMP
// Returns analysis if enough data exists
// ============================================================

export async function recordAndAnalyze(firebaseUid: string): Promise<{
  isBotLike: boolean;
  stddev: number;
  attemptCount: number;
} | null> {
  try {
    const redisKey = `timing:${firebaseUid}`;
    const now = Date.now();

    // Push current timestamp to Redis list
    await redis.rpush(redisKey, now.toString());
    
    // Trim to keep only last N attempts
    await redis.ltrim(redisKey, -CONFIG.WINDOW_SIZE, -1);
    
    // Set expiry (resets if inactive for 10 min)
    await redis.expire(redisKey, CONFIG.REDIS_TTL);

    // Get all stored timestamps
    const timestamps = await redis.lrange(redisKey, 0, -1);
    
    if (timestamps.length < CONFIG.MIN_ATTEMPTS_TO_ANALYZE) {
      return null; // Not enough data yet
    }

    // Calculate gaps between consecutive attempts
    const gaps: number[] = [];
    for (let i = 1; i < timestamps.length; i++) {
      const gap = parseInt(timestamps[i]) - parseInt(timestamps[i - 1]);
      gaps.push(gap);
    }

    // Calculate standard deviation
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const variance = gaps.reduce((sum, gap) => sum + Math.pow(gap - mean, 2), 0) / gaps.length;
    const stddev = Math.sqrt(variance);

    const isBotLike = stddev < CONFIG.BOT_STDDEV_THRESHOLD;

    return {
      isBotLike,
      stddev: Math.round(stddev),
      attemptCount: timestamps.length,
    };
  } catch (error: any) {
    console.error("Behavior analysis error:", error.message);
    return null;
  }
}

// ============================================================
// ANALYZE & FLAG IF BOT-LIKE
// Called from crime controller after each attempt
// ============================================================

export async function analyzeBehavior(
  firebaseUid: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const analysis = await recordAndAnalyze(firebaseUid);
  
  if (!analysis) return; // Not enough data
  
  if (analysis.isBotLike) {
    console.log(
      `🤖 BOT-LIKE BEHAVIOR: ${firebaseUid.substring(0, 8)}... ` +
      `| StdDev: ${analysis.stddev}ms (threshold: ${CONFIG.BOT_STDDEV_THRESHOLD}ms) ` +
      `| Attempts analyzed: ${analysis.attemptCount}`
    );
    
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
