import { Pool } from "pg";
import { logger } from "../utils/logger";

// ============================================================
// PRODUCTION-TUNED DATABASE POOL
// ============================================================

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  
  // Connection limits
  max: 20,              // Max connections in pool
  min: 2,               // Min connections kept alive
  idleTimeoutMillis: 30000,    // Close idle clients after 30s
  connectionTimeoutMillis: 5000, // Fail fast if can't connect
  
  // Query timeouts
  statement_timeout: 10000,   // 10s max per query
  query_timeout: 10000,
  
  // Safety
  allowExitOnIdle: false,
});

// Log pool events for observability
pool.on("connect", () => {
  logger.debug("New database client connected");
});

pool.on("error", (err) => {
  logger.error("Unexpected database pool error", {
    error: err.message,
    stack: err.stack,
  });
});

pool.on("remove", () => {
  logger.debug("Database client removed from pool");
});
