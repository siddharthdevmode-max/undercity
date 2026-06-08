import { Worker, Job }        from "bullmq";
import { bullmqConnection }   from "./index";
import { logger }             from "../utils/logger";
import { Alerts }             from "../utils/alerts";
import { runTrustRecovery }   from "../services/trustRecovery";
import { sendEmail }          from "../services/emailService";
import { pool }               from "../config/database";
import { config }             from "../config";
import { exec }               from "child_process";
import { promisify }          from "util";
import path                   from "path";
import fs                     from "fs";
import type { EmailJob, PaymentWebhookJob } from "./index";

const execAsync = promisify(exec);

// ============================================================
// BULLMQ WORKERS — UNDERCITY
// Each worker gets its OWN Redis connection (BullMQ requirement).
// Workers share bullmqConnection config but instantiate separately.
// ============================================================

// ── Helper: attach standard event listeners ────────────────

function attachWorkerEvents(worker: Worker, name: string): void {
  worker.on("completed", (job) => {
    logger.info(`✅ [${name}] Job completed`, {
      jobId:    job.id,
      duration: job.finishedOn && job.processedOn
        ? job.finishedOn - job.processedOn
        : undefined,
    });
  });

  worker.on("failed", (job, err) => {
    const isFinal = (job?.attemptsMade ?? 0) >= (job?.opts?.attempts ?? 1);

    logger.error(`❌ [${name}] Job failed`, {
      jobId:       job?.id,
      error:       err.message,
      attempts:    job?.attemptsMade,
      maxAttempts: job?.opts?.attempts,
      final:       isFinal,
    });

    // Only alert on final failure — not every retry
    if (isFinal) {
      void Alerts.systemError(
        `[${name}] Job permanently failed`,
        `Job ${job?.id}: ${err.message}`,
        "high"
      );
    }
  });

  worker.on("error", (err) => {
    logger.error(`💥 [${name}] Worker connection error`, { error: err.message });
  });

  worker.on("stalled", (jobId) => {
    logger.warn(`⚠️ [${name}] Job stalled`, { jobId });
  });

  worker.on("progress", (job, progress) => {
    logger.debug(`📊 [${name}] Job progress`, { jobId: job.id, progress });
  });
}

// ============================================================
// TRUST RECOVERY WORKER
// ============================================================

export const trustRecoveryWorker = new Worker(
  "trust-recovery",
  async (job: Job) => {
    logger.info("🔄 Trust recovery job started", { jobId: job.id });

    await job.updateProgress(10);
    const result = await runTrustRecovery();
    await job.updateProgress(100);

    logger.info("✅ Trust recovery complete", { jobId: job.id, ...result });
    return result;
  },
  {
    connection:  { ...bullmqConnection },
    concurrency: 1,
    // Stalled job timeout — if worker crashes mid-job, reclaim after 2 min
    stalledInterval: 120_000,
    maxStalledCount: 2,
  }
);

attachWorkerEvents(trustRecoveryWorker, "trust-recovery");

// ============================================================
// DATABASE BACKUP WORKER
// ============================================================

