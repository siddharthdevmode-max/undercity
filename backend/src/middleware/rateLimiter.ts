// ============================================================
// RATE LIMITER — UNDERCITY
// Redis-backed rate limiting with memory fallback alerting.
// Falls back to memory store if Redis is unavailable.
// ============================================================

import rateLimit, { Options, Store } from "express-rate-limit";
import { RedisStore }                from "rate-limit-redis";
import type { Request, Response, NextFunction } from "express";
import { redis }      from "../config/redis";
import { config }     from "../config";
import { logger }     from "../utils/logger";
import { sendAlert }  from "../utils/alerts";

// ─── Alert state ──────────────────────────────────────────
// BUG FIX: track per-prefix, reset after 10 minutes
// so re-failures after recovery still alert

const fallbackAlertedAt = new Map<string, number>();
const FALLBACK_ALERT_COOLDOWN_MS = 10 * 60 * 1_000;

function alertRedisStoreFallback(prefix: string): void {
  const last = fallbackAlertedAt.get(prefix) ?? 0;
  if (Date.now() - last < FALLBACK_ALERT_COOLDOWN_MS) return;

  fallbackAlertedAt.set(prefix, Date.now());

  logger.error(
    `[RateLimit] RedisStore unavailable for "${prefix}" — ` +
    `falling back to memory store.`
  );

  void sendAlert({
    title:    "Rate Limit Store Fallback",
    message:
      `RedisStore failed for \`${prefix}\`. ` +
      `Falling back to in-memory store. ` +
      `Rate limits are now per-process — effective limit may be multiplied by worker count.`,
    severity:  "warning",
    dedupeKey: `rl-redis-fallback:${prefix}`,
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

// ─── Trust proxy config ────────────────────────────────────
// BUG FIX: env-driven instead of a code comment
// CLOUDFLARE_PROXY=true → validate X-Forwarded-For header
// This allows rate limiting on real client IP behind Cloudflare

const behindCloudflare =
  process.env["CLOUDFLARE_PROXY"]?.trim() === "true";

// ─── Limiter factory ───────────────────────────────────────

function makeLimiter(
  prefix:  string,
  options: Partial<Options> & { windowMs: number; max: number }
) {
  const store = makeRedisStore(prefix);
  const { ...restOptions } = options;

  return rateLimit({
    standardHeaders: true,
    legacyHeaders:   false,
    validate:        { xForwardedForHeader: behindCloudflare },
    skip:            skipHealthCheck,
    keyGenerator:    keyByUidOrIp,
    handler: (req: Request, res: Response) => {
      logger.warn(`Rate limit hit [${prefix}]`, {
        ip:   req.ip,
        uid:  req.firebaseUser?.uid,
        path: req.path,
      });
      res.status(429).json({
        statusCode: 429,
        message:    restOptions.message ?? "Too many requests. Please slow down.",
        code:       "RATE_LIMIT",
        errorCode:  "ERR_9001",
        ...(req.requestId ? { requestId: req.requestId } : {}),
      });
    },
    ...restOptions,
    store, // always last
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

// BUG FIX: raised from 3 to 10 — 3/day was too strict for beta
// Players accidentally triggering GDPR endpoints get locked out for 24h
export const gdprLimiter = makeLimiter("gdpr", {
  windowMs:     24 * 60 * 60 * 1_000,
  max:          10,
  keyGenerator: keyByUidOrIp,
  message:      "Too many GDPR requests. Please wait 24 hours.",
});

export const mfaLimiter = makeLimiter("mfa", {
  windowMs:     15 * 60 * 1_000,
  max:          10,
  keyGenerator: keyByUidOrIp,
  message:      "Too many MFA attempts. Please wait.",
});

export const bankLimiter = makeLimiter("bank", {
  windowMs:     60 * 1_000,
  max:          30,
  keyGenerator: keyByUidOrIp,
  message:      "Too many bank requests. Slow down.",
});

export const marketLimiter = makeLimiter("market", {
  windowMs:     60 * 1_000,
  max:          30,
  keyGenerator: keyByUidOrIp,
  message:      "Too many market requests. Slow down.",
});

export const inventoryLimiter = makeLimiter("inventory", {
  windowMs:     60 * 1_000,
  max:          30,
  keyGenerator: keyByUidOrIp,
  message:      "Too many inventory requests. Slow down.",
});

export const referralLimiter = makeLimiter("referral", {
  windowMs:     60 * 1_000,
  max:          10,
  keyGenerator: keyByUidOrIp,
  message:      "Too many referral requests. Slow down.",
});

// ─── IP Blacklist ──────────────────────────────────────────

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
        statusCode: 403,
        message:    "Access denied.",
        code:       "FORBIDDEN",
        errorCode:  "ERR_1002",
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
  const WINDOW   = 15 * 60;    // 15 minutes
  const LOCKOUT  = 60 * 60;    // 1 hour
  const MAX_FAIL = 10;

  try {
    const locked = await redis.get(lockKey);
    if (locked) {
      logger.warn("Brute force lockout active", { ip });
      res.status(429).json({
        statusCode: 429,
        message:    "Too many failed attempts. Try again in 1 hour.",
        code:       "RATE_LIMIT",
        errorCode:  "ERR_9001",
      });
      return;
    }

    res.on("finish", () => {
      const status = res.statusCode;

      // BUG FIX: only increment on 401 (wrong credentials)
      // NOT on 403 (banned users — that's not a brute force attempt)
      if (status === 401) {
        redis
          .multi()
          .incr(failKey)
          .expire(failKey, WINDOW)
          .exec()
          .then((results) => {
            const count = results?.[0]?.[1] as number | null;
            if (count && count >= MAX_FAIL) {
              void redis.set(lockKey, "1", "EX", LOCKOUT).catch(() => {});
              logger.warn("Brute force lockout triggered", { ip, count });
            }
          })
          .catch(() => {});
      } else if (status >= 200 && status < 300) {
        // Successful auth — reset fail counter
        void redis.del(failKey).catch(() => {});
      }
    });

    next();
  } catch {
    next();
  }
};
