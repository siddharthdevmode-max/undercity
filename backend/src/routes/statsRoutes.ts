import { Router } from "express";
import { pool } from "../config/database";
import { statsLimiter } from "../middleware/rateLimiter";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// ============================================================
// GET /api/stats/live
// Single query for all stats — no sequential round trips
// ============================================================
router.get(
  "/live",
  statsLimiter,
  asyncHandler(async (_req, res) => {
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

    res.json({
      onlineNow:   row.online_now,
      last3Hours:  row.last_3_hours,
      last24Hours: row.last_24_hours,
      attacks24h:  0,
      crimes24h:   row.crimes_24h,
      casino24h:   0,
    });
  })
);

export default router;
