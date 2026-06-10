// ============================================================
// RATE LIMITER — UNDERCITY
// Redis-backed rate limiting with memory fallback alerting.
// Falls back to memory store if Redis is unavailable, but
// fires a Discord/Slack alert so you know about it.
// ============================================================

import rateLimit, { Options, Store } from "express-rate-limit";
import { RedisStore }                from "rate-limit-redis";
import type { Request, Response, NextFunction } from "express";
import { redis }      from "../config/redis";
import { config }     from "../config";
import { logger }     from "../utils/logger";
import { sendAlert }  from "../utils/alerts";

// ─── Alert state ──────────────────────────────────────────

let _redisStoreAlertFired = false;

function alertRedisStoreFallback(prefix: string): void {
  if (_redisStoreAlertFired) return;
  _redisStoreAlertFired = true;

  logger.error(
    `[RateLimit] RedisStore unavailable for "${prefix}" — ` +
    `falling back to memory store. ` +
    `Effective limit is max * numWorkers per process.`
  );

  sendAlert({
    title:    "⚠️ Rate Limit Store Fallback",
    message:
      `RedisStore failed for \`${prefix}\`. ` +
      `Falling back to in-memory store. ` +
      `Rate limits are now per-process — effective limit multiplied by worker count.`,
    severity:  "warning",
    dedupeKey: "rl-redis-fallback",
  });
}

// ─── Store factory ─────────────────────────────────────────

