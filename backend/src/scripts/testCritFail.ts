// ============================================================
// TEST SCRIPT: Simulate crit fail to verify jail works
// Run: npx ts-node src/scripts/testCritFail.ts
// This sets your jail_until to 60 seconds from now
// Reload the crimes page to see jail banner
// ============================================================

import { pool } from "../config/database";

async function testJail() {
  const client = await pool.connect();

  try {
    // Get first user
    const userResult = await client.query(
      `SELECT id, username FROM users LIMIT 1`
    );

    if (userResult.rows.length === 0) {
      console.log("❌ No users found");
      return;
    }

    const user = userResult.rows[0];
    const jailUntil = new Date(Date.now() + 60 * 1000); // 60 seconds from now

    await client.query(
      `UPDATE users SET jail_until = $1 WHERE id = $2`,
      [jailUntil, user.id]
    );

    console.log(`✅ User "${user.username}" jailed until ${jailUntil.toISOString()}`);
    console.log(`⏱️  Jail lasts 60 seconds — reload crimes page now`);
  } catch (error: any) {
    console.error("❌ Error:", error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

testJail();
