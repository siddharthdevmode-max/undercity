import { Router } from "express";
import { pool } from "../config/database";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { revokeUserSession } from "../middleware/firebaseAuth";
import { authMeLimiter } from "../middleware/rateLimiter";
import { asyncHandler } from "../utils/asyncHandler";
import { logger } from "../utils/logger";
import { noCache } from "../middleware/cacheHeaders";

// ============================================================
// PRIVACY / COMPLIANCE ROUTES
// GDPR Articles 15, 17, 20
// CCPA Section 1798.100, 1798.105, 1798.110
// ============================================================

const router = Router();

// All privacy routes — never cache
router.use(noCache);

// ============================================================
// GET /api/gdpr/export — Article 20 + CCPA 1798.110
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
        `SELECT id, username, email, level, money, points,
                nerve, max_nerve, life, max_life,
                onboarding_completed, created_at
         FROM users WHERE firebase_uid = $1 LIMIT 1`,
        [uid]
      ),
      pool.query(
        `SELECT c.name, c.tier, ucp.crime_level, ucp.crime_xp,
                ucp.attempts, ucp.successes, ucp.failures, ucp.updated_at
         FROM user_crime_progress ucp
         JOIN crimes c ON c.id = ucp.crime_id
         JOIN users  u ON u.id = ucp.user_id
         WHERE u.firebase_uid = $1`,
        [uid]
      ),
      pool.query(
        `SELECT violation_type, severity, created_at
         FROM uac_violations WHERE firebase_uid = $1
         ORDER BY created_at DESC`,
        [uid]
      ),
      pool.query(
        `SELECT ip_address, last_seen, hit_count
         FROM device_fingerprints WHERE firebase_uid = $1
         ORDER BY last_seen DESC`,
        [uid]
      ),
      pool.query(
        `SELECT ip_address, is_new_ip, accessed_at
         FROM auth_access_log WHERE firebase_uid = $1
         ORDER BY accessed_at DESC`,
        [uid]
      ).catch(() => ({ rows: [] })),
    ]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const exportData = {
      exported_at:    new Date().toISOString(),
      gdpr_notice:    "All personal data we hold about you (GDPR Art. 20 / CCPA §1798.110).",
      ccpa_notice:    "California residents have the right to know, delete, and opt-out of sale of personal information.",
      contact:        "katanas.reaper@gmail.com",
      account:        userResult.rows[0],
      game_progress:  crimeProgressResult.rows,
      security_log:   violationsResult.rows,
      devices:        fingerprintsResult.rows,
      login_history:  authLogResult.rows,
      data_sold:      false,
      data_shared_with_third_parties: false,
    };

    logger.info("📦 GDPR/CCPA data export", { uid: uid.substring(0, 8) });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="undercity-data-${Date.now()}.json"`
    );
    res.setHeader("Content-Type", "application/json");
    res.json(exportData);
  })
);

// ============================================================
// DELETE /api/gdpr/delete-account — Article 17 + CCPA 1798.105
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
      return res.status(404).json({
        message: "User not found or already deleted",
      });
    }

    const user = userResult.rows[0] as {
      id: number;
      username: string;
      email: string;
    };

    await pool.query(
      `UPDATE users
       SET deleted_at      = CURRENT_TIMESTAMP,
           deletion_reason = 'User requested account deletion (GDPR Art. 17 / CCPA §1798.105)',
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

    await revokeUserSession(uid);

    logger.info("🗑️ Account deletion initiated", {
      uid:      uid.substring(0, 8),
      username: user.username,
    });

    res.json({
      message:     "Account deletion initiated. Personal data permanently deleted within 30 days.",
      deleted_at:  new Date().toISOString(),
      data_purge:  "Within 30 days",
      contact:     "katanas.reaper@gmail.com",
      gdpr_basis:  "GDPR Article 17 — Right to Erasure",
      ccpa_basis:  "CCPA Section 1798.105 — Right to Delete",
    });
  })
);

// ============================================================
// GET /api/gdpr/my-data — Article 15 + CCPA 1798.100
// ============================================================
router.get(
  "/my-data",
  authMeLimiter,
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const { uid } = req.firebaseUser!;

    const result = await pool.query(
      `SELECT username, email, level, created_at,
              trust_score, is_shadow_banned, is_hard_banned,
              total_flags, onboarding_completed
       FROM users WHERE firebase_uid = $1 LIMIT 1`,
      [uid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message:         "Data we hold about you (GDPR Art. 15 / CCPA §1798.100)",
      data:            result.rows[0],
      data_sold:       false,
      data_shared:     false,
      full_export_url: "/api/gdpr/export",
      delete_url:      "DELETE /api/gdpr/delete-account",
      contact:         "katanas.reaper@gmail.com",
      gdpr_rights: [
        "Right of Access (Art. 15)       — GET  /api/gdpr/my-data",
        "Right to Portability (Art. 20)  — GET  /api/gdpr/export",
        "Right to Erasure (Art. 17)      — DELETE /api/gdpr/delete-account",
        "Right to Rectification (Art. 16)— Email katanas.reaper@gmail.com",
        "Right to Object (Art. 21)       — Email katanas.reaper@gmail.com",
      ],
      ccpa_rights: [
        "Right to Know (§1798.100)       — GET  /api/gdpr/my-data",
        "Right to Know Categories (§1798.110) — GET /api/gdpr/export",
        "Right to Delete (§1798.105)     — DELETE /api/gdpr/delete-account",
        "Right to Opt-Out of Sale        — We do not sell your data",
        "Right to Non-Discrimination     — Exercising rights won't affect service",
      ],
    });
  })
);

// ============================================================
// GET /api/gdpr/privacy-choices — CCPA opt-out page
// ============================================================
router.get(
  "/privacy-choices",
  asyncHandler(async (_req, res) => {
    res.json({
      data_sold:         false,
      data_shared:       false,
      opt_out_available: false,
      message:           "Undercity does not sell or share personal data with third parties.",
      contact:           "katanas.reaper@gmail.com",
      last_updated:      "2026-01-01",
    });
  })
);

export default router;
