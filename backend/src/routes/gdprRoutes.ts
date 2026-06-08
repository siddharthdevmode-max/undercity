import { Router }              from "express";
import { pool }                from "../config/database";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { revokeUserSession }   from "../middleware/firebaseAuth";
import {
  gdprLimiter,
  authMeLimiter,
}                              from "../middleware/rateLimiter";
import { asyncHandler }        from "../utils/asyncHandler";
import { validate }            from "../middleware/validate";
import { gdprDeleteSchema }    from "../utils/schemas";
import { noCache }             from "../middleware/cacheHeaders";
import { logger }              from "../utils/logger";
import { queueEmail }          from "../queues/index";
import { invalidateBanCache }  from "../middleware/banCheck";
import { invalidateRoleCache } from "../middleware/requireAdmin";
import { NotFoundError } from "../utils/errors";

// ============================================================
// GDPR / PRIVACY ROUTES — /api/gdpr
//
// GDPR Articles implemented:
//   Art. 15 — Right of Access         → GET  /my-data
//   Art. 17 — Right to Erasure        → DELETE /delete-account
//   Art. 20 — Right to Portability    → GET  /export
//
// CCPA Sections implemented:
//   §1798.100 — Right to Know         → GET  /my-data
//   §1798.105 — Right to Delete       → DELETE /delete-account
//   §1798.110 — Right to Know (cat.)  → GET  /export
//
// All routes: noCache header
// All authenticated routes: gdprLimiter (3 req/24h) or authMeLimiter
// ============================================================

const router = Router();

// Never cache any GDPR response
router.use(noCache);

// ── IP masking helper ──────────────────────────────────────
// Mask last octet of IPv4 / last group of IPv6 in exports
function maskIp(ip: string | null | undefined): string {
  if (!ip) return "hidden";
  // IPv4
  const v4 = ip.match(/^(\d+\.\d+\.\d+)\.\d+$/);
  if (v4) return `${v4[1]}.xxx`;
  // IPv6 — mask last 4 groups
  if (ip.includes(":")) {
    const parts = ip.split(":");
    return [...parts.slice(0, 4), "xxxx", "xxxx", "xxxx", "xxxx"].join(":");
  }
  return "hidden";
}

// ============================================================
// GET /api/gdpr/my-data — Art. 15 + CCPA §1798.100
// Summary view — what data we hold
// ============================================================
router.get(
  "/my-data",
  authMeLimiter,
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const { uid } = req.firebaseUser!;

    const result = await pool.query(
      `SELECT username, email, level, trust_score,
              is_shadow_banned, is_hard_banned,
              total_flags, onboarding_completed,
              created_at, last_seen_at
       FROM users
       WHERE firebase_uid = $1
         AND deleted_at   IS NULL
       LIMIT 1`,
      [uid]
    );

    if (result.rows.length === 0) throw new NotFoundError("User");

    res.json({
      gdpr_article:    "Art. 15 — Right of Access",
      ccpa_section:    "§1798.100 — Right to Know",
      message:         "Summary of personal data we hold about you.",
      data:            result.rows[0],
      data_sold:       false,
      data_shared:     false,
      full_export_url: "GET /api/gdpr/export",
      delete_url:      "DELETE /api/gdpr/delete-account",
      contact:         "privacy@undercity.online",
      your_rights: {
        gdpr: [
          "Art. 15 — Access:         GET  /api/gdpr/my-data",
          "Art. 20 — Portability:    GET  /api/gdpr/export",
          "Art. 17 — Erasure:        DELETE /api/gdpr/delete-account",
          "Art. 16 — Rectification:  Email privacy@undercity.online",
          "Art. 21 — Object:         Email privacy@undercity.online",
        ],
        ccpa: [
          "§1798.100 — Know:         GET  /api/gdpr/my-data",
          "§1798.110 — Know (cat.):  GET  /api/gdpr/export",
          "§1798.105 — Delete:       DELETE /api/gdpr/delete-account",
          "Opt-out of sale:          We do not sell your data",
          "Non-discrimination:       Exercising rights won't affect service",
        ],
      },
    });
  })
);

