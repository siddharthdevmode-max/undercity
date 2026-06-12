import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { noCache } from "../middleware/cacheHeaders";
import { asyncHandler } from "../utils/asyncHandler";
import { pool } from "../config/database";
import { ValidationError } from "../utils/errors";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();
router.use(noCache);

// Public — get all config keys (no auth needed, used by frontend)
router.get("/", asyncHandler(async (_req, res) => {
  const r = await pool.query(
    "SELECT key, value, type, label, description FROM game_config ORDER BY key"
  );
  const config: Record<string, unknown> = {};
  for (const row of r.rows) {
    if (row.type === "number") config[row.key] = parseFloat(row.value);
    else if (row.type === "boolean") config[row.key] = row.value === "true";
    else if (row.type === "json") {
      try { config[row.key] = JSON.parse(row.value); }
      catch { config[row.key] = row.value; }
    } else config[row.key] = row.value;
  }
  res.json({ config });
}));

// Admin — get all config with metadata
router.get("/all", verifyFirebaseToken, requireAdmin, asyncHandler(async (_req, res) => {
  const r = await pool.query("SELECT * FROM game_config ORDER BY key");
  res.json({ config: r.rows });
}));

// Admin — update a config key
router.patch("/:key", verifyFirebaseToken, requireAdmin, asyncHandler(async (req, res) => {
  const { key } = req.params;
  if (!key || key.length > 100) throw new ValidationError("Invalid key");

  const { value } = req.body;
  if (value === undefined) throw new ValidationError("Value is required");

  const check = await pool.query("SELECT type FROM game_config WHERE key = $1", [key]);
  if (check.rows.length === 0) throw new ValidationError(`Config key '${key}' not found`);

  const type = check.rows[0].type;
  let strValue: string;

  if (type === "boolean") {
    if (typeof value !== "boolean") throw new ValidationError("Expected boolean");
    strValue = value ? "true" : "false";
  } else if (type === "number") {
    const n = typeof value === "string" ? parseFloat(value) : value;
    if (typeof n !== "number" || isNaN(n)) throw new ValidationError("Expected number");
    strValue = String(n);
  } else if (type === "json") {
    try { strValue = typeof value === "string" ? value : JSON.stringify(value); }
    catch { throw new ValidationError("Invalid JSON"); }
  } else {
    strValue = String(value);
  }

  const r = await pool.query(
    "UPDATE game_config SET value = $1, updated_at = NOW() WHERE key = $2 RETURNING *",
    [strValue, key]
  );
  res.json({ config: r.rows[0] });
}));

export default router;
