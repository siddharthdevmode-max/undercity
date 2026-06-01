// ============================================================
// MIGRATION: Add last_crime_at column to users table
// Also ensures nerve, max_nerve, life, max_life columns exist
// Run once: npx ts-node src/scripts/addLastCrimeAt.ts
// ============================================================

import { pool } from "../config/database";

async function migrate() {
  const client = await pool.connect();

  try {
    console.log("🔧 Starting migration...\n");

    // Add last_crime_at if it doesn't exist
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS last_crime_at TIMESTAMPTZ DEFAULT NULL
    `);
    console.log("✅ Added last_crime_at column");

    // Ensure nerve columns exist with defaults
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS nerve INTEGER DEFAULT 30
    `);
    console.log("✅ Ensured nerve column exists (default 30)");

    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS max_nerve INTEGER DEFAULT 30
    `);
    console.log("✅ Ensured max_nerve column exists (default 30)");

    // Ensure life columns exist with defaults
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS life INTEGER DEFAULT 100
    `);
    console.log("✅ Ensured life column exists (default 100)");

    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS max_life INTEGER DEFAULT 100
    `);
    console.log("✅ Ensured max_life column exists (default 100)");

    // Ensure points column exists
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0
    `);
    console.log("✅ Ensured points column exists (default 0)");

    // Ensure jail columns exist
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS jail_until TIMESTAMPTZ DEFAULT NULL
    `);
    console.log("✅ Ensured jail_until column exists");

    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS federal_jail_until TIMESTAMPTZ DEFAULT NULL
    `);
    console.log("✅ Ensured federal_jail_until column exists");

    // Update any existing users that have NULL nerve/life to defaults
    await client.query(`
      UPDATE users
      SET
        nerve = COALESCE(nerve, 30),
        max_nerve = COALESCE(max_nerve, 30),
        life = COALESCE(life, 100),
        max_life = COALESCE(max_life, 100),
        points = COALESCE(points, 0)
      WHERE nerve IS NULL
         OR max_nerve IS NULL
         OR life IS NULL
         OR max_life IS NULL
         OR points IS NULL
    `);
    console.log("✅ Backfilled NULL values for existing users");

    console.log("\n🎉 Migration complete!");
  } catch (error: any) {
    console.error("❌ Migration failed:", error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
