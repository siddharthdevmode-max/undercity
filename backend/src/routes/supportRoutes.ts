import { Router } from "express";
import { pool } from "../config/database";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { requireAdmin } from "../middleware/requireAdmin";
import { authMeLimiter, adminLimiter } from "../middleware/rateLimiter";
import { asyncHandler } from "../utils/asyncHandler";
import { validate } from "../middleware/validate";
import { z } from "zod";
import { sanitizeString } from "../utils/sanitize";
import { logger } from "../utils/logger";

const router = Router();

const createTicketSchema = z.object({
  body: z.object({
    subject:  z.string().min(5).max(200).transform(sanitizeString),
    message:  z.string().min(20).max(5000).transform(sanitizeString),
    category: z.enum(["general", "bug", "appeal", "billing", "abuse"]).default("general"),
  }),
});

// ── POST /api/support/ticket — Create ticket ──────────────
router.post(
  "/ticket",
  authMeLimiter,
  verifyFirebaseToken,
  validate(createTicketSchema),
  asyncHandler(async (req, res) => {
    const { uid } = req.firebaseUser!;
    const { subject, message, category } = req.body as {
      subject:  string;
      message:  string;
      category: string;
    };

    const userResult = await pool.query(
      `SELECT id, username FROM users WHERE firebase_uid = $1 LIMIT 1`,
      [uid]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = userResult.rows[0] as { id: number; username: string };

    // Limit: 3 open tickets per user
    const openCount = await pool.query(
      `SELECT COUNT(*) FROM support_tickets
       WHERE firebase_uid = $1 AND status = 'open'`,
      [uid]
    );

    if (parseInt((openCount.rows[0] as { count: string }).count, 10) >= 3) {
      return res.status(429).json({
        message: "You already have 3 open tickets. Please wait for a response.",
      });
    }

    const result = await pool.query(
      `INSERT INTO support_tickets
         (firebase_uid, username, subject, message, category)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, subject, category, status, created_at`,
      [uid, user.username, subject, message, category]
    );

    logger.info("📬 Support ticket created", {
      ticketId: (result.rows[0] as { id: number }).id,
      uid:      uid.substring(0, 8),
      category,
    });

    res.status(201).json({
      message: "Ticket submitted. We'll respond within 48 hours.",
      ticket:  result.rows[0],
    });
  })
);

// ── GET /api/support/my-tickets — Player's own tickets ────
router.get(
  "/my-tickets",
  authMeLimiter,
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const { uid } = req.firebaseUser!;

    const result = await pool.query(
      `SELECT id, subject, category, status, admin_response,
              responded_at, created_at, updated_at
       FROM support_tickets
       WHERE firebase_uid = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [uid]
    );

    res.json({ tickets: result.rows });
  })
);

// ── GET /api/support/tickets — Admin: all tickets ─────────
router.get(
  "/tickets",
  verifyFirebaseToken,
  requireAdmin,
  adminLimiter,
  asyncHandler(async (_req, res) => {
    const result = await pool.query(
      `SELECT id, firebase_uid, username, subject, category,
              status, created_at, updated_at
       FROM support_tickets
       ORDER BY
         CASE status WHEN 'open' THEN 0 ELSE 1 END,
         created_at ASC
       LIMIT 100`
    );
    res.json({ tickets: result.rows });
  })
);

// ── POST /api/support/tickets/:id/respond — Admin respond ─
router.post(
  "/tickets/:id/respond",
  verifyFirebaseToken,
  requireAdmin,
  adminLimiter,
  asyncHandler(async (req, res) => {
    const ticketId = parseInt(String(req.params.id), 10);
    const adminUid = req.firebaseUser!.uid;
    const { response, status = "resolved" } = req.body as {
      response: string;
      status?:  string;
    };

    if (!response || response.trim().length < 10) {
      return res.status(400).json({ message: "Response must be at least 10 characters" });
    }

    if (isNaN(ticketId)) {
      return res.status(400).json({ message: "Invalid ticket ID" });
    }

    const result = await pool.query(
      `UPDATE support_tickets
       SET admin_response = $1,
           status         = $2,
           responded_by   = $3,
           responded_at   = CURRENT_TIMESTAMP,
           updated_at     = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, subject, status, firebase_uid`,
      [sanitizeString(response), status, adminUid, ticketId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    await pool.query(
      `INSERT INTO admin_audit_log
         (admin_firebase_uid, action_type, details, ip_address)
       VALUES ($1, 'TICKET_RESPONDED', $2, $3)`,
      [
        adminUid,
        JSON.stringify({ ticketId, status }),
        req.ip,
      ]
    );

    logger.info("📨 Support ticket responded", {
      ticketId,
      adminUid: adminUid.substring(0, 8),
      status,
    });

    res.json({ message: "Response sent", ticket: result.rows[0] });
  })
);

export default router;
