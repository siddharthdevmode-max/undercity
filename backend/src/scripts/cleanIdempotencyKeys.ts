import { pool } from "../config/database";
import { logger } from "../utils/logger";

async function cleanExpiredKeys() {
  try {
    const result = await pool.query(
      `DELETE FROM idempotency_keys WHERE expires_at < NOW()`
    );
    logger.info(`🧹 Cleaned ${result.rowCount} expired idempotency keys`);
  } catch (error: unknown) {
    logger.error("Cleanup error", {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await pool.end();
  }
}

void cleanExpiredKeys();
