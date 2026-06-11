import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { bankLimiter as forumLimiter } from "../middleware/rateLimiter";
import { noCache } from "../middleware/cacheHeaders";
import { validate } from "../middleware/validate";
import { idempotencyCheck } from "../middleware/idempotency";
import { asyncHandler } from "../utils/asyncHandler";
import { pool } from "../config/database";
import { NotFoundError } from "../utils/errors";
import { z } from "zod";
import { getCategories, getThreads, getThread, createThread, replyToThread } from "../services/forumService";

const createThreadSchema = z.object({
  categoryId: z.number().int().positive(),
  title: z.string().min(1).max(255),
  content: z.string().min(1),
});

const replySchema = z.object({
  content: z.string().min(1),
});

const router = Router();
router.use(noCache);

router.get("/categories", verifyFirebaseToken, asyncHandler(async (_req, res) => {
  const categories = await getCategories();
  res.json({ categories });
}));

router.get("/threads", verifyFirebaseToken, asyncHandler(async (req, res) => {
  const categoryId = req.query.category ? parseInt(req.query.category as string, 10) || undefined : undefined;
  const page = parseInt(req.query.page as string, 10) || 1;
  const result = await getThreads(categoryId, page);
  res.json(result);
}));

router.get("/threads/:id", verifyFirebaseToken, asyncHandler(async (req, res) => {
  const result = await getThread(parseInt(req.params.id, 10));
  res.json(result);
}));

router.post("/threads", verifyFirebaseToken, forumLimiter, validate(createThreadSchema), idempotencyCheck, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query("SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL", [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const thread = await createThread(userR.rows[0].id, req.body.categoryId, req.body.title, req.body.content);
  res.status(201).json(thread);
}));

router.post("/threads/:id/reply", verifyFirebaseToken, forumLimiter, validate(replySchema), idempotencyCheck, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query("SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL", [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const post = await replyToThread(parseInt(req.params.id, 10), userR.rows[0].id, req.body.content);
  res.status(201).json(post);
}));

export default router;
