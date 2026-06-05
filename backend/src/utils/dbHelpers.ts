import { PoolClient, QueryResult, QueryResultRow } from "pg";
import { pool } from "../config/database";
import { logger } from "./logger";

// ============================================================
// DB HELPERS
// - Slow query detection + persistence
// - Typed query results
// - Transaction wrapper
// - Retry logic for transient errors
// ============================================================

const SLOW_QUERY_THRESHOLD_MS = 100;

// Postgres error codes that are safe to retry
const RETRYABLE_PG_CODES = new Set([
  "40001", // serialization_failure
  "40P01", // deadlock_detected
  "08006", // connection_failure
  "08001", // sqlclient_unable_to_establish_sqlconnection
  "57P01", // admin_shutdown
  "57P02", // crash_shutdown
  "57P03", // cannot_connect_now
]);

function isRetryableError(error: unknown): boolean {
  const pgError = error as { code?: string; message?: string };
  if (pgError?.code && RETRYABLE_PG_CODES.has(pgError.code)) return true;
  if (pgError?.message?.includes("ETIMEDOUT"))                 return true;
  if (pgError?.message?.includes("ECONNRESET"))                return true;
  if (pgError?.message?.includes("ECONNREFUSED"))              return true;
  return false;
}

function logSlowQueryToDB(
  query: string,
  durationMs: number,
  rows: number
): void {
  void pool.query(
    `INSERT INTO slow_queries (query_text, duration_ms, rows_returned)
     VALUES ($1, $2, $3)`,
    [query.substring(0, 500), durationMs, rows]
  ).catch(() => {
    // Silent — table may not exist during migrations
  });
}

// ============================================================
// QUERY WITH SLOW QUERY DETECTION
// ============================================================
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const start = Date.now();
  try {
    const result: QueryResult<T> = await pool.query<T>(text, params as unknown[]);
    const duration = Date.now() - start;

    if (duration > SLOW_QUERY_THRESHOLD_MS) {
      logger.warn("🐢 Slow query detected", {
        duration_ms: duration,
        rows:        result.rowCount,
        sql:         text.substring(0, 120),
      });
      logSlowQueryToDB(text, duration, result.rowCount ?? 0);
    }

    return result.rows;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("💥 Query failed", {
      error: message,
      sql:   text.substring(0, 120),
    });
    throw error;
  }
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

// ============================================================
// TRANSACTION WRAPPER
// Handles BEGIN/COMMIT/ROLLBACK and client release
// ============================================================
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

// ============================================================
// RETRY WRAPPER
// Retries transient DB errors with exponential backoff
// Max 3 retries, 100ms → 200ms → 400ms delays
// Use for critical operations like crime attempts
// ============================================================
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?:  number;
    baseDelayMs?: number;
    label?:       string;
  } = {}
): Promise<T> {
  const {
    maxRetries  = 3,
    baseDelayMs = 100,
    label       = "DB operation",
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error;

      if (!isRetryableError(error) || attempt === maxRetries) {
        throw error;
      }

      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      logger.warn(`🔁 Retrying ${label}`, {
        attempt,
        maxRetries,
        delay_ms:  delay,
        error:     error instanceof Error ? error.message : String(error),
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// ============================================================
// RETRY TRANSACTION
// Combines transaction + retry for critical operations
// ============================================================
export async function retryTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
  label = "transaction"
): Promise<T> {
  return withRetry(
    () => transaction(callback),
    { label, maxRetries: 3, baseDelayMs: 100 }
  );
}

export function getPoolStats() {
  return {
    total:   pool.totalCount,
    idle:    pool.idleCount,
    waiting: pool.waitingCount,
  };
}
