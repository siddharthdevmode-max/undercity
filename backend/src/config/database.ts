// ============================================================
// DATABASE POOL — UNDERCITY
// Production-tuned pg.Pool with health check, proper SSL,
// per-connection session config, exhaustion alerting,
// and a safe withTransaction helper.
// ============================================================

import { Pool, PoolClient } from "pg";
import { logger } from "../utils/logger";
import { config } from "./index";

// ─── SSL Config ───────────────────────────────────────────

// SWAP_ON_VPS:
// Hetzner private network: SSL not needed (same datacenter, internal network)
// Managed DB (Supabase, RDS, etc.): set DATABASE_SSL=true + DATABASE_SSL_REJECT_UNAUTHORIZED=true
const dbSslEnabled = process.env.DATABASE_SSL?.trim() === "true";
const dbSslRejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED?.trim() !== "false";

const sslConfig = dbSslEnabled
  ? { rejectUnauthorized: dbSslRejectUnauthorized }
  : false;

// ─── Pool ─────────────────────────────────────────────────

export const pool = new Pool({
  connectionString:        config.databaseUrl,
  ssl:                     sslConfig,
  max:                     config.isTest ? 5  : 20,
  min:                     config.isTest ? 1  : 2,
  idleTimeoutMillis:       30_000,
  connectionTimeoutMillis: 5_000,
  allowExitOnIdle:         config.isTest,
  application_name:        `undercity-${config.nodeEnv}`,
});

// ─── Per-connection Session Config ───────────────────────
// Each SET runs as a separate query to avoid multi-statement
// driver compatibility issues.

pool.on("connect", (client: PoolClient) => {
  logger.debug("🔌 DB client connected");

  const sessionConfig = [
    "SET search_path TO public",
    "SET statement_timeout = '10s'",
    "SET lock_timeout = '5s'",
    "SET idle_in_transaction_session_timeout = '30s'",
  ];

  // Fire-and-forget: log but do not crash on failure
  void Promise.all(sessionConfig.map((sql) => client.query(sql))).catch(
    (err: Error) => {
      logger.error("Failed to set session config on new DB connection", {
        error: err.message,
      });
    }
  );
});

pool.on("error", (err: Error) => {
  logger.error("💥 DB pool error", {
    error: err.message,
    stack: err.stack,
  });
});

pool.on("remove", () => {
  logger.debug("🔌 DB client removed from pool");
});

// ─── Pool Exhaustion Monitor ──────────────────────────────
// Alerts when the wait queue builds up in production.

let exhaustionAlertCooldown = false;

if (config.isProduction) {
  setInterval(() => {
    const { waitingCount, totalCount } = pool;

    if (waitingCount > 5 && !exhaustionAlertCooldown) {
      exhaustionAlertCooldown = true;

      import("../utils/alerts")
        .then(({ Alerts }) => {
          Alerts.dbPoolExhausted(waitingCount, totalCount);
        })
        .catch(() => {});

      // Cooldown: 5 minutes between repeat alerts
      setTimeout(() => {
        exhaustionAlertCooldown = false;
      }, 300_000);
    }
  }, 30_000);
}

// ─── Health Check ─────────────────────────────────────────

export async function testDatabaseConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    const result = await client.query<{ now: Date }>("SELECT NOW() as now");
    logger.info("✅ Database connected", {
      serverTime: result.rows[0]?.now,
      totalConns: pool.totalCount,
      idleConns:  pool.idleCount,
    });
  } finally {
    client.release();
  }
}

// ─── Pool Stats (for health endpoint) ─────────────────────

export function getPoolStats() {
  return {
    total:   pool.totalCount,
    idle:    pool.idleCount,
    waiting: pool.waitingCount,
  };
}

// ─── Transaction Helper ───────────────────────────────────
// Rolls back safely even if ROLLBACK itself throws,
// preserving the original error in all cases.

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      logger.error("ROLLBACK failed — connection may be in bad state", {
        rollbackError:
          rollbackErr instanceof Error
            ? rollbackErr.message
            : String(rollbackErr),
      });
    }
    throw err;
  } finally {
    client.release();
  }
}
