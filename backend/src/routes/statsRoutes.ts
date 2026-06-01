import { Router } from "express";
import { pool } from "../config/database";

const router = Router();

// GET /api/stats/live
// Public endpoint — no auth required
router.get("/live", async (req, res) => {
  try {
    // Online now — logged in within last 5 minutes
    const onlineNow = await pool.query(`
      SELECT COUNT(*) FROM users
      WHERE last_crime_at >= NOW() - INTERVAL '5 minutes'
    `);

    // Active last 3 hours
    const last3Hours = await pool.query(`
      SELECT COUNT(*) FROM users
      WHERE last_crime_at >= NOW() - INTERVAL '3 hours'
    `);

    // Active last 24 hours
    const last24Hours = await pool.query(`
      SELECT COUNT(*) FROM users
      WHERE last_crime_at >= NOW() - INTERVAL '24 hours'
    `);

    // Crimes committed last 24 hours
    const crimes24h = await pool.query(`
      SELECT COALESCE(SUM(attempts), 0) AS total
      FROM user_crime_progress
      WHERE updated_at >= NOW() - INTERVAL '24 hours'
    `);

    return res.json({
      onlineNow:   parseInt(onlineNow.rows[0].count),
      last3Hours:  parseInt(last3Hours.rows[0].count),
      last24Hours: parseInt(last24Hours.rows[0].count),
      attacks24h:  0,  // placeholder until attack system is built
      crimes24h:   parseInt(crimes24h.rows[0].total),
      casino24h:   0,  // placeholder until casino system is built
    });

  } catch (error: any) {
    console.error("stats/live error:", error.message);
    return res.status(500).json({ message: "Failed to fetch stats" });
  }
});

export default router;
