// ============================================================
// HEALTH ROUTES — UNDERCITY
// GET /health          — simple liveness probe (no DB/Redis hit)
// GET /health/detailed — readiness probe with service checks
// GET /health/metrics  — Prometheus-format metrics (internal)
//
// Detailed + metrics endpoints are rate-limited and cached
// to prevent DoS via health check hammering.
// ============================================================

import { Router, Request, Response } from "express";
import { pool }          from "../config/database";
import redis             from "../config/redis";
import { getIO }         from "../config/socket";
import { asyncHandler }  from "../utils/asyncHandler";
import { internalOnly }  from "../middleware/internalOnly";
import { config }        from "../config";

const router = Router();

// ─── Config ───────────────────────────────────────────────

const DETAILED_CACHE_TTL_MS = 10_000;  // cache detailed check 10 seconds
const MEMORY_WARN_PERCENT   = 85;       // warn when heap > 85% of total

// ─── Cache ────────────────────────────────────────────────

interface DetailedCache {
  data:      Record<string, unknown>;
  timestamp: number;
}

let detailedCache: DetailedCache | null = null;

// ─── No-Cache Headers ─────────────────────────────────────

function setNoCacheHeaders(res: Response): void {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma",        "no-cache");
  res.setHeader("Expires",       "0");
}

// ─── Service Checks ───────────────────────────────────────

