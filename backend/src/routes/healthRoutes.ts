import { Router } from "express";
import { pool } from "../config/database";
import redis from "../config/redis";
import { asyncHandler } from "../utils/asyncHandler";
import { internalOnly } from "../middleware/internalOnly";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ status: "ok" });
});

router.get("/detailed", asyncHandler(async (_req, res) => {
  const services: Record<string, unknown> = {};
  let status = "ok";

  try {
    const dbStart = Date.now();
    await pool.query("SELECT NOW()");
    services.database = {
      status:       "connected",
      latency_ms:   Date.now() - dbStart,
      pool_total:   pool.totalCount,
      pool_idle:    pool.idleCount,
      pool_waiting: pool.waitingCount,
    };
  } catch (error: unknown) {
    status = "degraded";
    services.database = {
      status:  "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  try {
    const redisStart = Date.now();
    const pong = await redis.ping();
    services.redis = {
      status:     pong === "PONG" ? "connected" : "error",
      latency_ms: Date.now() - redisStart,
    };
  } catch (error: unknown) {
    status = "degraded";
    services.redis = {
      status:  "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  const checks = {
    status,
    uptime_seconds: Math.floor(process.uptime()),
    memory_mb:      Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    node_version:   process.version,
    environment:    process.env.NODE_ENV,
    timestamp:      new Date().toISOString(),
    services,
  };

  res.status(checks.status === "ok" ? 200 : 503).json(checks);
}));

router.get("/metrics", internalOnly, asyncHandler(async (_req, res) => {
  const mem    = process.memoryUsage();
  const uptime = process.uptime();

  let dbLatency = -1;
  let dbStatus  = 0;
  try {
    const dbStart = Date.now();
    await pool.query("SELECT 1");
    dbLatency = Date.now() - dbStart;
    dbStatus  = 1;
  } catch { /* dbStatus stays 0 */ }

  let redisLatency = -1;
  let redisStatus  = 0;
  try {
    const redisStart = Date.now();
    await redis.ping();
    redisLatency = Date.now() - redisStart;
    redisStatus  = 1;
  } catch { /* redisStatus stays 0 */ }

  const metrics = [
    "# HELP process_uptime_seconds Total uptime",
    "# TYPE process_uptime_seconds counter",
    `process_uptime_seconds ${uptime.toFixed(2)}`,
    "# HELP process_heap_used_bytes Heap used",
    "# TYPE process_heap_used_bytes gauge",
    `process_heap_used_bytes ${mem.heapUsed}`,
    "# HELP process_heap_total_bytes Heap total",
    "# TYPE process_heap_total_bytes gauge",
    `process_heap_total_bytes ${mem.heapTotal}`,
    "# HELP process_rss_bytes RSS",
    "# TYPE process_rss_bytes gauge",
    `process_rss_bytes ${mem.rss}`,
    "# HELP db_status DB status (1=up 0=down)",
    "# TYPE db_status gauge",
    `db_status ${dbStatus}`,
    "# HELP db_latency_ms DB latency",
    "# TYPE db_latency_ms gauge",
    `db_latency_ms ${dbLatency}`,
    "# HELP db_pool_total Total pool connections",
    "# TYPE db_pool_total gauge",
    `db_pool_total ${pool.totalCount}`,
    "# HELP db_pool_idle Idle pool connections",
    "# TYPE db_pool_idle gauge",
    `db_pool_idle ${pool.idleCount}`,
    "# HELP db_pool_waiting Waiting pool connections",
    "# TYPE db_pool_waiting gauge",
    `db_pool_waiting ${pool.waitingCount}`,
    "# HELP redis_status Redis status (1=up 0=down)",
    "# TYPE redis_status gauge",
    `redis_status ${redisStatus}`,
    "# HELP redis_latency_ms Redis latency",
    "# TYPE redis_latency_ms gauge",
    `redis_latency_ms ${redisLatency}`,
  ].join("\n");

  res.setHeader("Content-Type", "text/plain; version=0.0.4");
  res.send(metrics + "\n");
}));

export default router;
