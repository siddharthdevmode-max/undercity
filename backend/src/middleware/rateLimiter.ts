import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import type { Request, Response, NextFunction } from "express";
import redis from "../config/redis";
import { logger } from "../utils/logger";

// ============================================================
// REDIS-BACKED RATE LIMITER STORE
// ============================================================

function makeRedisStore(prefix: string) {
  try {
    return new RedisStore({
      sendCommand: (...args: string[]) =>
        redis.call(...(args as [string, ...string[]])) as Promise<number>,
      prefix: `rl:${prefix}:`,
    });
  } catch {
    logger.warn(`⚠️  Redis store unavailable for ${prefix}, falling back to memory`);
    return undefined;
  }
}

// ============================================================
// SHARED KEY GENERATORS
// ============================================================

const keyByUidOrIp = (req: Request): string => {
  if (req.firebaseUser?.uid) return `uid:${req.firebaseUser.uid}`;
  return `ip:${req.ip ?? "unknown"}`;
};

const keyByIp = (req: Request): string =>
  `ip:${req.ip ?? "unknown"}`;

const skipHealthCheck = (req: Request): boolean =>
  req.path.startsWith("/api/health");

// ============================================================
// GLOBAL FALLBACK RATE LIMITER
// Catches anything not covered by specific limiters
// 200 req/min per IP — generous but stops true abuse
// ============================================================
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false },
  message: { message: "Too many requests. Please slow down." },
  keyGenerator: keyByIp,
  store: makeRedisStore("global"),
  skip: skipHealthCheck,
  handler: (req: Request, res: Response) => {
    logger.warn("🚦 Global rate limit hit", {
      ip:   req.ip,
      path: req.path,
    });
    res.status(429).json({ message: "Too many requests. Please slow down." });
  },
});

// ============================================================
// IP BLACKLIST MIDDLEWARE
// Blocks IPs stored in Redis blacklist
// To blacklist an IP: redis.set(`blacklist:ip:1.2.3.4`, "1")
// To unblacklist:     redis.del(`blacklist:ip:1.2.3.4`)
// ============================================================
export const ipBlacklist = async (
  req:  Request,
  res:  Response,
  next: NextFunction
): Promise<void> => {
  const ip = req.ip ?? "";
  if (!ip) { next(); return; }

  const cleanIp = ip.replace(/^::ffff:/, "");

  try {
    const blocked = await redis.get(`blacklist:ip:${cleanIp}`);
    if (blocked) {
      logger.warn("🚫 Blacklisted IP blocked", {
        ip:   cleanIp,
        path: req.path,
      });
      res.status(403).json({ message: "Access denied." });
      return;
    }
    next();
  } catch {
    // Redis down — fail open
    next();
  }
};

// ============================================================
// BRUTE FORCE PROTECTION
// Tracks failed auth attempts per IP
// After 10 failures in 15min → lockout for 1 hour
// ============================================================
export const bruteForceProtection = async (
  req:  Request,
  res:  Response,
  next: NextFunction
): Promise<void> => {
  const ip      = (req.ip ?? "unknown").replace(/^::ffff:/, "");
  const key     = `brute:${ip}`;
  const WINDOW  = 15 * 60;   // 15 minutes tracking window
  const LOCKOUT = 60 * 60;   // 1 hour lockout
  const MAX     = 10;        // max failures before lockout

  try {
    const lockoutKey = `brute:lock:${ip}`;
    const locked     = await redis.get(lockoutKey);

    if (locked) {
      logger.warn("🔒 Brute force lockout active", { ip });
      res.status(429).json({
        message: "Too many failed attempts. Try again later.",
      });
      return;
    }

    // Intercept response to track failures/successes
    const originalJson = res.json.bind(res);
    res.json = function (body: unknown) {
      if (res.statusCode === 401 || res.statusCode === 403) {
        redis.incr(key).then((count) => {
          redis.expire(key, WINDOW);
          if (count >= MAX) {
            redis.set(lockoutKey, "1", "EX", LOCKOUT);
            logger.warn("🔒 Brute force lockout triggered", { ip, count });
          }
        }).catch(() => {});
      } else if (res.statusCode === 200 || res.statusCode === 201) {
        // Success — reset failure counter
        redis.del(key).catch(() => {});
      }
      return originalJson(body);
    };

    next();
  } catch {
    // Redis down — fail open
    next();
  }
};

// ============================================================
// CRIME RATE LIMITER — 30/min per UID
// ============================================================
export const crimeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false },
  message: { message: "Too many requests. Slow down." },
  keyGenerator: keyByUidOrIp,
  store: makeRedisStore("crime"),
  skip: skipHealthCheck,
});

// ============================================================
// CHALLENGE RATE LIMITER — 60/min per UID
// ============================================================
export const challengeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false },
  message: { message: "Too many requests." },
  keyGenerator: keyByUidOrIp,
  store: makeRedisStore("challenge"),
});

// ============================================================
// AUTH SYNC LIMITER — 5 per 15min per IP
// ============================================================
export const authSyncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false },
  message: { message: "Too many registration attempts. Try again later." },
  keyGenerator: keyByIp,
  store: makeRedisStore("auth_sync"),
});

// ============================================================
// AUTH ME LIMITER — 60/min per UID
// ============================================================
export const authMeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false },
  message: { message: "Too many requests." },
  keyGenerator: keyByUidOrIp,
  store: makeRedisStore("auth_me"),
});

// ============================================================
// USERNAME CHECK LIMITER — 20/min per IP
// ============================================================
export const usernameCheckLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false },
  message: { message: "Too many username checks. Slow down." },
  keyGenerator: keyByIp,
  store: makeRedisStore("username_check"),
});

// ============================================================
// STATS LIMITER — 30/min per IP
// ============================================================
export const statsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false },
  message: { message: "Too many requests." },
  keyGenerator: keyByIp,
  store: makeRedisStore("stats"),
});

// ============================================================
// ADMIN LIMITER — 30/min per UID
// ============================================================
export const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false },
  message: { message: "Too many admin requests." },
  keyGenerator: keyByUidOrIp,
  store: makeRedisStore("admin"),
});
