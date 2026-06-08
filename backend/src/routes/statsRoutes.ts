import { Router }        from "express";
import { pool }          from "../config/database";
import { redis }         from "../config/redis";
import { statsLimiter }  from "../middleware/rateLimiter";
import { asyncHandler }  from "../utils/asyncHandler";
import { shortCache }    from "../middleware/cacheHeaders";
import { getTickInfo }   from "../services/gameTick";
import { logger }        from "../utils/logger";

// ============================================================
// STATS ROUTES — /api/stats
// ============================================================

const router = Router();

const LIVE_CACHE_KEY = "stats:live:v2";
const LIVE_CACHE_TTL = 30;

const EMPTY_STATS = {
  onlineNow:   0,
  last3Hours:  0,
  last24Hours: 0,
  crimes24h:   0,
  attacks24h:  0,
  casino24h:   0,
  _source:     "fallback",
} as const;

type LiveStats = {
  onlineNow:   number;
  last3Hours:  number;
  last24Hours: number;
  crimes24h:   number;
  attacks24h:  number;
  casino24h:   number;
  _source?:    "cache" | "db" | "fallback";
};

// ============================================================
// GET /api/stats/live
// ============================================================
router.get(
  "/live",
  statsLimiter,
  shortCache,
  asyncHandler(async (_req, res): Promise<void> => {

    // ── 1. Try Redis cache ─────────────────────────────────
    try {
      const cached = await redis.get(LIVE_CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached) as LiveStats;
        res.json({ ...data, _source: "cache" });
        return;
      }
    } catch (err) {
      logger.warn("Stats: Redis cache miss (Redis down)", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // ── 2. Query DB ────────────────────────────────────────
    let stats: LiveStats;

    try {
      const [onlineR, last3R, last24R, crimes24R] = await Promise.all([
        pool.query(
          `SELECT COUNT(*)::int AS n FROM users
           WHERE last_seen_at > NOW() - INTERVAL '5 minutes' AND deleted_at IS NULL`
        ),
        pool.query(
          `SELECT COUNT(*)::int AS n FROM users
           WHERE last_seen_at > NOW() - INTERVAL '3 hours' AND deleted_at IS NULL`
        ),
        pool.query(
          `SELECT COUNT(*)::int AS n FROM users
           WHERE last_seen_at > NOW() - INTERVAL '24 hours' AND deleted_at IS NULL`
        ),
        pool.query(
          `SELECT COUNT(*)::int AS n FROM users
           WHERE last_crime_at > NOW() - INTERVAL '24 hours' AND deleted_at IS NULL`
        ),
      ]);

      const n = (r: { rows: Array<{ n: number }> }) => r.rows[0]?.n ?? 0;

      stats = {
        onlineNow:   n(onlineR),
        last3Hours:  n(last3R),
        last24Hours: n(last24R),
        crimes24h:   n(crimes24R),
        attacks24h:  0,
        casino24h:   0,
        _source:     "db",
      };

    } catch (err) {
      logger.error("Stats: DB query failed, returning fallback", {
        error: err instanceof Error ? err.message : String(err),
      });
      res.json(EMPTY_STATS);
      return;
    }

    // ── 3. Write to Redis cache ────────────────────────────
    try {
      await redis.set(LIVE_CACHE_KEY, JSON.stringify(stats), "EX", LIVE_CACHE_TTL);
    } catch {
      // Non-fatal
    }

    res.json(stats);
  })
);

// ============================================================
// GET /api/stats/tick
// ============================================================
router.get(
  "/tick",
  statsLimiter,
  asyncHandler(async (_req, res): Promise<void> => {
    try {
      const info = await getTickInfo();
      res.json({ tick: info, retrievedAt: new Date().toISOString() });
    } catch (err) {
      logger.error("Stats: Failed to get tick info", {
        error: err instanceof Error ? err.message : String(err),
      });
      res.json({
        tick:        null,
        error:       "Tick info unavailable",
        retrievedAt: new Date().toISOString(),
      });
    }
  })
);

export default router;
