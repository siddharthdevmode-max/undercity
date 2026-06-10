// ============================================================
// AUTH ROUTES — UNDERCITY
// POST /sync              — Register or return existing user
// GET  /me                — Get current user
// POST /onboarding-complete
// GET  /check-username/:username
// DELETE /account         — Self-deletion (GDPR)
// ============================================================

import { Router } from "express";
import { verifyFirebaseToken, revokeUserSession } from "../middleware/firebaseAuth";
import {
  authSyncLimiter,
  authMeLimiter,
  usernameCheckLimiter,
} from "../middleware/rateLimiter";
import { validate }           from "../middleware/validate";
import { noCache }            from "../middleware/cacheHeaders";
import { syncUserSchema, checkUsernameSchema } from "../utils/schemas";
import { asyncHandler }       from "../utils/asyncHandler";
import { pool }               from "../config/database";
import { getRequestLogger }   from "../utils/logger";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../utils/errors";
import { queueEmail }         from "../queues/index";
import { invalidateBanCache } from "../middleware/banCheck";
import { invalidateRoleCache } from "../middleware/requireAdmin";

const router = Router();
router.use(noCache);

const USER_FIELDS = `
  id, firebase_uid, email, username, level, money, points,
  nerve, max_nerve, life, max_life,
  energy, max_energy, happiness,
  jail_until, hospital_until, federal_jail_until,
  last_crime_at, last_seen_at,
  onboarding_completed, onboarding_completed_at,
  is_admin, is_developer, is_moderator,
  created_at
`;

// BUG FIX: happiness default is 100 (not 50)
// Migration 015 sets default: 100 — INSERT must match
const NEW_USER_DEFAULTS = {
  money:      750,
  level:      1,
  points:     0,
  nerve:      30,
  max_nerve:  30,
  life:       100,
  max_life:   100,
  energy:     100,
  max_energy: 100,
  happiness:  100,
} as const;

function generateBaseUsername(email: string | undefined): string {
  const base = (email ?? "user")
    .split("@")[0]!
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 16);
  return base.length >= 3 ? base : `user${Date.now() % 100000}`;
}

function generateFallbackUsername(base: string): string {
  const suffix = String(Math.floor(Math.random() * 9000) + 1000);
  return base.slice(0, 16) + suffix;
}

// ── POST /sync ────────────────────────────────────────────

router.post(
  "/sync",
  authSyncLimiter,
  verifyFirebaseToken,
  validate(syncUserSchema),
  asyncHandler(async (req, res) => {
    const log = getRequestLogger(req.requestId);
    const { uid, email } = req.firebaseUser!;
    const { username }   = req.body as { username?: string };

    const existing = await pool.query(
      `SELECT ${USER_FIELDS} FROM users
       WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`,
      [uid]
    );

    if (existing.rows.length > 0) {
      log.debug("Auth sync returning existing user", { uid: uid.substring(0, 8) });
      res.json(existing.rows[0]);
      return;
    }

    let resolvedUsername = username?.trim();
    if (!resolvedUsername) {
      resolvedUsername = generateBaseUsername(email);
    }

    let isValidUsername:
      | ((u: string) => { valid: boolean; reason?: string })
      | undefined;

    try {
      ({ isValidUsername } = (await import("../utils/profanityFilter")) as {
        isValidUsername: (u: string) => { valid: boolean; reason?: string };
      });
    } catch { /* profanity filter optional */ }

    if (isValidUsername) {
      const check = isValidUsername(resolvedUsername);
      if (!check.valid) throw new ValidationError(check.reason ?? "Invalid username");
    } else {
      if (resolvedUsername.length < 3 || resolvedUsername.length > 20) {
        throw new ValidationError("Username must be 3-20 characters");
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(resolvedUsername)) {
        throw new ValidationError("Username may only contain letters, numbers, _ and -");
      }
    }

    const insertUser = async (usernameToUse: string) =>
      pool.query(
        `INSERT INTO users (
           firebase_uid, email, username,
           money, level, points,
           nerve, max_nerve,
           life, max_life,
           energy, max_energy,
           happiness,
           jail_until, hospital_until, federal_jail_until,
           last_crime_at, onboarding_completed
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                 NULL, NULL, NULL, NULL, FALSE)
         RETURNING ${USER_FIELDS}`,
        [
          uid, email, usernameToUse,
          NEW_USER_DEFAULTS.money,
          NEW_USER_DEFAULTS.level,
          NEW_USER_DEFAULTS.points,
          NEW_USER_DEFAULTS.nerve,
          NEW_USER_DEFAULTS.max_nerve,
          NEW_USER_DEFAULTS.life,
          NEW_USER_DEFAULTS.max_life,
          NEW_USER_DEFAULTS.energy,
          NEW_USER_DEFAULTS.max_energy,
          NEW_USER_DEFAULTS.happiness,
        ]
      );

    let newUser;
    let usernameUsed = resolvedUsername;

    try {
      newUser = await insertUser(resolvedUsername);
    } catch (err: unknown) {
      const pgErr = err as { code?: string };
      if (pgErr.code !== "23505") throw err;

      if (username?.trim()) {
        throw new ConflictError("Username is already taken");
      }

      const fallback = generateFallbackUsername(resolvedUsername);
      usernameUsed   = fallback;

      try {
        newUser = await insertUser(fallback);
      } catch (err2: unknown) {
        const pgErr2 = err2 as { code?: string };
        if (pgErr2.code === "23505") {
          throw new ConflictError("Username is already taken. Please choose a different one.");
        }
        throw err2;
      }
    }

    void pool.query(
      `INSERT INTO admin_audit_log
         (admin_firebase_uid, action_type, details, ip_address)
       VALUES ($1, 'USER_REGISTERED', $2, $3)`,
      ["system", JSON.stringify({ username: usernameUsed, uid: uid.substring(0, 8) }), req.ip ?? "unknown"]
    ).catch(() => {});

    if (email) {
      void queueEmail({ type: "welcome", to: email, username: usernameUsed }).catch(() => {});
    }

    log.info("New user registered", { username: usernameUsed, uid: uid.substring(0, 8) });
    res.status(201).json(newUser.rows[0]);
  })
);

