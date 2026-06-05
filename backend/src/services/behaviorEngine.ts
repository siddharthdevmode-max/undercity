import redis from "../config/redis";
import { flagUser } from "./trustEngine";
import { isImmuneFromUAC } from "./immunityCheck";
import { logger } from "../utils/logger";

// ============================================================
// UAC 2.0 — BEHAVIOR ENGINE
// Pillar 2: Statistical Anomaly Detection
//
// 1. Timing stddev       (UAC 1.0 — kept)
// 2. Earnings velocity   (UAC 2.0 — NEW)
// 3. Active hours        (UAC 2.0 — NEW)
// 4. Success rate spike  (UAC 2.0 — NEW)
// ============================================================

const CONFIG = {
  // Timing analysis
  WINDOW_SIZE:               10,
  MIN_ATTEMPTS_TO_ANALYZE:   8,
  BOT_STDDEV_THRESHOLD:      150,
  REDIS_TTL:                 600,

  // Earnings velocity
  EARNINGS_WINDOW_SECONDS:   3600,
  EARNINGS_BASELINE_HOURS:   24,
  EARNINGS_SPIKE_MULTIPLIER: 10,
  MIN_EARNINGS_SAMPLES:      5,

  // Active hours
  ACTIVE_HOURS_WINDOW:       86400,  // 24h in seconds
  ACTIVE_HOURS_MAX:          23,     // flag at 23+ hours
  ACTIVE_BUCKET_MINUTES:     15,     // 15 min granularity

  // Success rate
  SUCCESS_RATE_WINDOW:       50,
  SUCCESS_RATE_BASELINE:     30,
  SUCCESS_RATE_SPIKE_PCT:    30,
} as const;

// ============================================================
// 1. TIMING ANALYSIS
// ============================================================

