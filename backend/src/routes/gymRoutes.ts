import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { bankLimiter as gymLimiter } from "../middleware/rateLimiter";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { pool } from "../config/database";
import { NotFoundError } from "../utils/errors";
import { z } from "zod";
import { train, getStats } from "../services/gymService";

const trainSchema = z.object({ stat: z.enum(["strength", "speed", "defense", "dexterity"]) });

const router = Router();

router.get("/", verifyFirebaseToken, gymLimiter, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query(`SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`, [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const stats = await getStats(userR.rows[0].id);
  res.json(stats);
}));

router.post("/train", verifyFirebaseToken, gymLimiter, validate(trainSchema), asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query(`SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`, [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const result = await train(userR.rows[0].id, req.body.stat);
  res.json(result);
}));

export default router;
