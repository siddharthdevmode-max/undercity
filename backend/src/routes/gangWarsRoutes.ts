import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { bankLimiter as gangLimiter } from "../middleware/rateLimiter";
import { noCache } from "../middleware/cacheHeaders";
import { asyncHandler } from "../utils/asyncHandler";
import { pool } from "../config/database";
import { NotFoundError } from "../utils/errors";
import { getWars, declareWar } from "../services/gangWarsService";

const router = Router();
router.use(noCache);

router.get("/", verifyFirebaseToken, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query("SELECT id FROM users WHERE firebase_uid = $1", [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const memberR = await pool.query("SELECT gang_id FROM gang_members WHERE user_id = $1", [userR.rows[0].id]);
  if (memberR.rows.length === 0) { res.json({ wars: [] }); return; }
  const wars = await getWars(memberR.rows[0].gang_id);
  res.json({ wars });
}));

router.post("/declare", verifyFirebaseToken, gangLimiter, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query("SELECT id FROM users WHERE firebase_uid = $1", [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  await declareWar(userR.rows[0].id, req.body.gangId);
  res.json({ message: "War declared" });
}));

export default router;
