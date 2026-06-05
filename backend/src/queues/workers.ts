import { Worker, Job } from "bullmq";
import { logger } from "../utils/logger";
import { runTrustRecovery } from "../services/trustRecovery";
import { pool } from "../config/database";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execAsync = promisify(exec);

const connection = {
  host:     process.env.REDIS_HOST     || "127.0.0.1",
  port:     parseInt(process.env.REDIS_PORT || "6379", 10),
  password: process.env.REDIS_PASSWORD || undefined,
};

// ============================================================
// TRUST RECOVERY WORKER
// ============================================================

export const trustRecoveryWorker = new Worker(
  "trust-recovery",
  async (job: Job) => {
    logger.info("🔄 Trust recovery job started", { jobId: job.id });
    const result = await runTrustRecovery();
    logger.info("✅ Trust recovery job complete", { jobId: job.id, ...result });
    return result;
  },
  { connection, concurrency: 1 }
);

// ============================================================
// DATABASE BACKUP WORKER
// Uses pg_dump with validated DATABASE_URL — no shell injection
// ============================================================

export const backupWorker = new Worker(
  "database-backup",
  async (job: Job) => {
    logger.info("💾 Database backup job started", { jobId: job.id });

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error("DATABASE_URL not set");

    // Validate DATABASE_URL format before passing to shell
    // Must match postgresql://user:pass@host:port/db
    const pgUrlRegex = /^postgresql:\/\/[^@]+@[^/]+\/\w+/;
    if (!pgUrlRegex.test(dbUrl)) {
      throw new Error("DATABASE_URL has invalid format — aborting backup for safety");
    }

    const timestamp  = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDir  = path.resolve(process.cwd(), "backups");
    const backupFile = path.resolve(backupDir, `undercity-${timestamp}.sql`);

    // Validate paths are within expected directory (path traversal protection)
    if (!backupFile.startsWith(backupDir)) {
      throw new Error("Path traversal detected in backup file path");
    }

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true, mode: 0o750 });
    }

    // Use env var for pg_dump to avoid URL in process list
    const env = {
      ...process.env,
      PGPASSWORD: extractPgPassword(dbUrl),
    };

    const pgDumpArgs = buildPgDumpArgs(dbUrl, backupFile);

    await execAsync(`pg_dump ${pgDumpArgs}`, {
      env,
      timeout: 300_000, // 5 min max
      maxBuffer: 100 * 1024 * 1024, // 100MB
    });

    const stats  = fs.statSync(backupFile);
    const sizeMb = Math.round(stats.size / 1024 / 1024 * 100) / 100;

    logger.info("✅ Database backup complete", {
      jobId: job.id,
      file:  backupFile,
      sizeMb,
    });

    // Keep only last 7 backups
    const files = fs.readdirSync(backupDir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => ({
        name: f,
        path: path.join(backupDir, f),
        time: fs.statSync(path.join(backupDir, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time);

    for (const file of files.slice(7)) {
      fs.unlinkSync(file.path);
      logger.info("🗑️ Old backup deleted", { file: file.name });
    }

    return { file: backupFile, sizeMb };
  },
  { connection, concurrency: 1 }
);

// ── Safe pg_dump argument builder ─────────────────────────
function buildPgDumpArgs(dbUrl: string, outputFile: string): string {
  try {
    const url   = new URL(dbUrl);
    const host  = url.hostname;
    const port  = url.port || "5432";
    const db    = url.pathname.replace("/", "");
    const user  = url.username;

    // Validate each component — no shell metacharacters
    const safe  = /^[a-zA-Z0-9_\-.]+$/;
    if (!safe.test(host) || !safe.test(port) || !safe.test(db) || !safe.test(user)) {
      throw new Error("Invalid characters in database connection params");
    }

    // outputFile is already path.resolve'd and validated above
    const safeOutput = outputFile.replace(/'/g, "");

    return `-h ${host} -p ${port} -U ${user} -d ${db} -f '${safeOutput}'`;
  } catch {
    throw new Error("Failed to parse DATABASE_URL for pg_dump");
  }
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
    logger.info("🧹 Idempotency cleanup job started", { jobId: job.id });

    const result = await pool.query(
      `DELETE FROM idempotency_keys WHERE expires_at < NOW() RETURNING id`
    );

    const deleted = result.rowCount ?? 0;
    logger.info("✅ Idempotency cleanup complete", { jobId: job.id, deleted });
    return { deleted };
  },
  { connection, concurrency: 1 }
);

// ── Worker Event Handlers ──────────────────────────────────

function attachWorkerEvents(worker: Worker, name: string) {
  worker.on("completed", (job) => {
    logger.info(`✅ [${name}] Job completed`, { jobId: job.id });
  });

  worker.on("failed", (job, err) => {
    logger.error(`❌ [${name}] Job failed`, {
      jobId:    job?.id,
      error:    err.message,
      attempts: job?.attemptsMade,
    });
  });

  worker.on("error", (err) => {
    logger.error(`💥 [${name}] Worker error`, { error: err.message });
  });
}

attachWorkerEvents(trustRecoveryWorker,      "trust-recovery");
attachWorkerEvents(backupWorker,             "database-backup");
attachWorkerEvents(idempotencyCleanupWorker, "idempotency-cleanup");

// ── Graceful Shutdown ──────────────────────────────────────

export async function closeWorkers(): Promise<void> {
  logger.info("🔄 Closing BullMQ workers...");
  await Promise.allSettled([
    trustRecoveryWorker.close(),
    backupWorker.close(),
    idempotencyCleanupWorker.close(),
  ]);
  logger.info("✅ BullMQ workers closed");
}
