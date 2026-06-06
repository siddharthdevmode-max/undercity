import { redis }            from "../config/redis";
import { flagUser }         from "./trustEngine";
import { isImmuneFromUAC }  from "./immunityCheck";
import { logger }           from "../utils/logger";
import { config }           from "../config";

// ============================================================
// UAC 2.0 — BEHAVIOR ENGINE
// Pillar 2: Statistical Anomaly Detection
//
// Checks:
//   1. Timing stddev       — bot-like mechanical intervals
//   2. Earnings velocity   — abnormal money gain per hour
//   3. Active hours        — 23+ hours active in 24h window
//   4. Success rate spike  — sudden jump above baseline
//
// DEDUPLICATION:
//   Each check has a per-uid cooldown in Redis so the same
//   violation doesn't fire 100x in a minute if the caller
//   is invoked rapidly (e.g., crime spam).
//
// EARNINGS MINIMUM:
//   Velocity check requires both current AND baseline to be
//   above MIN_EARNINGS_FLOOR to avoid false positives from
//   players who had $0 baseline and just earned $1.
// ============================================================

// ── Config ─────────────────────────────────────────────────

const CFG = {
  // Timing analysis
  TIMING_WINDOW_SIZE:        10,
  TIMING_MIN_SAMPLES:        8,
  TIMING_BOT_STDDEV_MS:      150,   // ms — below this = bot-like
  TIMING_REDIS_TTL:          600,   // 10 min
  TIMING_FLAG_COOLDOWN:      300,   // 5 min between timing flags

  // Earnings velocity
  EARNINGS_WINDOW_SEC:       3_600, // 1 hour bucket
  EARNINGS_BASELINE_HOURS:   24,
  EARNINGS_SPIKE_MULTIPLIER: 10,
  EARNINGS_MIN_SAMPLES:      5,
  EARNINGS_MIN_FLOOR:        500,   // minimum avg earnings to trigger (avoid $0→$1 false positives)
  EARNINGS_FLAG_COOLDOWN:    1_800, // 30 min between earnings flags

  // Active hours
  ACTIVE_HOURS_WINDOW_SEC:   86_400, // 24h
  ACTIVE_HOURS_MAX:          23,     // flag at 23+ hours
  ACTIVE_BUCKET_MIN:         15,     // 15-min granularity
  ACTIVE_FLAG_COOLDOWN:      3_600,  // 1h between active-hours flags

  // Success rate spike
  SUCCESS_RECENT_WINDOW:     50,
  SUCCESS_BASELINE_MIN:      30,
  SUCCESS_SPIKE_PCT:         30,    // % above baseline to flag
  SUCCESS_FLAG_COOLDOWN:     900,   // 15 min between success-rate flags
} as const;

// ── Deduplication helper ───────────────────────────────────
// Returns true if we're still within the cooldown window
// → skip the flag to avoid spam

async function isOnCooldown(key: string, ttlSeconds: number): Promise<boolean> {
  try {
    const result = await redis.set(key, "1", "EX", ttlSeconds, "NX");
    // NX = only set if not exists
    // result === null  → key already existed → on cooldown
    // result === "OK"  → key was set → NOT on cooldown (fire the flag)
    return result === null;
  } catch {
    return false; // Redis error → allow flag (fail open)
  }
}

// ── IP/UA cleaning ─────────────────────────────────────────

function cleanIp(ip?: string): string | undefined {
  return ip?.replace(/^::ffff:/, "");
}

// ============================================================
// 1. TIMING ANALYSIS
// ============================================================

