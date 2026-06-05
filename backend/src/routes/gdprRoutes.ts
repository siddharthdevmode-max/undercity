import { Router } from "express";
import { pool } from "../config/database";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { revokeUserSession } from "../middleware/firebaseAuth";
import { authMeLimiter } from "../middleware/rateLimiter";
import { asyncHandler } from "../utils/asyncHandler";
import { logger } from "../utils/logger";

// ============================================================
// GDPR ROUTES
// Article 15 — Right of Access
// Article 17 — Right to Erasure
// Article 20 — Right to Data Portability
// ============================================================

const router = Router();

// ============================================================
// GET /api/gdpr/export
// Article 20 — Data Portability
// Returns all user data as JSON
// ============================================================
router.get(
  "/export",
  authMeLimiter,
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const { uid } = req.firebaseUser!;

    const [
      userResult,
      crimeProgressResult,
      violationsResult,
      fingerprintsResult,
      authLogResult,
    ] = await Promise.all([
      pool.query(
        `SELECT
           id, username, email, level, money, points,
           nerve, max_nerve, life, max_life,
           onboarding_completed, created_at
         FROM users
         WHERE firebase_uid = $1 LIMIT 1`,
        [uid]
      ),
      pool.query(
        `SELECT c.name, c.tier,
                ucp.crime_level, ucp.crime_xp,
                ucp.attempts, ucp.successes, ucp.failures,
                ucp.updated_at
         FROM user_crime_progress ucp
         JOIN crimes c ON c.id = ucp.crime_id
         JOIN users u  ON u.id = ucp.user_id
         WHERE u.firebase_uid = $1`,
        [uid]
      ),
      pool.query(
        `SELECT violation_type, severity, created_at
         FROM uac_violations
         WHERE firebase_uid = $1
         ORDER BY created_at DESC`,
        [uid]
      ),
      pool.query(
        `SELECT ip_address, last_seen, hit_count
         FROM device_fingerprints
         WHERE firebase_uid = $1
         ORDER BY last_seen DESC`,
        [uid]
      ),
      pool.query(
        `SELECT ip_address, is_new_ip, accessed_at
         FROM auth_access_log
         WHERE firebase_uid = $1
         ORDER BY accessed_at DESC`,
        [uid]
      ).catch(() => ({ rows: [] })),
    ]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const exportData = {
      exported_at:   new Date().toISOString(),
      gdpr_notice:   "This is all personal data we hold about you under GDPR Article 20.",
      contact:       "katanas.reaper@gmail.com",
      account:       userResult.rows[0],
      game_progress: crimeProgressResult.rows,
      security_log:  violationsResult.rows,
      devices:       fingerprintsResult.rows,
      login_history: authLogResult.rows,
    };

    logger.info("📦 GDPR data export", { uid: uid.substring(0, 8) });

    res.setHeader("Content-Disposition", `attachment; filename="undercity-data-${Date.now()}.json"`);
    res.setHeader("Content-Type", "application/json");
    res.json(exportData);
  })
);

// ============================================================
// DELETE /api/gdpr/delete-account
// Article 17 — Right to Erasure
// Soft deletes account, schedules hard delete
// ============================================================
router.delete(
  "/delete-account",
  authMeLimiter,
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const { uid } = req.firebaseUser!;

    const userResult = await pool.query(
      `SELECT id, username, email FROM users
       WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`,
      [uid]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found or already deleted" });
    }

    const user = userResult.rows[0];

    // Soft delete — anonymise personal data immediately
    // Hard delete of remaining data happens after 30 days (via scheduled job)
    await pool.query(
      `UPDATE users
       SET deleted_at      = CURRENT_TIMESTAMP,
           deletion_reason = 'User requested account deletion (GDPR Art. 17)',
           email           = $2,
           username        = $3,
           is_hard_banned  = TRUE
       WHERE firebase_uid  = $1`,
      [
        uid,
        `deleted_${Date.now()}@deleted.invalid`,
        `deleted_${user.id}_${Date.now()}`,
      ]
    );

    // Revoke Firebase session immediately
    await revokeUserSession(uid);

    logger.info("🗑️ GDPR account deletion", {
      uid:      uid.substring(0, 8),
      username: user.username,
    });

    res.json({
      message: "Account deletion initiated. Your personal data will be permanently deleted within 30 days.",
      deleted_at:  new Date().toISOString(),
      data_purge:  "Within 30 days",
      contact:     "katanas.reaper@gmail.com",
    });
  })
);

// ============================================================
// GET /api/gdpr/my-data
// Article 15 — Right of Access (summary view)
// ============================================================
router.get(
  "/my-data",
  authMeLimiter,
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const { uid } = req.firebaseUser!;

    const result = await pool.query(
      `SELECT
         username, email, level, created_at,
         trust_score, is_shadow_banned, is_hard_banned,
         total_flags, onboarding_completed
       FROM users
       WHERE firebase_uid = $1 LIMIT 1`,
      [uid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message:         "Data we hold about you (GDPR Article 15)",
      data:            result.rows[0],
      full_export_url: "/api/gdpr/export",
      delete_url:      "DELETE /api/gdpr/delete-account",
      contact:         "katanas.reaper@gmail.com",
      rights: [
        "Right of Access (Art. 15) — GET /api/gdpr/my-data",
        "Right to Portability (Art. 20) — GET /api/gdpr/export",
        "Right to Erasure (Art. 17) — DELETE /api/gdpr/delete-account",
        "Right to Rectification (Art. 16) — Email katanas.reaper@gmail.com",
        "Right to Object (Art. 21) — Email katanas.reaper@gmail.com",
      ],
    });
  })
);

export default router;