async function checkDatabase(): Promise<{
  status: "connected" | "error";
  latency_ms: number;
  pool_total: number;
  pool_idle: number;
  pool_waiting: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    await pool.query("SELECT 1");
    return {
      status:       "connected",
      latency_ms:   Date.now() - start,
      pool_total:   pool.totalCount,
      pool_idle:    pool.idleCount,
      pool_waiting: pool.waitingCount,
    };
  } catch (err) {
    return {
      status:       "error",
      latency_ms:   Date.now() - start,
      pool_total:   pool.totalCount,
      pool_idle:    pool.idleCount,
      pool_waiting: pool.waitingCount,
      error:        err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkRedis(): Promise<{
  status: "connected" | "error";
  latency_ms: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    const pong = await redis.ping();
    return {
      status:     pong === "PONG" ? "connected" : "error",
      latency_ms: Date.now() - start,
    };
  } catch (err) {
    return {
      status:     "error",
      latency_ms: Date.now() - start,
      error:      err instanceof Error ? err.message : String(err),
    };
  }
}

function checkMemory(): {
  status:         "ok" | "warning";
  heap_used_mb:   number;
  heap_total_mb:  number;
  rss_mb:         number;
  heap_percent:   number;
} {
  const mem         = process.memoryUsage();
  const heapUsedMb  = Math.round(mem.heapUsed  / 1024 / 1024);
  const heapTotalMb = Math.round(mem.heapTotal  / 1024 / 1024);
  const rssMb       = Math.round(mem.rss        / 1024 / 1024);
  const heapPercent = Math.round((mem.heapUsed / mem.heapTotal) * 100);

  return {
    status:        heapPercent >= MEMORY_WARN_PERCENT ? "warning" : "ok",
    heap_used_mb:  heapUsedMb,
    heap_total_mb: heapTotalMb,
    rss_mb:        rssMb,
    heap_percent:  heapPercent,
  };
}

function checkSockets(): {
  status:      "ok" | "unavailable";
  connections: number;
} {
  try {
    const io = getIO();
    return {
      status:      "ok",
      connections: io.sockets.sockets.size,
    };
  } catch {
    return { status: "unavailable", connections: 0 };
  }
}

// ─── Routes ───────────────────────────────────────────────

/**
 * GET /health
 * Liveness probe — no external dependencies checked.
 * Returns 200 if the process is running.
 */
router.get("/", (_req: Request, res: Response) => {
  setNoCacheHeaders(res);
  res.json({
    status:    "ok",
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /health/detailed
 * Readiness probe — checks DB, Redis, memory, and Socket.io.
 * Cached for 10 seconds to prevent hammering.
 * Returns 200 (ok) or 503 (degraded/down).
 */
router.get("/detailed", asyncHandler(async (_req, res) => {
  setNoCacheHeaders(res);

  // Serve cached result if fresh
  if (
    detailedCache &&
    Date.now() - detailedCache.timestamp < DETAILED_CACHE_TTL_MS
  ) {
    const cached = detailedCache.data;
    const httpStatus = cached.status === "ok" ? 200 : 503;
    res.status(httpStatus).json({ ...cached, _cached: true });
    return;
  }

  // Run all checks concurrently
  const [db, redisCheck, memory, sockets] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    Promise.resolve(checkMemory()),
    Promise.resolve(checkSockets()),
  ]);

  // Determine overall status
  let overallStatus: "ok" | "degraded" | "down" = "ok";

  if (db.status === "error" && redisCheck.status === "error") {
    overallStatus = "down";
  } else if (
    db.status    === "error" ||
    redisCheck.status === "error" ||
    memory.status === "warning"
  ) {
    overallStatus = "degraded";
  }

  const payload: Record<string, unknown> = {
    status:         overallStatus,
    uptime_seconds: Math.floor(process.uptime()),
    timestamp:      new Date().toISOString(),
    node_version:   process.version,
    environment:    config.nodeEnv,
    services: {
      database: db,
      redis:    redisCheck,
      memory,
      sockets,
    },
  };

  // Cache it
  detailedCache = { data: payload, timestamp: Date.now() };

  const httpStatus = overallStatus === "ok" ? 200 : 503;
  res.status(httpStatus).json(payload);
}));

/**
 * GET /health/metrics
 * Prometheus-format metrics — internal only.
 * Protected by internalOnly middleware.
 */
router.get("/metrics", internalOnly, asyncHandler(async (_req, res) => {
  // Use cached detailed check if available to avoid double DB/Redis hits
  const [db, redisCheck] = await Promise.all([
    checkDatabase(),
    checkRedis(),
  ]);

  const mem    = process.memoryUsage();
  const uptime = process.uptime();

  let socketCount = 0;
  try {
    socketCount = getIO().sockets.sockets.size;
  } catch { /* socket not ready */ }

  const lines = [
    // ── Process ──
    "# HELP process_uptime_seconds Server uptime in seconds",
    "# TYPE process_uptime_seconds counter",
    `process_uptime_seconds ${uptime.toFixed(2)}`,

    "# HELP process_heap_used_bytes Heap memory in use",
    "# TYPE process_heap_used_bytes gauge",
    `process_heap_used_bytes ${mem.heapUsed}`,

    "# HELP process_heap_total_bytes Total heap allocated",
    "# TYPE process_heap_total_bytes gauge",
    `process_heap_total_bytes ${mem.heapTotal}`,

    "# HELP process_rss_bytes Resident set size",
    "# TYPE process_rss_bytes gauge",
    `process_rss_bytes ${mem.rss}`,

    "# HELP process_external_bytes External memory",
    "# TYPE process_external_bytes gauge",
    `process_external_bytes ${mem.external}`,

    // ── Database ──
    "# HELP db_up Database reachable (1=yes 0=no)",
    "# TYPE db_up gauge",
    `db_up ${db.status === "connected" ? 1 : 0}`,

    "# HELP db_latency_ms Database query latency in ms",
    "# TYPE db_latency_ms gauge",
    `db_latency_ms ${db.latency_ms}`,

    "# HELP db_pool_total Total connections in pool",
    "# TYPE db_pool_total gauge",
    `db_pool_total ${db.pool_total}`,

    "# HELP db_pool_idle Idle connections in pool",
    "# TYPE db_pool_idle gauge",
    `db_pool_idle ${db.pool_idle}`,

    "# HELP db_pool_waiting Requests waiting for connection",
    "# TYPE db_pool_waiting gauge",
    `db_pool_waiting ${db.pool_waiting}`,

    // ── Redis ──
    "# HELP redis_up Redis reachable (1=yes 0=no)",
    "# TYPE redis_up gauge",
    `redis_up ${redisCheck.status === "connected" ? 1 : 0}`,

    "# HELP redis_latency_ms Redis ping latency in ms",
    "# TYPE redis_latency_ms gauge",
    `redis_latency_ms ${redisCheck.latency_ms}`,

    // ── Sockets ──
    "# HELP socket_connections Active Socket.io connections",
    "# TYPE socket_connections gauge",
    `socket_connections ${socketCount}`,
  ];

  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  setNoCacheHeaders(res);
  res.send(lines.join("\n") + "\n");
}));

export default router;
