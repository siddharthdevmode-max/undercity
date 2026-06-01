import { Router } from "express";
import { pool } from "../config/database";
import redis from "../config/redis";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// ============================================================
// GET /api/health
// Basic health (for load balancers)
// ============================================================
router.get("/", (req, res) => {
  res.json({ status: "ok" });
});

// ============================================================
// GET /api/health/detailed
// Deep system check (for monitoring)
// ============================================================
router.get("/detailed", asyncHandler(async (req, res) => {
  const checks: any = {
    status: "ok",
    uptime_seconds: Math.floor(process.uptime()),
    memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    node_version: process.version,
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    services: {},
  };

  // Check Postgres
  try {
    const dbStart = Date.now();
    const dbResult = await pool.query("SELECT NOW(), version()");
    checks.services.database = {
      status: "connected",
      latency_ms: Date.now() - dbStart,
      pool_total: pool.totalCount,
      pool_idle: pool.idleCount,
      pool_waiting: pool.waitingCount,
    };
  } catch (error: any) {
    checks.status = "degraded";
    checks.services.database = { status: "error", message: error.message };
  }

  // Check Redis
  try {
    const redisStart = Date.now();
    const pong = await redis.ping();
    checks.services.redis = {
      status: pong === "PONG" ? "connected" : "error",
      latency_ms: Date.now() - redisStart,
    };
  } catch (error: any) {
    checks.status = "degraded";
    checks.services.redis = { status: "error", message: error.message };
  }

  const statusCode = checks.status === "ok" ? 200 : 503;
  res.status(statusCode).json(checks);
}));

export default router;
