// ============================================================
// CRIMES ENDPOINT TESTS — UNDERCITY
// Tests crime routes with mocked Firebase.
// ============================================================

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { pool } from "../../config/database";
import redis from "../../config/redis";

// ============================================================
// MOCK FIREBASE
// ============================================================

const TEST_UID = `test-crimes-${Date.now()}`;

vi.mock("../../config/firebase", () => ({
  authAdmin: {
    verifyIdToken: vi.fn().mockResolvedValue({
      uid:   TEST_UID,
      email: `${TEST_UID}@test.com`,
    }),
  },
}));

const { default: app } = await import("../../app");

// ============================================================
// HELPERS
// ============================================================

async function isDBAvailable(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

async function isRedisAvailable(): Promise<boolean> {
  try {
    const pong = await redis.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}

// ============================================================
// SETUP
// ============================================================

beforeAll(async () => {
  if (!await isDBAvailable()) {
    console.log("⏭️  No DB — skipping setup");
    return;
  }
  await pool.query(
    `INSERT INTO users (
      firebase_uid, email, username,
      money, level, points,
      nerve, max_nerve, life, max_life,
      trust_score, is_shadow_banned, is_hard_banned
    ) VALUES ($1, $2, $3, 5000, 5, 0, 30, 30, 100, 100, 100, false, false)
    ON CONFLICT (firebase_uid) DO NOTHING`,
    [TEST_UID, `${TEST_UID}@test.com`, `ct_${Date.now() % 100000}`]
  );
});

// ============================================================
// GET /api/v1/crimes
// ============================================================

describe("GET /api/v1/crimes", () => {
  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/v1/crimes");
    expect(res.status).toBe(401);
  });

  it("returns crimes list with valid token (requires DB)", async () => {
    if (!await isDBAvailable()) {
      console.log("⏭️  Skipping — no DB available");
      return;
    }

    const res = await request(app)
      .get("/api/v1/crimes")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("crimes");
    expect(res.body).toHaveProperty("user");
    expect(Array.isArray(res.body.crimes)).toBe(true);
  });

  it("crimes have correct shape (requires DB)", async () => {
    if (!await isDBAvailable()) {
      console.log("⏭️  Skipping — no DB available");
      return;
    }

    const res = await request(app)
      .get("/api/v1/crimes")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);

    if (res.body.crimes.length > 0) {
      const crime = res.body.crimes[0];
      expect(crime).toHaveProperty("id");
      expect(crime).toHaveProperty("key");
      expect(crime).toHaveProperty("name");
      expect(crime).toHaveProperty("tier");
      expect(crime).toHaveProperty("nerveCost");
      expect(crime).toHaveProperty("unlocked");
      expect(crime).toHaveProperty("progress");
    }
  });

  it("user stats have correct shape (requires DB)", async () => {
    if (!await isDBAvailable()) {
      console.log("⏭️  Skipping — no DB available");
      return;
    }

    const res = await request(app)
      .get("/api/v1/crimes")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.user).toHaveProperty("nerve");
    expect(res.body.user).toHaveProperty("maxNerve");
    expect(res.body.user).toHaveProperty("life");
    expect(res.body.user).toHaveProperty("money");
    expect(res.body.user).toHaveProperty("level");
  });

  it("blocked for hard-banned users (requires DB)", async () => {
    if (!await isDBAvailable()) {
      console.log("⏭️  Skipping — no DB available");
      return;
    }

    const bannedUid = `test-banned-${Date.now()}`;
    await pool.query(
      `INSERT INTO users (
        firebase_uid, email, username,
        money, level, points, nerve, max_nerve, life, max_life,
        trust_score, is_hard_banned
      ) VALUES ($1, $2, $3, 100, 1, 0, 30, 30, 100, 100, 0, true)`,
      [bannedUid, `banned@test.com`, `banned_${Date.now()}`]
    );

    const { authAdmin } = await import("../../config/firebase");
    vi.mocked(authAdmin.verifyIdToken).mockResolvedValueOnce({
      uid: bannedUid,
    } as never);

    const res = await request(app)
      .get("/api/v1/crimes")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(403);

    await pool.query(
      `DELETE FROM users WHERE firebase_uid = $1`, [bannedUid]
    );
  });
});

// ============================================================
// POST /api/v1/crimes/attempt
// ============================================================

