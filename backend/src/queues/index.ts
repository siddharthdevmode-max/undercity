import { Queue, QueueEvents } from "bullmq";
import { config }             from "../config";
import { logger }             from "../utils/logger";
import { Alerts }             from "../utils/alerts";

// ============================================================
// BULLMQ QUEUE SYSTEM — UNDERCITY
// Queues: trust-recovery, database-backup, idempotency-cleanup,
//         email, game-tick, payment-webhook
// ============================================================

// ── Shared Redis connection (from central config) ──────────
// Single connection object — all queues share it.
// Workers get their OWN connection (BullMQ requirement).

const connection = {
  host:            config.redis.host,
  port:            config.redis.port,
  password:        config.redis.password || undefined,
  tls:             config.redis.tls ? {} : undefined,
  connectTimeout:  10_000,
  maxRetriesPerRequest: null, // Required for BullMQ blocking commands
} as const;

export { connection as bullmqConnection };

// ── Queue factory ──────────────────────────────────────────
// All queues share base defaults; override only what differs.

function makeQueue(
  name: string,
  overrides: Partial<ConstructorParameters<typeof Queue>[1]> = {}
): Queue {
  return new Queue(name, {
    connection,
    defaultJobOptions: {
      attempts:         3,
      backoff:          { type: "exponential", delay: 5_000 },
      removeOnComplete: { count: 100, age: 60 * 60 * 24 },     // keep 100 or 1 day
      removeOnFail:     { count: 500, age: 60 * 60 * 24 * 7 }, // keep 500 or 7 days
    },
    ...overrides,
  });
}

// ── Queues ─────────────────────────────────────────────────

export const trustRecoveryQueue = makeQueue("trust-recovery", {
  defaultJobOptions: {
    attempts:         3,
    backoff:          { type: "exponential", delay: 5_000 },
    removeOnComplete: { count: 100, age: 86_400 },
    removeOnFail:     { count: 500, age: 604_800 },
  },
});

export const backupQueue = makeQueue("database-backup", {
  defaultJobOptions: {
    attempts:         2,
    backoff:          { type: "fixed", delay: 60_000 },
    removeOnComplete: { count: 10,  age: 86_400 * 7 },
    removeOnFail:     { count: 50,  age: 86_400 * 30 },
  },
});

export const idempotencyCleanupQueue = makeQueue("idempotency-cleanup", {
  defaultJobOptions: {
    attempts:         3,
    backoff:          { type: "exponential", delay: 2_000 },
    removeOnComplete: { count: 50  },
    removeOnFail:     { count: 100 },
  },
});

export const emailQueue = makeQueue("email", {
  defaultJobOptions: {
    attempts:         5,                                         // email gets more retries
    backoff:          { type: "exponential", delay: 10_000 },
    removeOnComplete: { count: 200, age: 86_400 },
    removeOnFail:     { count: 500, age: 86_400 * 7 },
  },
});

export const gameTickQueue = makeQueue("game-tick", {
  defaultJobOptions: {
    attempts:         1,                                         // ticks don't retry
    removeOnComplete: { count: 10  },
    removeOnFail:     { count: 100 },
  },
});

export const paymentWebhookQueue = makeQueue("payment-webhook", {
  defaultJobOptions: {
    attempts:         5,
    backoff:          { type: "exponential", delay: 30_000 },
    removeOnComplete: { count: 500, age: 86_400 * 30 },         // keep payment logs 30 days
    removeOnFail:     { count: 500, age: 86_400 * 30 },
  },
});

// ── All queues list (for bulk ops) ─────────────────────────

const ALL_QUEUES = [
  trustRecoveryQueue,
  backupQueue,
  idempotencyCleanupQueue,
  emailQueue,
  gameTickQueue,
  paymentWebhookQueue,
] as const;

// ── Queue Events (monitoring) ──────────────────────────────
// QueueEvents connects via a SEPARATE Redis connection.
// Use for monitoring failed jobs and firing alerts.

let queueEvents: QueueEvents | null = null;

export function initQueueEvents(): void {
  if (config.isTest) return;

  queueEvents = new QueueEvents("email", { connection });

  queueEvents.on("failed", ({ jobId, failedReason }) => {
    logger.error("📧 Email job permanently failed", { jobId, failedReason });

    // Alert if email failures exceed threshold — fire-and-forget
    void Alerts.systemError(
      "Email Queue Failure",
      `Job ${jobId} failed: ${failedReason}`,
      "medium"
    );
  });

  queueEvents.on("stalled", ({ jobId }) => {
    logger.warn("⚠️ Email job stalled", { jobId });
  });
}