// ============================================================
// GET /api/gdpr/export — Art. 20 + CCPA §1798.110
// Full machine-readable export — rate limited to 3/day
// ============================================================
router.get(
  "/export",
  gdprLimiter,
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const { uid } = req.firebaseUser!;

    const [
      userR,
      crimeR,
      violationsR,
      fingerprintsR,
      authLogR,
    ] = await Promise.all([
      pool.query(
        `SELECT id, username, email, level, money, points,
                nerve, max_nerve, life, max_life,
                energy, max_energy, happiness,
                onboarding_completed, created_at, last_seen_at
         FROM users
         WHERE firebase_uid = $1
           AND deleted_at   IS NULL
         LIMIT 1`,
        [uid]
      ),
      pool.query(
        `SELECT c.name, c.tier,
                ucp.crime_level, ucp.crime_xp,
                ucp.attempts, ucp.successes, ucp.failures,
                ucp.updated_at
         FROM user_crime_progress ucp
         JOIN crimes c ON c.id  = ucp.crime_id
         JOIN users  u ON u.id  = ucp.user_id
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

    if (userR.rows.length === 0) throw new NotFoundError("User");

    // Mask IPs in export — GDPR Recital 26 (pseudonymization)
    const maskedDevices = fingerprintsR.rows.map((row: {
      ip_address: string; last_seen: string; hit_count: number
    }) => ({
      ip_address: maskIp(row.ip_address),
      last_seen:  row.last_seen,
      hit_count:  row.hit_count,
    }));

    const maskedAuthLog = authLogR.rows.map((row: {
      ip_address: string; is_new_ip: boolean; accessed_at: string
    }) => ({
      ip_address: maskIp(row.ip_address),
      is_new_ip:  row.is_new_ip,
      accessed_at: row.accessed_at,
    }));

    const exportData = {
      exported_at:   new Date().toISOString(),
      format:        "GDPR Art. 20 portable data export",
      contact:       "privacy@undercity.online",
      gdpr_notice:   "All personal data held under GDPR Art. 20 / CCPA §1798.110",
      account:       userR.rows[0],
      game_progress: crimeR.rows,
      security_log:  violationsR.rows,
      devices:       maskedDevices,
      login_history: maskedAuthLog,
      data_sold:     false,
      data_shared_with_third_parties: false,
      ip_note:       "IP addresses are partially masked (GDPR pseudonymization). Full IPs available to law enforcement via valid legal request.",
    };

    logger.info("📦 GDPR data export", { uid: uid.substring(0, 8) });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="undercity-data-${Date.now()}.json"`
    );
    res.setHeader("Content-Type", "application/json");
    res.json(exportData);
  })
);

// ============================================================
// DELETE /api/gdpr/delete-account — Art. 17 + CCPA §1798.105
// Requires { confirm: "DELETE MY ACCOUNT" } in body
// Rate limited to 3/day — prevents abuse
// ============================================================
router.delete(
  "/delete-account",
  gdprLimiter,
  verifyFirebaseToken,
  validate(gdprDeleteSchema),
  asyncHandler(async (req, res) => {
    const { uid, email } = req.firebaseUser!;
    // gdprDeleteSchema already validated confirm === "DELETE MY ACCOUNT"

    const userResult = await pool.query(
      `SELECT id, username, email
       FROM users
       WHERE firebase_uid = $1
         AND deleted_at   IS NULL
       LIMIT 1`,
      [uid]
    );

    if (userResult.rows.length === 0) {
      throw new NotFoundError("User");
    }

    const user = userResult.rows[0] as { id: number; username: string; email: string };

    // ── Soft delete + PII anonymization ───────────────────
    await pool.query(
      `UPDATE users
       SET    deleted_at      = NOW(),
              deletion_reason = 'User invoked GDPR Art. 17 / CCPA §1798.105 right to erasure',
              email           = $2,
              username        = $3,
              is_hard_banned  = TRUE,
              updated_at      = NOW()
       WHERE  firebase_uid    = $1`,
      [
        uid,
        `deleted_${Date.now()}@deleted.invalid`,
        `deleted_${user.id}`,
      ]
    );

    // Revoke Firebase token — force sign-out
    await revokeUserSession(uid);

    // Invalidate caches
    await Promise.allSettled([
      invalidateBanCache(uid),
      invalidateRoleCache(uid),
    ]);

    // Audit trail (GDPR requires you to log erasure requests)
    void pool.query(
      `INSERT INTO admin_audit_log
         (admin_firebase_uid, action_type, details, ip_address)
       VALUES ($1, 'GDPR_ERASURE_REQUEST', $2, $3)`,
      [
        "system",
        JSON.stringify({
          userId:   user.id,
          username: user.username, // captured before erasure
          requestedAt: new Date().toISOString(),
          basis:    "GDPR Art. 17 / CCPA §1798.105",
        }),
        req.ip ?? "unknown",
      ]
    ).catch(() => {});

    // Send deletion confirmation (best-effort, to original email)
    const originalEmail = email ?? user.email;
    if (originalEmail && !originalEmail.includes("@deleted.invalid")) {
      void queueEmail({
        type:     "ban_notice",
        to:       originalEmail,
        username: user.username,
        reason:   "You requested account deletion. Your data will be purged within 30 days.",
      }).catch(() => {});
    }

    logger.info("🗑️ GDPR account deletion", {
      uid:      uid.substring(0, 8),
      userId:   user.id,
    });

    res.json({
      message:    "Account deleted. Personal data will be purged within 30 days per GDPR Art. 17.",
      deleted_at: new Date().toISOString(),
      data_purge: "Within 30 calendar days",
      contact:    "privacy@undercity.online",
      legal_basis: {
        gdpr: "Article 17 — Right to Erasure",
        ccpa: "Section 1798.105 — Right to Delete",
      },
    });
  })
);

// ============================================================
// GET /api/gdpr/privacy-choices — CCPA opt-out + do-not-sell
// Public endpoint — no auth, no rate limit (informational only)
// ============================================================
router.get(
  "/privacy-choices",
  asyncHandler(async (_req, res) => {
    res.json({
      data_sold:            false,
      data_shared:          false,
      targeted_advertising: false,
      opt_out_available:    false,
      message:              "Undercity does not sell, share, or use personal data for targeted advertising.",
      contact:              "privacy@undercity.online",
      last_updated:         "2026-01-01",
      frameworks:           ["GDPR", "CCPA", "PIPEDA"],
    });
  })
);

export default router;
