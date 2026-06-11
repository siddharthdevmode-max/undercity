import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { bankLimiter as travelLimiter } from "../middleware/rateLimiter";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { pool } from "../config/database";
import { NotFoundError } from "../utils/errors";
import { z } from "zod";
import { listCities, startFlight, getTravelStatus, returnHome } from "../services/travelService";

const flySchema = z.object({ cityId: z.number().int().positive() });

const router = Router();

router.get("/cities", verifyFirebaseToken, travelLimiter, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query(`SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`, [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const result = await listCities(userR.rows[0].id);
  res.json(result);
}));

router.post("/fly", verifyFirebaseToken, travelLimiter, validate(flySchema), asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query(`SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`, [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const result = await startFlight(userR.rows[0].id, req.body.cityId);
  res.json(result);
}));

router.get("/status", verifyFirebaseToken, travelLimiter, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query(`SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`, [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const result = await getTravelStatus(userR.rows[0].id);
  res.json(result);
}));

router.post("/return", verifyFirebaseToken, travelLimiter, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query(`SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`, [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const result = await returnHome(userR.rows[0].id);
  res.json(result);
}));

export default router;
