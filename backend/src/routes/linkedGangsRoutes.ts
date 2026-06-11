import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { bankLimiter as gangLimiter } from "../middleware/rateLimiter";
import { noCache } from "../middleware/cacheHeaders";
import { asyncHandler } from "../utils/asyncHandler";
import { pool } from "../config/database";
import { NotFoundError } from "../utils/errors";
import { getAlliances, requestAlliance, respondAlliance } from "../services/linkedGangsService";

const router = Router();
router.use(noCache);

router.get("/", verifyFirebaseToken, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query("SELECT id FROM users WHERE firebase_uid = $1", [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const memberR = await pool.query("SELECT gang_id FROM gang_members WHERE user_id = $1", [userR.rows[0].id]);
  if (memberR.rows.length === 0) { res.json({ alliances: [] }); return; }
  const alliances = await getAlliances(memberR.rows[0].gang_id);
  res.json({ alliances });
}));

router.post("/request", verifyFirebaseToken, gangLimiter, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query("SELECT id FROM users WHERE firebase_uid = $1", [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  await requestAlliance(userR.rows[0].id, req.body.gangId);
  res.json({ message: "Alliance requested" });
}));

router.post("/respond", verifyFirebaseToken, gangLimiter, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query("SELECT id FROM users WHERE firebase_uid = $1", [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  await respondAlliance(userR.rows[0].id, req.body.allianceId, req.body.accept);
  res.json({ message: "Response sent" });
}));

export default router;
