import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { marketLimiter, publicMarketLimiter } from "../middleware/rateLimiter";
import { noCache } from "../middleware/cacheHeaders";
import { validate } from "../middleware/validate";
import { idempotencyCheck } from "../middleware/idempotency";
import { asyncHandler } from "../utils/asyncHandler";
import { pool } from "../config/database";
import { getPagination, buildPaginatedResponse } from "../utils/pagination";
import { NotFoundError } from "../utils/errors";
import { marketListingSchema, marketBuySchema, marketCancelSchema } from "../utils/schemas";
import { listItem, buyItem, cancelListing, getListings, getMyListings } from "../services/marketService";

const router = Router();
router.use(noCache);

router.get("/listings", publicMarketLimiter, asyncHandler(async (req, res) => {
  const { limit, offset, page } = getPagination(req);
  const { q, category, sort, order } = req.query as Record<string, string | undefined>;
  const result = await getListings(
    { itemName: q, category, sort, order }, limit, offset
  );
  res.json(buildPaginatedResponse(result.listings, result.total, { page, limit, offset }));
}));

router.get("/my-listings", verifyFirebaseToken, marketLimiter, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query<{ id: number }>(
    `SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`, [uid]
  );
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const listings = await getMyListings(userR.rows[0].id);
  res.json({ listings });
}));

router.post("/list", verifyFirebaseToken, marketLimiter, validate(marketListingSchema), asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const { itemId, quantity, price } = req.body as { itemId: number; quantity: number; price: number };
  const userR = await pool.query<{ id: number }>(
    `SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`, [uid]
  );
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const listing = await listItem(userR.rows[0].id, itemId, quantity, price);
  res.status(201).json({ message: "Item listed for sale", listing });
}));

router.post("/buy/:listingId", verifyFirebaseToken, marketLimiter, validate(marketBuySchema), idempotencyCheck, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const listingId = parseInt(req.params["listingId"] ?? "0", 10);
  const userR = await pool.query<{ id: number }>(
    `SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`, [uid]
  );
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const result = await buyItem(userR.rows[0].id, listingId);
  res.json({ message: "Item purchased", ...result });
}));

router.delete("/listing/:listingId", verifyFirebaseToken, marketLimiter, validate(marketCancelSchema), asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const listingId = parseInt(req.params["listingId"] ?? "0", 10);
  const userR = await pool.query<{ id: number }>(
    `SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`, [uid]
  );
  if (userR.rows.length === 0) throw new NotFoundError("User");
  await cancelListing(userR.rows[0].id, listingId);
  res.json({ message: "Listing cancelled, items returned to inventory" });
}));

export default router;
