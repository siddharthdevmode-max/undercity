import { Router } from "express";
import { verifyFirebaseToken as authMiddleware } from "../middleware/firebaseAuth";
import { bankLimiter } from "../middleware/rateLimiter";
import { noCache } from "../middleware/cacheHeaders";
import { asyncHandler } from "../utils/asyncHandler";
import { pool } from "../config/database";
import { getPagination, buildPaginatedResponse } from "../utils/pagination";
import { NotFoundError } from "../utils/errors";
import { getBalance, getTransactionHistory, depositCash, withdrawCash, transferCash } from "../services/bankService";

const router = Router();
router.use(noCache);

router.get("/balance", authMiddleware, bankLimiter, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query<{ id: number }>(
    `SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`, [uid]
  );
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const balance = await getBalance(userR.rows[0].id);
  res.json(balance);
}));

router.post("/deposit", authMiddleware, bankLimiter, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const { amount } = req.body as { amount: number };
  const userR = await pool.query<{ id: number }>(
    `SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`, [uid]
  );
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const result = await depositCash(userR.rows[0].id, amount);
  res.json({ message: "Deposit successful", user: result });
}));

router.post("/withdraw", authMiddleware, bankLimiter, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const { amount } = req.body as { amount: number };
  const userR = await pool.query<{ id: number }>(
    `SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`, [uid]
  );
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const result = await withdrawCash(userR.rows[0].id, amount);
  res.json({ message: "Withdrawal successful", user: result });
}));

router.post("/transfer", authMiddleware, bankLimiter, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const { username, amount } = req.body as { username: string; amount: number };
  const userR = await pool.query<{ id: number }>(
    `SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`, [uid]
  );
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const result = await transferCash(userR.rows[0].id, username, amount);
  res.json({ message: "Transfer complete", ...result });
}));

router.get("/history", authMiddleware, bankLimiter, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const { limit, offset, page } = getPagination(req);
  const userR = await pool.query<{ id: number }>(
    `SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`, [uid]
  );
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const { transactions, total } = await getTransactionHistory(userR.rows[0].id, limit, offset);
  res.json(buildPaginatedResponse(transactions, total, { page, limit, offset }));
}));

export default router;
