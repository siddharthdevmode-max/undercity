// ============================================================
// HEALTH ROUTES — UNDERCITY
// GET /health          — liveness probe (no DB/Redis)
// GET /health/detailed — readiness probe with service checks
// GET /health/metrics  — Prometheus metrics (internal only)
// ============================================================

import { Router, Request, Response } from "express";
import { pool, getPoolStats } from "../config/database";
import { redis }        from "../config/redis";
import { getIO }        from "../config/socket";
import { asyncHandler } from "../utils/asyncHandler";
import { internalOnly } from "../middleware/internalOnly";
import { noCache }      from "../middleware/cacheHeaders";
import { config }       from "../config";

const router = Router();

const DETAILED_CACHE_TTL_MS = 10_000;
const MEMORY_WARN_PERCENT   = 85;

interface DetailedCache {
  data:      Record<string, unknown>;
  timestamp: number;
}

let detailedCache: DetailedCache | null = null;

async function checkDatabase(): Promise<{
  status:       "connected" | "error";
  latency_ms:   number;
  pools:        ReturnType<typeof getPoolStats>;
  error?:       string;
}> {
  const start = Date.now();
  try {
    await pool.query("SELECT 1");
    return {
      status:     "connected",
      latency_ms: Date.now() - start,
      pools:      getPoolStats(),
    };
  } catch (err) {
    return {
      status:     "error",
      latency_ms: Date.now() - start,
      pools:      getPoolStats(),
      error:      err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkRedis(): Promise<{
  status:     "connected" | "error";
  latency_ms: number;
  error?:     string;
}> {
  const start = Date.now();
  try {
    const pong = await redis.ping();
    return { status: pong === "PONG" ? "connected" : "error", latency_ms: Date.now() - start };
  } catch (err) {
    return {
      status:     "error",
      latency_ms: Date.now() - start,
      error:      err instanceof Error ? err.message : String(err),
    };
  }
}

function checkMemory() {
  const mem         = process.memoryUsage();
  const heapUsedMb  = Math.round(mem.heapUsed  / 1024 / 1024);
  const heapTotalMb = Math.round(mem.heapTotal  / 1024 / 1024);
  const rssMb       = Math.round(mem.rss        / 1024 / 1024);
  const heapPercent = Math.round((mem.heapUsed  / mem.heapTotal) * 100);
  return {
    status:        heapPercent >= MEMORY_WARN_PERCENT ? "warning" as const : "ok" as const,
    heap_used_mb:  heapUsedMb,
    heap_total_mb: heapTotalMb,
    rss_mb:        rssMb,
    heap_percent:  heapPercent,
  };
}

function checkSockets() {
  try {
    const io = getIO();
    return { status: "ok" as const, connections: io.sockets.sockets.size };
  } catch {
    return { status: "unavailable" as const, connections: 0 };
  }
}

// ── GET /health ───────────────────────────────────────────

router.get("/", noCache, (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── GET /health/detailed ─────────────────────────────────

router.get("/detailed", noCache, asyncHandler(async (_req, res) => {
  if (detailedCache && Date.now() - detailedCache.timestamp < DETAILED_CACHE_TTL_MS) {
    const cached     = detailedCache.data;
    const httpStatus = cached.status === "ok" ? 200 : 503;
    res.status(httpStatus).json({ ...cached, _cached: true });
    return;
  }

  const [db, redisCheck, memory, sockets] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    Promise.resolve(checkMemory()),
    Promise.resolve(checkSockets()),
  ]);

  let overallStatus: "ok" | "degraded" | "down" = "ok";
  if (db.status === "error" && redisCheck.status === "error") {
    overallStatus = "down";
  } else if (db.status === "error" || redisCheck.status === "error" || memory.status === "warning") {
    overallStatus = "degraded";
  }

  const payload: Record<string, unknown> = {
    status:         overallStatus,
    uptime_seconds: Math.floor(process.uptime()),
    timestamp:      new Date().toISOString(),
    node_version:   process.version,
    environment:    config.nodeEnv,
    services:       { database: db, redis: redisCheck, memory, sockets },
  };

  detailedCache = { data: payload, timestamp: Date.now() };
  res.status(overallStatus === "ok" ? 200 : 503).json(payload);
}));

// ── GET /health/metrics ───────────────────────────────────

router.get("/metrics", internalOnly, noCache, asyncHandler(async (_req, res) => {
  // BUG FIX: use cached detailed data if fresh — avoids double DB/Redis ping
  let db: Awaited<ReturnType<typeof checkDatabase>>;
  let redisCheck: Awaited<ReturnType<typeof checkRedis>>;

  if (detailedCache && Date.now() - detailedCache.timestamp < DETAILED_CACHE_TTL_MS) {
    const services = detailedCache.data.services as {
      database: Awaited<ReturnType<typeof checkDatabase>>;
      redis:    Awaited<ReturnType<typeof checkRedis>>;
    };
    db         = services.database;
    redisCheck = services.redis;
  } else {
    [db, redisCheck] = await Promise.all([checkDatabase(), checkRedis()]);
  }

  const mem    = process.memoryUsage();
  const uptime = process.uptime();
  let socketCount = 0;
  try { socketCount = getIO().sockets.sockets.size; } catch { /* not ready */ }

  const lines = [
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

    "# HELP db_up Database reachable (1=yes 0=no)",
    "# TYPE db_up gauge",
    `db_up ${db.status === "connected" ? 1 : 0}`,

    "# HELP db_latency_ms Database query latency in ms",
    "# TYPE db_latency_ms gauge",
    `db_latency_ms ${db.latency_ms}`,

    "# HELP db_pool_main_total Total main pool connections",
    "# TYPE db_pool_main_total gauge",
    `db_pool_main_total ${db.pools.main.total}`,

    "# HELP db_pool_main_idle Idle main pool connections",
    "# TYPE db_pool_main_idle gauge",
    `db_pool_main_idle ${db.pools.main.idle}`,

    "# HELP db_pool_main_waiting Main pool waiting requests",
    "# TYPE db_pool_main_waiting gauge",
    `db_pool_main_waiting ${db.pools.main.waiting}`,

    "# HELP db_pool_tick_total Total tick pool connections",
    "# TYPE db_pool_tick_total gauge",
    `db_pool_tick_total ${db.pools.tick.total}`,

    "# HELP db_pool_tick_idle Idle tick pool connections",
    "# TYPE db_pool_tick_idle gauge",
    `db_pool_tick_idle ${db.pools.tick.idle}`,

    "# HELP db_pool_tick_waiting Tick pool waiting requests",
    "# TYPE db_pool_tick_waiting gauge",
    `db_pool_tick_waiting ${db.pools.tick.waiting}`,

    "# HELP redis_up Redis reachable (1=yes 0=no)",
    "# TYPE redis_up gauge",
    `redis_up ${redisCheck.status === "connected" ? 1 : 0}`,

    "# HELP redis_latency_ms Redis ping latency in ms",
    "# TYPE redis_latency_ms gauge",
    `redis_latency_ms ${redisCheck.latency_ms}`,

    "# HELP socket_connections Active Socket.io connections",
    "# TYPE socket_connections gauge",
    `socket_connections ${socketCount}`,
  ];

  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.send(lines.join("\n") + "\n");
}));

export default router;
