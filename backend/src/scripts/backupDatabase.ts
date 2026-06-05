import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import { logger } from "../utils/logger";
import { Alerts } from "../utils/alerts";

const execAsync = promisify(exec);

// ============================================================
// DATABASE BACKUP SCRIPT
// 1. pg_dump to local file
// 2. Upload to R2/S3 if configured
// 3. Clean up old local backups (keep 7)
// 4. Alert on success/failure
// ============================================================

const BACKUP_DIR      = path.join(process.cwd(), "backups");
const KEEP_LOCAL      = 7;
const R2_BUCKET       = process.env.R2_BUCKET_NAME;
const R2_ENDPOINT     = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY   = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_KEY   = process.env.R2_SECRET_ACCESS_KEY;

async function uploadToR2(localFile: string, filename: string): Promise<boolean> {
  if (!R2_BUCKET || !R2_ENDPOINT || !R2_ACCESS_KEY || !R2_SECRET_KEY) {
    logger.warn("⚠️  R2 credentials not configured — skipping remote backup");
    return false;
  }

  try {
    // Using AWS CLI with R2 endpoint
    const cmd = [
      `AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY}"`,
      `AWS_SECRET_ACCESS_KEY="${R2_SECRET_KEY}"`,
      `aws s3 cp "${localFile}"`,
      `s3://${R2_BUCKET}/backups/${filename}`,
      `--endpoint-url "${R2_ENDPOINT}"`,
      `--storage-class STANDARD`,
    ].join(" ");

    await execAsync(cmd);
    logger.info("☁️  Backup uploaded to R2", { filename });
    return true;
  } catch (error: unknown) {
    logger.error("❌ R2 upload failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

async function cleanOldBackups(): Promise<void> {
  if (!fs.existsSync(BACKUP_DIR)) return;

  const files = fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => ({
      name: f,
      path: path.join(BACKUP_DIR, f),
      time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.time - a.time);

  const toDelete = files.slice(KEEP_LOCAL);
  for (const file of toDelete) {
    fs.unlinkSync(file.path);
    logger.info("🗑️  Old backup deleted", { file: file.name });
  }
}

async function backup(): Promise<void> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename  = `undercity-${timestamp}.sql`;
  const localPath = path.join(BACKUP_DIR, filename);

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  logger.info("💾 Starting database backup...", { filename });

  try {
    // Run pg_dump
    await execAsync(`pg_dump "${dbUrl}" > "${localPath}"`);

    const stats    = fs.statSync(localPath);
    const sizeMb   = Math.round(stats.size / 1024 / 1024 * 100) / 100;
    const duration = Date.now() - startTime;

    logger.info("✅ Local backup complete", {
      filename,
      sizeMb,
      durationMs: duration,
    });

    // Upload to R2
    const uploaded = await uploadToR2(localPath, filename);

    // Clean old local files
    await cleanOldBackups();

    // Alert success
    Alerts.serverStarted(0, "backup-complete");
    logger.info("✅ Backup pipeline complete", {
      filename,
      sizeMb,
      uploadedToR2: uploaded,
      durationMs:   Date.now() - startTime,
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("❌ Backup failed", { error: msg });
    Alerts.honeypotTriggered("BACKUP_FAILED", filename, msg);

    // Clean up failed backup file
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }

    process.exit(1);
  }
}

void backup();
