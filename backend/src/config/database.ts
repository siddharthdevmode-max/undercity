import { Pool } from "pg";
import { logger } from "../utils/logger";
import { config } from "./index";

// ============================================================
// PRODUCTION-TUNED DATABASE POOL
// SSL enforced in production
// All config from central config — no direct process.env reads
// ============================================================

const sslConfig = config.isProduction
  ? {
      rejectUnauthorized: true,
    }
  : false;

export const pool = new Pool({
  connectionString: config.databaseUrl,

  // SSL — enforced in production
  ssl: sslConfig,

  // Connection limits
  max:                     20,
  min:                     2,
  idleTimeoutMillis:       30_000,
  connectionTimeoutMillis: 5_000,

  // Query safety — prevent runaway queries
  statement_timeout: 10_000,
  query_timeout:     10_000,

  allowExitOnIdle: false,
});

pool.on("connect", (client) => {
  logger.debug("🔌 New database client connected");
  // Enforce search path for security
  client.query("SET search_path TO public").catch(() => {});
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

// ── Pool exhaustion alert ──────────────────────────────────
setInterval(() => {
  if (pool.waitingCount > 5) {
    import("../utils/alerts").then(({ Alerts }) => {
      Alerts.dbPoolExhausted(pool.waitingCount, pool.totalCount);
    }).catch(() => {});
  }
}, 30_000);
