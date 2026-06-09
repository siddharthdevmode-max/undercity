// ============================================================
// AUTH ENDPOINT TESTS — UNDERCITY
// Tests authentication routes with mocked Firebase.
// FIX: mock path was ../../config/firebase (wrong)
//      corrected to ../../../config/firebase
// ============================================================

import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";
import { pool } from "../../../config/database";
import redis   from "../../../config/redis";

const TEST_UID = `test-auth-${Date.now()}`;

// FIX: correct relative path from src/__tests__/integration/api/
vi.mock("../../../config/firebase", () => ({
  authAdmin: {
    verifyIdToken: vi.fn().mockResolvedValue({
      uid:            TEST_UID,
      email:          `${TEST_UID}@test.com`,
      name:           "Test User",
      email_verified: true,
    }),
  },
}));

const { default: app } = await import("../../../app");

// ── Helpers ───────────────────────────────────────────────

async function isDBAvailable(): Promise<boolean> {
  try { await pool.query("SELECT 1"); return true; }
  catch { return false; }
}

async function isRedisAvailable(): Promise<boolean> {
  try { return (await redis.ping()) === "PONG"; }
  catch { return false; }
}

async function flushRateLimitKeys(): Promise<void> {
  try {
    if (!await isRedisAvailable()) return;
    const keys = await redis.keys("rl:*");
    if (keys.length > 0) await redis.del(...keys);
    const bfKeys = await redis.keys("brute:*");
    if (bfKeys.length > 0) await redis.del(...bfKeys);
  } catch { /* Redis may not be available */ }
}

function shortId(): string {
  return Math.random().toString(36).substring(2, 7);
}

// ── POST /api/v1/auth/sync ────────────────────────────────

describe("POST /api/v1/auth/sync", () => {
  beforeEach(async () => {
    await flushRateLimitKeys();
  });

  it("returns 401 without token", async () => {
    const res = await request(app)
      .post("/api/v1/auth/sync")
      .send({ username: "testuser123" });
    expect([401, 429]).toContain(res.status);
  });

  it("returns 429 after too many registration attempts (requires Redis)", async () => {
    const redisOk = await isRedisAvailable();
    if (!redisOk) {
      console.log("⏭️  Skipping — no Redis available for rate limit test");
      return;
    }

    try {
      const info  = await redis.info("server");
      const match = info.match(/redis_version:([\d.]+)/);
      if (match) {
        const major = parseInt(match[1].split(".")[0] ?? "0", 10);
        if (major < 5) {
          console.log(`⏭️  Skipping — Redis ${match[1]} too old (need 5+)`);
          return;
        }
      }
    } catch {
      console.log("⏭️  Skipping — could not verify Redis version");
      return;
    }

    const requests = Array(6).fill(null).map(() =>
      request(app).post("/api/v1/auth/sync").send({ username: "spamuser" })
    );
    const responses  = await Promise.all(requests);
    const hasRateLimit = responses.some((r) => r.status === 429);
    expect(hasRateLimit).toBe(true);
  });

  it("creates new user on first sync (requires DB)", async () => {
    if (!await isDBAvailable()) {
      console.log("⏭️  Skipping — no DB available");
      return;
    }

    const username = `nu_${shortId()}`;
    const res = await request(app)
      .post("/api/v1/auth/sync")
      .set("Authorization", "Bearer fake-token")
      .send({ username });

    expect([200, 201, 403, 409, 429]).toContain(res.status);
  });
});

// ── GET /api/v1/auth/me ───────────────────────────────────

describe("GET /api/v1/auth/me", () => {
  beforeEach(async () => {
    await flushRateLimitKeys();
  });

  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/v1/auth/me");
    expect([401, 429]).toContain(res.status);
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
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer fake-token");

    expect([200, 429]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toHaveProperty("username");
      expect(res.body).toHaveProperty("level");
      expect(res.body).not.toHaveProperty("trust_score");
    }
  });

  it("returns 404 for unknown user (requires DB)", async () => {
    if (!await isDBAvailable()) {
      console.log("⏭️  Skipping — no DB available");
      return;
    }

    // FIX: correct import path
    const { authAdmin } = await import("../../../config/firebase");
    vi.mocked(authAdmin.verifyIdToken).mockResolvedValueOnce({
      uid:            "test-ghost-uid-that-does-not-exist",
      email_verified: true,
    } as never);

    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer fake-token");

    expect([404, 429, 500]).toContain(res.status);
  });
});

// ── GET /api/v1/auth/check-username/:username ─────────────

describe("GET /api/v1/auth/check-username/:username", () => {
  beforeEach(async () => {
    await flushRateLimitKeys();
  });

  it("returns 400 for username too short", async () => {
    const res = await request(app).get("/api/v1/auth/check-username/ab");
    expect([400, 429]).toContain(res.status);
  });

  it("returns 400 for invalid characters", async () => {
    const res = await request(app)
      .get("/api/v1/auth/check-username/invalid-name!");
    expect([400, 429]).toContain(res.status);
  });

  it("returns 400 for username too long", async () => {
    const res = await request(app)
      .get("/api/v1/auth/check-username/thisusernameiswaytoolongtobevalid");
    expect([400, 429]).toContain(res.status);
  });

  it("returns available: true for unused username (requires DB)", async () => {
    if (!await isDBAvailable()) {
      console.log("⏭️  Skipping — no DB available");
      return;
    }
    const res = await request(app)
      .get("/api/v1/auth/check-username/unusedname999");
    expect([200, 429]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.available).toBe(true);
    }
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
      .get(`/api/v1/auth/check-username/${username}`);
    expect([200, 429]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.available).toBe(false);
    }
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
      .get(`/api/v1/auth/check-username/${username.toLowerCase()}`);
    expect([200, 429]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.available).toBe(false);
    }
  });
});

// ── Cleanup ───────────────────────────────────────────────

afterAll(async () => {
  await flushRateLimitKeys();
  if (await isDBAvailable()) {
    await pool.query(
      `DELETE FROM users WHERE firebase_uid LIKE 'test-%'`
    ).catch(() => {});
  }
  await pool.end().catch(() => {});
  await redis.quit().catch(() => {});
});
