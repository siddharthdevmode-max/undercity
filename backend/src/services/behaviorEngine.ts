import redis from "../config/redis";
import { flagUser } from "./trustEngine";
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
  WINDOW_SIZE:              10,
  MIN_ATTEMPTS_TO_ANALYZE:  8,
  BOT_STDDEV_THRESHOLD:     150,
  REDIS_TTL:                600,

  // Earnings velocity
  EARNINGS_WINDOW_SECONDS:  3600,   // 1 hour window
  EARNINGS_BASELINE_HOURS:  24,     // build baseline over 24h
  EARNINGS_SPIKE_MULTIPLIER: 10,    // flag if 10x above personal avg
  MIN_EARNINGS_SAMPLES:     5,      // need 5 hours of data before flagging

  // Active hours
  ACTIVE_HOURS_WINDOW:      86400,  // 24h window
  ACTIVE_HOURS_MAX:         23,     // flag if active 23+ hours in 24h
  ACTIVE_BUCKET_MINUTES:    15,     // granularity: 15 min buckets

  // Success rate
  SUCCESS_RATE_WINDOW:      50,     // rolling window of 50 attempts
  SUCCESS_RATE_BASELINE:    30,     // need 30 attempts for baseline
  SUCCESS_RATE_SPIKE_PCT:   30,     // flag if rate jumps 30%+ above baseline
};

// ============================================================
// 1. TIMING ANALYSIS (existing UAC 1.0)
// ============================================================

