import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { referralLimiter } from "../middleware/rateLimiter";
import { noCache } from "../middleware/cacheHeaders";
import { asyncHandler } from "../utils/asyncHandler";
import { pool } from "../config/database";
import { NotFoundError } from "../utils/errors";
import { generateReferralCode, applyReferralCode, getReferralStats } from "../services/referralService";

const router = Router();
router.use(noCache);

router.get("/my-code", verifyFirebaseToken, referralLimiter, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query<{ id: number }>(
    `SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`, [uid]
  );
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const code = await generateReferralCode(userR.rows[0].id);
  res.json({ referralCode: code });
}));

router.post("/apply", verifyFirebaseToken, referralLimiter, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const { code } = req.body as { code: string };
  const userR = await pool.query<{ id: number }>(
    `SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`, [uid]
  );
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const result = await applyReferralCode(userR.rows[0].id, code);
  res.json({ message: "Referral code applied", ...result });
}));

router.get("/stats", verifyFirebaseToken, referralLimiter, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query<{ id: number }>(
    `SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`, [uid]
  );
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const stats = await getReferralStats(userR.rows[0].id);
  res.json(stats);
}));

export default router;
