import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { asyncHandler } from "../utils/asyncHandler";
import { stripe, POINT_PACKS } from "../config/stripe";
import { pool } from "../config/database";
import { logger } from "../utils/logger";
import { AppError } from "../utils/errors";
import { SocketNotify } from "../config/socket";
import { EmailService } from "../services/emailService";
import express from "express";

const router = Router();

// ── GET /api/v1/payments/packs ─────────────────────────────
router.get("/packs", asyncHandler(async (_req, res) => {
  res.json({
    packs: POINT_PACKS.map((p) => ({
      id:       p.id,
      name:     p.name,
      points:   p.points + p.bonus,
      base:     p.points,
      bonus:    p.bonus,
      priceUsd: p.priceUsd,
      popular:  p.popular,
    })),
  });
}));

// ── POST /api/v1/payments/checkout ─────────────────────────
router.post("/checkout", verifyFirebaseToken, asyncHandler(async (req, res) => {
  if (!stripe) throw new AppError("Payments not configured", 503, "PAYMENTS_DISABLED");

  const { packId, successUrl, cancelUrl } = req.body as {
    packId:     string;
    successUrl: string;
    cancelUrl:  string;
  };

  // Validate successUrl and cancelUrl are from our domain (SSRF prevention)
  const ALLOWED_DOMAINS = (process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim());
  const isValidUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      return ALLOWED_DOMAINS.some(d => {
        try { return new URL(d).hostname === parsed.hostname; } catch { return false; }
      });
    } catch { return false; }
  };

  if (!isValidUrl(successUrl) || !isValidUrl(cancelUrl)) {
    throw new AppError("Invalid redirect URL", 400, "INVALID_URL");
  }

  const pack = POINT_PACKS.find((p) => p.id === packId);
  if (!pack) throw new AppError("Invalid pack", 400, "INVALID_PACK");
  if (!pack.priceId) throw new AppError("Pack not configured", 503, "PACK_NOT_CONFIGURED");

  const uid = req.firebaseUser!.uid;

  const userResult = await pool.query(
    "SELECT id, email FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL",
    [uid]
  );

  if (!userResult.rows[0]) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  const user = userResult.rows[0] as { id: number; email: string };

  const session = await stripe.checkout.sessions.create({
    mode:                  "payment",
    payment_method_types:  ["card"],
    line_items: [{ price: pack.priceId, quantity: 1 }],
    success_url:           `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:            cancelUrl,
    metadata: {
      userId: String(user.id),
      uid,
      packId: pack.id,
      points: String(pack.points + pack.bonus),
    },
    customer_email: user.email,
  });

  logger.info("💳 Checkout session created", { uid, packId, sessionId: session.id });
  res.json({ url: session.url, sessionId: session.id });
}));

// ── POST /api/v1/payments/webhook ─────────────────────────
// Raw body MUST come before express.json() in app.ts for this route
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  asyncHandler(async (req, res) => {
    if (!stripe) {
      res.json({ received: true });
      return;
    }

    const sig    = req.headers["stripe-signature"] as string;
    const secret = process.env.STRIPE_WEBHOOK_SECRET || "";

    if (!secret) {
      logger.error("💳 STRIPE_WEBHOOK_SECRET not set");
      res.status(500).json({ error: "Webhook not configured" });
      return;
    }

    let event: import("stripe").Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch (err) {
      logger.error("💳 Webhook signature failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(400).json({ error: "Webhook signature failed" });
      return;
    }

    if (event.type === "checkout.session.completed") {
      const session    = event.data.object as import("stripe").Stripe.Checkout.Session;
      const { userId, uid, points } = session.metadata || {};

      if (!userId || !uid || !points) {
        logger.error("💳 Webhook missing metadata", { sessionId: session.id });
        res.json({ received: true });
        return;
      }

      const pointsToAdd = parseInt(points, 10);
      const userIdInt   = parseInt(userId, 10);

      if (isNaN(pointsToAdd) || isNaN(userIdInt) || pointsToAdd <= 0) {
        logger.error("💳 Invalid points or userId in webhook", { points, userId });
        res.json({ received: true });
        return;
      }

      // Idempotency: check if already processed
      const alreadyProcessed = await pool.query(
        `SELECT id FROM payment_logs WHERE stripe_session_id = $1`,
        [session.id]
      );

      if (alreadyProcessed.rows.length > 0) {
        logger.info("💳 Webhook already processed (idempotent)", { sessionId: session.id });
        res.json({ received: true });
        return;
      }

      await pool.query(
        `UPDATE users SET points = points + $1, updated_at = NOW()
         WHERE id = $2 AND deleted_at IS NULL`,
        [pointsToAdd, userIdInt]
      );

      await pool.query(
        `INSERT INTO payment_logs
           (user_id, stripe_session_id, points_added, amount_cents, pack_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [userIdInt, session.id, pointsToAdd, session.amount_total, session.metadata?.packId]
      );

      // Audit log
      await pool.query(
        `INSERT INTO admin_audit_log (admin_firebase_uid, action_type, details)
         VALUES ('stripe-webhook', 'PAYMENT_COMPLETED', $1)`,
        [JSON.stringify({ sessionId: session.id, uid, pointsToAdd, amountCents: session.amount_total })]
      );

      SocketNotify.system(uid, `✅ ${pointsToAdd} points added to your account!`);

      // Send purchase confirmation email (fire and forget)
      const userRow = await pool.query(
        `SELECT email, username FROM users WHERE id = $1`,
        [userIdInt]
      ).catch(() => ({ rows: [] }));

      if (userRow.rows[0]) {
        const u = userRow.rows[0] as { email: string; username: string };
        EmailService.sendPurchaseConfirm({
          to:       u.email,
          username: u.username,
          points:   pointsToAdd,
          packName: session.metadata?.packId || "Pack",
          amount:   session.amount_total || 0,
        }).catch(() => {});
      }

      logger.info("💳 Points granted", { uid, userId, pointsToAdd });
    }

    res.json({ received: true });
  })
);

// ── GET /api/v1/payments/history ──────────────────────────
router.get("/history", verifyFirebaseToken, asyncHandler(async (req, res) => {
  const uid = req.firebaseUser!.uid;

  const result = await pool.query(
    `SELECT pl.id, pl.points_added, pl.amount_cents, pl.pack_id, pl.created_at
     FROM payment_logs pl
     JOIN users u ON u.id = pl.user_id
     WHERE u.firebase_uid = $1
     ORDER BY pl.created_at DESC
     LIMIT 50`,
    [uid]
  );

  res.json({ history: result.rows });
}));

export default router;