export async function recordAndAnalyze(firebaseUid: string): Promise<{
  isBotLike: boolean;
  stddev: number;
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
// Tracks money earned per hour, flags 10x spikes
// ============================================================

export async function trackEarningsVelocity(
  firebaseUid: string,
  moneyEarned: number,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  if (moneyEarned <= 0) return;

  try {
    const now = Date.now();
    const currentHourBucket = Math.floor(now / (CONFIG.EARNINGS_WINDOW_SECONDS * 1000));
    const hourlyKey = `earnings:hourly:${firebaseUid}:${currentHourBucket}`;
    const historyKey = `earnings:history:${firebaseUid}`;

    // Add to current hour bucket
    await redis.incrby(hourlyKey, moneyEarned);
    await redis.expire(hourlyKey, CONFIG.EARNINGS_WINDOW_SECONDS * 2);

    // Get current hour total
    const currentHourTotal = parseInt(await redis.get(hourlyKey) || "0");

    // Store hourly total in history for baseline calculation
    // Each entry: "bucket:amount"
    await redis.zadd(historyKey, currentHourBucket, `${currentHourBucket}:${currentHourTotal}`);
    await redis.expire(historyKey, CONFIG.EARNINGS_BASELINE_HOURS * 3600);

    // Clean old entries (keep last 24h worth of buckets)
    const oldestBucket = currentHourBucket - CONFIG.EARNINGS_BASELINE_HOURS;
    await redis.zremrangebyscore(historyKey, "-inf", oldestBucket);

    // Get all historical entries
    const history = await redis.zrange(historyKey, 0, -1);

    if (history.length < CONFIG.MIN_EARNINGS_SAMPLES) return;

    // Calculate baseline average (exclude current hour)
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
        uid: firebaseUid.substring(0, 8),
        currentHour: currentHourTotal,
        avgHourly: Math.round(avgEarnings),
        multiplier: Math.round(currentHourTotal / avgEarnings),
      });

      await flagUser({
        firebaseUid,
        violationType: "EARNINGS_VELOCITY",
        details: {
          current_hour_earnings: currentHourTotal,
          avg_hourly_earnings: Math.round(avgEarnings),
          multiplier: Math.round(currentHourTotal / avgEarnings),
          threshold: CONFIG.EARNINGS_SPIKE_MULTIPLIER,
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
// Flags users active 23+ hours in a 24h window
// ============================================================

export async function trackActiveHours(
  firebaseUid: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    const now = Date.now();
    const bucketKey = Math.floor(now / (CONFIG.ACTIVE_BUCKET_MINUTES * 60 * 1000));
    const activeKey = `active:${firebaseUid}`;

    // Add current time bucket to sorted set (score = timestamp)
    await redis.zadd(activeKey, bucketKey, bucketKey.toString());
    await redis.expire(activeKey, CONFIG.ACTIVE_HOURS_WINDOW * 2);

    // Clean old entries (keep last 24h)
    const oldestBucket = bucketKey - Math.floor(CONFIG.ACTIVE_HOURS_WINDOW / (CONFIG.ACTIVE_BUCKET_MINUTES * 60));
    await redis.zremrangebyscore(activeKey, "-inf", oldestBucket);

    // Count unique buckets in last 24h
    const activeBuckets = await redis.zcard(activeKey);

    // Total possible buckets in 24h
    const bucketsPerHour = 60 / CONFIG.ACTIVE_BUCKET_MINUTES;
    const totalPossibleBuckets = 24 * bucketsPerHour; // 96 for 15-min buckets

    // Calculate active hours
    const activeHours = (activeBuckets / bucketsPerHour);

    if (activeHours >= CONFIG.ACTIVE_HOURS_MAX) {
      logger.warn("⏰ Active hours anomaly", {
        uid: firebaseUid.substring(0, 8),
        activeHours: Math.round(activeHours * 10) / 10,
        activeBuckets,
        totalPossible: totalPossibleBuckets,
      });

      await flagUser({
        firebaseUid,
        violationType: "ACTIVE_HOURS_ANOMALY",
        details: {
          active_hours: Math.round(activeHours * 10) / 10,
          active_buckets: activeBuckets,
          total_possible_buckets: totalPossibleBuckets,
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
// Flags if success rate jumps 30%+ above personal baseline
// ============================================================

export async function trackSuccessRate(
  firebaseUid: string,
  wasSuccess: boolean,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    const recentKey = `success:recent:${firebaseUid}`;
    const baselineKey = `success:baseline:${firebaseUid}`;

    const outcomeValue = wasSuccess ? "1" : "0";

    // Push to recent window
    await redis.rpush(recentKey, outcomeValue);
    await redis.ltrim(recentKey, -CONFIG.SUCCESS_RATE_WINDOW, -1);
    await redis.expire(recentKey, 3600);

    // Push to baseline window (larger)
    await redis.rpush(baselineKey, outcomeValue);
    await redis.ltrim(baselineKey, -(CONFIG.SUCCESS_RATE_WINDOW * 5), -1);
    await redis.expire(baselineKey, 86400);

    // Get both windows
    const recent = await redis.lrange(recentKey, 0, -1);
    const baseline = await redis.lrange(baselineKey, 0, -1);

    // Need enough data for both
    if (recent.length < CONFIG.SUCCESS_RATE_WINDOW) return;
    if (baseline.length < CONFIG.SUCCESS_RATE_BASELINE + CONFIG.SUCCESS_RATE_WINDOW) return;

    // Calculate recent success rate
    const recentSuccesses = recent.filter((v) => v === "1").length;
    const recentRate = (recentSuccesses / recent.length) * 100;

    // Calculate baseline rate (excluding the recent window)
    const baselineOnly = baseline.slice(0, baseline.length - recent.length);
    if (baselineOnly.length < CONFIG.SUCCESS_RATE_BASELINE) return;

    const baselineSuccesses = baselineOnly.filter((v) => v === "1").length;
    const baselineRate = (baselineSuccesses / baselineOnly.length) * 100;

    // Check for spike
    const spike = recentRate - baselineRate;

    if (spike >= CONFIG.SUCCESS_RATE_SPIKE_PCT) {
      logger.warn("📈 Success rate spike detected", {
        uid: firebaseUid.substring(0, 8),
        recentRate: Math.round(recentRate),
        baselineRate: Math.round(baselineRate),
        spike: Math.round(spike),
      });

      await flagUser({
        firebaseUid,
        violationType: "SUCCESS_RATE_SPIKE",
        details: {
          recent_rate: Math.round(recentRate),
          baseline_rate: Math.round(baselineRate),
          spike_pct: Math.round(spike),
          threshold_pct: CONFIG.SUCCESS_RATE_SPIKE_PCT,
          recent_window: recent.length,
          baseline_window: baselineOnly.length,
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
// Runs timing analysis + flags if bot-like
// ============================================================

export async function analyzeBehavior(
  firebaseUid: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
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
// FULL ANALYSIS — called after crime outcome is known
// Runs all 3 new detectors fire-and-forget
// ============================================================

export async function analyzePostCrime(
  firebaseUid: string,
  moneyEarned: number,
  wasSuccess: boolean,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await Promise.allSettled([
    trackEarningsVelocity(firebaseUid, moneyEarned, ipAddress, userAgent),
    trackActiveHours(firebaseUid, ipAddress, userAgent),
    trackSuccessRate(firebaseUid, wasSuccess, ipAddress, userAgent),
  ]);
}
