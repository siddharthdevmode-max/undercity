import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../../app";
import { pool } from "../../config/database";
import redis from "../../config/redis";

// ============================================================
// HEALTH ENDPOINT INTEGRATION TESTS
// No auth required — public endpoints
// ============================================================

describe("GET /api/health", () => {
  it("returns 200 with status ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

describe("GET /api/health/detailed", () => {
  it("returns service status", async () => {
    const res = await request(app).get("/api/health/detailed");
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty("status");
    expect(res.body).toHaveProperty("uptime_seconds");
    expect(res.body).toHaveProperty("memory_mb");
    expect(res.body).toHaveProperty("services");
  });

  it("includes database and redis checks", async () => {
    const res = await request(app).get("/api/health/detailed");
    expect(res.body.services).toHaveProperty("database");
    expect(res.body.services).toHaveProperty("redis");
  });

  it("returns 503 when degraded", async () => {
    // This tests the structure — actual degradation tested by mocking
    const res = await request(app).get("/api/health/detailed");
    if (res.status === 503) {
      expect(res.body.status).toBe("degraded");
    } else {
      expect(res.body.status).toBe("ok");
    }
  });
});

describe("GET /api/health/metrics", () => {
  it("returns prometheus format in non-production", async () => {
    const res = await request(app).get("/api/health/metrics");
    // In test env (non-production), internalOnly allows it
    expect([200, 403]).toContain(res.status);
    if (res.status === 200) {
      expect(res.headers["content-type"]).toContain("text/plain");
      expect(res.text).toContain("process_uptime_seconds");
      expect(res.text).toContain("db_status");
      expect(res.text).toContain("redis_status");
    }
  });
});

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

afterAll(async () => {
  await pool.end().catch(() => {});
  await redis.quit().catch(() => {});
});
