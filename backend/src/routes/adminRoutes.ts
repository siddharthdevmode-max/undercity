import { Router, Request, Response } from "express";
import { pool } from "../config/database";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";

const router = Router();

// ============================================================
// ADMIN CHECK MIDDLEWARE
// For now, hardcode admin UIDs. Later move to DB role.
// ============================================================

const ADMIN_UIDS = (process.env.ADMIN_UIDS || "").split(",").filter(Boolean);

const requireAdmin = (req: Request, res: Response, next: any) => {
  const uid = (req as any).firebaseUser?.uid;
  if (!uid || !ADMIN_UIDS.includes(uid)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};

// ============================================================
// GET /api/admin/cheaters
// List all users sorted by lowest trust score
// ============================================================

router.get("/cheaters", verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id, username, firebase_uid, trust_score, total_flags,
        is_shadow_banned, is_hard_banned, 
        last_flag_reason, last_flag_at
      FROM users
      WHERE trust_score < 100 OR total_flags > 0
      ORDER BY trust_score ASC, total_flags DESC
      LIMIT 100
    `);
    
    return res.json({ users: result.rows });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
});

// ============================================================
// GET /api/admin/violations/:uid
// Full violation history for a user
// ============================================================

router.get("/violations/:uid", verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const { uid } = req.params;
    const result = await pool.query(`
      SELECT violation_type, severity, details, ip_address, user_agent, created_at
      FROM uac_violations
      WHERE firebase_uid = $1
      ORDER BY created_at DESC
      LIMIT 100
    `, [uid]);
    
    return res.json({ violations: result.rows });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
});

// ============================================================
// POST /api/admin/unban/:uid
// Manually unban + reset trust score
// ============================================================

router.post("/unban/:uid", verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const { uid } = req.params;
    await pool.query(`
      UPDATE users 
      SET trust_score = 100, 
          is_shadow_banned = FALSE, 
          is_hard_banned = FALSE,
          total_flags = 0,
          last_flag_reason = NULL,
          last_flag_at = NULL
      WHERE firebase_uid = $1
    `, [uid]);
    
    console.log(`✅ Admin unbanned user: ${String(uid).substring(0, 8)}...`);
    return res.json({ message: "User unbanned and trust restored" });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
});

// ============================================================
// GET /api/admin/stats
// Overall UAC statistics
// ============================================================

router.get("/stats", verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) AS total_users,
        (SELECT COUNT(*) FROM users WHERE is_hard_banned = TRUE) AS hard_banned,
        (SELECT COUNT(*) FROM users WHERE is_shadow_banned = TRUE) AS shadow_banned,
        (SELECT COUNT(*) FROM users WHERE trust_score < 70) AS suspicious,
        (SELECT COUNT(*) FROM uac_violations) AS total_violations,
        (SELECT COUNT(*) FROM uac_violations WHERE created_at > NOW() - INTERVAL '24 hours') AS violations_24h
    `);
    
    return res.json(stats.rows[0]);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
});

// ============================================================
// GET /api/admin/multi-accounts
// Find users sharing same device fingerprint
// ============================================================

router.get("/multi-accounts", verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        fingerprint_hash,
        COUNT(DISTINCT firebase_uid) AS account_count,
        array_agg(DISTINCT firebase_uid) AS uids,
        MAX(last_seen) AS last_active
      FROM device_fingerprints
      GROUP BY fingerprint_hash
      HAVING COUNT(DISTINCT firebase_uid) > 1
      ORDER BY account_count DESC
      LIMIT 50
    `);
    
    return res.json({ groups: result.rows });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
});

export default router;
