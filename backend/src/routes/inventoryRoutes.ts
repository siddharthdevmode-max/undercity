import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { inventoryLimiter } from "../middleware/rateLimiter";
import { noCache } from "../middleware/cacheHeaders";
import { validate } from "../middleware/validate";
import { idempotencyCheck } from "../middleware/idempotency";
import { asyncHandler } from "../utils/asyncHandler";
import { pool } from "../config/database";
import { getPagination, buildPaginatedResponse } from "../utils/pagination";
import { NotFoundError } from "../utils/errors";
import { inventoryActionSchema } from "../utils/schemas";
import { getInventory, useItem, dropItem } from "../services/inventoryService";

const router = Router();
router.use(noCache);

router.get("/", verifyFirebaseToken, inventoryLimiter, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const { limit, offset, page } = getPagination(req);
  const category = req.query["category"] as string | undefined;
  const userR = await pool.query<{ id: number }>(
    `SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`, [uid]
  );
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const result = await getInventory(userR.rows[0].id, category, limit, offset);
  res.json(buildPaginatedResponse(result.items, result.total, { page, limit, offset }));
}));

router.post("/use", verifyFirebaseToken, inventoryLimiter, validate(inventoryActionSchema), idempotencyCheck, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const { itemId, quantity } = req.body as { itemId: number; quantity: number };
  const userR = await pool.query<{ id: number }>(
    `SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`, [uid]
  );
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const result = await useItem(userR.rows[0].id, itemId, quantity);
  res.json({ message: "Item used", ...result });
}));

router.post("/drop", verifyFirebaseToken, inventoryLimiter, validate(inventoryActionSchema), idempotencyCheck, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const { itemId, quantity } = req.body as { itemId: number; quantity: number };
  const userR = await pool.query<{ id: number }>(
    `SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`, [uid]
  );
  if (userR.rows.length === 0) throw new NotFoundError("User");
  await dropItem(userR.rows[0].id, itemId, quantity);
  res.json({ message: "Item dropped" });
}));

export default router;
