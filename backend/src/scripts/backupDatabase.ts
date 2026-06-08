import { execFile }  from "child_process";
import { promisify } from "util";
import path          from "path";
import fs            from "fs";
import { logger }    from "../utils/logger";
import { Alerts }    from "../utils/alerts";

// FIX: execFile instead of exec — no shell, no injection risk
const execFileAsync = promisify(execFile);

// ============================================================
// DATABASE BACKUP SCRIPT
// 1. pg_dump to local file (execFile — no shell injection)
// 2. Upload to R2/S3 if configured
// 3. Clean up old local backups (keep 7)
// 4. Alert on success/failure
// ============================================================

const BACKUP_DIR    = path.join(process.cwd(), "backups");
const KEEP_LOCAL    = 7;
const R2_BUCKET     = process.env.R2_BUCKET_NAME;
const R2_ENDPOINT   = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;

interface PgParts {
  host:     string;
  port:     string;
  db:       string;
  user:     string;
  password: string;
}

function parsePgUrl(dbUrl: string): PgParts {
  const url       = new URL(dbUrl);
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
    throw new Error("Invalid characters in DATABASE_URL connection params");
  }

  return { host, port, db, user, password: url.password || "" };
}

async function uploadToR2(localFile: string, filename: string): Promise<boolean> {
  if (!R2_BUCKET || !R2_ENDPOINT || !R2_ACCESS_KEY || !R2_SECRET_KEY) {
    logger.warn("⚠️  R2 credentials not configured — skipping remote backup");
    return false;
  }

  try {
    // FIX: execFile with array args — no shell
    await execFileAsync(
      "aws",
      [
        "s3", "cp",
        localFile,
        `s3://${R2_BUCKET}/backups/${filename}`,
        "--endpoint-url", R2_ENDPOINT,
        "--storage-class", "STANDARD",
      ],
      {
        env: {
          ...process.env,
          AWS_ACCESS_KEY_ID:     R2_ACCESS_KEY,
          AWS_SECRET_ACCESS_KEY: R2_SECRET_KEY,
        },
        timeout: 120_000,
      }
    );

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

  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => ({
      name: f,
      path: path.join(BACKUP_DIR, f),
      time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.time - a.time);

  for (const file of files.slice(KEEP_LOCAL)) {
    fs.unlinkSync(file.path);
    logger.info("🗑️  Old backup deleted", { file: file.name });
  }
}

async function backup(): Promise<void> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename  = `undercity-${timestamp}.sql`;
  const localPath = path.join(BACKUP_DIR, filename);

  // Path traversal guard
  if (!localPath.startsWith(BACKUP_DIR + path.sep)) {
    throw new Error("Path traversal detected in backup output path");
  }

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o750 });
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL environment variable is not set");

  logger.info("💾 Starting database backup...", { filename });

  try {
    const { host, port, db, user, password } = parsePgUrl(dbUrl);

    // FIX: execFile with array args — completely eliminates shell injection
    await execFileAsync(
      "pg_dump",
      [
        "-h", host,
        "-p", port,
        "-U", user,
        "-d", db,
        "-f", localPath,
        "--no-password",
      ],
      {
        env:       { ...process.env, PGPASSWORD: password },
        timeout:   300_000,
        maxBuffer: 100 * 1024 * 1024,
      }
    );

    const stats      = fs.statSync(localPath);
    const fileSizeKb = Math.round(stats.size / 1024);
    const durationMs = Date.now() - startTime;

    logger.info("✅ Local backup complete", { filename, fileSizeKb, durationMs });

    const uploaded = await uploadToR2(localPath, filename);
    await cleanOldBackups();

    Alerts.backupSucceeded(fileSizeKb, durationMs);

    logger.info("✅ Backup pipeline complete", {
      filename,
      fileSizeKb,
      uploadedToR2: uploaded,
      durationMs:   Date.now() - startTime,
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("❌ Backup failed", { error: msg });
    Alerts.backupFailed(msg);

    if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
    process.exit(1);
  }
}

void backup();