export async function recordAndAnalyze(firebaseUid: string): Promise<{
  isBotLike:    boolean;
  stddev:       number;
  attemptCount: number;
} | null> {
  try {
    const redisKey = `timing:${firebaseUid}`;
    const now      = Date.now();

    await redis.rpush(redisKey, now.toString());
    await redis.ltrim(redisKey, -CONFIG.WINDOW_SIZE, -1);
    await redis.expire(redisKey, CONFIG.REDIS_TTL);

    const timestamps = await redis.lrange(redisKey, 0, -1);

    if (timestamps.length < CONFIG.MIN_ATTEMPTS_TO_ANALYZE) {
      return null;
    }

    const gaps: number[] = [];
    for (let i = 1; i < timestamps.length; i++) {
      gaps.push(parseInt(timestamps[i]) - parseInt(timestamps[i - 1]));
    }

    const mean     = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const variance = gaps.reduce((sum, gap) => sum + Math.pow(gap - mean, 2), 0) / gaps.length;
    const stddev   = Math.sqrt(variance);

    return {
      isBotLike:    stddev < CONFIG.BOT_STDDEV_THRESHOLD,
      stddev:       Math.round(stddev),
      attemptCount: timestamps.length,
    };
  } catch (error: unknown) {
    logger.error("Behavior analysis error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// ============================================================
// 2. EARNINGS VELOCITY TRACKING
// ============================================================

export async function trackEarningsVelocity(
  firebaseUid: string,
  moneyEarned: number,
  ipAddress?:  string,
  userAgent?:  string
): Promise<void> {
  if (moneyEarned <= 0) return;

  try {
    const now               = Date.now();
    const currentHourBucket = Math.floor(now / (CONFIG.EARNINGS_WINDOW_SECONDS * 1000));
    const hourlyKey         = `earnings:hourly:${firebaseUid}:${currentHourBucket}`;
    const historyKey        = `earnings:history:${firebaseUid}`;

    await redis.incrby(hourlyKey, moneyEarned);
    await redis.expire(hourlyKey, CONFIG.EARNINGS_WINDOW_SECONDS * 2);

    const currentHourTotal = parseInt(await redis.get(hourlyKey) || "0");

    await redis.zadd(historyKey, currentHourBucket, `${currentHourBucket}:${currentHourTotal}`);
    await redis.expire(historyKey, CONFIG.EARNINGS_BASELINE_HOURS * 3600);

    const oldestBucket = currentHourBucket - CONFIG.EARNINGS_BASELINE_HOURS;
    await redis.zremrangebyscore(historyKey, "-inf", oldestBucket);

    const history = await redis.zrange(historyKey, 0, -1);
    if (history.length < CONFIG.MIN_EARNINGS_SAMPLES) return;

    const pastEarnings: number[] = [];
    for (const entry of history) {
      const [bucket, amount] = entry.split(":");
      if (parseInt(bucket) !== currentHourBucket) {
        pastEarnings.push(parseInt(amount));
      }
    }

    if (pastEarnings.length < CONFIG.MIN_EARNINGS_SAMPLES - 1) return;

    const avgEarnings = pastEarnings.reduce((a, b) => a + b, 0) / pastEarnings.length;

    if (avgEarnings > 0 && currentHourTotal > avgEarnings * CONFIG.EARNINGS_SPIKE_MULTIPLIER) {
      logger.warn("💰 Earnings velocity anomaly", {
        uid:         firebaseUid.substring(0, 8),
        currentHour: currentHourTotal,
        avgHourly:   Math.round(avgEarnings),
        multiplier:  Math.round(currentHourTotal / avgEarnings),
      });

      await flagUser({
        firebaseUid,
        violationType: "EARNINGS_VELOCITY",
        details: {
          current_hour_earnings: currentHourTotal,
          avg_hourly_earnings:   Math.round(avgEarnings),
          multiplier:            Math.round(currentHourTotal / avgEarnings),
          threshold:             CONFIG.EARNINGS_SPIKE_MULTIPLIER,
        },
        ipAddress,
        userAgent,
      });
    }
  } catch (error: unknown) {
    logger.error("Earnings velocity error", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ============================================================
// 3. ACTIVE HOURS TRACKING
// ============================================================

export async function trackActiveHours(
  firebaseUid: string,
  ipAddress?:  string,
  userAgent?:  string
): Promise<void> {
  try {
    const now        = Date.now();
    const bucketSize = CONFIG.ACTIVE_BUCKET_MINUTES * 60 * 1000;
    const bucketKey  = Math.floor(now / bucketSize);
    const activeKey  = `active:${firebaseUid}`;

    // Add current bucket
    await redis.zadd(activeKey, bucketKey, bucketKey.toString());
    await redis.expire(activeKey, CONFIG.ACTIVE_HOURS_WINDOW * 2);

    // Remove buckets older than 24h
    const bucketsPerHour  = 60 / CONFIG.ACTIVE_BUCKET_MINUTES;
    const maxBuckets      = 24 * bucketsPerHour; // 96 for 15-min buckets
    const oldestBucket    = bucketKey - maxBuckets;
    await redis.zremrangebyscore(activeKey, "-inf", oldestBucket);

    // Count unique active buckets in last 24h
    const activeBuckets = await redis.zcard(activeKey);

    // Convert buckets → hours
    const activeHours = activeBuckets / bucketsPerHour;

    if (activeHours >= CONFIG.ACTIVE_HOURS_MAX) {
      logger.warn("⏰ Active hours anomaly", {
        uid:          firebaseUid.substring(0, 8),
        activeHours:  Math.round(activeHours * 10) / 10,
        activeBuckets,
        maxBuckets,
      });

      await flagUser({
        firebaseUid,
        violationType: "ACTIVE_HOURS_ANOMALY",
        details: {
          active_hours:    Math.round(activeHours * 10) / 10,
          active_buckets:  activeBuckets,
          max_buckets:     maxBuckets,
          threshold_hours: CONFIG.ACTIVE_HOURS_MAX,
        },
        ipAddress,
        userAgent,
      });
    }
  } catch (error: unknown) {
    logger.error("Active hours tracking error", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ============================================================
// 4. SUCCESS RATE SPIKE DETECTION
// ============================================================

export async function trackSuccessRate(
  firebaseUid: string,
  wasSuccess:  boolean,
  ipAddress?:  string,
  userAgent?:  string
): Promise<void> {
  try {
    const recentKey   = `success:recent:${firebaseUid}`;
    const baselineKey = `success:baseline:${firebaseUid}`;
    const value       = wasSuccess ? "1" : "0";

    await redis.rpush(recentKey, value);
    await redis.ltrim(recentKey, -CONFIG.SUCCESS_RATE_WINDOW, -1);
    await redis.expire(recentKey, 3600);

    await redis.rpush(baselineKey, value);
    await redis.ltrim(baselineKey, -(CONFIG.SUCCESS_RATE_WINDOW * 5), -1);
    await redis.expire(baselineKey, 86400);

    const recent   = await redis.lrange(recentKey, 0, -1);
    const baseline = await redis.lrange(baselineKey, 0, -1);

    if (recent.length < CONFIG.SUCCESS_RATE_WINDOW) return;
    if (baseline.length < CONFIG.SUCCESS_RATE_BASELINE + CONFIG.SUCCESS_RATE_WINDOW) return;

    const recentSuccesses = recent.filter((v) => v === "1").length;
    const recentRate      = (recentSuccesses / recent.length) * 100;

    const baselineOnly     = baseline.slice(0, baseline.length - recent.length);
    if (baselineOnly.length < CONFIG.SUCCESS_RATE_BASELINE) return;

    const baselineSuccesses = baselineOnly.filter((v) => v === "1").length;
    const baselineRate      = (baselineSuccesses / baselineOnly.length) * 100;

    const spike = recentRate - baselineRate;

    if (spike >= CONFIG.SUCCESS_RATE_SPIKE_PCT) {
      logger.warn("📈 Success rate spike detected", {
        uid:         firebaseUid.substring(0, 8),
        recentRate:  Math.round(recentRate),
        baselineRate: Math.round(baselineRate),
        spike:       Math.round(spike),
      });

      await flagUser({
        firebaseUid,
        violationType: "SUCCESS_RATE_SPIKE",
        details: {
          recent_rate:      Math.round(recentRate),
          baseline_rate:    Math.round(baselineRate),
          spike_pct:        Math.round(spike),
          threshold_pct:    CONFIG.SUCCESS_RATE_SPIKE_PCT,
          recent_window:    recent.length,
          baseline_window:  baselineOnly.length,
        },
        ipAddress,
        userAgent,
      });
    }
  } catch (error: unknown) {
    logger.error("Success rate tracking error", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ============================================================
// MAIN ENTRY — called from crimeController
// ============================================================

export async function analyzeBehavior(
  firebaseUid: string,
  ipAddress?:  string,
  userAgent?:  string
): Promise<void> {
  if (await isImmuneFromUAC(firebaseUid)) return;

  const analysis = await recordAndAnalyze(firebaseUid);
  if (!analysis) return;

  if (analysis.isBotLike) {
    logger.warn("🤖 Bot-like behavior detected", {
      uid:               firebaseUid.substring(0, 8),
      stddev_ms:         analysis.stddev,
      threshold_ms:      CONFIG.BOT_STDDEV_THRESHOLD,
      attempts_analyzed: analysis.attemptCount,
    });

    await flagUser({
      firebaseUid,
      violationType: "SUSPICIOUS_TIMING",
      details: {
        stddev_ms:         analysis.stddev,
        threshold_ms:      CONFIG.BOT_STDDEV_THRESHOLD,
        attempts_analyzed: analysis.attemptCount,
      },
      ipAddress,
      userAgent,
    });
  }
}

// ============================================================
// FULL POST-CRIME ANALYSIS — fire and forget
// ============================================================

export async function analyzePostCrime(
  firebaseUid: string,
  moneyEarned: number,
  wasSuccess:  boolean,
  ipAddress?:  string,
  userAgent?:  string
): Promise<void> {
  if (await isImmuneFromUAC(firebaseUid)) return;

  await Promise.allSettled([
    trackEarningsVelocity(firebaseUid, moneyEarned, ipAddress, userAgent),
    trackActiveHours(firebaseUid, ipAddress, userAgent),
    trackSuccessRate(firebaseUid, wasSuccess, ipAddress, userAgent),
  ]);
}
