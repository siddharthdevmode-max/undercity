// ============================================================
// TEST SCRIPT: Simulate crit fail to verify jail works
// Run: npx ts-node src/scripts/testCritFail.ts
// Sets first user's jail_until to 60 seconds from now.
// Reload the crimes page to see jail banner.
// ============================================================

import { pool } from "../config/database";

async function testJail(): Promise<void> {
  const client = await pool.connect();

  try {
    const userResult = await client.query(
      `SELECT id, username FROM users LIMIT 1`
    );

    if (userResult.rows.length === 0) {
      console.log("❌ No users found");
      return;
    }

    const user      = userResult.rows[0] as { id: number; username: string };
    const jailUntil = new Date(Date.now() + 60 * 1_000);

    await client.query(
      `UPDATE users SET jail_until = $1 WHERE id = $2`,
      [jailUntil, user.id]
    );

    console.log(`✅ User "${user.username}" jailed until ${jailUntil.toISOString()}`);
    console.log(`⏱️  Jail lasts 60 seconds — reload crimes page now`);
  } catch (error: unknown) {
    // FIX: error: unknown instead of error: any (TypeScript strict)
    console.error("❌ Error:", error instanceof Error ? error.message : String(error));
  } finally {
    client.release();
    await pool.end();
  }
}

void testJail();
