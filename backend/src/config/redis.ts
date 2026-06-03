import Redis from "ioredis";
import { logger } from "../utils/logger";
import { config } from "./index";

// ============================================================
// REDIS CLIENT
// All config from central config — no direct process.env reads
// ============================================================

const redis = new Redis({
  host:     config.redis.host,
  port:     config.redis.port,
  password: config.redis.password,

  // Reconnect with exponential backoff: 50ms → 3s max
  retryStrategy(times) {
    const delay = Math.min(times * 50, 3000);
    logger.warn(`🔁 Redis retrying connection (attempt ${times}, delay ${delay}ms)`);
    return delay;
  },

  maxRetriesPerRequest: 3,
  lazyConnect: true,

  reconnectOnError(err) {
    const targetErrors = ["READONLY", "ETIMEDOUT", "ECONNRESET"];
    return targetErrors.some((e) => err.message.includes(e));
  },
});

redis.on("connect",      ()            => logger.info("✅ Redis connected"));
redis.on("ready",        ()            => logger.info("✅ Redis ready"));
redis.on("error",        (err)         => logger.error("❌ Redis error", { error: err.message }));
redis.on("close",        ()            => logger.warn("⚠️  Redis connection closed"));
redis.on("reconnecting", (delay: number) => logger.warn(`🔁 Redis reconnecting in ${delay}ms`));

export default redis;
