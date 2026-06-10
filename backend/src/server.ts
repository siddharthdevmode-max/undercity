// ============================================================
// SERVER BOOT — UNDERCITY
// Connects DB + Redis, starts listening, starts game systems.
// Not imported by tests — only executed in production/dev.
// ============================================================

import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// ── validateEnv FIRST — before any other local import ────
// config/index.ts builds at import time and may throw.
// validateEnv provides a cleaner error layer on top.
// Both guard, but validateEnv gives the friendliest output.
import { validateEnv } from "./utils/envValidator";
validateEnv();

import { config }  from "./config";
import { logger }  from "./utils/logger";
import { Alerts }  from "./utils/alerts";

// ── Sentry after validateEnv + config ────────────────────
import { initSentry } from "./config/sentry";
initSentry();

import { testDatabaseConnection }            from "./config/database";
import { connectRedis, testRedisConnection } from "./config/redis";
import { startGameTick }                     from "./services/gameTick";
import { setupGracefulShutdown }             from "./utils/gracefulShutdown";
import { httpServer }                        from "./app";

// ── Timeout wrapper ───────────────────────────────────────
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`[Boot] ${label} timed out after ${ms}ms`)),
        ms
      )
    ),
  ]);
}

async function boot(): Promise<void> {
  logger.info("Booting Undercity backend...", { env: config.nodeEnv });

  // ── Database ──────────────────────────────────────────
  try {
    await withTimeout(testDatabaseConnection(), 10_000, "Database connection");
    logger.info("Database connected");
  } catch (err) {
    logger.error("Database connection failed — cannot start", {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }

  // ── Redis ─────────────────────────────────────────────
  try {
    await withTimeout(connectRedis(), 10_000, "Redis connection");
    const pong = await withTimeout(testRedisConnection(), 5_000, "Redis ping");
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

  // ── Game systems ──────────────────────────────────────
  const shouldRunGameSystems =
    config.isProduction ||
    process.env["ENABLE_GAME_TICK"] === "true";

  if (shouldRunGameSystems) {
    try {
      const { setupScheduledJobs } = await import("./queues/scheduler");
      await withTimeout(setupScheduledJobs(), 15_000, "Scheduled jobs setup");
      logger.info("Scheduled jobs active");
    } catch (err) {
      // Degraded state — alert loudly, do NOT exit
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("Scheduled jobs failed to start — system is degraded", {
        error: msg,
      });
      // Fire-and-forget alert
      void Alerts.scheduledJobsFailed(msg).catch((alertErr) => {
        logger.warn("Failed to send scheduled jobs alert", {
          error: alertErr instanceof Error ? alertErr.message : String(alertErr),
        });
      });
    }

    startGameTick();
    logger.info("Game tick active");
  } else {
    logger.info("Game systems skipped (dev/test mode)");
    logger.info(
      "To enable game tick locally: set ENABLE_GAME_TICK=true in .env"
    );
  }

  // ── Shutdown handler ──────────────────────────────────
  setupGracefulShutdown(httpServer);

  // ── Startup alert (fire-and-forget, never crash boot) ─
  void Alerts.serverStarted(config.port, config.nodeEnv).catch((err) => {
    logger.warn("Failed to send startup alert", {
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

boot().catch((err) => {
  logger.error("Boot failed", {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack  : undefined,
  });
  process.exit(1);
});
