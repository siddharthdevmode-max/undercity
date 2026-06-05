import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { authMeLimiter } from "../middleware/rateLimiter";
import { asyncHandler } from "../utils/asyncHandler";
import { authAdmin } from "../config/firebase";

// ============================================================
// MFA ROUTES
// Firebase handles actual 2FA enrollment on the client.
// These routes: check status, return instructions
// ============================================================

const router = Router();

// ── GET /api/mfa/status ────────────────────────────────────
router.get(
  "/status",
  authMeLimiter,
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const { uid } = req.firebaseUser!;

    try {
      const userRecord = await authAdmin.getUser(uid);
      const hasMfa     = (userRecord.multiFactor?.enrolledFactors?.length ?? 0) > 0;
      const factors    = userRecord.multiFactor?.enrolledFactors?.map((f) => ({
        uid:            f.uid,
        displayName:    f.displayName,
        factorId:       f.factorId,
        enrollmentTime: f.enrollmentTime,
      })) ?? [];

      res.json({ mfaEnabled: hasMfa, factors });
    } catch {
      res.json({ mfaEnabled: false, factors: [] });
    }
  })
);

// ── GET /api/mfa/instructions ─────────────────────────────
router.get(
  "/instructions",
  authMeLimiter,
  verifyFirebaseToken,
  asyncHandler(async (_req, res) => {
    res.json({
      message: "To enable 2FA, use Firebase Multi-Factor Authentication in app settings.",
      steps: [
        "Go to Account Settings in Undercity",
        "Click Enable Two-Factor Authentication",
        "Add your phone number",
        "Verify with the SMS code",
        "Save your backup codes",
      ],
      supportedMethods: ["SMS (phone number)"],
    });
  })
);

export default router;
