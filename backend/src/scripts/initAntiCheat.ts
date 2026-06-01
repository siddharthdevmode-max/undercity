import { pool } from "../config/database";

async function initUAC() {
  const client = await pool.connect();
  try {
    console.log("🛡️  Initializing Undercity Anti-Cheat (UAC) Database...");

    // ─── Add UAC columns to users table ───
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS trust_score INTEGER DEFAULT 100,
      ADD COLUMN IF NOT EXISTS is_shadow_banned BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS is_hard_banned BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS last_flag_reason TEXT,
      ADD COLUMN IF NOT EXISTS last_flag_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS total_flags INTEGER DEFAULT 0;
    `);

    console.log("✅ User table updated with UAC columns");

    // ─── Create violations log table ───
    await client.query(`
      CREATE TABLE IF NOT EXISTS uac_violations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        firebase_uid TEXT,
        violation_type TEXT NOT NULL,
        severity INTEGER NOT NULL,
        details JSONB DEFAULT '{}'::jsonb,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("✅ uac_violations log table created");

    // ─── Create index for fast lookups ───
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_uac_violations_user 
      ON uac_violations(user_id, created_at DESC);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_trust_score 
      ON users(trust_score) WHERE trust_score < 70;
    `);

    console.log("✅ Indexes created");

    // ─── Verify columns exist ───
    const verify = await client.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('trust_score', 'is_shadow_banned', 'is_hard_banned', 'total_flags');
    `);

    console.log("\n📊 Anti-Cheat columns verified:");
    console.table(verify.rows);

    console.log("\n🛡️  UAC DATABASE READY. Phase 2 foundation complete.");
  } catch (error: any) {
    console.error("❌ UAC Init Failed:", error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

initUAC();