export const backupWorker = new Worker(
  "database-backup",
  async (job: Job) => {
    if (config.isTest) throw new Error("Backup worker disabled in test mode");
    logger.info("💾 Database backup job started", { jobId: job.id });

    const dbUrl = config.databaseUrl;
    if (!dbUrl) throw new Error("DATABASE_URL not set");

    // Validate DATABASE_URL format
    const pgUrlRegex = /^postgresql:\/\/[^@]+@[^/]+\/\w+/;
    if (!pgUrlRegex.test(dbUrl)) {
      throw new Error("DATABASE_URL has invalid format — aborting backup");
    }

    await job.updateProgress(10);

    const timestamp  = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDir  = path.resolve(process.cwd(), "backups");
    const backupFile = path.resolve(backupDir, `undercity-${timestamp}.sql`);

    // Path traversal guard
    if (!backupFile.startsWith(backupDir + path.sep)) {
      throw new Error("Path traversal detected in backup path");
    }

    fs.mkdirSync(backupDir, { recursive: true, mode: 0o750 });

    await job.updateProgress(20);

    const pgPassword = extractPgPassword(dbUrl);
    const pgDumpArgs = buildPgDumpArgs(dbUrl, backupFile);

    await execAsync(`pg_dump ${pgDumpArgs}`, {
      env:       { ...process.env, PGPASSWORD: pgPassword },
      timeout:   300_000,    // 5 min max
      maxBuffer: 100 * 1024 * 1024, // 100MB
    });

    await job.updateProgress(80);

    const stats  = fs.statSync(backupFile);
    const sizeMb = Math.round((stats.size / 1024 / 1024) * 100) / 100;

    // Keep only last 7 backups — delete oldest first
    const allBackups = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith("undercity-") && f.endsWith(".sql"))
      .map((f) => ({
        name: f,
        fullPath: path.join(backupDir, f),
        mtime: fs.statSync(path.join(backupDir, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.mtime - a.mtime);

    for (const old of allBackups.slice(7)) {
      fs.unlinkSync(old.fullPath);
      logger.info("🗑️ Old backup deleted", { file: old.name });
    }

    await job.updateProgress(100);

    logger.info("✅ Database backup complete", {
      jobId: job.id,
      file:  path.basename(backupFile),
      sizeMb,
    });

    return { file: backupFile, sizeMb, timestamp };
  },
  {
    connection:  { ...bullmqConnection },
    concurrency: 1,  // Never run two backups simultaneously
    stalledInterval: 360_000, // 6 min — backup can take a while
    maxStalledCount: 1,
  }
);

attachWorkerEvents(backupWorker, "database-backup");

// ── pg_dump helpers ────────────────────────────────────────

function buildPgDumpArgs(dbUrl: string, outputFile: string): string {
  const url  = new URL(dbUrl);
  const host = url.hostname;
  const port = url.port || "5432";
  const db   = url.pathname.slice(1); // remove leading /
  const user = url.username;

  // Only allow safe characters — no shell metacharacters
  const safeIdent = /^[a-zA-Z0-9_\-.]+$/;
  if (
    !safeIdent.test(host) ||
    !safeIdent.test(port) ||
    !safeIdent.test(db)   ||
    !safeIdent.test(user)
  ) {
    throw new Error("Invalid characters in DB connection params");
  }

  // outputFile is already path.resolve'd — strip quotes as extra safety
  const safeOutput = outputFile.replace(/'/g, "").replace(/\\/g, "");

  return `-h ${host} -p ${port} -U ${user} -d ${db} -f '${safeOutput}' --no-password`;
}

function extractPgPassword(dbUrl: string): string {
  try {
    return new URL(dbUrl).password || "";
  } catch {
    return "";
  }
}

// ============================================================
// IDEMPOTENCY CLEANUP WORKER
// ============================================================

export const idempotencyCleanupWorker = new Worker(
  "idempotency-cleanup",
  async (job: Job) => {
    logger.info("🧹 Idempotency cleanup started", { jobId: job.id });

    // Delete in batches to avoid long-running transactions
    let totalDeleted = 0;
    const BATCH_SIZE = 1_000;

    while (true) {
      const result = await pool.query(
        `DELETE FROM idempotency_keys
         WHERE id IN (
           SELECT id FROM idempotency_keys
           WHERE expires_at < NOW()
           LIMIT $1
         )
         RETURNING id`,
        [BATCH_SIZE]
      );

      const batchDeleted = result.rowCount ?? 0;
      totalDeleted += batchDeleted;

      await job.updateProgress(Math.min(90, (totalDeleted / 10_000) * 90));

      // If we deleted fewer than BATCH_SIZE, we're done
      if (batchDeleted < BATCH_SIZE) break;
    }

    await job.updateProgress(100);

    logger.info("✅ Idempotency cleanup complete", {
      jobId: job.id,
      totalDeleted,
    });

    return { totalDeleted };
  },
  {
    connection:  { ...bullmqConnection },
    concurrency: 1,
  }
);

attachWorkerEvents(idempotencyCleanupWorker, "idempotency-cleanup");

// ============================================================
// EMAIL WORKER
// ============================================================

export const emailWorker = new Worker(
  "email",
  async (job: Job<EmailJob>) => {
    const { type } = job.data;

    logger.info("📧 Email job started", {
      jobId:    job.id,
      type,
      to:       job.data.to,
    });

    await job.updateProgress(10);
    await sendEmail(job.data);
    await job.updateProgress(100);

    logger.info("✅ Email sent", { jobId: job.id, type, to: job.data.to });
    return { sent: true, type, to: job.data.to };
  },
  {
    connection:  { ...bullmqConnection },
    concurrency: 5, // Send up to 5 emails in parallel
    limiter: {
      max:      20,      // max 20 emails
      duration: 1_000,   // per second — respects ESP rate limits
    },
  }
);

attachWorkerEvents(emailWorker, "email");

// ============================================================
// PAYMENT WEBHOOK WORKER
// ============================================================

export const paymentWebhookWorker = new Worker(
  "payment-webhook",
  async (job: Job<PaymentWebhookJob>) => {
    const { paymentEventId, paymentEventType } = job.data;

    logger.info("💳 Payment webhook job started", {
      jobId:           job.id,
      paymentEventId,
      paymentEventType,
    });

    await job.updateProgress(10);

    // Dynamically import to avoid circular deps
    const { processPaymentWebhook } = await import("../services/emailService");
    await processPaymentWebhook(job.data);

    await job.updateProgress(100);

    logger.info("✅ Payment webhook processed", {
      jobId: job.id,
      paymentEventId,
    });

    return { processed: true, paymentEventId };
  },
  {
    connection:  { ...bullmqConnection },
    concurrency: 1, // Process payments serially — no race conditions
  }
);

attachWorkerEvents(paymentWebhookWorker, "payment-webhook");

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

const ALL_WORKERS = [
  trustRecoveryWorker,
  backupWorker,
  idempotencyCleanupWorker,
  emailWorker,
  paymentWebhookWorker,
] as const;

export async function closeWorkers(): Promise<void> {
  logger.info("🔄 Closing BullMQ workers...");

  // close() waits for active jobs to finish (up to stalledInterval)
  const results = await Promise.allSettled(
    ALL_WORKERS.map((w) => w.close())
  );

  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    logger.warn("⚠️ Some workers did not close cleanly", { count: failed.length });
  }

  logger.info("✅ BullMQ workers closed");
}

export function getWorkerStatuses() {
  return ALL_WORKERS.map((w) => ({
    name:    w.name,
    running: !w.closing,
  }));
}
