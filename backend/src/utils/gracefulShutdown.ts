import { Server } from "http";
import { pool } from "../config/database";
import redis from "../config/redis";
import { logger } from "./logger";
import { Alerts } from "./alerts";

// ============================================================
// GRACEFUL SHUTDOWN
// Order: stop accepting → drain requests → close DB → close Redis
// ============================================================

export function setupGracefulShutdown(server: Server): void {
  const shutdown = async (signal: string) => {
    logger.warn(`⚠️  ${signal} received — graceful shutdown initiated`);
    Alerts.gracefulShutdown(signal);

    // Stop accepting new connections
    server.close(async () => {
      logger.info("✅ HTTP server closed");

      try {
        // Try to close queues/workers if they exist
        try {
          const { closeQueues } = await import("../queues/index");
          const { closeWorkers } = await import("../queues/workers");
          await Promise.allSettled([closeQueues(), closeWorkers()]);
          logger.info("✅ BullMQ queues and workers closed");
        } catch {
          // Queue system may not be initialized — safe to ignore
        }

        // Close DB pool
        await pool.end();
        logger.info("✅ Database pool closed");

        // Close Redis
        await redis.quit();
        logger.info("✅ Redis connection closed");

        logger.info("✅ Graceful shutdown complete");
        process.exit(0);
      } catch (error: unknown) {
        logger.error("💥 Error during shutdown", {
          error: error instanceof Error ? error.message : String(error),
        });
        process.exit(1);
      }
    });

    // Force kill after 30 seconds
    setTimeout(() => {
      logger.error("💥 Forced shutdown after timeout");
      process.exit(1);
    }, 30_000);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT",  () => void shutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    logger.error("💥 Unhandled rejection", {
      reason: reason instanceof Error ? reason.message : String(reason),
    });
  });

  process.on("uncaughtException", (error) => {
    logger.error("💥 Uncaught exception", {
      error:  error.message,
      stack:  error.stack,
    });
    process.exit(1);
  });
}
