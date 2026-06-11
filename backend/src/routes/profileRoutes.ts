import { Router } from "express";
import { authMeLimiter } from "../middleware/rateLimiter";
import { shortCache } from "../middleware/cacheHeaders";
import { asyncHandler } from "../utils/asyncHandler";
import { pool } from "../config/database";
import { NotFoundError } from "../utils/errors";

const router = Router();

router.get("/:username", authMeLimiter, shortCache, asyncHandler(async (req, res) => {
  const username = req.params["username"] ?? "";
  const userR = await pool.query(
    `SELECT id, username, level, money, points, nerve, max_nerve, life, max_life,
            energy, max_energy, happiness, created_at, last_seen_at, last_crime_at
     FROM users WHERE LOWER(username) = LOWER($1) AND deleted_at IS NULL LIMIT 1`,
    [username]
  );
  if (userR.rows.length === 0) throw new NotFoundError("Player");

  const user = userR.rows[0];

  const crimeStatsR = await pool.query(
    `SELECT COUNT(*)::int AS total_crimes,
            COALESCE(SUM(attempts), 0)::int AS total_attempts,
            COALESCE(SUM(successes), 0)::int AS total_successes,
            COALESCE(SUM(failures), 0)::int AS total_failures
     FROM crime_progress WHERE user_id = $1`,
    [user.id]
  );

  const topCrimeR = await pool.query(
    `SELECT cp.crime_key, c.name, cp.attempts, cp.successes
     FROM crime_progress cp
     JOIN crimes c ON c.key = cp.crime_key
     WHERE cp.user_id = $1
     ORDER BY cp.attempts DESC LIMIT 1`,
    [user.id]
  );

  res.json({
    user,
    crimeStats: crimeStatsR.rows[0] ?? { total_crimes: 0, total_attempts: 0, total_successes: 0, total_failures: 0 },
    topCrime: topCrimeR.rows[0] ?? null,
  });
}));

export default router;
