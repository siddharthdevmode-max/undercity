// ============================================================
// REDIS CLIENT — UNDERCITY
// ioredis with exponential backoff, TLS support,
// lazy connect, and full event logging.
// ============================================================

import Redis from "ioredis";
import type { RedisOptions } from "ioredis";
import { logger } from "../utils/logger";
import { config } from "./index";

const redisOptions: RedisOptions = {
  host:     config.redis.host,
  port:     config.redis.port,
  password: config.redis.password,

  ...(config.redis.tls ? { tls: {} } : {}),

  connectTimeout:  10_000,
  commandTimeout:  5_000,
  keepAlive:       30_000,
  lazyConnect:     true,

  // null = no per-request retry limit; retries handled by retryStrategy
  // Required for pub/sub and blocking commands to work correctly
  maxRetriesPerRequest: null,

  retryStrategy(times: number) {
    if (times > 20) {
      logger.error("Redis: max retry attempts reached, giving up");
      return null;
    }
    const delay = Math.min(100 * Math.pow(2, times - 1), 5_000);
    logger.warn(`Redis retry attempt ${times} in ${delay}ms`);
    return delay;
  },

  reconnectOnError(err: Error) {
    const retryErrors = ["READONLY", "ETIMEDOUT", "ECONNRESET", "ECONNREFUSED"];
    return retryErrors.some((e) => err.message.includes(e));
  },
};

const redis = new Redis(redisOptions);

redis.on("connect",     () => logger.info("Redis connecting..."));
redis.on("ready",       () => logger.info("✅ Redis ready"));
redis.on("close",       () => logger.warn("Redis connection closed"));
redis.on("end",         () => logger.warn("Redis connection ended — no more retries"));

redis.on("error", (err: Error) => {
  logger.error("Redis error", {
    error: err.message,
    code:  (err as NodeJS.ErrnoException).code,
  });
});

redis.on("reconnecting", (delay: number) => {
  logger.warn("Redis reconnecting", { delayMs: delay });
});

// ─── Connect ──────────────────────────────────────────────

export async function connectRedis(): Promise<void> {
  if (config.isTest) {
    logger.debug("Redis skipped in test mode");
    return;
  }

  if (redis.status === "ready" || redis.status === "connect") {
    return;
  }

  await redis.connect();

  logger.info("Redis connection established", {
    host: config.redis.host,
    port: config.redis.port,
    tls:  config.redis.tls,
  });
}

// ─── Health Check ─────────────────────────────────────────

export async function testRedisConnection(): Promise<boolean> {
  try {
    const pong = await redis.ping();
    return pong === "PONG";
  } catch (err) {
    logger.error("Redis PING failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

// ─── Server Info (for health endpoint) ───────────────────

export async function getRedisInfo(): Promise<Record<string, string>> {
  try {
    const info  = await redis.info("server");
    const lines = info.split("\r\n");
    const result: Record<string, string> = {};

    for (const line of lines) {
      const [key, value] = line.split(":");
      if (key && value) result[key.trim()] = value.trim();
    }

    return result;
  } catch (err) {
    logger.warn("Redis INFO failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return {};
  }
}

export default redis;
export { redis };
