import { Router, Request, Response, NextFunction } from "express";
import { pool } from "../config/database";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { getPoolStats } from "../utils/dbHelpers";
import { asyncHandler } from "../utils/asyncHandler";
import { validate } from "../middleware/validate";
import { adminUidParamSchema } from "../utils/schemas";
import { ForbiddenError } from "../utils/errors";
import { adminLimiter } from "../middleware/rateLimiter";
import { logger } from "../utils/logger";

const router = Router();

const ADMIN_UIDS = (process.env.ADMIN_UIDS || "").split(",").filter(Boolean);

const requireAdmin = (req: Request, _res: Response, next: NextFunction) => {
  const uid = req.firebaseUser?.uid;
  if (!uid || !ADMIN_UIDS.includes(uid)) {
    throw new ForbiddenError();
  }
  next();
};

// ============================================================
// GET /api/admin/cheaters
// ============================================================
router.get(
  "/cheaters",
  verifyFirebaseToken,
  requireAdmin,
  adminLimiter,
  asyncHandler(async (_req, res) => {
    const result = await pool.query(`
      SELECT id, username, firebase_uid, trust_score, total_flags,
             is_shadow_banned, is_hard_banned, last_flag_reason, last_flag_at
      FROM users
      WHERE trust_score < 100 OR total_flags > 0
      ORDER BY trust_score ASC, total_flags DESC
      LIMIT 100
    `);
    res.json({ users: result.rows });
  })
);

// ============================================================
// GET /api/admin/violations/:uid
// ============================================================
router.get(
  "/violations/:uid",
  verifyFirebaseToken,
  requireAdmin,
  adminLimiter,
  validate(adminUidParamSchema),
  asyncHandler(async (req, res) => {
    const uid = String(req.params.uid);
    const result = await pool.query(
      `SELECT violation_type, severity, details, ip_address, user_agent, created_at
       FROM uac_violations WHERE firebase_uid = $1
       ORDER BY created_at DESC LIMIT 100`,
      [uid]
    );
    res.json({ violations: result.rows });
  })
);

// ============================================================
// POST /api/admin/unban/:uid
// ============================================================
router.post(
  "/unban/:uid",
  verifyFirebaseToken,
  requireAdmin,
  adminLimiter,
  validate(adminUidParamSchema),
  asyncHandler(async (req, res) => {
    const uid = String(req.params.uid);
    await pool.query(
      `UPDATE users
       SET trust_score = 100, is_shadow_banned = FALSE,
           is_hard_banned = FALSE, total_flags = 0,
           last_flag_reason = NULL, last_flag_at = NULL
       WHERE firebase_uid = $1`,
      [uid]
    );
    logger.info(`✅ Admin unbanned user: ${uid.substring(0, 8)}...`);
    res.json({ message: "User unbanned and trust restored" });
  })
);

// ============================================================
// GET /api/admin/stats
// ============================================================
router.get(
  "/stats",
  verifyFirebaseToken,
  requireAdmin,
  adminLimiter,
  asyncHandler(async (_req, res) => {
    const stats = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL) AS total_users,
        (SELECT COUNT(*) FROM users WHERE is_hard_banned = TRUE) AS hard_banned,
        (SELECT COUNT(*) FROM users WHERE is_shadow_banned = TRUE) AS shadow_banned,
        (SELECT COUNT(*) FROM users WHERE trust_score < 70) AS suspicious,
        (SELECT COUNT(*) FROM uac_violations) AS total_violations,
        (SELECT COUNT(*) FROM uac_violations WHERE created_at > NOW() - INTERVAL '24 hours') AS violations_24h
    `);
    res.json(stats.rows[0]);
  })
);

// ============================================================
// GET /api/admin/multi-accounts
// ============================================================
router.get(
  "/multi-accounts",
  verifyFirebaseToken,
  requireAdmin,
  adminLimiter,
  asyncHandler(async (_req, res) => {
    const result = await pool.query(`
      SELECT fingerprint_hash, COUNT(DISTINCT firebase_uid) AS account_count,
             array_agg(DISTINCT firebase_uid) AS uids, MAX(last_seen) AS last_active
      FROM device_fingerprints
      GROUP BY fingerprint_hash
      HAVING COUNT(DISTINCT firebase_uid) > 1
      ORDER BY account_count DESC LIMIT 50
    `);
    res.json({ groups: result.rows });
  })
);

// ============================================================
// GET /api/admin/db-health
// ============================================================
router.get(
  "/db-health",
  verifyFirebaseToken,
  requireAdmin,
  adminLimiter,
  asyncHandler(async (_req, res) => {
    const poolStats = getPoolStats();

    const dbSize = await pool.query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size
    `);

    const tableStats = await pool.query(`
      SELECT
        schemaname, relname AS table_name,
        n_live_tup AS row_count,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) AS total_size
      FROM pg_stat_user_tables
      ORDER BY n_live_tup DESC
    `);

    const slowQueries = await pool
      .query(`
        SELECT query_text, duration_ms, rows_returned, created_at
        FROM slow_queries
        ORDER BY created_at DESC LIMIT 20
      `)
      .catch(() => ({ rows: [] }));

    res.json({
      pool: poolStats,
      database_size: dbSize.rows[0]?.db_size,
      tables: tableStats.rows,
      recent_slow_queries: slowQueries.rows,
    });
  })
);

export default router;
