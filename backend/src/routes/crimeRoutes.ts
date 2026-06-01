import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { verifyChallenge } from "../middleware/securityHeaders";
import { crimeLimiter } from "../middleware/rateLimiter";
import { checkBanStatus } from "../middleware/banCheck";
import { getCrimes, attemptCrime } from "../controllers/crimeController";

const router = Router();

router.get(
  "/",
  verifyFirebaseToken,
  checkBanStatus,
  getCrimes
);

router.post(
  "/attempt",
  verifyFirebaseToken,
  checkBanStatus,      // 1. Block hard-banned users immediately
  crimeLimiter,        // 2. Rate limit
  verifyChallenge,     // 3. Verify one-time token
  attemptCrime         // 4. Process crime
);

export default router;
