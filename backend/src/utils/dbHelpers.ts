import { PoolClient, QueryResult, QueryResultRow } from "pg";
import { pool } from "../config/database";
import { logger } from "./logger";

// ============================================================
// TYPE-SAFE DATABASE HELPERS
// Now with persistent slow query logging
// ============================================================

const SLOW_QUERY_THRESHOLD_MS = 100;

async function logSlowQueryToDB(query: string, durationMs: number, rows: number) {
  // Fire & forget - don't await, don't break the app if it fails
  pool.query(
    `INSERT INTO slow_queries (query_text, duration_ms, rows_returned) VALUES ($1, $2, $3)`,
    [query.substring(0, 500), durationMs, rows]
  ).catch(() => {
    // Silent fail - table may not exist yet during migrations
  });
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const start = Date.now();
  try {
    const result: QueryResult<T> = await pool.query<T>(text, params);
    const duration = Date.now() - start;

    if (duration > SLOW_QUERY_THRESHOLD_MS) {
      logger.warn("Slow query detected", {
        duration_ms: duration,
        rows: result.rowCount,
        sql: text.substring(0, 100),
      });
      logSlowQueryToDB(text, duration, result.rowCount || 0);
    }

    return result.rows;
  } catch (error: any) {
    logger.error("Query failed", { error: error.message, sql: text.substring(0, 100) });
    throw error;
  }
}

export async function queryOne<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] || null;
}

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
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function getPoolStats() {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };
}
