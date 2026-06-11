import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { bankLimiter as calendarLimiter } from "../middleware/rateLimiter";
import { noCache } from "../middleware/cacheHeaders";
import { validate } from "../middleware/validate";
import { idempotencyCheck } from "../middleware/idempotency";
import { asyncHandler } from "../utils/asyncHandler";
import { pool } from "../config/database";
import { NotFoundError } from "../utils/errors";
import { z } from "zod";
import { getEvents, createEvent, deleteEvent } from "../services/calendarService";

const createEventSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().default(""),
  eventDate: z.string(),
});

const router = Router();
router.use(noCache);

router.get("/events", verifyFirebaseToken, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query("SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL", [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
  const events = await getEvents(userR.rows[0].id, month);
  res.json({ events });
}));

router.post("/events", verifyFirebaseToken, calendarLimiter, validate(createEventSchema), idempotencyCheck, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query("SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL", [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const event = await createEvent(userR.rows[0].id, req.body.title, req.body.description || "", req.body.eventDate);
  res.status(201).json(event);
}));

router.delete("/events/:id", verifyFirebaseToken, calendarLimiter, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query("SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL", [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  await deleteEvent(parseInt(req.params.id, 10), userR.rows[0].id);
  res.status(204).send();
}));

export default router;