function makeRedisStore(prefix: string): Store | undefined {
  if (config.isTest) return undefined;

  try {
    return new RedisStore({
      sendCommand: (...args: string[]) =>
        redis.call(...(args as [string, ...string[]])) as Promise<number>,
      prefix: `rl:${prefix}:`,
    });
  } catch (err) {
    alertRedisStoreFallback(prefix);
    logger.warn(`Could not create RedisStore for "${prefix}"`, {
      error: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}

// ─── Key generators ────────────────────────────────────────

const keyByUidOrIp = (req: Request): string =>
  req.firebaseUser?.uid
    ? `uid:${req.firebaseUser.uid}`
    : `ip:${req.ip ?? "unknown"}`;

const keyByIp = (req: Request): string => `ip:${req.ip ?? "unknown"}`;

// ─── Health check skip ─────────────────────────────────────

const skipHealthCheck = (req: Request): boolean =>
  req.path.startsWith("/api/health") ||
  req.path.startsWith("/api/v1/health");

// ─── Limiter factory ───────────────────────────────────────
// FIX: store is built once and passed as a single property.
// Previous version spread options AFTER store, which caused
// the store key to appear twice — TS1117 duplicate property error.

function makeLimiter(
  prefix:  string,
  options: Partial<Options> & { windowMs: number; max: number }
) {
  const store = makeRedisStore(prefix);

  const { ...restOptions } = options;

  return rateLimit({
    standardHeaders: true,
    legacyHeaders:   false,
    // SWAP_ON_VPS: Behind Cloudflare, set xForwardedForHeader: true
    // Cloudflare sends real client IP in CF-Connecting-IP header
    // Also set app.set("trust proxy", "loopback, linklocal, uniquelocal") in app.ts
    validate:        { xForwardedForHeader: false },
    skip:            skipHealthCheck,
    keyGenerator:    keyByUidOrIp,
    handler: (req: Request, res: Response) => {
      logger.warn(`Rate limit hit [${prefix}]`, {
        ip:   req.ip,
        uid:  req.firebaseUser?.uid,
        path: req.path,
      });
      res.status(429).json({
        message:   restOptions.message ?? "Too many requests. Please slow down.",
        code:      "RATE_LIMIT",
        errorCode: "ERR_9001",
        requestId: req.requestId,
      });
    },
    ...restOptions,
    store, // store always last — never overwritten by spread
  });
}

// ─── Limiters ──────────────────────────────────────────────

export const globalLimiter = makeLimiter("global", {
  windowMs:     config.rateLimit.windowMs,
  max:          config.rateLimit.maxRequests,
  keyGenerator: keyByIp,
  message:      "Too many requests. Please slow down.",
});

export const authSyncLimiter = makeLimiter("auth_sync", {
  windowMs:               config.rateLimit.authWindowMs,
  max:                    config.rateLimit.authMaxRequests,
  keyGenerator:           keyByIp,
  skipSuccessfulRequests: false,
  message:                "Too many registration attempts. Try again later.",
});

export const authMeLimiter = makeLimiter("auth_me", {
  windowMs: config.rateLimit.windowMs,
  max:      60,
  message:  "Too many requests.",
});

export const usernameCheckLimiter = makeLimiter("username_check", {
  windowMs:     config.rateLimit.windowMs,
  max:          20,
  keyGenerator: keyByIp,
  message:      "Too many username checks. Slow down.",
});

export const crimeLimiter = makeLimiter("crime", {
  windowMs: config.rateLimit.windowMs,
  max:      30,
  message:  "Too many crime requests. Slow down.",
});

export const challengeLimiter = makeLimiter("challenge", {
  windowMs: config.rateLimit.windowMs,
  max:      60,
  message:  "Too many requests.",
});

export const adminLimiter = makeLimiter("admin", {
  windowMs: config.rateLimit.windowMs,
  max:      30,
  message:  "Too many admin requests.",
});

export const statsLimiter = makeLimiter("stats", {
  windowMs:     config.rateLimit.windowMs,
  max:          30,
  keyGenerator: keyByIp,
  message:      "Too many requests.",
});

export const paymentLimiter = makeLimiter("payment", {
  windowMs:     15 * 60 * 1_000,
  max:          10,
  keyGenerator: keyByUidOrIp,
  message:      "Too many payment requests. Please wait.",
});

export const supportLimiter = makeLimiter("support", {
  windowMs:     60 * 60 * 1_000,
  max:          5,
  keyGenerator: keyByUidOrIp,
  message:      "Too many support requests. Please wait.",
});

export const gdprLimiter = makeLimiter("gdpr", {
  windowMs:     24 * 60 * 60 * 1_000,
  max:          3,
  keyGenerator: keyByUidOrIp,
  message:      "Too many GDPR requests. Please wait 24 hours.",
});

export const mfaLimiter = makeLimiter("mfa", {
  windowMs:     15 * 60 * 1_000,
  max:          10,
  keyGenerator: keyByUidOrIp,
  message:      "Too many MFA attempts. Please wait.",
});

// ─── IP Blacklist ──────────────────────────────────────────

export const ipBlacklist = async (
  req:  Request,
  res:  Response,
  next: NextFunction
): Promise<void> => {
  if (config.isTest) { next(); return; }

  const raw = req.ip ?? "";
  if (!raw)          { next(); return; }

  const ip = raw.replace(/^::ffff:/, "");

  try {
    const blocked = await redis.get(`blacklist:ip:${ip}`);
    if (blocked) {
      logger.warn("Blacklisted IP blocked", { ip, path: req.path });
      res.status(403).json({
        message:   "Access denied.",
        code:      "FORBIDDEN",
        errorCode: "ERR_1002",
      });
      return;
    }
    next();
  } catch {
    next();
  }
};

// ─── Brute Force Protection ────────────────────────────────

export const bruteForceProtection = async (
  req:  Request,
  res:  Response,
  next: NextFunction
): Promise<void> => {
  if (config.isTest) { next(); return; }

  const ip       = (req.ip ?? "unknown").replace(/^::ffff:/, "");
  const failKey  = `brute:fail:${ip}`;
  const lockKey  = `brute:lock:${ip}`;
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
        errorCode: "ERR_9001",
      });
      return;
    }

    res.on("finish", () => {
      const status = res.statusCode;

      if (status === 401 || status === 403) {
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
      } else if (status >= 200 && status < 300) {
        redis.del(failKey).catch(() => {});
      }
    });

    next();
  } catch {
    next();
  }
};
