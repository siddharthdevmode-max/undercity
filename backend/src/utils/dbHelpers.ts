import { PoolClient, QueryResult } from "pg";
import { pool } from "../config/database";
import { logger } from "./logger";

// ============================================================
// TYPE-SAFE DATABASE HELPERS
// Cleaner alternative to raw pool.query everywhere
// Includes automatic transaction management
// ============================================================

/**
 * Run a query and return typed rows
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const start = Date.now();
  try {
    const result: QueryResult<T> = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (duration > 100) {
      logger.warn("Slow query detected", {
        duration_ms: duration,
        rows: result.rowCount,
        sql: text.substring(0, 100),
      });
    }
    
    return result.rows;
  } catch (error: any) {
    logger.error("Query failed", {
      error: error.message,
      sql: text.substring(0, 100),
    });
    throw error;
  }
}

/**
 * Get a single row or null
 */
export async function queryOne<T = any>(
  text: string,
  params?: any[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] || null;
}

/**
 * Run multiple queries in a transaction
 * Auto-commits on success, rolls back on error
 */
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

/**
 * Get pool statistics (for monitoring)
 */
export function getPoolStats() {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };
}
