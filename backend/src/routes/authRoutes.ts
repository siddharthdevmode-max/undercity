import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import {
  authSyncLimiter,
  authMeLimiter,
  usernameCheckLimiter,
} from "../middleware/rateLimiter";
import { validate } from "../middleware/validate";
import { syncUserSchema, checkUsernameSchema } from "../utils/schemas";
import { asyncHandler } from "../utils/asyncHandler";
import { pool } from "../config/database";
import { getRequestLogger } from "../utils/logger";
import { ConflictError, NotFoundError, ValidationError } from "../utils/errors";

const router = Router();

const USER_FIELDS = `
  id, firebase_uid, email, username, level, money, points,
  nerve, max_nerve, life, max_life,
  jail_until, federal_jail_until, last_crime_at,
  created_at
`;

// ============================================================
// POST /api/auth/sync — strict limit (registration only)
// ============================================================
router.post(
  "/sync",
  authSyncLimiter,
  verifyFirebaseToken,
  validate(syncUserSchema),
  asyncHandler(async (req, res) => {
    const log = getRequestLogger(req);
    const { uid, email } = req.firebaseUser!;
    const { username } = req.body as { username?: string };

    const existing = await pool.query(
      `SELECT ${USER_FIELDS} FROM users WHERE firebase_uid = $1 LIMIT 1`,
      [uid]
    );

    if (existing.rows.length > 0) {
      return res.json(existing.rows[0]);
    }

    if (!username) {
      throw new ValidationError("Username is required for new accounts");
    }

    const usernameTaken = await pool.query(
      `SELECT id FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
      [username]
    );

    if (usernameTaken.rows.length > 0) {
      throw new ConflictError("Username is already taken");
    }

    const newUser = await pool.query(
      `INSERT INTO users (
        firebase_uid, email, username,
        money, level, points,
        nerve, max_nerve, life, max_life,
        jail_until, federal_jail_until, last_crime_at
      )
      VALUES ($1, $2, $3, 750, 1, 0, 30, 30, 100, 100, NULL, NULL, NULL)
      RETURNING ${USER_FIELDS}`,
      [uid, email, username]
    );

    log.info("👤 New user created", {
      username,
      uid: uid.substring(0, 8),
    });
    res.status(201).json(newUser.rows[0]);
  })
);

// ============================================================
// GET /api/auth/me — lenient limit (called constantly)
// ============================================================
router.get(
  "/me",
  authMeLimiter,
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const { uid } = req.firebaseUser!;

    const result = await pool.query(
      `SELECT ${USER_FIELDS} FROM users WHERE firebase_uid = $1 LIMIT 1`,
      [uid]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError("User");
    }

    res.json(result.rows[0]);
  })
);

// ============================================================
// GET /api/auth/check-username/:username — public
// ============================================================
router.get(
  "/check-username/:username",
  usernameCheckLimiter,
  validate(checkUsernameSchema),
  asyncHandler(async (req, res) => {
    const username = String(req.params.username || "");

    if (username.length < 3) {
      return res.json({ available: false, reason: "Too short" });
    }
    if (username.length > 20) {
      return res.json({ available: false, reason: "Too long" });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.json({ available: false, reason: "Invalid characters" });
    }

    const result = await pool.query(
      `SELECT id FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
      [username]
    );

    res.json({ available: result.rows.length === 0 });
  })
);

export default router;
