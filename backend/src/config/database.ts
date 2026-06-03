import { Pool } from "pg";
import { logger } from "../utils/logger";
import { config } from "./index";

// ============================================================
// PRODUCTION-TUNED DATABASE POOL
// All config from central config — no direct process.env reads
// ============================================================

export const pool = new Pool({
  connectionString: config.databaseUrl,

  // Connection limits
  max:                    20,
  min:                    2,
  idleTimeoutMillis:      30_000,
  connectionTimeoutMillis: 5_000,

  // Query safety — prevent runaway queries
  statement_timeout: 10_000,
  query_timeout:     10_000,

  allowExitOnIdle: false,
});

pool.on("connect", () => {
  logger.debug("🔌 New database client connected");
});

pool.on("error", (err) => {
  logger.error("💥 Unexpected database pool error", {
    error: err.message,
    stack: err.stack,
  });
});

pool.on("remove", () => {
  logger.debug("🔌 Database client removed from pool");
});
