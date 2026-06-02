/// <reference types="node" />
import "dotenv/config";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);

// ============================================================
// DATABASE BACKUP SCRIPT
// Creates timestamped pg_dump backups
// Keeps last 7 days, deletes older
// Run via cron: 0 3 * * * (3am daily)
// ============================================================

async function backup() {
  const BACKUP_DIR = path.resolve(__dirname, "../../backups");
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL not set");
    process.exit(1);
  }

  // Ensure backup directory exists
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = path.join(BACKUP_DIR, `undercity-${timestamp}.sql`);

  console.log(`📦 Starting backup → ${backupFile}`);

  try {
    await execAsync(`pg_dump "${DATABASE_URL}" > "${backupFile}"`);
    const stats = fs.statSync(backupFile);
    const sizeMb = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`✅ Backup complete: ${sizeMb} MB`);

    // Cleanup old backups (keep last 7 days)
    const files = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith("undercity-") && f.endsWith(".sql"))
      .map((f) => ({
        name: f,
        path: path.join(BACKUP_DIR, f),
        time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time);

    const toDelete = files.slice(7);
    for (const f of toDelete) {
      fs.unlinkSync(f.path);
      console.log(`🗑️  Deleted old backup: ${f.name}`);
    }

    console.log(`✅ Total backups retained: ${Math.min(files.length, 7)}`);
  } catch (error: any) {
    console.error(`❌ Backup failed: ${error.message}`);
    process.exit(1);
  }
}

backup();
