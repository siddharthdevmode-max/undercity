import { Router }              from "express";
import express                 from "express";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { asyncHandler }        from "../utils/asyncHandler";
import { paymentLimiter }      from "../middleware/rateLimiter";
import { noCache }             from "../middleware/cacheHeaders";
import { validate }            from "../middleware/validate";
import { createCheckoutSchema } from "../utils/schemas";
import { stripe, POINT_PACKS } from "../config/stripe";
import { pool }                from "../config/database";
import { withTransaction }     from "../config/database";
import { config }              from "../config";
import { logger }              from "../utils/logger";
import { queueEmail, queuePaymentWebhook } from "../queues/index";
import { SocketNotify }        from "../config/socket";
import { getPagination, buildPaginatedResponse } from "../utils/pagination";
import {
  AppError,
  NotFoundError,
  ValidationError,
}                              from "../utils/errors";

// ============================================================
// PAYMENT ROUTES — /api/v1/payments
//
// GET  /packs       — List available point packs (public)
// POST /checkout    — Create Stripe Checkout session (auth)
// POST /webhook     — Stripe webhook (raw body, no auth)
// GET  /history     — Player's own payment history (auth)
//
// WEBHOOK STRATEGY:
//   Webhook handler does minimal work:
//     1. Verify Stripe signature
//     2. Queue event via queuePaymentWebhook()
//     3. Return 200 to Stripe immediately
//   Actual processing (DB update, email, socket) happens
//   in the payment-webhook BullMQ worker (workers.ts).
//   This makes webhook processing fault-tolerant + retryable.
//
// ATOMIC PAYMENT:
//   UPDATE users + INSERT payment_logs + INSERT audit_log
//   run in a single withTransaction() — no partial success.
//
// SSRF:
//   successUrl / cancelUrl validated against config.allowedOrigins
// ============================================================

const router = Router();

// ── URL validator (SSRF protection) ───────────────────────

