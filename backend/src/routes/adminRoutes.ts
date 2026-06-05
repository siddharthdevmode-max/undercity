import { Router } from "express";
import { pool } from "../config/database";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { revokeUserSession } from "../middleware/firebaseAuth";
import { getPoolStats } from "../utils/dbHelpers";
import { asyncHandler } from "../utils/asyncHandler";
import { validate } from "../middleware/validate";
import { adminUidParamSchema } from "../utils/schemas";
import { adminLimiter } from "../middleware/rateLimiter";
import { requireAdmin } from "../middleware/requireAdmin";
import { logger } from "../utils/logger";
import { runTrustRecovery } from "../services/trustRecovery";
import { invalidateImmunityCache } from "../services/immunityCheck";
import redis from "../config/redis";

const router = Router();

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
       FROM uac_violations
       WHERE firebase_uid = $1
       ORDER BY created_at DESC
       LIMIT 100`,
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

    const result = await pool.query(
      `UPDATE users
       SET trust_score      = 100,
           is_shadow_banned = FALSE,
           is_hard_banned   = FALSE,
           total_flags      = 0,
           last_flag_reason = NULL,
           last_flag_at     = NULL
       WHERE firebase_uid = $1
       RETURNING id, username, firebase_uid, trust_score,
                 is_shadow_banned, is_hard_banned`,
      [uid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // Invalidate immunity cache in case roles changed
    await invalidateImmunityCache(uid);

    logger.info(`✅ Admin unbanned user: ${uid.substring(0, 8)}...`);
    res.json({
      message: "User unbanned and trust restored",
      user:    result.rows[0],
    });
  })
);

// ============================================================
// POST /api/admin/shadow-ban/:uid
// Manual shadow ban without hard banning
// ============================================================
router.post(
  "/shadow-ban/:uid",
  verifyFirebaseToken,
  requireAdmin,
  adminLimiter,
  validate(adminUidParamSchema),
  asyncHandler(async (req, res) => {
    const uid    = String(req.params.uid);
    const reason = String((req.body as { reason?: string }).reason || "Manual admin shadow ban");

    const result = await pool.query(
      `UPDATE users
       SET trust_score      = LEAST(COALESCE(trust_score, 100), 19),
           is_shadow_banned = TRUE,
           is_hard_banned   = FALSE,
           last_flag_reason = $2,
           last_flag_at     = CURRENT_TIMESTAMP
       WHERE firebase_uid = $1
       RETURNING id, username, firebase_uid, trust_score,
                 is_shadow_banned, is_hard_banned, last_flag_reason, last_flag_at`,
      [uid, reason]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    logger.warn(`⚠️  Admin shadow-banned user: ${uid.substring(0, 8)}... reason: ${reason}`);
    res.json({
      message: "User shadow-banned",
      user:    result.rows[0],
    });
  })
);

// ============================================================
// POST /api/admin/hard-ban/:uid
// Hard ban + Firebase session revocation
// ============================================================
router.post(
  "/hard-ban/:uid",
  verifyFirebaseToken,
  requireAdmin,
  adminLimiter,
  validate(adminUidParamSchema),
  asyncHandler(async (req, res) => {
    const uid    = String(req.params.uid);
    const reason = String((req.body as { reason?: string }).reason || "Manual admin hard ban");

    const result = await pool.query(
      `UPDATE users
       SET trust_score      = 0,
           is_shadow_banned = FALSE,
           is_hard_banned   = TRUE,
           last_flag_reason = $2,
           last_flag_at     = CURRENT_TIMESTAMP
       WHERE firebase_uid = $1
       RETURNING id, username, firebase_uid, trust_score,
                 is_shadow_banned, is_hard_banned, last_flag_reason, last_flag_at`,
      [uid, reason]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // 🔒 Revoke Firebase session — kicks them out immediately
    await revokeUserSession(uid);

    // 🚫 Also blacklist their IPs from recent fingerprints
    const fpResult = await pool.query(
      `SELECT DISTINCT ip_address
       FROM device_fingerprints
       WHERE firebase_uid = $1
         AND last_seen > NOW() - INTERVAL '30 days'`,
      [uid]
    );

    for (const row of fpResult.rows) {
      if (row.ip_address) {
        await redis.set(
          `blacklist:ip:${row.ip_address}`,
          reason,
          "EX",
          60 * 60 * 24 * 30 // 30 days
        );
        logger.warn(`🚫 IP blacklisted: ${row.ip_address} (banned user)`);
      }
    }

    // Invalidate immunity cache
    await invalidateImmunityCache(uid);

    logger.warn(`🚫 Admin hard-banned user: ${uid.substring(0, 8)}... reason: ${reason}`);
    res.json({
      message:        "User hard-banned, session revoked, IPs blacklisted",
      user:           result.rows[0],
      ips_blacklisted: fpResult.rows.map((r) => r.ip_address).filter(Boolean),
    });
  })
);

// ============================================================
// POST /api/admin/ip-blacklist
// Manually blacklist an IP
// ============================================================
router.post(
  "/ip-blacklist",
  verifyFirebaseToken,
  requireAdmin,
  adminLimiter,
  asyncHandler(async (req, res) => {
    const { ip, reason, days = 30 } = req.body as {
      ip:      string;
      reason?: string;
      days?:   number;
    };

    if (!ip) {
      return res.status(400).json({ message: "IP address is required" });
    }

    const ttl = Math.min(Math.max(days, 1), 365) * 60 * 60 * 24;
    await redis.set(
      `blacklist:ip:${ip}`,
      reason || "Manual admin blacklist",
      "EX",
      ttl
    );

    logger.warn(`🚫 Manual IP blacklist: ${ip} for ${days} days`);
    res.json({ message: `IP ${ip} blacklisted for ${days} days` });
  })
);

// ============================================================
// DELETE /api/admin/ip-blacklist
// Remove IP from blacklist
// ============================================================
router.delete(
  "/ip-blacklist",
  verifyFirebaseToken,
  requireAdmin,
  adminLimiter,
  asyncHandler(async (req, res) => {
    const { ip } = req.body as { ip: string };

    if (!ip) {
      return res.status(400).json({ message: "IP address is required" });
    }

    await redis.del(`blacklist:ip:${ip}`);

    logger.info(`✅ IP removed from blacklist: ${ip}`);
    res.json({ message: `IP ${ip} removed from blacklist` });
  })
);

// ============================================================
// GET /api/admin/user/:uid/full
// Full investigation bundle for one user
// ============================================================
router.get(
  "/user/:uid/full",
  verifyFirebaseToken,
  requireAdmin,
  adminLimiter,
  validate(adminUidParamSchema),
  asyncHandler(async (req, res) => {
    const uid = String(req.params.uid);

    const userResult = await pool.query(
      `SELECT id, username, email, firebase_uid, level, money, points,
              nerve, max_nerve, life, max_life,
              trust_score, total_flags, is_shadow_banned, is_hard_banned,
              last_flag_reason, last_flag_at, created_at
       FROM users
       WHERE firebase_uid = $1
       LIMIT 1`,
      [uid]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = userResult.rows[0];

    const [
      violationsResult,
      trustRecoveryResult,
      fingerprintsResult,
      linkedAccountsResult,
      crimeProgressResult,
      authLogResult,
    ] = await Promise.all([
      pool.query(
        `SELECT violation_type, severity, details, ip_address, user_agent, created_at
         FROM uac_violations
         WHERE firebase_uid = $1
         ORDER BY created_at DESC
         LIMIT 100`,
        [uid]
      ),
      pool.query(
        `SELECT old_score, new_score, reason, created_at
         FROM trust_recovery_log
         WHERE firebase_uid = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [uid]
      ),
      pool.query(
        `SELECT fingerprint_hash, ip_address, user_agent, hit_count, last_seen
         FROM device_fingerprints
         WHERE firebase_uid = $1
         ORDER BY last_seen DESC
         LIMIT 50`,
        [uid]
      ),
      pool.query(
        `SELECT DISTINCT df2.firebase_uid
         FROM device_fingerprints df1
         JOIN device_fingerprints df2
           ON df1.fingerprint_hash = df2.fingerprint_hash
         WHERE df1.firebase_uid = $1
           AND df2.firebase_uid != $1
         ORDER BY df2.firebase_uid ASC`,
        [uid]
      ),
      pool.query(
        `SELECT c.crime_key, c.name, c.tier,
                ucp.crime_level, ucp.crime_xp, ucp.hidden_cpl,
                ucp.attempts, ucp.successes, ucp.failures, ucp.crit_failures,
                ucp.specials_found_count, ucp.updated_at
         FROM user_crime_progress ucp
         JOIN users u  ON u.id  = ucp.user_id
         JOIN crimes c ON c.id  = ucp.crime_id
         WHERE u.firebase_uid = $1
         ORDER BY ucp.updated_at DESC, c.tier ASC, c.id ASC
         LIMIT 100`,
        [uid]
      ),
      // NEW: auth access log
      pool.query(
        `SELECT ip_address, user_agent, is_new_ip, accessed_at
         FROM auth_access_log
         WHERE firebase_uid = $1
         ORDER BY accessed_at DESC
         LIMIT 50`,
        [uid]
      ).catch(() => ({ rows: [] })),
    ]);

    res.json({
      user,
      violations:       violationsResult.rows,
      trustRecoveryLog: trustRecoveryResult.rows,
      fingerprints:     fingerprintsResult.rows,
      linkedAccounts:   linkedAccountsResult.rows.map((r) => r.firebase_uid),
      crimeProgress:    crimeProgressResult.rows,
      authLog:          authLogResult.rows,
    });
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
        (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL)          AS total_users,
        (SELECT COUNT(*) FROM users WHERE is_hard_banned = TRUE)       AS hard_banned,
        (SELECT COUNT(*) FROM users WHERE is_shadow_banned = TRUE)     AS shadow_banned,
        (SELECT COUNT(*) FROM users WHERE trust_score < 70)            AS suspicious,
        (SELECT COUNT(*) FROM uac_violations)                          AS total_violations,
        (SELECT COUNT(*) FROM uac_violations
         WHERE created_at > NOW() - INTERVAL '24 hours')               AS violations_24h,
        (SELECT COUNT(*) FROM auth_access_log
         WHERE is_new_ip = TRUE
           AND accessed_at > NOW() - INTERVAL '24 hours')              AS new_ips_24h
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
      SELECT fingerprint_hash,
             COUNT(DISTINCT firebase_uid) AS account_count,
             array_agg(DISTINCT firebase_uid) AS uids,
             MAX(last_seen) AS last_active
      FROM device_fingerprints
      GROUP BY fingerprint_hash
      HAVING COUNT(DISTINCT firebase_uid) > 1
      ORDER BY account_count DESC
      LIMIT 50
    `);
    res.json({ groups: result.rows });
  })
);

// ============================================================
// GET /api/admin/earnings-anomalies
// ============================================================
router.get(
  "/earnings-anomalies",
  verifyFirebaseToken,
  requireAdmin,
  adminLimiter,
  asyncHandler(async (_req, res) => {
    const result = await pool.query(`
      SELECT
        uv.firebase_uid,
        u.username,
        uv.severity,
        uv.details,
        uv.ip_address,
        uv.user_agent,
        uv.created_at
      FROM uac_violations uv
      LEFT JOIN users u ON u.firebase_uid = uv.firebase_uid
      WHERE uv.violation_type = 'EARNINGS_VELOCITY'
      ORDER BY uv.created_at DESC
      LIMIT 100
    `);
    res.json({ anomalies: result.rows });
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
      SELECT schemaname,
             relname   AS table_name,
             n_live_tup AS row_count,
             pg_size_pretty(
               pg_total_relation_size(schemaname||'.'||relname)
             ) AS total_size
      FROM pg_stat_user_tables
      ORDER BY n_live_tup DESC
    `);

    const slowQueries = await pool
      .query(`
        SELECT query_text, duration_ms, rows_returned, created_at
        FROM slow_queries
        ORDER BY created_at DESC
        LIMIT 20
      `)
      .catch(() => ({ rows: [] }));

    res.json({
      pool:                poolStats,
      database_size:       dbSize.rows[0]?.db_size,
      tables:              tableStats.rows,
      recent_slow_queries: slowQueries.rows,
    });
  })
);

// ============================================================
// POST /api/admin/trust-recovery/run
// ============================================================
router.post(
  "/trust-recovery/run",
  verifyFirebaseToken,
  requireAdmin,
  adminLimiter,
  asyncHandler(async (_req, res) => {
    const result = await runTrustRecovery();
    res.json({ message: "Trust recovery complete", ...result });
  })
);

// ============================================================
// GET /api/admin/trust-recovery/log/:uid
// ============================================================
router.get(
  "/trust-recovery/log/:uid",
  verifyFirebaseToken,
  requireAdmin,
  adminLimiter,
  validate(adminUidParamSchema),
  asyncHandler(async (req, res) => {
    const uid = String(req.params.uid);
    const result = await pool.query(
      `SELECT old_score, new_score, reason, created_at
       FROM trust_recovery_log
       WHERE firebase_uid = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [uid]
    );
    res.json({ log: result.rows });
  })
);

export default router;
