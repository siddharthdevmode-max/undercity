import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { bankLimiter as jobLimiter } from "../middleware/rateLimiter";
import { validate } from "../middleware/validate";
import { idempotencyCheck } from "../middleware/idempotency";
import { asyncHandler } from "../utils/asyncHandler";
import { pool } from "../config/database";
import { NotFoundError } from "../utils/errors";
import { z } from "zod";
import { listJobs, applyJob, work, quitJob } from "../services/jobService";

const applySchema = z.object({ jobId: z.number().int().positive() });

const router = Router();

router.get("/", verifyFirebaseToken, jobLimiter, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query(`SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`, [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const result = await listJobs(userR.rows[0].id);
  res.json(result);
}));

router.post("/apply", verifyFirebaseToken, jobLimiter, validate(applySchema), asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query(`SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`, [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const result = await applyJob(userR.rows[0].id, req.body.jobId);
  res.json(result);
}));

router.post("/work", verifyFirebaseToken, jobLimiter, idempotencyCheck, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query(`SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`, [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const result = await work(userR.rows[0].id);
  res.json(result);
}));

router.post("/quit", verifyFirebaseToken, jobLimiter, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query(`SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`, [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const result = await quitJob(userR.rows[0].id);
  res.json(result);
}));

export default router;
