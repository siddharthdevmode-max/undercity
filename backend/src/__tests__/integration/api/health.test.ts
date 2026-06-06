// ============================================================
// HEALTH ENDPOINT TESTS — UNDERCITY
// Tests the health routes without requiring DB/Redis.
// All service checks degrade gracefully in test env.
// ============================================================

import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import app from "../../app";
import { pool } from "../../config/database";
import redis from "../../config/redis";

// ── GET /api/health ────────────────────────────────────────

describe("GET /api/health", () => {
  it("returns 200 with status ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("returns timestamp", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("timestamp");
    expect(typeof res.body.timestamp).toBe("string");
  });

  it("returns JSON", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["content-type"]).toContain("application/json");
  });
});

// ── GET /api/health/detailed ───────────────────────────────

describe("GET /api/health/detailed", () => {
  it("returns 200 or 503", async () => {
    const res = await request(app).get("/api/health/detailed");
    expect([200, 503]).toContain(res.status);
  });

  it("has required top-level fields", async () => {
    const res = await request(app).get("/api/health/detailed");
    expect(res.body).toHaveProperty("status");
    expect(res.body).toHaveProperty("uptime_seconds");
    expect(res.body).toHaveProperty("timestamp");
    expect(res.body).toHaveProperty("services");
  });

  it("status is one of ok | degraded | down", async () => {
    const res = await request(app).get("/api/health/detailed");
    expect(["ok", "degraded", "down"]).toContain(res.body.status);
  });

  it("includes database and redis checks", async () => {
    const res = await request(app).get("/api/health/detailed");
    expect(res.body.services).toHaveProperty("database");
    expect(res.body.services).toHaveProperty("redis");
  });

  it("database check has correct shape", async () => {
    const res = await request(app).get("/api/health/detailed");
    const db = res.body.services.database;
    expect(db).toHaveProperty("status");
    expect(db).toHaveProperty("latency_ms");
    expect(["connected", "error"]).toContain(db.status);
  });

  it("redis check has correct shape", async () => {
    const res = await request(app).get("/api/health/detailed");
    const r = res.body.services.redis;
    expect(r).toHaveProperty("status");
    expect(r).toHaveProperty("latency_ms");
    expect(["connected", "error"]).toContain(r.status);
  });

  it("503 status body says degraded or down", async () => {
    const res = await request(app).get("/api/health/detailed");
    if (res.status === 503) {
      expect(["degraded", "down"]).toContain(res.body.status);
    }
  });

  it("200 status body says ok", async () => {
    const res = await request(app).get("/api/health/detailed");
    if (res.status === 200) {
      expect(res.body.status).toBe("ok");
    }
  });
});

// ── GET /api/health/metrics ────────────────────────────────

describe("GET /api/health/metrics", () => {
  it("returns 200 or 403", async () => {
    const res = await request(app).get("/api/health/metrics");
    expect([200, 403]).toContain(res.status);
  });

  it("returns prometheus text format when accessible", async () => {
    const res = await request(app).get("/api/health/metrics");
    if (res.status === 200) {
      expect(res.headers["content-type"]).toContain("text/plain");
      expect(res.text).toContain("process_uptime_seconds");
      expect(res.text).toContain("db_up");
      expect(res.text).toContain("redis_up");
    }
  });
});

// ── 404 handler ───────────────────────────────────────────

describe("404 handler", () => {
  it("returns 404 for unknown routes", async () => {
    const res = await request(app).get("/api/nonexistent-route-xyz");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });

  it("returns JSON not HTML for 404", async () => {
    const res = await request(app).get("/api/totally-fake");
    expect(res.headers["content-type"]).toContain("application/json");
  });
});

// ── Cleanup ───────────────────────────────────────────────

afterAll(async () => {
  await pool.end().catch(() => {});
  await redis.quit().catch(() => {});
});