// ── Stats ──────────────────────────────────────────────────

export interface QueueStats {
  name:      string;
  waiting:   number;
  active:    number;
  completed: number;
  failed:    number;
  delayed:   number;
  paused:    number;
}

export async function getQueueStats(): Promise<QueueStats[]> {
  const results = await Promise.allSettled(
    ALL_QUEUES.map(async (q) => {
      const counts = await q.getJobCounts(
        "waiting", "active", "completed", "failed", "delayed", "paused"
      );
      return {
        name:      q.name,
        waiting:   counts.waiting   ?? 0,
        active:    counts.active    ?? 0,
        completed: counts.completed ?? 0,
        failed:    counts.failed    ?? 0,
        delayed:   counts.delayed   ?? 0,
        paused:    counts.paused    ?? 0,
      } satisfies QueueStats;
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<QueueStats> => r.status === "fulfilled")
    .map((r) => r.value);
}

// ── Health check ───────────────────────────────────────────

export async function isQueueHealthy(): Promise<boolean> {
  try {
    // isPaused() does a lightweight Redis LLEN — good health probe
    await Promise.all(ALL_QUEUES.map((q) => q.isPaused()));
    return true;
  } catch {
    return false;
  }
}

// ── Graceful shutdown ──────────────────────────────────────

export async function closeQueues(): Promise<void> {
  logger.info("🔄 Closing BullMQ queues...");

  const results = await Promise.allSettled([
    ...ALL_QUEUES.map((q) => q.close()),
    queueEvents?.close() ?? Promise.resolve(),
  ]);

  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    logger.warn("⚠️ Some queues did not close cleanly", { count: failed.length });
  }

  logger.info("✅ BullMQ queues closed");
}

// ── Email queue helpers ────────────────────────────────────

export type EmailJobType =
  | "welcome"
  | "security_alert"
  | "purchase_confirm"
  | "email_verify"
  | "password_reset"
  | "ban_notice"
  | "support_reply";

export interface EmailJobWelcome        { type: "welcome";          to: string; username: string }
export interface EmailJobSecurityAlert  { type: "security_alert";   to: string; username: string; event: string; ip?: string }
export interface EmailJobPurchase       { type: "purchase_confirm"; to: string; username: string; points: number; packName: string; amountCents: number }
export interface EmailJobVerify         { type: "email_verify";     to: string; username: string; link: string }
export interface EmailJobPasswordReset  { type: "password_reset";   to: string; username: string; link: string }
export interface EmailJobBanNotice      { type: "ban_notice";       to: string; username: string; reason: string; expiresAt?: string }
export interface EmailJobSupportReply   { type: "support_reply";    to: string; username: string; ticketId: string; message: string }

export type EmailJob =
  | EmailJobWelcome
  | EmailJobSecurityAlert
  | EmailJobPurchase
  | EmailJobVerify
  | EmailJobPasswordReset
  | EmailJobBanNotice
  | EmailJobSupportReply;

// Priority map — lower number = higher priority in BullMQ
const EMAIL_PRIORITY: Record<EmailJobType, number> = {
  security_alert:   1,
  ban_notice:       2,
  email_verify:     3,
  password_reset:   3,
  support_reply:    5,
  purchase_confirm: 5,
  welcome:          10,
};

export async function queueEmail(job: EmailJob): Promise<void> {
  await emailQueue.add(job.type, job, {
    priority: EMAIL_PRIORITY[job.type] ?? 10,
    // Deduplication: don't queue duplicate welcome emails
    jobId: job.type === "welcome" ? `welcome:${job.to}` : undefined,
  });
}

export async function queueEmailBulk(jobs: EmailJob[]): Promise<void> {
  const bulkJobs = jobs.map((job) => ({
    name: job.type,
    data: job,
    opts: {
      priority: EMAIL_PRIORITY[job.type] ?? 10,
    },
  }));
  await emailQueue.addBulk(bulkJobs);
}

// ── Payment webhook helper ─────────────────────────────────

export interface PaymentWebhookJob {
  paymentEventId:   string;
  paymentEventType: string;
  payload:         string; // raw Stripe event JSON
  receivedAt:      string; // ISO timestamp
}

export async function queuePaymentWebhook(job: PaymentWebhookJob): Promise<void> {
  await paymentWebhookQueue.add("payment-webhook-job", job, {
    // Deduplicate by Stripe event ID — safe to re-deliver
    jobId: `payment:${job.paymentEventId}`,
  });
}
