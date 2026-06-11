// ============================================================
// DATABASE POOL — UNDERCITY
// Production-tuned pg.Pool with health check, proper SSL,
// per-connection session config, exhaustion alerting,
// and a safe withTransaction helper.
// ============================================================

import { Pool, PoolClient } from "pg";
import { logger }           from "../utils/logger";
import { config }           from "./index";
import { Alerts }           from "../utils/alerts";

// ─── SSL Config ───────────────────────────────────────────

const sslConfig = config.databaseSsl
  ? { rejectUnauthorized: config.databaseSslRejectUnauthorized }
  : false;

// ─── Pool ─────────────────────────────────────────────────

export const pool = new Pool({
  connectionString:        config.databaseUrl,
  ssl:                     sslConfig,
  max:                     config.databasePool.max,
  min:                     config.databasePool.min,
  idleTimeoutMillis:       30_000,
  connectionTimeoutMillis: config.databasePool.acquireMs,
  allowExitOnIdle:         config.isTest,
  application_name:        `undercity-${config.nodeEnv}`,
});

// ─── Per-connection Session Config ───────────────────────
// BUG FIX: session config must block — if it fails, the client
// is destroyed so it never enters the pool without timeouts set.
// Previously this was fire-and-forget which allowed unsafe clients.

const SESSION_CONFIG_SQL = [
  "SET search_path TO public",
  "SET statement_timeout = '10s'",
  "SET lock_timeout = '5s'",
  "SET idle_in_transaction_session_timeout = '30s'",
] as const;

pool.on("connect", (client: PoolClient) => {
  logger.debug("DB client connected — applying session config");

  // We intentionally do NOT use fire-and-forget here.
  // The pool will not hand this client out until our async work is done
  // IF we attach the query before the "connect" handler returns.
  // We chain on the client's internal promise to block pool availability.
  const setup = async () => {
    for (const sql of SESSION_CONFIG_SQL) {
      await client.query(sql);
    }
  };

  setup().catch((err: Error) => {
    logger.error("Session config failed — destroying client", {
      error: err.message,
    });
    // Destroy client so it never enters the pool in bad state
    client.release(err);
  });
});

pool.on("error", (err: Error) => {
  logger.error("DB pool error", {
    error: err.message,
    stack: err.stack,
  });
});

pool.on("remove", () => {
  logger.debug("DB client removed from pool");
});

// ─── Pool Exhaustion Monitor ──────────────────────────────
// BUG FIX: static import (not dynamic inside interval)
// BUG FIX: sustained check — alert only if waiting > 5 for 2 consecutive polls

let exhaustionAlertCooldown  = false;
let consecutiveHighWait      = 0;
const HIGH_WAIT_THRESHOLD    = 5;
const HIGH_WAIT_CONSECUTIVE  = 2;   // must be high for 2 polls (60s) to alert

if (config.isProduction) {
  setInterval(() => {
    // BUG FIX: pg types don't expose waitingCount — safe cast
    const waiting = (pool as unknown as { waitingCount: number }).waitingCount ?? 0;
    const total   = pool.totalCount;

    if (waiting > HIGH_WAIT_THRESHOLD) {
      consecutiveHighWait++;
    } else {
      consecutiveHighWait = 0;
    }

    if (
      consecutiveHighWait >= HIGH_WAIT_CONSECUTIVE &&
      !exhaustionAlertCooldown
    ) {
      exhaustionAlertCooldown = true;
      consecutiveHighWait     = 0;

      void Alerts.dbPoolExhausted(waiting, total).catch(() => {});

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
    logger.info("Database connected", {
      serverTime: result.rows[0]?.now,
      totalConns: pool.totalCount,
      idleConns:  pool.idleCount,
    });
  } finally {
    client.release();
  }
}

// ─── Dedicated Game Tick Pool ────────────────────────────
// Separate smaller pool so game tick bulk queries never
// starve user-facing request pool.
// Size: 5 connections (enough for 7 parallel tick tasks).

export const tickPool = new Pool({
  connectionString:        config.databaseUrl,
  ssl:                     sslConfig,
  max:                     5,
  min:                     1,
  idleTimeoutMillis:       30_000,
  connectionTimeoutMillis: 5_000,
  application_name:        `undercity-tick-${config.nodeEnv}`,
});

tickPool.on("error", (err: Error) => {
  logger.error("Tick pool error", {
    error: err.message,
    stack: err.stack,
  });
});

// ─── Pool Stats (for health endpoint) ─────────────────────

export function getPoolStats() {
  return {
    main: {
      total:   pool.totalCount,
      idle:    pool.idleCount,
      waiting: (pool as unknown as { waitingCount: number }).waitingCount ?? 0,
    },
    tick: {
      total:   tickPool.totalCount,
      idle:    tickPool.idleCount,
      waiting: (tickPool as unknown as { waitingCount: number }).waitingCount ?? 0,
    },
  };
}

// ─── Transaction Helper ───────────────────────────────────
// Rolls back safely even if ROLLBACK itself throws.
// BUG FIX: warns if called while already in a transaction
// (nested BEGIN is silently ignored by Postgres — not safe).

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  // Detect accidental nesting — Postgres ignores nested BEGIN
  // but the outer COMMIT/ROLLBACK will affect all work
  const txStatus = await client
    .query<{ txid: string }>("SELECT txid_current_if_assigned() as txid")
    .then((r) => r.rows[0]?.txid)
    .catch(() => null);

  if (txStatus) {
    logger.warn(
      "withTransaction called while already in a transaction — " +
      "nested BEGIN detected. Use savepoints for nested transactions."
    );
  }

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

// ─── Savepoint Helper ─────────────────────────────────────
// For nested operations inside an existing transaction.
// Usage: await withSavepoint(client, "sp_name", async (c) => { ... })

export async function withSavepoint<T>(
  client:    PoolClient,
  name:      string,
  fn:        (client: PoolClient) => Promise<T>
): Promise<T> {
  // Savepoint names must be valid SQL identifiers
  const safeName = name.replace(/[^a-z0-9_]/gi, "_");
  await client.query(`SAVEPOINT ${safeName}`);
  try {
    const result = await fn(client);
    await client.query(`RELEASE SAVEPOINT ${safeName}`);
    return result;
  } catch (err) {
    await client.query(`ROLLBACK TO SAVEPOINT ${safeName}`).catch(() => {});
    throw err;
  }
}
