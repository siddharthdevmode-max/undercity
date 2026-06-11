import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { bankLimiter as casinoLimiter } from "../middleware/rateLimiter";
import { validate } from "../middleware/validate";
import { idempotencyCheck } from "../middleware/idempotency";
import { asyncHandler } from "../utils/asyncHandler";
import { pool } from "../config/database";
import { NotFoundError } from "../utils/errors";
import { z } from "zod";
import { play } from "../services/casinoService";

const playSchema = z.object({
  game: z.enum(["coinflip", "roulette", "slots"]),
  bet: z.number().int().positive(),
});

const router = Router();

router.post("/play", verifyFirebaseToken, casinoLimiter, validate(playSchema), idempotencyCheck, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const userR = await pool.query(`SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`, [uid]);
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const result = await play(userR.rows[0].id, req.body.game, req.body.bet);
  res.json(result);
}));

export default router;
