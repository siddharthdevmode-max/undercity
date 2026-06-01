import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { getCrimes, attemptCrime } from "../controllers/crimeController";

const router = Router();

// GET /api/crimes — list all crimes with user progress
router.get("/", verifyFirebaseToken, getCrimes);

// POST /api/crimes/attempt — attempt a crime
router.post("/attempt", verifyFirebaseToken, attemptCrime);

export default router;