import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { bankLimiter as statLimiter } from "../middleware/rateLimiter";
import { noCache } from "../middleware/cacheHeaders";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { pool } from "../config/database";
import { NotFoundError, ValidationError } from "../utils/errors";
import { z } from "zod";

const allocateSchema = z.object({
  stat: z.enum(["strength", "speed", "defense", "dexterity"]),
  amount: z.number().int().min(1).max(100),
});

const router = Router();
router.use(noCache);

// GET /stats — current battle stats + unspent points
router.get("/", verifyFirebaseToken, statLimiter, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const r = await pool.query(
    `SELECT strength, speed, defense, dexterity, unspent_stat_points
     FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`,
    [uid]
  );
  if (r.rows.length === 0) throw new NotFoundError("User");
  res.json(r.rows[0]);
}));

// POST /stats/allocate — spend unspent points on a stat
router.post("/allocate", verifyFirebaseToken, statLimiter, validate(allocateSchema), asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const { stat, amount } = req.body;

  const userR = await pool.query(
    `SELECT id, strength, speed, defense, dexterity, unspent_stat_points
     FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`,
    [uid]
  );
  if (userR.rows.length === 0) throw new NotFoundError("User");

  const user = userR.rows[0];
  if (user.unspent_stat_points < amount) {
    throw new ValidationError(`Not enough stat points. You have ${user.unspent_stat_points}.`);
  }

  const maxStat = 999;
  const currentVal = user[stat];
  if (currentVal + amount > maxStat) {
    throw new ValidationError(`Cannot exceed ${maxStat} in ${stat}. You can allocate at most ${maxStat - currentVal} more.`);
  }

  const result = await pool.query(
    `UPDATE users
     SET ${stat} = ${stat} + $1,
         unspent_stat_points = unspent_stat_points - $2
     WHERE id = $3
     RETURNING strength, speed, defense, dexterity, unspent_stat_points`,
    [amount, amount, user.id]
  );

  res.json({ stats: result.rows[0], allocated: amount, stat });
}));

export default router;
