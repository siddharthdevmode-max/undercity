import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { bankLimiter as missionLimiter } from "../middleware/rateLimiter";
import { noCache } from "../middleware/cacheHeaders";
import { asyncHandler } from "../utils/asyncHandler";
import { pool } from "../config/database";
import { NotFoundError } from "../utils/errors";
import { getAvailable, startMission } from "../services/missionService";

const router = Router();
router.use(noCache);

router.get("/available", verifyFirebaseToken, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query("SELECT id FROM users WHERE firebase_uid = $1", [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const missions = await getAvailable(userR.rows[0].id);
  res.json({ missions });
}));

router.post("/start", verifyFirebaseToken, missionLimiter, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query("SELECT id FROM users WHERE firebase_uid = $1", [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const um = await startMission(userR.rows[0].id, req.body.missionId);
  res.json(um);
}));

export default router;
