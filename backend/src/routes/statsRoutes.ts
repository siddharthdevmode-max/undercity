import { Router } from "express";
import { pool } from "../config/database";
import { statsLimiter } from "../middleware/rateLimiter";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// ============================================================
// GET /api/stats/live
// Public endpoint — no auth required
// Rate limited: 30 req/min per IP
// ============================================================
router.get(
  "/live",
  statsLimiter,
  asyncHandler(async (req, res) => {
    const onlineNow = await pool.query(`
      SELECT COUNT(*)::int AS count FROM users
      WHERE last_crime_at >= NOW() - INTERVAL '5 minutes'
    `);

    const last3Hours = await pool.query(`
      SELECT COUNT(*)::int AS count FROM users
      WHERE last_crime_at >= NOW() - INTERVAL '3 hours'
    `);

    const last24Hours = await pool.query(`
      SELECT COUNT(*)::int AS count FROM users
      WHERE last_crime_at >= NOW() - INTERVAL '24 hours'
    `);

    const crimes24h = await pool.query(`
      SELECT COALESCE(SUM(attempts), 0)::int AS total
      FROM user_crime_progress
      WHERE updated_at >= NOW() - INTERVAL '24 hours'
    `);

    res.json({
      onlineNow: onlineNow.rows[0].count,
      last3Hours: last3Hours.rows[0].count,
      last24Hours: last24Hours.rows[0].count,
      attacks24h: 0, // placeholder
      crimes24h: crimes24h.rows[0].total,
      casino24h: 0, // placeholder
    });
  })
);

export default router;
