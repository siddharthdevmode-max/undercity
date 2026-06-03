import { Server } from "http";
import { pool } from "../config/database";
import redis from "../config/redis";
import { logger } from "./logger";

export function setupGracefulShutdown(server: Server) {
  let isShuttingDown = false;

  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`📴 ${signal} received, starting graceful shutdown...`);

    server.close(() => {
      logger.info("✅ HTTP server closed");
    });

    setTimeout(() => {
      logger.warn("⏰ Shutdown timeout, forcing exit");
      process.exit(1);
    }, 30000);

    try {
      await pool.end();
      logger.info("✅ Database pool closed");

      await redis.quit();
      logger.info("✅ Redis connection closed");

      logger.info("👋 Graceful shutdown complete");
      process.exit(0);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("❌ Error during shutdown", { error: message });
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));

  process.on("uncaughtException", (err: Error) => {
    logger.error("💥 Uncaught exception", { error: err.message, stack: err.stack });
    shutdown("uncaughtException");
  });

  process.on("unhandledRejection", (reason: unknown) => {
    logger.error("💥 Unhandled rejection", { reason: String(reason) });
    shutdown("unhandledRejection");
  });
}
