import { Router, Request, Response } from "express";
import { pool } from "../config/database";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { getPoolStats } from "../utils/dbHelpers";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

const ADMIN_UIDS = (process.env.ADMIN_UIDS || "").split(",").filter(Boolean);

const requireAdmin = (req: Request, res: Response, next: any) => {
  const uid = (req as any).firebaseUser?.uid;
  if (!uid || !ADMIN_UIDS.includes(uid)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};

// ============================================================
// Existing routes (cheaters, violations, unban, stats)
// ============================================================

router.get("/cheaters", verifyFirebaseToken, requireAdmin, asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT id, username, firebase_uid, trust_score, total_flags,
           is_shadow_banned, is_hard_banned, last_flag_reason, last_flag_at
    FROM users
    WHERE trust_score < 100 OR total_flags > 0
    ORDER BY trust_score ASC, total_flags DESC
    LIMIT 100
  `);
  res.json({ users: result.rows });
}));

router.get("/violations/:uid", verifyFirebaseToken, requireAdmin, asyncHandler(async (req, res) => {
  const { uid } = req.params;
  const result = await pool.query(`
    SELECT violation_type, severity, details, ip_address, user_agent, created_at
    FROM uac_violations WHERE firebase_uid = $1
    ORDER BY created_at DESC LIMIT 100
  `, [uid]);
  res.json({ violations: result.rows });
}));

router.post("/unban/:uid", verifyFirebaseToken, requireAdmin, asyncHandler(async (req, res) => {
  const { uid } = req.params;
  await pool.query(`
    UPDATE users SET trust_score = 100, is_shadow_banned = FALSE, 
           is_hard_banned = FALSE, total_flags = 0,
           last_flag_reason = NULL, last_flag_at = NULL
    WHERE firebase_uid = $1
  `, [uid]);
  console.log(`✅ Admin unbanned user: ${String(uid).substring(0, 8)}...`);
  res.json({ message: "User unbanned and trust restored" });
}));

router.get("/stats", verifyFirebaseToken, requireAdmin, asyncHandler(async (req, res) => {
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
}));

router.get("/multi-accounts", verifyFirebaseToken, requireAdmin, asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT fingerprint_hash, COUNT(DISTINCT firebase_uid) AS account_count,
           array_agg(DISTINCT firebase_uid) AS uids, MAX(last_seen) AS last_active
    FROM device_fingerprints
    GROUP BY fingerprint_hash
    HAVING COUNT(DISTINCT firebase_uid) > 1
    ORDER BY account_count DESC LIMIT 50
  `);
  res.json({ groups: result.rows });
}));

// ============================================================
// NEW: Database health endpoint
// ============================================================

router.get("/db-health", verifyFirebaseToken, requireAdmin, asyncHandler(async (req, res) => {
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

  const slowQueries = await pool.query(`
    SELECT query_text, duration_ms, rows_returned, created_at
    FROM slow_queries
    ORDER BY created_at DESC LIMIT 20
  `).catch(() => ({ rows: [] }));

  res.json({
    pool: poolStats,
    database_size: dbSize.rows[0]?.db_size,
    tables: tableStats.rows,
    recent_slow_queries: slowQueries.rows,
  });
}));

export default router;
