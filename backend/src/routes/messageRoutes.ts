import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { bankLimiter as messageLimiter } from "../middleware/rateLimiter";
import { noCache } from "../middleware/cacheHeaders";
import { validate } from "../middleware/validate";
import { idempotencyCheck } from "../middleware/idempotency";
import { asyncHandler } from "../utils/asyncHandler";
import { pool } from "../config/database";
import { NotFoundError } from "../utils/errors";
import { z } from "zod";
import { getInbox, getSentMessages, getMessage, sendMessage, deleteMessage, getUnreadCount } from "../services/messageService";

const sendSchema = z.object({
  recipient: z.string().min(1).max(50),
  subject: z.string().max(255).default(""),
  body: z.string().min(1),
});

const router = Router();
router.use(noCache);

router.get("/inbox", verifyFirebaseToken, messageLimiter, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query("SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL", [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const page = parseInt(req.query.page as string, 10) || 1;
  const result = await getInbox(userR.rows[0].id, page);
  res.json(result);
}));

router.get("/sent", verifyFirebaseToken, messageLimiter, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query("SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL", [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const page = parseInt(req.query.page as string, 10) || 1;
  const result = await getSentMessages(userR.rows[0].id, page);
  res.json(result);
}));

router.get("/unread-count", verifyFirebaseToken, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query("SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL", [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const count = await getUnreadCount(userR.rows[0].id);
  res.json({ unread: count });
}));

router.get("/:id", verifyFirebaseToken, messageLimiter, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query("SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL", [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const message = await getMessage(parseInt(req.params.id, 10), userR.rows[0].id);
  res.json({ message });
}));

router.post("/send", verifyFirebaseToken, messageLimiter, validate(sendSchema), idempotencyCheck, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query("SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL", [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const msg = await sendMessage(userR.rows[0].id, req.body.recipient, req.body.subject || "", req.body.body);
  res.status(201).json({ message: msg });
}));

router.delete("/:id", verifyFirebaseToken, messageLimiter, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query("SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL", [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  await deleteMessage(parseInt(req.params.id, 10), userR.rows[0].id);
  res.json({ success: true });
}));

export default router;
