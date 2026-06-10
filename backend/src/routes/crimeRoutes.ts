// ============================================================
// CRIME ROUTES — /api/crimes
//
// GET  /         — List available crimes
// POST /attempt  — Attempt a crime (full UAC gauntlet)
//
// MIDDLEWARE ORDER ON POST /attempt:
//   1. verifyFirebaseToken  — who are you?
//   2. checkBanStatus       — are you banned?
//   3. crimeLimiter         — are you spamming?
//   4. verifyTurnstile      — are you human? (low-trust users)
//   5. verifyChallenge      — do you have a valid UAC token?
//   6. idempotencyCheck     — is this a duplicate request?
//   7. validate             — is the payload valid?
//   8. noCache              — never cache crime results
//   9. attemptCrime         — execute
// ============================================================

import { Router }                    from "express";
import { verifyFirebaseToken }        from "../middleware/firebaseAuth";
import { checkBanStatus }             from "../middleware/banCheck";
import { crimeLimiter }               from "../middleware/rateLimiter";
import { verifyTurnstile }            from "../middleware/turnstileVerifier";
import { verifyChallenge }            from "../middleware/challengeVerifier";
import { idempotencyCheck }           from "../middleware/idempotency";
import { validate }                   from "../middleware/validate";
import { noCache, privateCache }      from "../middleware/cacheHeaders";
import { asyncHandler }               from "../utils/asyncHandler";
import { attemptCrimeSchema }         from "../utils/schemas";
import { getCrimes, attemptCrime }    from "../controllers/crimeController";

const router = Router();

// ── GET /api/crimes ────────────────────────────────────────
// BUG FIX: changed from mediumCache (5 min) to privateCache (60s)
// mediumCache was hiding newly unlocked crimes after level-up for 5 minutes
// Crime list is user-specific (unlocked status depends on level)

router.get(
  "/",
  verifyFirebaseToken,
  checkBanStatus,
  privateCache,
  asyncHandler(getCrimes)
);

// ── POST /api/crimes/attempt ───────────────────────────────

router.post(
  "/attempt",
  verifyFirebaseToken,
  checkBanStatus,
  crimeLimiter,
  verifyTurnstile,
  verifyChallenge,
  idempotencyCheck,
  validate(attemptCrimeSchema),
  noCache,
  asyncHandler(attemptCrime)
);

export default router;
