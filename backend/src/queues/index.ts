import { Queue } from "bullmq";
import { logger } from "../utils/logger";

// ============================================================
// BULLMQ QUEUE SYSTEM
// Queues: trust-recovery, backup, idempotency-cleanup, email
// ============================================================

const connection = {
  host:     process.env.REDIS_HOST     || "127.0.0.1",
  port:     parseInt(process.env.REDIS_PORT || "6379", 10),
  password: process.env.REDIS_PASSWORD || undefined,
};

export const trustRecoveryQueue = new Queue("trust-recovery", {
  connection,
  defaultJobOptions: {
    attempts:         3,
    backoff:          { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail:     { count: 500 },
  },
});

export const backupQueue = new Queue("database-backup", {
  connection,
  defaultJobOptions: {
    attempts:         2,
    backoff:          { type: "fixed", delay: 60000 },
    removeOnComplete: { count: 10 },
    removeOnFail:     { count: 50 },
  },
});

export const idempotencyCleanupQueue = new Queue("idempotency-cleanup", {
  connection,
  defaultJobOptions: {
    attempts:         3,
    backoff:          { type: "exponential", delay: 2000 },
    removeOnComplete: { count: 50 },
    removeOnFail:     { count: 100 },
  },
});

export const emailQueue = new Queue("email", {
  connection,
  defaultJobOptions: {
    attempts:         3,
    backoff:          { type: "exponential", delay: 10000 },
    removeOnComplete: { count: 200 },
    removeOnFail:     { count: 500 },
  },
});

export async function getQueueStats() {
  const [trustCounts, backupCounts, idempotencyCounts, emailCounts] = await Promise.all([
    trustRecoveryQueue.getJobCounts(),
    backupQueue.getJobCounts(),
    idempotencyCleanupQueue.getJobCounts(),
    emailQueue.getJobCounts(),
  ]);

  return {
    "trust-recovery":      trustCounts,
    "database-backup":     backupCounts,
    "idempotency-cleanup": idempotencyCounts,
    "email":               emailCounts,
  };
}

export async function closeQueues(): Promise<void> {
  logger.info("🔄 Closing BullMQ queues...");
  await Promise.allSettled([
    trustRecoveryQueue.close(),
    backupQueue.close(),
    idempotencyCleanupQueue.close(),
    emailQueue.close(),
  ]);
  logger.info("✅ BullMQ queues closed");
}

// ── Email queue helper ─────────────────────────────────────

export type EmailJob =
  | { type: "welcome";          to: string; username: string }
  | { type: "security_alert";   to: string; username: string; event: string; ip?: string }
  | { type: "purchase_confirm"; to: string; username: string; points: number; packName: string; amount: number };

export async function queueEmail(job: EmailJob): Promise<void> {
  await emailQueue.add(job.type, job, {
    priority: job.type === "security_alert" ? 1 : 10,
  });
}
