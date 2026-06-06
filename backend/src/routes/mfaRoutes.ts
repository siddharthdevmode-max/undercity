import { Router }              from "express";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { mfaLimiter }          from "../middleware/rateLimiter";
import { noCache }             from "../middleware/cacheHeaders";
import { asyncHandler }        from "../utils/asyncHandler";
import { authAdmin }           from "../config/firebase";
import { redis }               from "../config/redis";
import { pool }                from "../config/database";
import { logger }              from "../utils/logger";

// ============================================================
// MFA ROUTES — /api/mfa
//
// Firebase handles actual 2FA enrollment on the client SDK.
// These routes: read MFA status, log changes, admin visibility.
//
// GET  /status       — Check if user has MFA enrolled
// GET  /instructions — Static onboarding guide
// POST /log-change   — Frontend calls this after enrolling/removing
//                      MFA so we can update our DB + audit log
//
// CACHING:
//   MFA status is cached in Redis for 5 minutes per uid.
//   Firebase Admin SDK getUser() is a network call —
//   don't make it on every poll from the frontend.
//
// RATE LIMITING:
//   mfaLimiter (10 req / 15 min) — tighter than authMeLimiter.
// ============================================================

const router = Router();

// ── Cache config ───────────────────────────────────────────
const MFA_STATUS_CACHE_TTL = 5 * 60; // 5 minutes

// ── Never cache MFA responses ─────────────────────────────
router.use(noCache);

// ── MFA status cache helpers ───────────────────────────────

interface MfaStatus {
  mfaEnabled: boolean;
  factors:    Array<{
    uid:            string;
    displayName:    string | undefined;
    factorId:       string;
    enrollmentTime: string | undefined;
  }>;
}

async function getCachedMfaStatus(uid: string): Promise<MfaStatus | null> {
  try {
    const cached = await redis.get(`mfa:status:${uid}`);
    return cached ? (JSON.parse(cached) as MfaStatus) : null;
  } catch {
    return null;
  }
}

async function setCachedMfaStatus(uid: string, status: MfaStatus): Promise<void> {
  try {
    await redis.set(
      `mfa:status:${uid}`,
      JSON.stringify(status),
      "EX",
      MFA_STATUS_CACHE_TTL
    );
  } catch {
    // Non-fatal
  }
}

async function invalidateMfaCache(uid: string): Promise<void> {
  try {
    await redis.del(`mfa:status:${uid}`);
  } catch {
    // Non-fatal
  }
}

// ============================================================
// GET /api/mfa/status
// ============================================================
router.get(
  "/status",
  mfaLimiter,
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const { uid } = req.firebaseUser!;

    // ── Try cache first ────────────────────────────────────
    const cached = await getCachedMfaStatus(uid);
    if (cached) {
      res.json({ ...cached, _cached: true });
      return;
    }

    // ── Firebase Admin SDK call ────────────────────────────
    try {
      const userRecord = await authAdmin.getUser(uid);
      const enrolled   = userRecord.multiFactor?.enrolledFactors ?? [];
      const hasMfa     = enrolled.length > 0;

      const status: MfaStatus = {
        mfaEnabled: hasMfa,
        factors: enrolled.map((f) => ({
          uid:            f.uid,
          displayName:    f.displayName ?? undefined,
          factorId:       f.factorId,
          enrollmentTime: f.enrollmentTime ?? undefined,
        })),
      };

      // Cache the result
      await setCachedMfaStatus(uid, status);

      res.json(status);

    } catch (err) {
      logger.warn("MFA: Firebase getUser failed", {
        uid:   uid.substring(0, 8),
        error: err instanceof Error ? err.message : String(err),
      });
      // Fail gracefully — return unknown state
      res.json({ mfaEnabled: false, factors: [], _error: "status_unavailable" });
    }
  })
);

// ============================================================
// GET /api/mfa/instructions
// Static content — could be frontend-only but kept here
// for API completeness and localization future-proofing.
// ============================================================
router.get(
  "/instructions",
  mfaLimiter,
  verifyFirebaseToken,
  asyncHandler(async (_req, res) => {
    res.json({
      message:          "Enable 2FA via Firebase Multi-Factor Authentication.",
      supportedMethods: ["SMS (phone number)"],
      steps: [
        "Open Account Settings in Undercity",
        "Click 'Enable Two-Factor Authentication'",
        "Enter your phone number",
        "Enter the SMS verification code",
        "Save your backup codes in a secure location",
      ],
      notes: [
        "Backup codes can be used if you lose phone access",
        "Removing your phone also disables MFA",
        "Contact support if locked out",
      ],
      supportEmail: "support@undercity.gg",
    });
  })
);

// ============================================================
// POST /api/mfa/log-change
// Called by the frontend after the user enrolls or removes MFA
// via the Firebase client SDK. We record this in the audit log
// and invalidate the status cache.
//
// Body: { action: "enrolled" | "removed", factorId: string }
// ============================================================
router.post(
  "/log-change",
  mfaLimiter,
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const { uid } = req.firebaseUser!;
    const { action, factorId } = req.body as {
      action?:   unknown;
      factorId?: unknown;
    };

    // Validate action
    if (action !== "enrolled" && action !== "removed") {
      res.status(400).json({
        message: "action must be 'enrolled' or 'removed'",
        code:    "ERR_2001",
      });
      return;
    }

    const safeFactorId = typeof factorId === "string"
      ? factorId.substring(0, 100)
      : "unknown";

    // ── Invalidate cache — force fresh fetch next time ─────
    await invalidateMfaCache(uid);

    // ── Audit log ──────────────────────────────────────────
    void pool.query(
      `INSERT INTO admin_audit_log
         (admin_firebase_uid, action_type, details, ip_address)
       VALUES ($1, $2, $3, $4)`,
      [
        uid,
        action === "enrolled" ? "MFA_ENROLLED" : "MFA_REMOVED",
        JSON.stringify({ factorId: safeFactorId }),
        req.ip ?? "unknown",
      ]
    ).catch((err: Error) => {
      logger.error("MFA: audit log write failed", { error: err.message });
    });

    logger.info(`🔐 MFA ${action}`, {
      uid:      uid.substring(0, 8),
      factorId: safeFactorId,
    });

    res.json({ message: `MFA ${action} recorded.` });
  })
);

export default router;
