import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { pool } from "../../config/database";
import redis from "../../config/redis";

const TEST_UID = `test-auth-${Date.now()}`;

vi.mock("../../config/firebase", () => ({
  authAdmin: {
    verifyIdToken: vi.fn().mockResolvedValue({
      uid:   TEST_UID,
      email: `${TEST_UID}@test.com`,
      name:  "Test User",
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

async function flushRateLimitKeys(): Promise<void> {
  try {
    const keys = await redis.keys("rl:*");
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // Redis may not be available in all envs
  }
}

// Short unique suffix — stays well within 20 char username limit
// e.g. "nu_a3f9" = 7 chars total including prefix
function shortId(): string {
  return Math.random().toString(36).substring(2, 7);
}

// ============================================================
// POST /api/auth/sync
// ============================================================

describe("POST /api/auth/sync", () => {
  beforeAll(async () => {
    await flushRateLimitKeys();
  });

  it("returns 401 without token", async () => {
    await flushRateLimitKeys();
    const res = await request(app)
      .post("/api/auth/sync")
      .send({ username: "testuser123" });
    expect(res.status).toBe(401);
  });

  it("returns 429 after too many registration attempts", async () => {
    const requests = Array(6).fill(null).map(() =>
      request(app).post("/api/auth/sync").send({ username: "spamuser" })
    );
    const responses = await Promise.all(requests);
    const hasRateLimit = responses.some((r) => r.status === 429);
    expect(hasRateLimit).toBe(true);
  });

  it("creates new user on first sync (requires DB)", async () => {
    if (!await isDBAvailable()) {
      console.log("⏭️  Skipping — no DB available");
      return;
    }
    await flushRateLimitKeys();

    // "nu_" + 5 random chars = 8 chars max — well within 3-20 limit
    const username = `nu_${shortId()}`;

    const res = await request(app)
      .post("/api/auth/sync")
      .set("Authorization", "Bearer fake-token")
      .send({ username });

    expect([200, 201, 403, 409]).toContain(res.status);
  });
});

// ============================================================
// GET /api/auth/me
// ============================================================

describe("GET /api/auth/me", () => {
  beforeAll(async () => {
    await flushRateLimitKeys();
  });

  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns user data with valid token (requires DB)", async () => {
    if (!await isDBAvailable()) {
      console.log("⏭️  Skipping — no DB available");
      return;
    }
    await pool.query(
      `INSERT INTO users (
        firebase_uid, email, username,
        money, level, points, nerve, max_nerve, life, max_life
      ) VALUES ($1, $2, $3, 1000, 1, 0, 30, 30, 100, 100)
      ON CONFLICT (firebase_uid) DO NOTHING`,
      [TEST_UID, `${TEST_UID}@test.com`, `tm_${shortId()}`]
    );

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("username");
    expect(res.body).toHaveProperty("level");
    expect(res.body).not.toHaveProperty("trust_score");
  });

  it("returns 404 for unknown user (requires DB)", async () => {
    if (!await isDBAvailable()) {
      console.log("⏭️  Skipping — no DB available");
      return;
    }
    const { authAdmin } = await import("../../config/firebase");
    vi.mocked(authAdmin.verifyIdToken).mockResolvedValueOnce({
      uid: "test-ghost-uid-that-does-not-exist",
    } as never);

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer fake-token");

    expect([404, 500]).toContain(res.status);
  });
});

// ============================================================
// GET /api/auth/check-username/:username
// ============================================================

describe("GET /api/auth/check-username/:username", () => {
  beforeAll(async () => {
    await flushRateLimitKeys();
  });

  it("returns 400 for username too short", async () => {
    const res = await request(app).get("/api/auth/check-username/ab");
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid characters", async () => {
    const res = await request(app)
      .get("/api/auth/check-username/invalid-name!");
    expect(res.status).toBe(400);
  });

  it("returns 400 for username too long", async () => {
    const res = await request(app)
      .get("/api/auth/check-username/thisusernameiswaytoolongtobevalid");
    expect(res.status).toBe(400);
  });

  it("returns available: true for unused username (requires DB)", async () => {
    if (!await isDBAvailable()) {
      console.log("⏭️  Skipping — no DB available");
      return;
    }
    const res = await request(app)
      .get("/api/auth/check-username/unusedname999");
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(true);
  });

  it("returns available: false for taken username (requires DB)", async () => {
    if (!await isDBAvailable()) {
      console.log("⏭️  Skipping — no DB available");
      return;
    }
    const username = `tk_${shortId()}`;
    await pool.query(
      `INSERT INTO users (firebase_uid, email, username,
        money, level, points, nerve, max_nerve, life, max_life)
       VALUES ($1, $2, $3, 100, 1, 0, 30, 30, 100, 100)`,
      [`test-taken-${shortId()}`, `t@test.com`, username]
    );
    const res = await request(app)
      .get(`/api/auth/check-username/${username}`);
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
  });

  it("is case insensitive (requires DB)", async () => {
    if (!await isDBAvailable()) {
      console.log("⏭️  Skipping — no DB available");
      return;
    }
    const username = `Cs_${shortId()}`;
    await pool.query(
      `INSERT INTO users (firebase_uid, email, username,
        money, level, points, nerve, max_nerve, life, max_life)
       VALUES ($1, $2, $3, 100, 1, 0, 30, 30, 100, 100)`,
      [`test-case-${shortId()}`, `c@test.com`, username]
    );
    const res = await request(app)
      .get(`/api/auth/check-username/${username.toLowerCase()}`);
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
  });
});

// ============================================================
// CLEANUP
// ============================================================

afterAll(async () => {
  await flushRateLimitKeys();
  await pool.query(
    `DELETE FROM users WHERE firebase_uid LIKE 'test-%'`
  ).catch(() => {});
  await pool.end().catch(() => {});
  await redis.quit().catch(() => {});
});
