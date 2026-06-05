import {
  trustRecoveryQueue,
  backupQueue,
  idempotencyCleanupQueue,
} from "./index";
import { logger } from "../utils/logger";

// ============================================================
// JOB SCHEDULER
// Sets up recurring jobs using BullMQ repeat
// Only runs in production
// ============================================================

export async function setupScheduledJobs(): Promise<void> {
  logger.info("⏰ Setting up scheduled jobs...");

  try {
    await trustRecoveryQueue.add(
      "daily-trust-recovery",
      {},
      {
        repeat:  { pattern: "0 3 * * *" },
        jobId:   "daily-trust-recovery",
      }
    );

    await backupQueue.add(
      "daily-backup",
      {},
      {
        repeat:  { pattern: "0 2 * * *" },
        jobId:   "daily-backup",
      }
    );

    await idempotencyCleanupQueue.add(
      "hourly-idempotency-cleanup",
      {},
      {
        repeat:  { pattern: "0 * * * *" },
        jobId:   "hourly-idempotency-cleanup",
      }
    );

    logger.info("✅ Scheduled jobs configured", {
      jobs: [
        "trust-recovery    → daily 03:00 UTC",
        "database-backup   → daily 02:00 UTC",
        "idempotency-clean → every hour",
      ],
    });
  } catch (err: unknown) {
    logger.error("❌ Failed to setup scheduled jobs", {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
