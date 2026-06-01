import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { pool } from "../config/database";

const router = Router();

// POST /api/auth/sync
router.post("/sync", verifyFirebaseToken, async (req, res) => {
  try {
    const firebaseUser = (req as any).firebaseUser;
    const { uid, email } = firebaseUser;
    const { username } = req.body;

    const existing = await pool.query(
      "SELECT * FROM users WHERE firebase_uid = $1",
      [uid]
    );

    let user;

    if (existing.rows.length === 0) {
      const newUser = await pool.query(
        `INSERT INTO users (
          firebase_uid,
          email,
          username,
          money,
          level,
          points,
          nerve,
          max_nerve,
          life,
          max_life,
          jail_until,
          federal_jail_until,
          last_crime_at
        )
        VALUES ($1, $2, $3, 750, 1, 0, 30, 30, 100, 100, NULL, NULL, NULL)
        RETURNING *`,
        [uid, email, username]
      );
      user = newUser.rows[0];
    } else {
      user = existing.rows[0];
    }

    res.json(user);

  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: "Sync failed", error: error.message });
  }
});

// GET /api/auth/me
router.get("/me", verifyFirebaseToken, async (req, res) => {
  try {
    const firebaseUser = (req as any).firebaseUser;
    const { uid } = firebaseUser;

    const result = await pool.query(
      "SELECT * FROM users WHERE firebase_uid = $1",
      [uid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(result.rows[0]);

  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch user", error: error.message });
  }
});

// GET /api/auth/check-username/:username
// Public endpoint — no auth required (used during registration)
router.get("/check-username/:username", async (req, res) => {
  try {
    const { username } = req.params;

    // Basic validation
    if (!username || username.length < 3) {
      return res.json({ available: false, reason: "Too short" });
    }
    if (username.length > 20) {
      return res.json({ available: false, reason: "Too long" });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.json({ available: false, reason: "Invalid characters" });
    }

    const result = await pool.query(
      "SELECT id FROM users WHERE LOWER(username) = LOWER($1)",
      [username]
    );

    res.json({ available: result.rows.length === 0 });

  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: "Check failed", error: error.message });
  }
});

export default router;
