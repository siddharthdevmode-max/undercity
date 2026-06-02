import Redis from "ioredis";
import { logger } from "../utils/logger";

// ============================================================
// REDIS CLIENT
// - Optional password (REDIS_PASSWORD env var)
// - Retry strategy with exponential backoff
// - Proper logger integration (no console.*)
// ============================================================

const redis = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD || undefined,

  // Reconnect with backoff: 50ms, 100ms, 200ms ... max 3s
  retryStrategy(times) {
    const delay = Math.min(times * 50, 3000);
    logger.warn(`🔁 Redis retrying connection (attempt ${times}, delay ${delay}ms)`);
    return delay;
  },

  // Fail fast on first connect attempt
  maxRetriesPerRequest: 3,

  // Don't connect until first command
  lazyConnect: true,

  // Reconnect if we get certain errors
  reconnectOnError(err) {
    const targetErrors = ["READONLY", "ETIMEDOUT", "ECONNRESET"];
    return targetErrors.some((e) => err.message.includes(e));
  },
});

redis.on("connect", () => {
  logger.info("✅ Redis connected");
});

redis.on("ready", () => {
  logger.info("✅ Redis ready to accept commands");
});

redis.on("error", (err) => {
  logger.error("❌ Redis error", { error: err.message });
});

redis.on("close", () => {
  logger.warn("⚠️ Redis connection closed");
});

redis.on("reconnecting", (delay: number) => {
  logger.warn(`🔁 Redis reconnecting in ${delay}ms`);
});

export default redis;
