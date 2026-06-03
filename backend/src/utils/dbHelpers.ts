import { PoolClient, QueryResult, QueryResultRow } from "pg";
import { pool } from "../config/database";
import { logger } from "./logger";

// ============================================================
// DB HELPERS
// Wraps pool.query with:
// - Slow query detection (>100ms → warn + persist to DB)
// - Typed query results
// - Single transaction wrapper
// ============================================================

const SLOW_QUERY_THRESHOLD_MS = 100;

// Fire-and-forget — void is explicit so linter doesn't complain
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

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const start = Date.now();
  try {
    const result: QueryResult<T> = await pool.query<T>(
      text,
      params as unknown[]
    );
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
// Handles BEGIN/COMMIT/ROLLBACK and client release automatically
// Usage:
//   const result = await transaction(async (client) => {
//     await client.query(...)
//     return something;
//   });
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

export function getPoolStats() {
  return {
    total:   pool.totalCount,
    idle:    pool.idleCount,
    waiting: pool.waitingCount,
  };
}
