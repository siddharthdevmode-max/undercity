// ============================================================
// SERVER BOOT — UNDERCITY
// Connects DB + Redis, starts listening, starts game systems.
// Not imported by tests — only executed in production/dev.
// ============================================================

import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { validateEnv }     from "./utils/envValidator";
import { config }          from "./config";
import { logger }          from "./utils/logger";
import { Alerts }          from "./utils/alerts";

import { testDatabaseConnection }            from "./config/database";
import { connectRedis, testRedisConnection } from "./config/redis";
import { startGameTick }                     from "./services/gameTick";
import { setupGracefulShutdown }             from "./utils/gracefulShutdown";

import { httpServer } from "./app";

validateEnv();

async function boot(): Promise<void> {
  logger.info("Booting Undercity backend...", { env: config.nodeEnv });

  // ── Database ──────────────────────────────────────────
  try {
    await testDatabaseConnection();
    logger.info("Database connected");
  } catch (err) {
    logger.error("Database connection failed — cannot start", {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }

  // ── Redis ─────────────────────────────────────────────
  try {
    await connectRedis();
    const pong = await testRedisConnection();
    if (!pong) throw new Error("Redis PING returned non-PONG");
    logger.info("Redis connected");
  } catch (err) {
    logger.error("Redis connection failed — cannot start", {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }

  // ── Listen ────────────────────────────────────────────
  await new Promise<void>((resolve) => {
    httpServer.listen(config.port, () => resolve());
  });

  logger.info("Server running", {
    url:    `http://localhost:${config.port}`,
    env:    config.nodeEnv,
    docs:   `http://localhost:${config.port}/api/docs`,
    health: `http://localhost:${config.port}/api/v1/health`,
  });

  // ── Game systems (production only) ───────────────────
  if (config.isProduction) {
    try {
      const { setupScheduledJobs } = await import("./queues/scheduler");
      await setupScheduledJobs();
      logger.info("Scheduled jobs active");
    } catch (err) {
      logger.error("Scheduled jobs failed to start", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    startGameTick();
    logger.info("Game tick active");
  } else {
    logger.info("Scheduled jobs skipped (dev)");
    logger.info("Game tick skipped (dev)");
  }

  // ── Shutdown handler ──────────────────────────────────
  setupGracefulShutdown(httpServer);

  // ── Alert ─────────────────────────────────────────────
  Alerts.serverStarted(config.port, config.nodeEnv);
}

boot().catch((err) => {
  logger.error("Boot failed", {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack  : undefined,
  });
  process.exit(1);
});
