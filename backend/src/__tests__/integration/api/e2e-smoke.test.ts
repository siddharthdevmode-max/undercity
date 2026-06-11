// ============================================================
// E2E SMOKE TEST — UNDERCITY
// Validates the full middleware stack boots and responds.
// Does not require DB/Redis — uses health endpoint + CORS
// to verify trackRequests, requestTimeout, security headers,
// rate limiter, error handler all wired correctly.
// ============================================================

import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import app from "../../../app";
import { pool } from "../../../config/database";
import redis from "../../../config/redis";

describe("E2E smoke — middleware stack", () => {
  it("responds with security headers (helmet)", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["referrer-policy"]).toMatch(/strict-origin/);
  });

  it("has CORS headers on cross-origin requests", async () => {
    const res = await request(app)
      .get("/api/health")
      .set("Origin", "http://localhost:3000");
    expect(res.headers["access-control-allow-origin"]).toBeDefined();
  });

  it("rejects disallowed origin", async () => {
    const res = await request(app)
      .get("/api/health")
      .set("Origin", "https://evil-site.com");
    expect(res.status).toBe(500);
  });

  it("includes X-Request-ID on every response", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-request-id"]).toBeDefined();
  });

  it("includes X-API-Version header", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-api-version"]).toBe("1");
  });

  it("returns JSON for all API routes", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["content-type"]).toContain("application/json");
  });

  it("404 handler returns JSON for unknown routes", async () => {
    const res = await request(app).get("/api/nonexistent-path");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("code", "NOT_FOUND");
  });

  it("global rate limiter returns 429 on rapid requests", async () => {
    // Use a non-existent path — returns 404 fast, no DB/Redis needed,
    // and goes through globalLimiter (which skips only /api/health).
    let limited = false;
    for (let i = 0; i < 120; i++) {
      const res = await request(app)
        .get("/api/nonexistent-rate-test")
        .set("X-Request-ID", `rl-e2e-${i}`);
      if (res.status === 429) { limited = true; break; }
    }
    // 120 requests against 100/60s limit — MUST trigger
    expect(limited).toBe(true);
  });
});

describe("E2E smoke — route wiring", () => {
  it("health routes respond 200", async () => {
    const [v1, noV1] = await Promise.all([
      request(app).get("/api/v1/health"),
      request(app).get("/api/health"),
    ]);
    expect(v1.status).toBe(200);
    expect(noV1.status).toBe(200);
  });

  it("auth routes respond without crashing", async () => {
    const res = await request(app).post("/api/v1/auth/sync");
    // 401 (no token) or 429 (rate limited) — both mean wired correctly
    expect([401, 429]).toContain(res.status);
  });

  it("crime routes respond without crashing", async () => {
    const res = await request(app).get("/api/v1/crimes");
    expect([200, 401, 429]).toContain(res.status);
  });

  it("bank routes respond without crashing", async () => {
    const res = await request(app).get("/api/v1/bank/balance");
    // auth middleware returns 401 (no token), error handler catches DB failures
    expect([200, 401, 429, 500]).toContain(res.status);
  });

  it("market routes respond without crashing", async () => {
    const res = await request(app).get("/api/v1/market/listings");
    // public route — error handler catches DB failures
    expect([200, 401, 429, 500]).toContain(res.status);
  });
});

afterAll(async () => {
  await pool.end().catch(() => {});
  await redis.quit().catch(() => {});
});