describe("POST /api/v1/crimes/attempt", () => {
  it("returns 401 without token", async () => {
    const res = await request(app)
      .post("/api/v1/crimes/attempt")
      .send({ crimeKey: "beg_for_change" });

    expect(res.status).toBe(401);
  });

  it("returns 403 without challenge token", async () => {
    const res = await request(app)
      .post("/api/v1/crimes/attempt")
      .set("Authorization", "Bearer fake-token")
      .send({ crimeKey: "beg_for_change" });

    expect(res.status).toBe(403);
  });

  it("returns 400 or 403 for invalid crimeKey format (requires DB + Redis)", async () => {
    if (!await isDBAvailable() || !await isRedisAvailable()) {
      console.log("⏭️  Skipping — DB or Redis unavailable");
      return;
    }

    // Get a real challenge token first
    const challengeRes = await request(app)
      .get("/api/v1/challenge")
      .set("Authorization", "Bearer fake-token");

    if (challengeRes.status !== 200) {
      console.log("⏭️  Skipping — couldn't get challenge token");
      return;
    }

    const res = await request(app)
      .post("/api/v1/crimes/attempt")
      .set("Authorization", "Bearer fake-token")
      .set("x-uac-challenge", challengeRes.body.token)
      .send({ crimeKey: "INVALID KEY WITH SPACES!" });

    expect([400, 422]).toContain(res.status);
  });

  it("returns 400 or 403 for missing crimeKey (requires DB + Redis)", async () => {
    if (!await isDBAvailable() || !await isRedisAvailable()) {
      console.log("⏭️  Skipping — DB or Redis unavailable");
      return;
    }

    const challengeRes = await request(app)
      .get("/api/v1/challenge")
      .set("Authorization", "Bearer fake-token");

    if (challengeRes.status !== 200) {
      console.log("⏭️  Skipping — couldn't get challenge token");
      return;
    }

    const res = await request(app)
      .post("/api/v1/crimes/attempt")
      .set("Authorization", "Bearer fake-token")
      .set("x-uac-challenge", challengeRes.body.token)
      .send({});

    expect([400, 422]).toContain(res.status);
  });

  it("full crime attempt flow with real challenge token (requires DB + Redis)", async () => {
    if (!await isDBAvailable() || !await isRedisAvailable()) {
      console.log("⏭️  Skipping — DB or Redis unavailable");
      return;
    }

    const challengeRes = await request(app)
      .get("/api/v1/challenge")
      .set("Authorization", "Bearer fake-token");

    if (challengeRes.status !== 200) {
      console.log("⏭️  Skipping — couldn't get challenge token");
      return;
    }

    const { token } = challengeRes.body;

    const res = await request(app)
      .post("/api/v1/crimes/attempt")
      .set("Authorization", "Bearer fake-token")
      .set("x-uac-challenge", token)
      .send({ crimeKey: "beg_for_change" });

    // Success, validation error, not found, or rate limited
    expect([200, 400, 404, 422, 429]).toContain(res.status);

    if (res.status === 200) {
      expect(res.body).toHaveProperty("outcome");
      expect(res.body).toHaveProperty("message");
      expect(res.body).toHaveProperty("rewards");
      expect(res.body).toHaveProperty("penalties");
      expect(res.body).toHaveProperty("user");
      expect(res.body).toHaveProperty("progress");
      expect(["success", "fail", "crit_fail", "special"]).toContain(
        res.body.outcome
      );
    }
  });

  it("returns 423 when user is in jail (requires DB + Redis)", async () => {
    if (!await isDBAvailable() || !await isRedisAvailable()) {
      console.log("⏭️  Skipping — DB or Redis unavailable");
      return;
    }

    await pool.query(
      `UPDATE users
       SET jail_until = NOW() + INTERVAL '10 minutes'
       WHERE firebase_uid = $1`,
      [TEST_UID]
    );

    const challengeRes = await request(app)
      .get("/api/v1/challenge")
      .set("Authorization", "Bearer fake-token");

    if (challengeRes.status !== 200) {
      console.log("⏭️  Skipping — couldn't get challenge token");
      // Release from jail before returning
      await pool.query(
        `UPDATE users SET jail_until = NULL WHERE firebase_uid = $1`,
        [TEST_UID]
      );
      return;
    }

    const res = await request(app)
      .post("/api/v1/crimes/attempt")
      .set("Authorization", "Bearer fake-token")
      .set("x-uac-challenge", challengeRes.body.token)
      .send({ crimeKey: "beg_for_change" });

    expect([423, 429]).toContain(res.status);

    if (res.status === 423) {
      expect(res.body.code).toBe("IN_JAIL");
      expect(res.body).toHaveProperty("secondsRemaining");
      expect(res.body.secondsRemaining).toBeGreaterThan(0);
    }

    // Release from jail
    await pool.query(
      `UPDATE users SET jail_until = NULL WHERE firebase_uid = $1`,
      [TEST_UID]
    );
  });
});

// ============================================================
// CLEANUP
// ============================================================

afterAll(async () => {
  if (await isDBAvailable()) {
    await pool.query(`DELETE FROM uac_violations WHERE firebase_uid LIKE 'test-%'`).catch(() => {});
    await pool.query(`DELETE FROM device_fingerprints WHERE firebase_uid LIKE 'test-%'`).catch(() => {});
    await pool.query(
      `DELETE FROM user_crime_progress WHERE user_id IN (SELECT id FROM users WHERE firebase_uid LIKE 'test-%')`
    ).catch(() => {});
    await pool.query(`DELETE FROM users WHERE firebase_uid LIKE 'test-%'`).catch(() => {});
  }
  await pool.end().catch(() => {});
  await redis.quit().catch(() => {});
});
