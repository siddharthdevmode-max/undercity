import { Worker, Job }        from "bullmq";
import { bullmqConnection }   from "./index";
import { logger }             from "../utils/logger";
import { Alerts }             from "../utils/alerts";
import { runTrustRecovery }   from "../services/trustRecovery";
import { sendEmail }          from "../services/emailService";
import { pool }               from "../config/database";
import { config }             from "../config";
import { execFile }           from "child_process";
import { promisify }          from "util";
import path                   from "path";
import fs                     from "fs";
import type { EmailJob, PaymentWebhookJob } from "./index";

// FIX: Use execFile (no shell) instead of exec (shell=true)
// execFile does NOT invoke a shell — args are passed directly to the process.
// This eliminates shell injection risk entirely.
const execFileAsync = promisify(execFile);

// ============================================================
// BULLMQ WORKERS — UNDERCITY
// Each worker gets its OWN Redis connection (BullMQ requirement).
// ============================================================

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
    connection:      { ...bullmqConnection },
    concurrency:     1,
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

    const { host, port, db, user, password } = parsePgUrl(dbUrl);

    // FIX: Use execFile (array args) instead of exec (shell string)
    // This completely eliminates shell injection — no shell is invoked.
    await execFileAsync(
      "pg_dump",
      [
        "-h", host,
        "-p", port,
        "-U", user,
        "-d", db,
        "-f", backupFile,
        "--no-password",
      ],
      {
        env:       { ...process.env, PGPASSWORD: password },
        timeout:   300_000,
        maxBuffer: 100 * 1024 * 1024,
      }
    );

    await job.updateProgress(80);

    const stats  = fs.statSync(backupFile);
    const sizeMb = Math.round((stats.size / 1024 / 1024) * 100) / 100;

    // Retain last 7 backups
    const allBackups = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith("undercity-") && f.endsWith(".sql"))
      .map((f) => ({
        name:     f,
        fullPath: path.join(backupDir, f),
        mtime:    fs.statSync(path.join(backupDir, f)).mtime.getTime(),
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
    connection:      { ...bullmqConnection },
    concurrency:     1,
    stalledInterval: 360_000,
    maxStalledCount: 1,
  }
);

attachWorkerEvents(backupWorker, "database-backup");

interface PgParts {
  host:     string;
  port:     string;
  db:       string;
  user:     string;
  password: string;
}

function parsePgUrl(dbUrl: string): PgParts {
  const url      = new URL(dbUrl);
  const safeIdent = /^[a-zA-Z0-9_\-.]+$/;

  const host = url.hostname;
  const port = url.port || "5432";
  const db   = url.pathname.slice(1);
  const user = url.username;

  if (
    !safeIdent.test(host) ||
    !safeIdent.test(port) ||
    !safeIdent.test(db)   ||
    !safeIdent.test(user)
  ) {
    throw new Error("Invalid characters in DB connection params");
  }

  return { host, port, db, user, password: url.password || "" };
}

// ============================================================
// IDEMPOTENCY CLEANUP WORKER
// ============================================================

export const idempotencyCleanupWorker = new Worker(
  "idempotency-cleanup",
  async (job: Job) => {
    logger.info("🧹 Idempotency cleanup started", { jobId: job.id });

    let totalDeleted = 0;
    const BATCH_SIZE = 1_000;

    while (true) { // eslint-disable-line no-constant-condition
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
      jobId: job.id,
      type,
      to:    job.data.to,
    });

    await job.updateProgress(10);
    await sendEmail(job.data);
    await job.updateProgress(100);

    logger.info("✅ Email sent", { jobId: job.id, type, to: job.data.to });
    return { sent: true, type, to: job.data.to };
  },
  {
    connection:  { ...bullmqConnection },
    concurrency: 5,
    limiter: {
      max:      20,
      duration: 1_000,
    },
  }
);

attachWorkerEvents(emailWorker, "email");

// ============================================================
// PAYMENT WEBHOOK WORKER
// ============================================================
// Phase 0-2 STUB: Payment webhook processing not yet implemented.
// Lemon Squeezy integration coming in Phase 3 (Sept 2026).
// Worker registered so BullMQ doesn't leave jobs stranded,
// but immediately marks them as skipped with a log.
// ============================================================

export const paymentWebhookWorker = new Worker(
  "payment-webhook",
  async (job: Job<PaymentWebhookJob>) => {
    const { paymentEventId, paymentEventType } = job.data;

    logger.info("💳 Payment webhook received (Phase 3 stub — skipping)", {
      jobId:           job.id,
      paymentEventId,
      paymentEventType,
    });

    return {
      processed:     false,
      reason:        "payments_not_implemented",
      paymentEventId,
    };
  },
  {
    connection:  { ...bullmqConnection },
    concurrency: 1,
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
