import { Server } from "http";
import { pool } from "../config/database";
import redis from "../config/redis";
import { logger } from "./logger";

// ============================================================
// GRACEFUL SHUTDOWN
// When Ctrl+C or kill -SIGTERM:
//   1. Stop accepting new requests
//   2. Wait for ongoing requests to finish (30s max)
//   3. Close DB pool
//   4. Close Redis
//   5. Exit cleanly
// Prevents data loss & connection leaks on restart
// ============================================================

export function setupGracefulShutdown(server: Server) {
  let isShuttingDown = false;

  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`📴 ${signal} received, starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(() => {
      logger.info("✅ HTTP server closed");
    });

    // Wait up to 30s for ongoing requests
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
    } catch (error: any) {
      logger.error("❌ Error during shutdown", { error: error.message });
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  
  // Catch uncaught errors (last resort)
  process.on("uncaughtException", (err) => {
    logger.error("💥 Uncaught exception", { error: err.message, stack: err.stack });
    shutdown("uncaughtException");
  });
  
  process.on("unhandledRejection", (reason) => {
    logger.error("💥 Unhandled rejection", { reason });
    shutdown("unhandledRejection");
  });
}
