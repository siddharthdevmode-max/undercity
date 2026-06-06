import { Router }              from "express";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { verifyChallenge }     from "../middleware/challengeVerifier";
import { crimeLimiter }        from "../middleware/rateLimiter";
import { checkBanStatus }      from "../middleware/banCheck";
import { idempotencyCheck }    from "../middleware/idempotency";
import { verifyTurnstile }     from "../middleware/turnstileVerifier";
import { validate }            from "../middleware/validate";
import { mediumCache, noCache } from "../middleware/cacheHeaders";
import { asyncHandler }        from "../utils/asyncHandler";
import { attemptCrimeSchema }  from "../utils/schemas";
import {
  getCrimes,
  attemptCrime,
}                              from "../controllers/crimeController";

// ============================================================
// CRIME ROUTES — /api/crimes
//
// GET  /         — List available crimes (cached 5 min)
// POST /attempt  — Attempt a crime (full UAC gauntlet)
//
// MIDDLEWARE ORDER ON POST /attempt (important):
//   1. verifyFirebaseToken  — who are you?
//   2. checkBanStatus       — are you banned?
//   3. crimeLimiter         — are you spamming?
//   4. verifyTurnstile      — are you human? (low-trust users)
//   5. verifyChallenge      — do you have a valid UAC token?
//   6. idempotencyCheck     — is this a duplicate request?
//   7. validate             — is the payload valid?
//   8. attemptCrime         — execute the crime
//
// ORDERING RATIONALE:
//   - verifyTurnstile BEFORE verifyChallenge:
//     Turnstile failure = no point consuming/checking challenge token
//   - verifyTurnstile BEFORE idempotencyCheck:
//     No point storing idempotency key if Turnstile fails
//   - validate LAST before handler:
//     Schema validation after all security gates pass
// ============================================================

const router = Router();

// ── GET /api/crimes ────────────────────────────────────────
// Crime list changes rarely — cache 5 minutes (private, per user
// because crime availability may differ by level/trust in future)

router.get(
  "/",
  verifyFirebaseToken,
  checkBanStatus,
  mediumCache,          // private, max-age=300 — per Round 9 cacheHeaders
  asyncHandler(getCrimes)
);

// ── POST /api/crimes/attempt ───────────────────────────────

router.post(
  "/attempt",
  verifyFirebaseToken,  // 1. Auth
  checkBanStatus,       // 2. Ban check
  crimeLimiter,         // 3. Rate limit
  verifyTurnstile,      // 4. Human check (low-trust users)
  verifyChallenge,      // 5. UAC token
  idempotencyCheck,     // 6. Dedup
  validate(attemptCrimeSchema), // 7. Schema
  noCache,              // 8. Never cache crime results
  asyncHandler(attemptCrime)    // 9. Execute
);

export default router;
