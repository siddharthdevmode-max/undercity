import {
  trustRecoveryQueue,
  backupQueue,
  idempotencyCleanupQueue,
  emailQueue,
} from "./index";
import { logger } from "../utils/logger";
import { config } from "../config";

// ============================================================
// JOB SCHEDULER — UNDERCITY
// Sets up recurring BullMQ repeat jobs.
//
// IMPORTANT: BullMQ repeat jobs are stored in Redis.
// Adding the same repeat job on every restart CREATES DUPLICATES.
// We use upsertJobScheduler() (BullMQ v5) or removeRepeatable()
// + add() pattern (BullMQ v4) to avoid duplicates.
//
// Strategy: remove existing repeatable by key, then re-add.
// This is idempotent — safe to call on every server restart.
// ============================================================

interface ScheduledJob {
  queue:   typeof trustRecoveryQueue;
  name:    string;
  pattern: string;           // cron pattern
  tz:      string;           // always specify timezone
  jobId:   string;           // stable ID for deduplication
  data?:   Record<string, unknown>;
}

const SCHEDULED_JOBS: ScheduledJob[] = [
  {
    queue:   trustRecoveryQueue,
    name:    "daily-trust-recovery",
    pattern: "0 3 * * *",          // 03:00 UTC daily
    tz:      "UTC",
    jobId:   "scheduled:trust-recovery:daily",
  },
  {
    queue:   backupQueue,
    name:    "daily-backup",
    pattern: "0 2 * * *",          // 02:00 UTC daily
    tz:      "UTC",
    jobId:   "scheduled:backup:daily",
  },
  {
    queue:   idempotencyCleanupQueue,
    name:    "hourly-idempotency-cleanup",
    pattern: "5 * * * *",          // :05 every hour (not :00 — avoid thundering herd)
    tz:      "UTC",
    jobId:   "scheduled:idempotency-cleanup:hourly",
  },
  {
    queue:   emailQueue,
    name:    "daily-email-queue-purge",
    pattern: "0 4 * * *",          // 04:00 UTC daily
    tz:      "UTC",
    jobId:   "scheduled:email-purge:daily",
    data:    { task: "purge_old_failed" },
  },
];

// ── Upsert a single scheduled job ─────────────────────────
// Remove existing repeatable (if any), then add fresh.
// This is the BullMQ v4-compatible idempotent pattern.

async function upsertScheduledJob(job: ScheduledJob): Promise<void> {
  const repeatOpts = {
    pattern:  job.pattern,
    tz:       job.tz,
  };

  // Remove any existing repeatable with this key to avoid duplicates
  try {
    await job.queue.removeRepeatable(job.name, repeatOpts);
  } catch {
    // May not exist yet on first boot — that's fine
  }

  await job.queue.add(
    job.name,
    job.data ?? {},
    {
      repeat: repeatOpts,
      jobId:  job.jobId,
    }
  );
}

// ── Main setup ─────────────────────────────────────────────

export async function setupScheduledJobs(): Promise<void> {
  // Skip in test mode — no Redis available
  if (config.isTest) {
    logger.info("⏰ Skipping scheduled jobs in test mode");
    return;
  }

  logger.info("⏰ Setting up scheduled jobs...");

  const results = await Promise.allSettled(
    SCHEDULED_JOBS.map((job) => upsertScheduledJob(job))
  );

  const succeeded: string[] = [];
  const failed:    string[] = [];

  results.forEach((result, i) => {
    const job = SCHEDULED_JOBS[i]!;
    if (result.status === "fulfilled") {
      succeeded.push(`${job.name} → ${job.pattern} ${job.tz}`);
    } else {
      failed.push(`${job.name}: ${result.reason?.message ?? "unknown error"}`);
      logger.error(`❌ Failed to schedule ${job.name}`, {
        error: result.reason?.message,
      });
    }
  });

  if (succeeded.length > 0) {
    logger.info("✅ Scheduled jobs configured", { jobs: succeeded });
  }

  if (failed.length > 0) {
    // Don't throw — partial scheduling is better than no scheduling
    logger.warn("⚠️ Some scheduled jobs failed to configure", { failed });
  }
}

// ── Teardown ───────────────────────────────────────────────
// Used in tests or when you want to remove all repeat jobs.

export async function teardownScheduledJobs(): Promise<void> {
  logger.info("🧹 Removing all scheduled jobs...");

  const results = await Promise.allSettled(
    SCHEDULED_JOBS.map((job) =>
      job.queue.removeRepeatable(job.name, {
        pattern: job.pattern,
        tz:      job.tz,
      })
    )
  );

  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    logger.warn("⚠️ Some scheduled jobs could not be removed", {
      count: failed.length,
    });
  }

  logger.info("✅ Scheduled jobs removed");
}

// ── List active scheduled jobs ─────────────────────────────

export async function listScheduledJobs(): Promise<
  Array<{ queue: string; name: string; pattern: string; nextRun?: number }>
> {
  const allRepeatables = await Promise.allSettled(
    SCHEDULED_JOBS.map(async (job) => {
      const repeatables = await job.queue.getRepeatableJobs();
      return repeatables.map((r) => ({
        queue:   job.queue.name,
        name:    r.name,
        pattern: r.pattern ?? "",
        nextRun: r.next,
      }));
    })
  );

  return allRepeatables
    .filter((r): r is PromiseFulfilledResult<typeof r extends PromiseFulfilledResult<infer T> ? T : never> =>
      r.status === "fulfilled"
    )
    .flatMap((r) => r.value);
}