export async function recordAndAnalyze(
  firebaseUid: string
): Promise<{ isBotLike: boolean; stddev: number; attemptCount: number } | null> {
  try {
    const key = `timing:${firebaseUid}`;
    const now = Date.now();

    // Use pipeline for atomic rpush + ltrim + expire
    await redis
      .pipeline()
      .rpush(key, now.toString())
      .ltrim(key, -CFG.TIMING_WINDOW_SIZE, -1)
      .expire(key, CFG.TIMING_REDIS_TTL)
      .exec();

    const timestamps = await redis.lrange(key, 0, -1);

    if (timestamps.length < CFG.TIMING_MIN_SAMPLES) return null;

    const gaps: number[] = [];
    for (let i = 1; i < timestamps.length; i++) {
      const diff = parseInt(timestamps[i]!, 10) - parseInt(timestamps[i - 1]!, 10);
      if (diff >= 0) gaps.push(diff); // ignore clock skew negatives
    }

    if (gaps.length === 0) return null;

    const mean     = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const variance = gaps.reduce((sum, g) => sum + Math.pow(g - mean, 2), 0) / gaps.length;
    const stddev   = Math.sqrt(variance);

    return {
      isBotLike:    stddev < CFG.TIMING_BOT_STDDEV_MS,
      stddev:       Math.round(stddev),
      attemptCount: timestamps.length,
    };
  } catch (err) {
    logger.error("BehaviorEngine: timing analysis error", {
      error: err instanceof Error ? err.message : String(err),
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
    const now              = Date.now();
    const hourBucket       = Math.floor(now / (CFG.EARNINGS_WINDOW_SEC * 1_000));
    const hourlyKey        = `earnings:h:${firebaseUid}:${hourBucket}`;
    const historyKey       = `earnings:hist:${firebaseUid}`;

    // Increment current hour total
    const currentHourTotal = await redis
      .pipeline()
      .incrby(hourlyKey, moneyEarned)
      .expire(hourlyKey, CFG.EARNINGS_WINDOW_SEC * 2)
      .exec()
      .then((results) => {
        const incrResult = results?.[0];
        return Array.isArray(incrResult) ? (incrResult[1] as number) : 0;
      });

    // Record in sorted set: score=bucket, member="bucket:total"
    // We use a unique member per bucket — re-add just updates the score
    await redis
      .pipeline()
      .zadd(historyKey, hourBucket, `${hourBucket}`)
      .expire(historyKey, CFG.EARNINGS_BASELINE_HOURS * 3_600)
      .exec();

    // Store the actual total separately (ZADD score can't hold large floats reliably)
    await redis.set(
      `earnings:total:${firebaseUid}:${hourBucket}`,
      String(currentHourTotal),
      "EX",
      CFG.EARNINGS_BASELINE_HOURS * 3_600
    );

    // Prune old buckets
    await redis.zremrangebyscore(historyKey, "-inf", hourBucket - CFG.EARNINGS_BASELINE_HOURS);

    // Get past hour buckets (exclude current)
    const pastBuckets = await redis.zrange(historyKey, 0, -1);
    const pastBucketsExCurrent = pastBuckets.filter((b) => parseInt(b, 10) !== hourBucket);

    if (pastBucketsExCurrent.length < CFG.EARNINGS_MIN_SAMPLES - 1) return;

    // Fetch totals for past buckets
    const totalKeys = pastBucketsExCurrent.map(
      (b) => `earnings:total:${firebaseUid}:${b}`
    );
    const totals = await redis.mget(...totalKeys);
    const pastEarnings = totals
      .map((v) => (v ? parseInt(v, 10) : 0))
      .filter((v) => v > 0);

    if (pastEarnings.length < CFG.EARNINGS_MIN_SAMPLES - 1) return;

    const avgEarnings = pastEarnings.reduce((a, b) => a + b, 0) / pastEarnings.length;

    // Minimum floor prevents $0→$1 false positives
    if (
      avgEarnings < CFG.EARNINGS_MIN_FLOOR ||
      currentHourTotal <= avgEarnings * CFG.EARNINGS_SPIKE_MULTIPLIER
    ) {
      return;
    }

    // Deduplication cooldown
    const cooldownKey = `flag:cooldown:EARNINGS_VELOCITY:${firebaseUid}`;
    if (await isOnCooldown(cooldownKey, CFG.EARNINGS_FLAG_COOLDOWN)) return;

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
        threshold:             CFG.EARNINGS_SPIKE_MULTIPLIER,
      },
      ipAddress: cleanIp(ipAddress),
      userAgent,
    });
  } catch (err) {
    logger.error("BehaviorEngine: earnings velocity error", {
      error: err instanceof Error ? err.message : String(err),
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
    const bucketMs   = CFG.ACTIVE_BUCKET_MIN * 60 * 1_000;
    const bucketKey  = Math.floor(now / bucketMs);
    const activeKey  = `active:${firebaseUid}`;

    const bucketsPerHour = 60 / CFG.ACTIVE_BUCKET_MIN; // 4 for 15-min buckets
    const maxBuckets     = 24 * bucketsPerHour;         // 96
    const oldestBucket   = bucketKey - maxBuckets;

    await redis
      .pipeline()
      .zadd(activeKey, bucketKey, bucketKey.toString())
      .expire(activeKey, CFG.ACTIVE_HOURS_WINDOW_SEC * 2)
      .zremrangebyscore(activeKey, "-inf", oldestBucket)
      .exec();

    const activeBuckets = await redis.zcard(activeKey);
    const activeHours   = activeBuckets / bucketsPerHour;

    if (activeHours < CFG.ACTIVE_HOURS_MAX) return;

    const cooldownKey = `flag:cooldown:ACTIVE_HOURS:${firebaseUid}`;
    if (await isOnCooldown(cooldownKey, CFG.ACTIVE_FLAG_COOLDOWN)) return;

    logger.warn("⏰ Active hours anomaly", {
      uid:         firebaseUid.substring(0, 8),
      activeHours: Math.round(activeHours * 10) / 10,
    });

    await flagUser({
      firebaseUid,
      violationType: "ACTIVE_HOURS_ANOMALY",
      details: {
        active_hours:    Math.round(activeHours * 10) / 10,
        active_buckets:  activeBuckets,
        max_buckets:     maxBuckets,
        threshold_hours: CFG.ACTIVE_HOURS_MAX,
      },
      ipAddress: cleanIp(ipAddress),
      userAgent,
    });
  } catch (err) {
    logger.error("BehaviorEngine: active hours error", {
      error: err instanceof Error ? err.message : String(err),
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
    const value       = wasSuccess ? "1" : "0";
    const recentKey   = `sr:recent:${firebaseUid}`;
    const baselineKey = `sr:base:${firebaseUid}`;

    await redis
      .pipeline()
      .rpush(recentKey, value)
      .ltrim(recentKey, -CFG.SUCCESS_RECENT_WINDOW, -1)
      .expire(recentKey, 3_600)
      .rpush(baselineKey, value)
      .ltrim(baselineKey, -(CFG.SUCCESS_RECENT_WINDOW * 5), -1)
      .expire(baselineKey, 86_400)
      .exec();

    const [recent, baseline] = await Promise.all([
      redis.lrange(recentKey, 0, -1),
      redis.lrange(baselineKey, 0, -1),
    ]);

    if (recent.length < CFG.SUCCESS_RECENT_WINDOW) return;

    // Baseline = everything BEFORE the recent window
    const baselineOnly = baseline.slice(0, baseline.length - recent.length);
    if (baselineOnly.length < CFG.SUCCESS_BASELINE_MIN) return;

    const recentRate   = (recent.filter((v) => v === "1").length   / recent.length)      * 100;
    const baselineRate = (baselineOnly.filter((v) => v === "1").length / baselineOnly.length) * 100;
    const spike        = recentRate - baselineRate;

    if (spike < CFG.SUCCESS_SPIKE_PCT) return;

    const cooldownKey = `flag:cooldown:SUCCESS_RATE:${firebaseUid}`;
    if (await isOnCooldown(cooldownKey, CFG.SUCCESS_FLAG_COOLDOWN)) return;

    logger.warn("📈 Success rate spike", {
      uid:         firebaseUid.substring(0, 8),
      recentRate:  Math.round(recentRate),
      baselineRate: Math.round(baselineRate),
      spike:       Math.round(spike),
    });

    await flagUser({
      firebaseUid,
      violationType: "SUCCESS_RATE_SPIKE",
      details: {
        recent_rate:     Math.round(recentRate),
        baseline_rate:   Math.round(baselineRate),
        spike_pct:       Math.round(spike),
        threshold_pct:   CFG.SUCCESS_SPIKE_PCT,
        recent_window:   recent.length,
        baseline_window: baselineOnly.length,
      },
      ipAddress: cleanIp(ipAddress),
      userAgent,
    });
  } catch (err) {
    logger.error("BehaviorEngine: success rate error", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ============================================================
// MAIN ENTRY — timing analysis (called from crimeController)
// ============================================================

export async function analyzeBehavior(
  firebaseUid: string,
  ipAddress?:  string,
  userAgent?:  string
): Promise<void> {
  if (config.isTest) return;
  if (await isImmuneFromUAC(firebaseUid)) return;

  const analysis = await recordAndAnalyze(firebaseUid);
  if (!analysis?.isBotLike) return;

  const cooldownKey = `flag:cooldown:TIMING:${firebaseUid}`;
  if (await isOnCooldown(cooldownKey, CFG.TIMING_FLAG_COOLDOWN)) return;

  logger.warn("🤖 Bot-like timing detected", {
    uid:       firebaseUid.substring(0, 8),
    stddev_ms: analysis.stddev,
    threshold: CFG.TIMING_BOT_STDDEV_MS,
    samples:   analysis.attemptCount,
  });

  await flagUser({
    firebaseUid,
    violationType: "SUSPICIOUS_TIMING",
    details: {
      stddev_ms:  analysis.stddev,
      threshold:  CFG.TIMING_BOT_STDDEV_MS,
      samples:    analysis.attemptCount,
    },
    ipAddress: cleanIp(ipAddress),
    userAgent,
  });
}

// ============================================================
// POST-CRIME ANALYSIS — fire-and-forget from crimeController
// All 3 checks run in parallel. Immune users skip entirely.
// ============================================================

export async function analyzePostCrime(
  firebaseUid: string,
  moneyEarned: number,
  wasSuccess:  boolean,
  ipAddress?:  string,
  userAgent?:  string
): Promise<void> {
  if (config.isTest) return;
  if (await isImmuneFromUAC(firebaseUid)) return;

  await Promise.allSettled([
    trackEarningsVelocity(firebaseUid, moneyEarned, ipAddress, userAgent),
    trackActiveHours(firebaseUid, ipAddress, userAgent),
    trackSuccessRate(firebaseUid, wasSuccess, ipAddress, userAgent),
  ]);
}
