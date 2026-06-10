// ============================================================
// DB HELPERS — UNDERCITY
// Typed query wrappers. Use these instead of pool.query().
// ============================================================

import { PoolClient, QueryResult, QueryResultRow } from "pg";
import { pool, withTransaction } from "../config/database";
import { logger } from "./logger";

const SLOW_QUERY_THRESHOLD_MS = 100;

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
  const pg = error as { code?: string; message?: string };
  if (pg.code && RETRYABLE_PG_CODES.has(pg.code)) return true;
  if (pg.message?.includes("ETIMEDOUT"))  return true;
  if (pg.message?.includes("ECONNRESET")) return true;
  if (pg.message?.includes("ECONNREFUSED")) return true;
  return false;
}

function warnSlowQuery(sql: string, durationMs: number, rows: number): void {
  logger.warn("Slow query", {
    duration_ms: durationMs,
    rows,
    sql: sql.slice(0, 200),
  });
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  sql:    string,
  params?: unknown[]
): Promise<T[]> {
  const start = Date.now();
  try {
    const result: QueryResult<T> = await pool.query<T>(sql, params as unknown[]);
    const duration = Date.now() - start;
    if (duration > SLOW_QUERY_THRESHOLD_MS) {
      warnSlowQuery(sql, duration, result.rowCount ?? 0);
    }
    return result.rows;
  } catch (error: unknown) {
    logger.error("Query failed", {
      error: error instanceof Error ? error.message : String(error),
      sql:   sql.slice(0, 200),
    });
    throw error;
  }
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  sql:    string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function queryCount(
  sql:    string,
  params?: unknown[]
): Promise<number> {
  const row = await queryOne<{ count: string }>(sql, params);
  return parseInt(row?.count ?? "0", 10);
}

export async function queryExists(
  sql:    string,
  params?: unknown[]
): Promise<boolean> {
  const row = await queryOne<{ exists: boolean }>(
    `SELECT EXISTS(${sql}) AS exists`,
    params
  );
  return row?.exists ?? false;
}

export async function clientQuery<T extends QueryResultRow = QueryResultRow>(
  client: PoolClient,
  sql:    string,
  params?: unknown[]
): Promise<T[]> {
  const start = Date.now();
  try {
    const result: QueryResult<T> = await client.query<T>(sql, params as unknown[]);
    const duration = Date.now() - start;
    if (duration > SLOW_QUERY_THRESHOLD_MS) {
      warnSlowQuery(sql, duration, result.rowCount ?? 0);
    }
    return result.rows;
  } catch (error: unknown) {
    logger.error("Client query failed", {
      error: error instanceof Error ? error.message : String(error),
      sql:   sql.slice(0, 200),
    });
    throw error;
  }
}

export const transaction = withTransaction;

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

      if (!isRetryableError(error) || attempt === maxRetries) throw error;

      const base   = baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.random() * base * 0.5;
      const delay  = Math.round(base + jitter);

      logger.warn(`Retrying ${label}`, {
        attempt,
        maxRetries,
        delay_ms: delay,
        error:    error instanceof Error ? error.message : String(error),
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export async function retryTransaction<T>(
  callback:   (client: PoolClient) => Promise<T>,
  label       = "transaction",
  maxRetries  = 3
): Promise<T> {
  return withRetry(
    () => withTransaction(callback),
    { label, maxRetries, baseDelayMs: 100 }
  );
}

// BUG FIX: type assertion for pg's unofficial waitingCount property
export function getPoolStats() {
  return {
    total:   pool.totalCount,
    idle:    pool.idleCount,
    waiting: (pool as unknown as { waitingCount: number }).waitingCount ?? 0,
  };
}
