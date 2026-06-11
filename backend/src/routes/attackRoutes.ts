import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { crimeLimiter as attackLimiter } from "../middleware/rateLimiter";
import { validate } from "../middleware/validate";
import { idempotencyCheck } from "../middleware/idempotency";
import { asyncHandler } from "../utils/asyncHandler";
import { pool } from "../config/database";
import { NotFoundError } from "../utils/errors";
import { z } from "zod";
import { searchTarget, attack, getAttackLog } from "../services/attackService";

const attackSchema = z.object({ targetId: z.number().int().positive() });

const router = Router();

router.get("/search", verifyFirebaseToken, attackLimiter, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query(`SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`, [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const target = await searchTarget(userR.rows[0].id);
  res.json(target);
}));

router.post("/attack", verifyFirebaseToken, attackLimiter, validate(attackSchema), idempotencyCheck, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query(`SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`, [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const result = await attack(userR.rows[0].id, req.body.targetId);
  res.json(result);
}));

router.get("/log", verifyFirebaseToken, attackLimiter, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query(`SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`, [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const log = await getAttackLog(userR.rows[0].id);
  res.json({ log });
}));

export default router;
