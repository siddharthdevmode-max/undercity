import { Router } from "express";
import { pool } from "../config/database";
import redis from "../config/redis";
import { statsLimiter } from "../middleware/rateLimiter";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
const CACHE_KEY = "stats:live";
const CACHE_TTL = 30; // seconds

// ============================================================
// GET /api/stats/live
// Single query for all stats — cached 30s in Redis
// ============================================================
router.get(
  "/live",
  statsLimiter,
  asyncHandler(async (_req, res) => {

    // ── Try cache first ──
    try {
      const cached = await redis.get(CACHE_KEY);
      if (cached) {
        return res.json({
          ...JSON.parse(cached),
          _cached: true,
        });
      }
    } catch {
      // Redis down — fall through to DB
    }

    // ── DB query ──
    const result = await pool.query(`
      SELECT
        (
          SELECT COUNT(*)::int FROM users
          WHERE last_crime_at >= NOW() - INTERVAL '5 minutes'
        ) AS online_now,
        (
          SELECT COUNT(*)::int FROM users
          WHERE last_crime_at >= NOW() - INTERVAL '3 hours'
        ) AS last_3_hours,
        (
          SELECT COUNT(*)::int FROM users
          WHERE last_crime_at >= NOW() - INTERVAL '24 hours'
        ) AS last_24_hours,
        (
          SELECT COALESCE(SUM(attempts), 0)::int
          FROM user_crime_progress
          WHERE updated_at >= NOW() - INTERVAL '24 hours'
        ) AS crimes_24h
    `);

    const row = result.rows[0];

    const data = {
      onlineNow:   row.online_now,
      last3Hours:  row.last_3_hours,
      last24Hours: row.last_24_hours,
      attacks24h:  0,
      crimes24h:   row.crimes_24h,
      casino24h:   0,
    };

    // ── Cache result ──
    try {
      await redis.set(CACHE_KEY, JSON.stringify(data), "EX", CACHE_TTL);
    } catch {
      // ignore cache write failures
    }

    res.json(data);
  })
);

export default router;
