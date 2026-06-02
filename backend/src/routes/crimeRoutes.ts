import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { verifyChallenge } from "../middleware/securityHeaders";
import { crimeLimiter } from "../middleware/rateLimiter";
import { checkBanStatus } from "../middleware/banCheck";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { attemptCrimeSchema } from "../utils/schemas";
import { getCrimes, attemptCrime } from "../controllers/crimeController";

const router = Router();

router.get(
  "/",
  verifyFirebaseToken,
  checkBanStatus,
  asyncHandler(getCrimes)
);

router.post(
  "/attempt",
  verifyFirebaseToken,
  checkBanStatus,
  crimeLimiter,
  verifyChallenge,
  validate(attemptCrimeSchema),
  asyncHandler(attemptCrime)
);

export default router;
