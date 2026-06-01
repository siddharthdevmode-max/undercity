import { pool } from "../config/database";

async function init() {
  const client = await pool.connect();
  try {
    console.log("🖐️  Creating device_fingerprints table...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS device_fingerprints (
        id SERIAL PRIMARY KEY,
        firebase_uid TEXT NOT NULL,
        fingerprint_hash TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        hit_count INTEGER DEFAULT 1,
        first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(firebase_uid, fingerprint_hash)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_fingerprint_hash 
      ON device_fingerprints(fingerprint_hash);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_fingerprint_uid 
      ON device_fingerprints(firebase_uid);
    `);

    console.log("✅ device_fingerprints table created with indexes");
  } catch (error: any) {
    console.error("❌ Fingerprint init failed:", error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

init();
