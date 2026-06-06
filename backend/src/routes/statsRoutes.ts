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
//
// GET /live    — Live player counts + activity (30s Redis cache)
// GET /tick    — Game tick info (admin/debug, no cache)
// ============================================================

const router = Router();

// ── Cache config ───────────────────────────────────────────
const LIVE_CACHE_KEY = "stats:live:v2";   // v2 — bump when shape changes
const LIVE_CACHE_TTL = 30;                // seconds

// ── Fallback stats shape ───────────────────────────────────
// Returned when DB is unavailable — never returns 500 to frontend
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
  asyncHandler(async (_req, res) => {

    // ── 1. Try Redis cache ─────────────────────────────────
    try {
      const cached = await redis.get(LIVE_CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached) as LiveStats;
        return res.json({ ...data, _source: "cache" });
      }
    } catch (err) {
      logger.warn("Stats: Redis cache miss (Redis down)", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // ── 2. Query DB — parallel subqueries ─────────────────
    // Using last_seen_at (not last_crime_at) for online count
    // last_seen_at is updated by firebaseAuth middleware on every request

    let stats: LiveStats;

    try {
      const [onlineR, last3R, last24R, crimes24R] = await Promise.all([
        pool.query(
          `SELECT COUNT(*)::int AS n
           FROM users
           WHERE last_seen_at > NOW() - INTERVAL '5 minutes'
             AND deleted_at   IS NULL`
        ),
        pool.query(
          `SELECT COUNT(*)::int AS n
           FROM users
           WHERE last_seen_at > NOW() - INTERVAL '3 hours'
             AND deleted_at   IS NULL`
        ),
        pool.query(
          `SELECT COUNT(*)::int AS n
           FROM users
           WHERE last_seen_at > NOW() - INTERVAL '24 hours'
             AND deleted_at   IS NULL`
        ),
        // crimes24h: total crime attempts in last 24h
        pool.query(
          `SELECT COALESCE(SUM(attempts), 0)::int AS n
           FROM user_crime_progress
           WHERE updated_at > NOW() - INTERVAL '24 hours'`
        ),
        // attacks24h and casino24h: add queries here when tables exist
      ]);

      const n = (r: { rows: Array<{ n: number }> }) => r.rows[0]?.n ?? 0;

      stats = {
        onlineNow:   n(onlineR),
        last3Hours:  n(last3R),
        last24Hours: n(last24R),
        crimes24h:   n(crimes24R),
        attacks24h:  0,   // TODO: query combat_log when table exists
        casino24h:   0,   // TODO: query casino_rounds when table exists
        _source:     "db",
      };

    } catch (err) {
      // DB unavailable — return fallback instead of 500
      logger.error("Stats: DB query failed, returning fallback", {
        error: err instanceof Error ? err.message : String(err),
      });

      return res.json(EMPTY_STATS);
    }

    // ── 3. Write to Redis cache ────────────────────────────
    try {
      await redis.set(
        LIVE_CACHE_KEY,
        JSON.stringify(stats),
        "EX",
        LIVE_CACHE_TTL
      );
    } catch {
      // Non-fatal — continue without cache
    }

    res.json(stats);
  })
);

// ============================================================
// GET /api/stats/tick
// Game tick debug info — no cache, not rate-limited hard
// ============================================================
router.get(
  "/tick",
  statsLimiter,
  asyncHandler(async (_req, res) => {
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
