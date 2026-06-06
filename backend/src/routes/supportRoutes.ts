import { Router }              from "express";
import { z }                   from "zod";
import { pool }                from "../config/database";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import {
  requireModerator,
}                              from "../middleware/requireAdmin";
import {
  supportLimiter,
  adminLimiter,
  authMeLimiter,
}                              from "../middleware/rateLimiter";
import { asyncHandler }        from "../utils/asyncHandler";
import { validate }            from "../middleware/validate";
import {
  createSupportTicketSchema,
  replyTicketSchema,
}                              from "../utils/schemas";
import { sanitizeString }      from "../utils/sanitize";
import { logger }              from "../utils/logger";
import { queueEmail }          from "../queues/index";
import { getPagination, buildPaginatedResponse } from "../utils/pagination";
import {
  NotFoundError,
  ValidationError,
  AppError,
}                              from "../utils/errors";

// ============================================================
// SUPPORT ROUTES — /api/support
//
// POST   /ticket               — Create ticket (player)
// GET    /my-tickets           — Own tickets (player)
// GET    /tickets              — All tickets (moderator+)
// GET    /tickets/:id          — Single ticket (moderator+)
// POST   /tickets/:id/respond  — Respond to ticket (moderator+)
// POST   /tickets/:id/close    — Close ticket (moderator+)
// ============================================================

const router = Router();

// ── Valid ticket statuses ──────────────────────────────────
const TICKET_STATUSES = ["open", "in_progress", "resolved", "closed", "wont_fix"] as const;
type TicketStatus = typeof TICKET_STATUSES[number];

// ── Ticket ID param validator ──────────────────────────────
const ticketIdParam = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "Ticket ID must be numeric"),
  }),
});

// ── Open ticket limit per user ─────────────────────────────
const MAX_OPEN_TICKETS = 3;

// ============================================================
// POST /api/support/ticket
// ============================================================
router.post(
  "/ticket",
  supportLimiter,
  verifyFirebaseToken,
  validate(createSupportTicketSchema),
  asyncHandler(async (req, res) => {
    const { uid }               = req.firebaseUser!;
    const { subject, message, category } = req.body as {
      subject:  string;
      message:  string;
      category: string;
    };

    const userResult = await pool.query(
      `SELECT id, username, email
       FROM users
       WHERE firebase_uid = $1
         AND deleted_at   IS NULL
       LIMIT 1`,
      [uid]
    );

    if (userResult.rows.length === 0) throw new NotFoundError("User");

    const user = userResult.rows[0] as { id: number; username: string; email: string };

    // Check open ticket limit
    const openCount = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM support_tickets
       WHERE firebase_uid = $1
         AND status       = 'open'`,
      [uid]
    );

    const count = (openCount.rows[0] as { count: number }).count;
    if (count >= MAX_OPEN_TICKETS) {
      throw new AppError(
        `You already have ${MAX_OPEN_TICKETS} open tickets. Wait for a response before opening more.`,
        429,
        "ERR_9003"
      );
    }

    const result = await pool.query(
      `INSERT INTO support_tickets
         (firebase_uid, username, subject, message, category, status)
       VALUES ($1, $2, $3, $4, $5, 'open')
       RETURNING id, subject, category, status, created_at`,
      [uid, user.username, subject, message, category]
    );

    const ticket = result.rows[0] as { id: number };

    logger.info("📬 Support ticket created", {
      ticketId: ticket.id,
      uid:      uid.substring(0, 8),
      category,
    });

    res.status(201).json({
      message: "Ticket submitted. We respond within 48 hours.",
      ticket:  result.rows[0],
    });
  })
);

// ============================================================
// GET /api/support/my-tickets
// ============================================================
router.get(
  "/my-tickets",
  authMeLimiter,
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const { uid }             = req.firebaseUser!;
    const { limit, offset, page } = getPagination(req);

    const [countR, rowsR] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM support_tickets
         WHERE firebase_uid = $1`,
        [uid]
      ),
      pool.query(
        `SELECT id, subject, category, status,
                admin_response, responded_at,
                created_at, updated_at
         FROM support_tickets
         WHERE firebase_uid = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [uid, limit, offset]
      ),
    ]);

    const total = (countR.rows[0] as { total: number }).total;
    res.json(buildPaginatedResponse(rowsR.rows, total, { page, limit, offset }));
  })
);

// ============================================================
// GET /api/support/tickets — All tickets (moderator+)
// ============================================================
router.get(
  "/tickets",
  verifyFirebaseToken,
  requireModerator,
  adminLimiter,
  asyncHandler(async (req, res) => {
    const { limit, offset, page } = getPagination(req);
    const statusFilter = req.query["status"]
      ? String(req.query["status"])
      : null;
    const categoryFilter = req.query["category"]
      ? String(req.query["category"])
      : null;

    // Validate status filter
    if (statusFilter && !TICKET_STATUSES.includes(statusFilter as TicketStatus)) {
      throw new ValidationError(`Invalid status. Valid: ${TICKET_STATUSES.join(", ")}`);
    }

    const [countR, rowsR] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM support_tickets
         WHERE ($1::text IS NULL OR status   = $1)
           AND ($2::text IS NULL OR category = $2)`,
        [statusFilter, categoryFilter]
      ),
      pool.query(
        `SELECT id, firebase_uid, username, subject, category,
                status, created_at, updated_at, responded_at
         FROM support_tickets
         WHERE ($1::text IS NULL OR status   = $1)
           AND ($2::text IS NULL OR category = $2)
         ORDER BY
           CASE status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
           created_at ASC
         LIMIT $3 OFFSET $4`,
        [statusFilter, categoryFilter, limit, offset]
      ),
    ]);

    const total = (countR.rows[0] as { total: number }).total;
    res.json(buildPaginatedResponse(rowsR.rows, total, { page, limit, offset }));
  })
);

