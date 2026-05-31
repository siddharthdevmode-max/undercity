import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { pool } from "../config/database";

const router = Router();

// POST /api/auth/sync
// Called after Firebase login/register
// Creates user in DB if first time, returns user data
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
        `INSERT INTO users (firebase_uid, email, username, money, level)
         VALUES ($1, $2, $3, 750, 1)
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
// Called on every dashboard load to get current player data
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

export default router;
