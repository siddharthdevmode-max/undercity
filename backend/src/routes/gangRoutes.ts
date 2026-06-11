import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { bankLimiter as gangLimiter } from "../middleware/rateLimiter";
import { noCache } from "../middleware/cacheHeaders";
import { validate } from "../middleware/validate";
import { idempotencyCheck } from "../middleware/idempotency";
import { asyncHandler } from "../utils/asyncHandler";
import { pool } from "../config/database";
import { NotFoundError } from "../utils/errors";
import { z } from "zod";
import { create, getMyGang, getGangs, join, leave, kick } from "../services/gangService";

const createSchema = z.object({ name: z.string().min(2).max(50), tag: z.string().length(3).max(5), description: z.string().default("") });
const joinSchema = z.object({ gangId: z.number().int().positive() });
const kickSchema = z.object({ userId: z.number().int().positive() });

const router = Router();
router.use(noCache);

router.get("/list", verifyFirebaseToken, asyncHandler(async (_req, res) => { res.json(await getGangs()); }));

router.get("/my", verifyFirebaseToken, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query("SELECT id FROM users WHERE firebase_uid = $1", [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const result = await getMyGang(userR.rows[0].id);
  res.json(result || { gang: null });
}));

router.post("/create", verifyFirebaseToken, gangLimiter, validate(createSchema), idempotencyCheck, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query("SELECT id FROM users WHERE firebase_uid = $1", [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const gang = await create(userR.rows[0].id, req.body.name, req.body.tag, req.body.description);
  res.status(201).json(gang);
}));

router.post("/join", verifyFirebaseToken, gangLimiter, validate(joinSchema), asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query("SELECT id FROM users WHERE firebase_uid = $1", [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  await join(req.body.gangId, userR.rows[0].id);
  res.json({ message: "Joined gang" });
}));

router.post("/leave", verifyFirebaseToken, gangLimiter, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query("SELECT id FROM users WHERE firebase_uid = $1", [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  await leave(userR.rows[0].id);
  res.json({ message: "Left gang" });
}));

router.post("/kick", verifyFirebaseToken, gangLimiter, validate(kickSchema), asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query("SELECT id FROM users WHERE firebase_uid = $1", [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  await kick(userR.rows[0].id, req.body.userId);
  res.json({ message: "Member kicked" });
}));

export default router;
