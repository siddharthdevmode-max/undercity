import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import type { Request } from "express";
import redis from "../config/redis";
import { logger } from "../utils/logger";

// ============================================================
// REDIS-BACKED RATE LIMITER STORE
// Persists across restarts, works across multiple instances
// Falls back gracefully if Redis is unavailable
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
