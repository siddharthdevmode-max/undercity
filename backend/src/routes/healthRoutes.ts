import { Router } from "express";
import { pool } from "../config/database";
import redis from "../config/redis";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// ============================================================
// GET /api/health
// Basic health (for load balancers)
// ============================================================
router.get("/", (_req, res) => {
  res.json({ status: "ok" });
});

// ============================================================
// GET /api/health/detailed
// Deep system check (for monitoring)
// ============================================================
router.get("/detailed", asyncHandler(async (_req, res) => {
  const checks: Record<string, any> = {
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
    await pool.query("SELECT NOW()");
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

// ============================================================
// GET /api/health/metrics
// Prometheus-compatible metrics endpoint
// ============================================================
router.get("/metrics", asyncHandler(async (_req, res) => {
  const mem = process.memoryUsage();
  const uptime = process.uptime();

  let dbLatency = -1;
  let dbStatus = 0;
  try {
    const dbStart = Date.now();
    await pool.query("SELECT 1");
    dbLatency = Date.now() - dbStart;
    dbStatus = 1;
  } catch {
    dbStatus = 0;
  }

  let redisLatency = -1;
  let redisStatus = 0;
  try {
    const redisStart = Date.now();
    await redis.ping();
    redisLatency = Date.now() - redisStart;
    redisStatus = 1;
  } catch {
    redisStatus = 0;
  }

  const metrics = [
    "# HELP process_uptime_seconds Total uptime of the process",
    "# TYPE process_uptime_seconds counter",
    `process_uptime_seconds ${uptime.toFixed(2)}`,
    "# HELP process_heap_used_bytes Heap memory used",
    "# TYPE process_heap_used_bytes gauge",
    `process_heap_used_bytes ${mem.heapUsed}`,
    "# HELP process_heap_total_bytes Total heap memory",
    "# TYPE process_heap_total_bytes gauge",
    `process_heap_total_bytes ${mem.heapTotal}`,
    "# HELP process_rss_bytes Resident set size",
    "# TYPE process_rss_bytes gauge",
    `process_rss_bytes ${mem.rss}`,
    "# HELP db_status Database connection status (1=up, 0=down)",
    "# TYPE db_status gauge",
    `db_status ${dbStatus}`,
    "# HELP db_latency_ms Database query latency in milliseconds",
    "# TYPE db_latency_ms gauge",
    `db_latency_ms ${dbLatency}`,
    "# HELP db_pool_total Total connections in pool",
    "# TYPE db_pool_total gauge",
    `db_pool_total ${pool.totalCount}`,
    "# HELP db_pool_idle Idle connections in pool",
    "# TYPE db_pool_idle gauge",
    `db_pool_idle ${pool.idleCount}`,
    "# HELP db_pool_waiting Waiting connections in pool",
    "# TYPE db_pool_waiting gauge",
    `db_pool_waiting ${pool.waitingCount}`,
    "# HELP redis_status Redis connection status (1=up, 0=down)",
    "# TYPE redis_status gauge",
    `redis_status ${redisStatus}`,
    "# HELP redis_latency_ms Redis ping latency in milliseconds",
    "# TYPE redis_latency_ms gauge",
    `redis_latency_ms ${redisLatency}`,
  ].join("\n");

  res.setHeader("Content-Type", "text/plain; version=0.0.4");
  res.send(metrics + "\n");
}));

export default router;
