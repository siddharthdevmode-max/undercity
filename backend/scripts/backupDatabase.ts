import * as fs from "fs";
import * as path from "path";
import crypto from "crypto";

const BACKUP_DIR = process.env.BACKUP_DIR ?? "./backups";
const MAX_BACKUPS = parseInt(process.env.MAX_BACKUPS ?? "7");

export async function backupDatabase(): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `undercity-db-backup-${timestamp}.sql`;
  const filepath = path.join(BACKUP_DIR, filename);

  console.log(`📦 Starting database backup...`);

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  try {
    const dbHost = process.env.DB_HOST ?? "localhost";
    const dbName = process.env.DB_NAME ?? "undercity";
    const dbUser = process.env.DB_USER ?? "postgres";

    // Set env for pg_dump
    const dumpEnv = { ...process.env, PGPASSWORD: process.env.DB_PASSWORD };

    const { execSync } = require("child_process");
    execSync(
      `pg_dump -h ${dbHost} -U ${dbUser} -F p -f ${filepath} ${dbName}`,
      { env: dumpEnv, stdio: "inherit" }
    );

    console.log(`✅ Backup created: ${filepath}`);
    cleanupOldBackups();
    generateChecksum(filepath);

    return filename;
  } catch (error) {
    console.error(`❌ Backup failed:`, error);
    throw error;
  }
}

function cleanupOldBackups(): void {
  const backups = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  while (backups.length > MAX_BACKUPS) {
    const oldest = backups.shift();
    if (oldest) {
      fs.unlinkSync(path.join(BACKUP_DIR, oldest));
      console.log(`🗑️  Deleted old backup: ${oldest}`);
    }
  }
}

function generateChecksum(filepath: string): void {
  const content = fs.readFileSync(filepath);
  const hash = crypto.createHash("sha256").update(content).digest("hex");
  fs.writeFileSync(`${filepath}.sha256`, hash);
  console.log(`🔐 Checksum saved: ${hash.substring(0, 16)}...`);
}

if (require.main === module) {
  backupDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
