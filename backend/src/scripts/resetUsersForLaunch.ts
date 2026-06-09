import { pool } from "../config/database";

async function main() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Find users to keep
    const keepResult = await client.query<{
      id: number;
      username: string;
      is_admin: boolean;
      is_developer: boolean;
    }>(`
      SELECT id, username, is_admin, is_developer
      FROM users
      WHERE COALESCE(is_admin, false) = true
         OR COALESCE(is_developer, false) = true
    `);

    const keepIds = keepResult.rows.map((r) => r.id);

    console.log("Keeping privileged users:");
    for (const row of keepResult.rows) {
      console.log(`- ${row.username} (id=${row.id}, admin=${row.is_admin}, developer=${row.is_developer})`);
    }

    // Delete dependent rows first for non-privileged users
    await client.query(`
      DELETE FROM user_crime_progress
      WHERE user_id IN (
        SELECT id
        FROM users
        WHERE COALESCE(is_admin, false) = false
          AND COALESCE(is_developer, false) = false
      )
    `).catch(() => {});

    await client.query(`
      DELETE FROM uac_violations
      WHERE firebase_uid IN (
        SELECT firebase_uid
        FROM users
        WHERE COALESCE(is_admin, false) = false
          AND COALESCE(is_developer, false) = false
      )
    `).catch(() => {});

    await client.query(`
      DELETE FROM device_fingerprints
      WHERE firebase_uid IN (
        SELECT firebase_uid
        FROM users
        WHERE COALESCE(is_admin, false) = false
          AND COALESCE(is_developer, false) = false
      )
    `).catch(() => {});

    await client.query(`
      DELETE FROM auth_access_log
      WHERE firebase_uid IN (
        SELECT firebase_uid
        FROM users
        WHERE COALESCE(is_admin, false) = false
          AND COALESCE(is_developer, false) = false
      )
    `).catch(() => {});

    // Delete the actual users
    const deleteResult = await client.query(`
      DELETE FROM users
      WHERE COALESCE(is_admin, false) = false
        AND COALESCE(is_developer, false) = false
      RETURNING id, username
    `);

    await client.query("COMMIT");

    console.log(`Deleted ${deleteResult.rowCount ?? 0} non-privileged users:`);
    for (const row of deleteResult.rows) {
      console.log(`- ${row.username} (id=${row.id})`);
    }

    console.log("✅ Local DB cleaned for launch.");
    console.log(`✅ Preserved ${keepIds.length} admin/developer account(s).`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Failed to reset users for launch:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

void main();
