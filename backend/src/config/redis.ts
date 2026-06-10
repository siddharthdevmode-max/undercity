// ============================================================
// REDIS CLIENT — UNDERCITY
// ioredis with exponential backoff, TLS support,
// lazy connect, and full event logging.
// BullMQ connections are separate (see createBullMQConnection).
// ============================================================

import Redis            from "ioredis";
import type { RedisOptions } from "ioredis";
import { logger }       from "../utils/logger";
import { config }       from "./index";

// ─── Shared Base Options ──────────────────────────────────

const baseOptions: RedisOptions = {
  host:     config.redis.host,
  port:     config.redis.port,
  password: config.redis.password,

  ...(config.redis.tls ? { tls: {} } : {}),

  connectTimeout:  10_000,
  commandTimeout:  5_000,
  keepAlive:       30_000,
  lazyConnect:     true,

  // Required: null disables per-request retry limit
  // Needed for BullMQ blocking commands and pub/sub
  maxRetriesPerRequest: null,
};

// ─── Retry Strategy Factory ───────────────────────────────

function makeRetryStrategy(label: string) {
  return (times: number): number | null => {
    if (times > 20) {
      logger.error(`Redis [${label}]: max retry attempts reached — giving up`);

      // Alert asynchronously — do not block the retry strategy return
      void import("../utils/alerts")
        .then(({ Alerts }) => Alerts.redisDown(label))
        .catch(() => {});

      return null;
    }
    const delay = Math.min(100 * Math.pow(2, times - 1), 5_000);
    logger.warn(`Redis [${label}] retry attempt ${times} in ${delay}ms`);
    return delay;
  };
}

// ─── Attach Event Logging ─────────────────────────────────

function attachEvents(client: Redis, label: string): void {
  // BUG FIX: "connect" fires before AUTH — do not log "ready" here
  // "ready" fires after AUTH succeeds — this is the usable state
  client.on("connect",     () => logger.debug(`Redis [${label}] TCP connected (authenticating...)`));
  client.on("ready",       () => logger.info(`Redis [${label}] ready`));
  client.on("close",       () => logger.warn(`Redis [${label}] connection closed`));
  client.on("end",         () => logger.warn(`Redis [${label}] connection ended — no more retries`));
  client.on("reconnecting",(d: number) => logger.warn(`Redis [${label}] reconnecting`, { delayMs: d }));
  client.on("error",       (err: Error) => {
    logger.error(`Redis [${label}] error`, {
      error: err.message,
      code:  (err as NodeJS.ErrnoException).code,
    });
  });
}

// ─── Primary Client ───────────────────────────────────────
// Used for: rate limiting, caching, session data, health checks
// NOT used for BullMQ (see createBullMQConnection below)

const redis = new Redis({
  ...baseOptions,
  retryStrategy:    makeRetryStrategy("primary"),
  reconnectOnError: (err: Error) => {
    const retryErrors = ["READONLY", "ETIMEDOUT", "ECONNRESET", "ECONNREFUSED"];
    return retryErrors.some((e) => err.message.includes(e));
  },
});

attachEvents(redis, "primary");

// ─── BullMQ Connection Factory ────────────────────────────
// BUG FIX: BullMQ MUST have its own connections.
// Sharing the primary client causes command timeout conflicts
// with blocking commands (BRPOP, XREAD) used by BullMQ.
// Each call creates a NEW connection — caller owns the lifecycle.

export function createBullMQConnection(): Redis {
  const client = new Redis({
    ...baseOptions,
    // BullMQ-specific: no command timeout (blocking commands)
    commandTimeout:   undefined,
    enableReadyCheck: false,
    retryStrategy:    makeRetryStrategy("bullmq"),
  });
  attachEvents(client, "bullmq");
  return client;
}

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

// ─── Server + Memory Info (for health endpoint) ───────────
// BUG FIX: includes memory info for monitoring
// BUG FIX: parser is more robust (skips comment lines)

export async function getRedisInfo(): Promise<Record<string, string>> {
  try {
    const [serverInfo, memoryInfo] = await Promise.all([
      redis.info("server"),
      redis.info("memory"),
    ]);

    const result: Record<string, string> = {};

    for (const line of [...serverInfo.split("\r\n"), ...memoryInfo.split("\r\n")]) {
      if (!line || line.startsWith("#")) continue;
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;
      const key   = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      if (key && value) result[key] = value;
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
