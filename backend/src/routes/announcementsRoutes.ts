import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { noCache } from "../middleware/cacheHeaders";
import { asyncHandler } from "../utils/asyncHandler";
import { pool } from "../config/database";
import { ValidationError } from "../utils/errors";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { requireAdmin } from "../middleware/requireAdmin";

const createSchema = z.object({
  title: z.string().min(1).max(255),
  body: z.string().min(1),
  priority: z.enum(["low", "normal", "high", "critical"]).default("normal"),
  active: z.boolean().default(true),
});

const updateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  body: z.string().min(1).optional(),
  priority: z.enum(["low", "normal", "high", "critical"]).optional(),
  active: z.boolean().optional(),
});

const router = Router();
router.use(noCache);

// Public — get active announcements
router.get("/", asyncHandler(async (_req, res) => {
  const r = await pool.query(
    `SELECT id, title, body, priority, created_at
     FROM announcements
     WHERE active = true
     ORDER BY priority DESC, created_at DESC
     LIMIT 10`
  );
  res.json({ announcements: r.rows });
}));

// Admin — create announcement
router.post("/", verifyFirebaseToken, requireAdmin, validate(createSchema), asyncHandler(async (req, res) => {
  const { title, body, priority, active } = req.body;
  const userR = await pool.query("SELECT id FROM users WHERE firebase_uid = $1", [req.firebaseUser!.uid]);
  const r = await pool.query(
    `INSERT INTO announcements (title, body, priority, active, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [title, body, priority, active, userR.rows[0].id]
  );
  res.status(201).json({ announcement: r.rows[0] });
}));

// Admin — list all announcements
router.get("/all", verifyFirebaseToken, requireAdmin, asyncHandler(async (_req, res) => {
  const r = await pool.query(
    "SELECT * FROM announcements ORDER BY created_at DESC LIMIT 100"
  );
  res.json({ announcements: r.rows });
}));

// Admin — update announcement
router.patch("/:id", verifyFirebaseToken, requireAdmin, validate(updateSchema), asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) throw new ValidationError("Invalid ID");

  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  for (const field of ["title", "body", "priority", "active"] as const) {
    if (req.body[field] !== undefined) {
      sets.push(`${field} = $${idx++}`);
      vals.push(req.body[field]);
    }
  }

  if (sets.length === 0) throw new ValidationError("No fields to update");
  sets.push(`updated_at = NOW()`);
  vals.push(id);

  const r = await pool.query(
    `UPDATE announcements SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
    vals
  );
  if (r.rows.length === 0) throw new ValidationError("Announcement not found");
  res.json({ announcement: r.rows[0] });
}));

// Admin — delete announcement
router.delete("/:id", verifyFirebaseToken, requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) throw new ValidationError("Invalid ID");
  await pool.query("DELETE FROM announcements WHERE id = $1", [id]);
  res.json({ success: true });
}));

export default router;