// ============================================================
// GET /api/support/tickets/:id — Single ticket (moderator+)
// ============================================================
router.get(
  "/tickets/:id",
  verifyFirebaseToken,
  requireModerator,
  adminLimiter,
  validate(ticketIdParam),
  asyncHandler(async (req, res) => {
    const ticketId = parseInt(String(req.params["id"]), 10);

    const result = await pool.query(
      `SELECT id, firebase_uid, username, subject, category,
              message, status, admin_response,
              responded_by, responded_at,
              created_at, updated_at
       FROM support_tickets
       WHERE id = $1`,
      [ticketId]
    );

    if (result.rows.length === 0) throw new NotFoundError("Ticket");
    res.json({ ticket: result.rows[0] });
  })
);

// ============================================================
// POST /api/support/tickets/:id/respond — Moderator respond
// ============================================================
router.post(
  "/tickets/:id/respond",
  verifyFirebaseToken,
  requireModerator,
  adminLimiter,
  validate(
    z.object({
      params: z.object({ id: z.string().regex(/^\d+$/) }),
      body:   replyTicketSchema.shape.body,
    })
  ),
  asyncHandler(async (req, res) => {
    const ticketId  = parseInt(String(req.params["id"]), 10);
    const adminUid  = req.firebaseUser!.uid;
    const { response, status = "resolved" } = req.body as {
      response: string;
      status?:  string;
    };

    // Validate status
    if (!TICKET_STATUSES.includes(status as TicketStatus)) {
      throw new ValidationError(`Invalid status. Valid: ${TICKET_STATUSES.join(", ")}`);
    }

    const result = await pool.query(
      `UPDATE support_tickets
       SET    admin_response = $1,
              status         = $2,
              responded_by   = $3,
              responded_at   = NOW(),
              updated_at     = NOW()
       WHERE  id = $4
       RETURNING id, subject, status, firebase_uid, username`,
      [sanitizeString(response), status, adminUid, ticketId]
    );

    if (result.rows.length === 0) throw new NotFoundError("Ticket");

    const ticket = result.rows[0] as {
      id:          number;
      subject:     string;
      status:      string;
      firebase_uid: string;
      username:    string;
    };

    // Audit log — fire-and-forget
    void pool.query(
      `INSERT INTO admin_audit_log
         (admin_firebase_uid, action_type, details, ip_address)
       VALUES ($1, 'TICKET_RESPONDED', $2, $3)`,
      [
        adminUid,
        JSON.stringify({ ticketId, status, username: ticket.username }),
        req.ip ?? "unknown",
      ]
    ).catch(() => {});

    // Notify player via email — only on resolved/closed
    if (status === "resolved" || status === "closed") {
      // Get player email
      const userR = await pool.query(
        `SELECT email FROM users WHERE firebase_uid = $1 LIMIT 1`,
        [ticket.firebase_uid]
      ).catch(() => ({ rows: [] }));

      const email = (userR.rows[0] as { email?: string } | undefined)?.email;
      if (email) {
        void queueEmail({
          type:      "support_reply",
          to:        email,
          username:  ticket.username,
          ticketId:  String(ticket.id),
          message:   response,
        }).catch(() => {});
      }
    }

    logger.info("📨 Support ticket responded", {
      ticketId,
      adminUid: adminUid.substring(0, 8),
      status,
    });

    res.json({ message: "Response sent", ticket: result.rows[0] });
  })
);

// ============================================================
// POST /api/support/tickets/:id/close — Close ticket
// ============================================================
router.post(
  "/tickets/:id/close",
  verifyFirebaseToken,
  requireModerator,
  adminLimiter,
  validate(ticketIdParam),
  asyncHandler(async (req, res) => {
    const ticketId = parseInt(String(req.params["id"]), 10);
    const adminUid = req.firebaseUser!.uid;

    const result = await pool.query(
      `UPDATE support_tickets
       SET    status     = 'closed',
              updated_at = NOW()
       WHERE  id = $1
       RETURNING id, status`,
      [ticketId]
    );

    if (result.rows.length === 0) throw new NotFoundError("Ticket");

    void pool.query(
      `INSERT INTO admin_audit_log
         (admin_firebase_uid, action_type, details, ip_address)
       VALUES ($1, 'TICKET_CLOSED', $2, $3)`,
      [adminUid, JSON.stringify({ ticketId }), req.ip ?? "unknown"]
    ).catch(() => {});

    res.json({ message: "Ticket closed", ticket: result.rows[0] });
  })
);

export default router;
