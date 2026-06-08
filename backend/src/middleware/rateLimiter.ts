import rateLimit, { Options } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import type { Request, Response, NextFunction } from "express";
import { redis } from "../config/redis";
import { config } from "../config";
import { logger } from "../utils/logger";

function makeRedisStore(prefix: string): RedisStore | undefined {
  if (config.isTest) return undefined;

  try {
    return new RedisStore({
      sendCommand: (...args: string[]) =>
        redis.call(...(args as [string, ...string[]])) as Promise<number>,
      prefix: `rl:${prefix}:`
    });
  } catch (err) {
    logger.warn(`Could not create RedisStore for "${prefix}"`, {
      error: err instanceof Error ? err.message : String(err)
    });
    return undefined;
  }
}

const keyByUidOrIp = (req: Request): string =>
  req.firebaseUser?.uid
    ? `uid:${req.firebaseUser.uid}`
    : `ip:${req.ip ?? "unknown"}`;

const keyByIp = (req: Request): string => `ip:${req.ip ?? "unknown"}`;

const skipHealthCheck = (req: Request): boolean =>
  req.path.startsWith("/api/health") || req.path.startsWith("/api/v1/health");

function makeLimiter(
  prefix: string,
  options: Partial<Options> & { windowMs: number; max: number }
) {
  return rateLimit({
    standardHeaders: true,
    legacyHeaders:   false,
    validate:        { xForwardedForHeader: false },
    store:           makeRedisStore(prefix),
    skip:            skipHealthCheck,
    keyGenerator:    keyByUidOrIp,
    handler: (req: Request, res: Response) => {
      logger.warn(`Rate limit hit [${prefix}]`, {
        ip:   req.ip,
        uid:  req.firebaseUser?.uid,
        path: req.path
      });
      res.status(429).json({
        message:   options.message ?? "Too many requests. Please slow down.",
        code:      "RATE_LIMIT",
        errorCode: "ERR_9001",
        requestId: req.requestId
      });
    },
    ...options
  });
}

// ── Global limiter uses config as source of truth ─────────
// config.rateLimit.maxRequests is set via RATE_LIMIT_MAX env var (default 100)
// Do NOT hardcode this value here — use the config.
export const globalLimiter = makeLimiter("global", {
  windowMs:    config.rateLimit.windowMs,
  max:         config.rateLimit.maxRequests,
  keyGenerator: keyByIp,
  message:     "Too many requests. Please slow down."
});

export const authSyncLimiter = makeLimiter("auth_sync", {
  windowMs:               config.rateLimit.authWindowMs,
  max:                    config.rateLimit.authMaxRequests,
  keyGenerator:           keyByIp,
  skipSuccessfulRequests: false,
  message:                "Too many registration attempts. Try again later."
});

export const authMeLimiter = makeLimiter("auth_me", {
  windowMs: config.rateLimit.windowMs,
  max:      60,
  message:  "Too many requests."
});

export const usernameCheckLimiter = makeLimiter("username_check", {
  windowMs:    config.rateLimit.windowMs,
  max:         20,
  keyGenerator: keyByIp,
  message:     "Too many username checks. Slow down."
});

export const crimeLimiter = makeLimiter("crime", {
  windowMs: config.rateLimit.windowMs,
  max:      30,
  message:  "Too many crime requests. Slow down."
});

export const challengeLimiter = makeLimiter("challenge", {
  windowMs: config.rateLimit.windowMs,
  max:      60,
  message:  "Too many requests."
});

export const adminLimiter = makeLimiter("admin", {
  windowMs: config.rateLimit.windowMs,
  max:      30,
  message:  "Too many admin requests."
});

export const statsLimiter = makeLimiter("stats", {
  windowMs:    config.rateLimit.windowMs,
  max:         30,
  keyGenerator: keyByIp,
  message:     "Too many requests."
});

export const paymentLimiter = makeLimiter("payment", {
  windowMs:    15 * 60 * 1000,
  max:         10,
  keyGenerator: keyByUidOrIp,
  message:     "Too many payment requests. Please wait."
});

export const supportLimiter = makeLimiter("support", {
  windowMs:    60 * 60 * 1000,
  max:         5,
  keyGenerator: keyByUidOrIp,
  message:     "Too many support requests. Please wait."
});

export const gdprLimiter = makeLimiter("gdpr", {
  windowMs:    24 * 60 * 60 * 1000,
  max:         3,
  keyGenerator: keyByUidOrIp,
  message:     "Too many GDPR requests. Please wait 24 hours."
});

export const mfaLimiter = makeLimiter("mfa", {
  windowMs:    15 * 60 * 1000,
  max:         10,
  keyGenerator: keyByUidOrIp,
  message:     "Too many MFA attempts. Please wait."
});

// ─── IP Blacklist ─────────────────────────────────────────

export const ipBlacklist = async (
  req:  Request,
  res:  Response,
  next: NextFunction
): Promise<void> => {
  if (config.isTest) { next(); return; }

  const raw = req.ip ?? "";
  if (!raw) { next(); return; }

  const ip = raw.replace(/^::ffff:/, "");

  try {
    const blocked = await redis.get(`blacklist:ip:${ip}`);
    if (blocked) {
      logger.warn("Blacklisted IP blocked", { ip, path: req.path });
      res.status(403).json({
        message:   "Access denied.",
        code:      "FORBIDDEN",
        errorCode: "ERR_1002"
      });
      return;
    }
    next();
  } catch {
    next();
  }
};

// ─── Brute Force Protection ───────────────────────────────

export const bruteForceProtection = async (
  req:  Request,
  res:  Response,
  next: NextFunction
): Promise<void> => {
  if (config.isTest) { next(); return; }

  const ip      = (req.ip ?? "unknown").replace(/^::ffff:/, "");
  const failKey = `brute:fail:${ip}`;
  const lockKey = `brute:lock:${ip}`;
  const WINDOW   = 15 * 60;
  const LOCKOUT  = 60 * 60;
  const MAX_FAIL = 10;

  try {
    const locked = await redis.get(lockKey);
    if (locked) {
      logger.warn("Brute force lockout", { ip });
      res.status(429).json({
        message:   "Too many failed attempts. Try again in 1 hour.",
        code:      "RATE_LIMIT",
        errorCode: "ERR_9001"
      });
      return;
    }

    res.on("finish", () => {
      const statusCode = res.statusCode;

      if (statusCode === 401 || statusCode === 403) {
        redis
          .multi()
          .incr(failKey)
          .expire(failKey, WINDOW)
          .exec()
          .then((results) => {
            const count = results?.[0]?.[1] as number | null;
            if (count && count >= MAX_FAIL) {
              redis.set(lockKey, "1", "EX", LOCKOUT).catch(() => {});
              logger.warn("Brute force lockout triggered", { ip, count });
            }
          })
          .catch(() => {});
      } else if (statusCode >= 200 && statusCode < 300) {
        redis.del(failKey).catch(() => {});
      }
    });

    next();
  } catch {
    next();
  }
};
