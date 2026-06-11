import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { bankLimiter as propLimiter } from "../middleware/rateLimiter";
import { validate } from "../middleware/validate";
import { idempotencyCheck } from "../middleware/idempotency";
import { asyncHandler } from "../utils/asyncHandler";
import { pool } from "../config/database";
import { NotFoundError } from "../utils/errors";
import { z } from "zod";
import { listProperties, buyProperty, collectIncome } from "../services/propertyService";

const buySchema = z.object({ propertyId: z.number().int().positive() });

const router = Router();

router.get("/", verifyFirebaseToken, propLimiter, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query(`SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`, [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const result = await listProperties(userR.rows[0].id);
  res.json(result);
}));

router.post("/buy", verifyFirebaseToken, propLimiter, validate(buySchema), idempotencyCheck, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query(`SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`, [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const result = await buyProperty(userR.rows[0].id, req.body.propertyId);
  res.json(result);
}));

router.post("/collect", verifyFirebaseToken, propLimiter, idempotencyCheck, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query(`SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`, [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const result = await collectIncome(userR.rows[0].id);
  res.json(result);
}));

export default router;