// ── GET /me ───────────────────────────────────────────────

router.get(
  "/me",
  authMeLimiter,
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const { uid } = req.firebaseUser!;

    const result = await pool.query(
      `SELECT ${USER_FIELDS} FROM users
       WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`,
      [uid]
    );

    if (result.rows.length === 0) throw new NotFoundError("User");
    res.json(result.rows[0]);
  })
);

// ── POST /onboarding-complete ─────────────────────────────

router.post(
  "/onboarding-complete",
  authMeLimiter,
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const { uid } = req.firebaseUser!;

    // BUG FIX: set onboarding_completed_at timestamp
    const result = await pool.query(
      `UPDATE users
       SET onboarding_completed     = TRUE,
           onboarding_completed_at  = NOW(),
           updated_at               = NOW()
       WHERE firebase_uid = $1
         AND deleted_at   IS NULL
       RETURNING id, onboarding_completed, onboarding_completed_at`,
      [uid]
    );

    if (result.rows.length === 0) throw new NotFoundError("User");

    res.json({
      message:              "Onboarding complete. Welcome to the Undercity.",
      onboarding_completed: true,
    });
  })
);

// ── GET /check-username/:username ─────────────────────────

router.get(
  "/check-username/:username",
  usernameCheckLimiter,
  validate(checkUsernameSchema),
  asyncHandler(async (req, res) => {
    const username = String(req.params["username"] ?? "");

    if (username.length < 3 || username.length > 20) {
      res.json({ available: false, reason: "Must be 3-20 characters" });
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      res.json({ available: false, reason: "Only letters, numbers, _ and - allowed" });
      return;
    }

    try {
      const { isValidUsername } = (await import("../utils/profanityFilter")) as {
        isValidUsername: (u: string) => { valid: boolean; reason?: string };
      };
      const check = isValidUsername(username);
      if (!check.valid) {
        res.json({ available: false, reason: check.reason });
        return;
      }
    } catch { /* profanity filter optional */ }

    const result = await pool.query(
      `SELECT id FROM users
       WHERE LOWER(username) = LOWER($1) AND deleted_at IS NULL LIMIT 1`,
      [username]
    );

    res.json({ available: result.rows.length === 0 });
  })
);

// ── DELETE /account ───────────────────────────────────────

router.delete(
  "/account",
  authMeLimiter,
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const { uid, email } = req.firebaseUser!;
    const { confirm }    = req.body as { confirm?: string };

    if (confirm !== "DELETE MY ACCOUNT") {
      throw new ValidationError('Send { "confirm": "DELETE MY ACCOUNT" } to confirm deletion');
    }

    const userResult = await pool.query(
      `SELECT id, username FROM users
       WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`,
      [uid]
    );

    if (userResult.rows.length === 0) throw new NotFoundError("User");

    const user = userResult.rows[0] as { id: number; username: string };

    await pool.query(
      `UPDATE users
       SET deleted_at      = NOW(),
           deletion_reason = 'Player self-deletion via /api/auth/account',
           email           = $2,
           username        = $3,
           is_hard_banned  = TRUE,
           updated_at      = NOW()
       WHERE firebase_uid  = $1`,
      [uid, `deleted_${Date.now()}@deleted.invalid`, `deleted_${user.id}`]
    );

    // BUG FIX: revoke Firebase token — without this, deleted user's
    // token is valid for up to 60 more minutes
    await Promise.allSettled([
      revokeUserSession(uid),
      invalidateBanCache(uid),
      invalidateRoleCache(uid),
    ]);

    void pool.query(
      `INSERT INTO admin_audit_log
         (admin_firebase_uid, action_type, details, ip_address)
       VALUES ($1, 'PLAYER_SELF_DELETION', $2, $3)`,
      [uid, JSON.stringify({ userId: user.id, username: user.username }), req.ip ?? "unknown"]
    ).catch(() => {});

    if (email && user.username) {
      void queueEmail({
        type:     "ban_notice",
        to:       email,
        username: user.username,
        reason:   "Account deletion requested by you.",
      }).catch(() => {});
    }

    res.json({
      message:    "Account deleted. Personal data will be purged within 30 days.",
      deleted_at: new Date().toISOString(),
    });
  })
);

export default router;