function isAllowedRedirectUrl(url: string): boolean {
  const allowed = config.allowedOrigins; // string[] from config

  try {
    const parsed = new URL(url);

    // Must be https in production
    if (config.isProduction && parsed.protocol !== "https:") return false;

    return allowed.some((origin) => {
      try {
        return new URL(origin).hostname === parsed.hostname;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

// ============================================================
// GET /api/v1/payments/packs
// Public — no auth required
// ============================================================
router.get(
  "/packs",
  asyncHandler(async (_req, res) => {
    res.json({
      packs: POINT_PACKS.map((p) => ({
        id:       p.id,
        name:     p.name,
        points:   p.points + p.bonus,
        base:     p.points,
        bonus:    p.bonus,
        priceUsd: p.priceUsd,
        popular:  p.popular ?? false,
      })),
    });
  })
);

// ============================================================
// POST /api/v1/payments/checkout
// Create Stripe Checkout session
// ============================================================
router.post(
  "/checkout",
  paymentLimiter,
  verifyFirebaseToken,
  noCache,
  validate(createCheckoutSchema),
  asyncHandler(async (req, res) => {
    if (!stripe) {
      throw new AppError("Payments are not currently available.", 503, "ERR_7002");
    }

    if (!config.features.paymentsEnabled) {
      throw new AppError("Payments are temporarily disabled.", 503, "ERR_7002");
    }

    const { packId, successUrl, cancelUrl } = req.body as {
      packId:     string;
      successUrl: string;
      cancelUrl:  string;
    };

    // ── Validate redirect URLs (SSRF) ──────────────────────
    if (!isAllowedRedirectUrl(successUrl) || !isAllowedRedirectUrl(cancelUrl)) {
      throw new ValidationError("Invalid redirect URL — must be an allowed origin.");
    }

    // ── Find pack ──────────────────────────────────────────
    const pack = POINT_PACKS.find((p) => p.id === packId);
    if (!pack)         throw new ValidationError("Invalid pack ID.");
    if (!pack.priceId) throw new AppError("This pack is not available for purchase.", 503, "ERR_7002");

    const uid = req.firebaseUser!.uid;

    // ── Get user ───────────────────────────────────────────
    const userResult = await pool.query(
      `SELECT id, email, username
       FROM users
       WHERE firebase_uid = $1
         AND deleted_at   IS NULL
       LIMIT 1`,
      [uid]
    );

    if (!userResult.rows[0]) throw new NotFoundError("User");

    const user = userResult.rows[0] as { id: number; email: string; username: string };

    // ── Create Stripe session ──────────────────────────────
    const session = await stripe.checkout.sessions.create({
      mode:                 "payment",
      payment_method_types: ["card"],
      line_items:           [{ price: pack.priceId, quantity: 1 }],
      success_url:          `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:           cancelUrl,
      customer_email:       user.email,
      metadata: {
        userId:   String(user.id),
        uid,
        packId:   pack.id,
        points:   String(pack.points + pack.bonus),
        username: user.username,
      },
    });

    logger.info("💳 Checkout session created", {
      uid:       uid.substring(0, 8),
      packId,
      sessionId: session.id,
    });

    res.json({ url: session.url, sessionId: session.id });
  })
);

// ============================================================
// POST /api/v1/payments/webhook
// Stripe webhook — raw body required, no auth
// express.raw() must be applied BEFORE this route in app.ts
// ============================================================
router.post(
  "/webhook",
  // Raw body parser applied here for this specific route.
  // If app.ts already applies it globally for this path, remove this line.
  express.raw({ type: "application/json", limit: "1mb" }),
  asyncHandler(async (req, res) => {
    if (!stripe) {
      res.json({ received: true });
      return;
    }

    const sig    = req.headers["stripe-signature"];
    const secret = config.stripe.webhookSecret;

    if (!sig || !secret) {
      logger.error("💳 Webhook: missing signature or secret");
      res.status(400).json({ error: "Webhook configuration error" });
      return;
    }

    // ── Verify Stripe signature ────────────────────────────
    let event: { type: string; id: string; data: { object: unknown } };

    try {
      event = stripe.webhooks.constructEvent(
        req.body as Buffer,
        sig,
        secret
      ) as typeof event;
    } catch (err) {
      logger.error("💳 Webhook: signature verification failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(400).json({ error: "Invalid webhook signature" });
      return;
    }

    // ── Queue for async processing ─────────────────────────
    // Return 200 to Stripe immediately — processing happens in worker.
    // BullMQ worker retries on failure — Stripe won't re-deliver.
    try {
      await queuePaymentWebhook({
        stripeEventId:   event.id,
        stripeEventType: event.type,
        payload:         JSON.stringify(event),
        receivedAt:      new Date().toISOString(),
      });

      logger.info("💳 Webhook queued", {
        eventId:   event.id,
        eventType: event.type,
      });
    } catch (err) {
      // Queue failed — process synchronously as fallback
      logger.error("💳 Webhook: queue failed, processing synchronously", {
        error:     err instanceof Error ? err.message : String(err),
        eventId:   event.id,
        eventType: event.type,
      });

      if (event.type === "checkout.session.completed") {
        await processCheckoutCompleted(event.data.object);
      }
    }

    // Always return 200 — Stripe will retry on non-2xx
    res.json({ received: true });
  })
);

// ============================================================
// processCheckoutCompleted
// Called by worker (workers.ts processStripeWebhook) AND
// as synchronous fallback in webhook route if queue fails.
// Exported so workers.ts can import it.
// ============================================================

interface StripeCheckoutSession {
  id:           string;
  amount_total: number | null;
  metadata:     Record<string, string> | null;
}

export async function processCheckoutCompleted(
  sessionData: unknown
): Promise<void> {
  const session = sessionData as StripeCheckoutSession;

  const { userId, uid, points, packId, username } = session.metadata ?? {};

  if (!userId || !uid || !points) {
    logger.error("💳 processCheckout: missing metadata", {
      sessionId: session.id,
    });
    return;
  }

  const pointsToAdd = parseInt(points, 10);
  const userIdInt   = parseInt(userId, 10);

  if (!Number.isFinite(pointsToAdd) || !Number.isFinite(userIdInt) || pointsToAdd <= 0) {
    logger.error("💳 processCheckout: invalid points or userId", {
      points,
      userId,
      sessionId: session.id,
    });
    return;
  }

  // ── Idempotency check ──────────────────────────────────
  const alreadyDone = await pool.query(
    `SELECT id FROM payment_logs WHERE stripe_session_id = $1 LIMIT 1`,
    [session.id]
  );

  if (alreadyDone.rows.length > 0) {
    logger.info("💳 processCheckout: already processed (idempotent)", {
      sessionId: session.id,
    });
    return;
  }

  // ── Atomic DB update ───────────────────────────────────
  // UPDATE users + INSERT payment_logs + INSERT audit_log
  // All three succeed or all three roll back.
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE users
       SET    points     = points + $1,
              updated_at = NOW()
       WHERE  id         = $2
         AND  deleted_at IS NULL`,
      [pointsToAdd, userIdInt]
    );

    await client.query(
      `INSERT INTO payment_logs
         (user_id, stripe_session_id, points_added, amount_cents, pack_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userIdInt,
        session.id,
        pointsToAdd,
        session.amount_total ?? 0,
        packId ?? null,
      ]
    );

    await client.query(
      `INSERT INTO admin_audit_log
         (admin_firebase_uid, action_type, details, ip_address)
       VALUES ('stripe-webhook', 'PAYMENT_COMPLETED', $1, 'stripe')`,
      [JSON.stringify({
        sessionId:   session.id,
        uid,
        pointsToAdd,
        amountCents: session.amount_total,
        packId,
      })]
    );
  });

  // ── Post-success side effects (non-critical) ───────────

  // Real-time notification to player
  SocketNotify.system(uid, `✅ ${pointsToAdd} points added to your account!`);

  // Confirmation email via queue
  try {
    const userRow = await pool.query(
      `SELECT email, username FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [userIdInt]
    );

    if (userRow.rows[0]) {
      const u = userRow.rows[0] as { email: string; username: string };
      await queueEmail({
        type:       "purchase_confirm",
        to:         u.email,
        username:   u.username ?? username ?? "Player",
        points:     pointsToAdd,
        packName:   packId ?? "Points Pack",
        amountCents: session.amount_total ?? 0,
      });
    }
  } catch (err) {
    // Non-fatal — payment succeeded even if email fails
    logger.warn("💳 processCheckout: email queue failed", {
      error:     err instanceof Error ? err.message : String(err),
      sessionId: session.id,
    });
  }

  logger.info("💳 Points granted successfully", {
    uid:       uid.substring(0, 8),
    userIdInt,
    pointsToAdd,
    sessionId: session.id,
  });
}

// ============================================================
// GET /api/v1/payments/history
// ============================================================
router.get(
  "/history",
  paymentLimiter,
  verifyFirebaseToken,
  noCache,
  asyncHandler(async (req, res) => {
    const uid             = req.firebaseUser!.uid;
    const { limit, offset, page } = getPagination(req);

    const [countR, rowsR] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM payment_logs pl
         JOIN users u ON u.id = pl.user_id
         WHERE u.firebase_uid = $1`,
        [uid]
      ),
      pool.query(
        `SELECT pl.id, pl.points_added, pl.amount_cents,
                pl.pack_id, pl.created_at
         FROM payment_logs pl
         JOIN users u ON u.id = pl.user_id
         WHERE u.firebase_uid = $1
         ORDER BY pl.created_at DESC
         LIMIT $2 OFFSET $3`,
        [uid, limit, offset]
      ),
    ]);

    const total = (countR.rows[0] as { total: number }).total;
    res.json(buildPaginatedResponse(rowsR.rows, total, { page, limit, offset }));
  })
);

export default router;
