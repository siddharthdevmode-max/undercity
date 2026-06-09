// ============================================================
// PAYMENT ROUTES — UNDERCITY
// Lemon Squeezy integration (Phase 3)
//
// GET  /tiers     — Public: what tiers cost and include
// GET  /checkout  — Returns checkout URLs for each tier
// POST /webhook   — Lemon Squeezy signed webhook handler
//
// WEBHOOK SECURITY:
//   Lemon Squeezy signs webhooks with HMAC-SHA256.
//   We verify the signature before processing ANY event.
//   Raw body must be read BEFORE express.json() parses it.
//   app.ts mounts express.raw() for /webhook before express.json().
//
// IDEMPOTENCY:
//   Webhook events are deduplicated via payment_session_id
//   ON CONFLICT in payment_logs.
//   LS may deliver the same event multiple times.
// ============================================================

import { Router, Request, Response } from "express";
import crypto                        from "crypto";
import { verifyFirebaseToken }        from "../middleware/firebaseAuth";
import { paymentLimiter }             from "../middleware/rateLimiter";
import { noCache }                    from "../middleware/cacheHeaders";
import { asyncHandler }               from "../utils/asyncHandler";
import { logger }                     from "../utils/logger";
import { Alerts }                     from "../utils/alerts";
import { config }                     from "../config";
import { TIER_CONFIG }                from "../config/tiers";
import { CHECKOUT_URLS }              from "../config/payments";
import { queuePaymentWebhook }        from "../queues/index";
import type { LemonSqueezyWebhookPayload } from "../services/paymentService";

const router = Router();

// ============================================================
// GET /api/payments/tiers
// Public — shows what each tier costs and includes
// ============================================================
router.get(
  "/tiers",
  noCache,
  (_req: Request, res: Response) => {
    res.json({
      tiers: [
        {
          id:       "player",
          name:     "Player",
          price:    "Free",
          priceUsd: 0,
          duration: "Forever",
          features: [
            "Full access to all crimes",
            "1 nerve every 5 minutes",
            "5 energy every 15 minutes",
            "Standard game experience",
          ],
          cta: null,
        },
        {
          id:       "citizen",
          name:     "Black Card",
          price:    "$4.99",
          priceUsd: 4.99,
          duration: "31 days",
          features: [
            "Everything in Player",
            "1 nerve every 5 minutes",
            "5 energy every 12 minutes",
            "Black Card badge",
            "Support the game",
          ],
          popular: false,
          cta:     "Get Black Card",
        },
        {
          id:       "contributor",
          name:     "Contributor",
          price:    "$7.99/month",
          priceUsd: 7.99,
          duration: "Monthly",
          features: [
            "Everything in Black Card",
            "1 nerve every 3 minutes 🔥",
            "5 energy every 10 minutes 🔥",
            "Contributor badge",
            "Early access to new features",
            "Priority support",
          ],
          popular: true,
          cta:     "Become a Contributor",
        },
      ],
      paymentsEnabled: config.features.paymentsEnabled,
      note: config.features.paymentsEnabled
        ? null
        : "Payments launch with the game on December 15, 2026.",
    });
  }
);

// ============================================================
// GET /api/payments/checkout
// Returns Lemon Squeezy checkout URL with firebase_uid embedded
// ============================================================
router.get(
  "/checkout",
  noCache,
  paymentLimiter,
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const { uid } = req.firebaseUser!;

    if (!config.features.paymentsEnabled) {
      res.status(503).json({
        error:   "PAYMENTS_NOT_ENABLED",
        message: "Payments will be available at launch (December 2026).",
      });
      return;
    }

    const tier = req.query["tier"] as string;

    if (tier !== "citizen" && tier !== "contributor") {
      res.status(400).json({
        error:   "INVALID_TIER",
        message: "tier must be 'citizen' or 'contributor'",
      });
      return;
    }

    const baseUrl = CHECKOUT_URLS[tier];

    if (!baseUrl) {
      logger.error("Payment: checkout URL not configured", { tier });
      res.status(503).json({
        error:   "CHECKOUT_NOT_CONFIGURED",
        message: "Payment not yet configured. Contact support.",
      });
      return;
    }

    // Embed firebase_uid as custom_data — passed through to webhook
    const checkoutUrl = `${baseUrl}?checkout[custom][firebase_uid]=${encodeURIComponent(uid)}`;

    logger.info("💳 Checkout URL requested", {
      uid:  uid.substring(0, 8),
      tier,
    });

    res.json({
      tier,
      checkoutUrl,
      tierConfig: TIER_CONFIG[tier as keyof typeof TIER_CONFIG],
    });
  })
);

// ============================================================
// POST /api/payments/webhook
// Lemon Squeezy signed webhook handler
//
// express.raw() is applied in app.ts BEFORE express.json()
// for this route only — so req.body arrives as a Buffer.
// ============================================================
router.post(
  "/webhook",
  asyncHandler(async (req: Request, res: Response) => {
    const webhookSecret = config.lemonSqueezy.webhookSecret;

    if (!webhookSecret) {
      logger.error("Payment: LEMONSQUEEZY_WEBHOOK_SECRET not set");
      res.status(500).json({ error: "WEBHOOK_SECRET_NOT_CONFIGURED" });
      return;
    }

    // ── Get raw body for HMAC verification ────────────────
    const rawBody: string = Buffer.isBuffer(req.body)
      ? req.body.toString("utf-8")
      : typeof req.body === "string"
        ? req.body
        : JSON.stringify(req.body);

    // ── Verify HMAC-SHA256 signature ───────────────────────
    const signature = req.headers["x-signature"] as string | undefined;

    if (!signature) {
      logger.warn("Payment: webhook missing x-signature header");
      res.status(401).json({ error: "MISSING_SIGNATURE" });
      return;
    }

    const expectedSig = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody, "utf-8")
      .digest("hex");

    // Constant-time comparison prevents timing attacks
    const sigBuffer = Buffer.from(signature,   "hex");
    const expBuffer = Buffer.from(expectedSig, "hex");

    if (
      sigBuffer.length !== expBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expBuffer)
    ) {
      logger.warn("Payment: invalid webhook signature", {
        received: signature.substring(0, 8),
      });
      res.status(401).json({ error: "INVALID_SIGNATURE" });
      return;
    }

    // ── Parse payload ──────────────────────────────────────
    let payload: LemonSqueezyWebhookPayload;
    try {
      payload = JSON.parse(rawBody) as LemonSqueezyWebhookPayload;
    } catch {
      res.status(400).json({ error: "INVALID_JSON" });
      return;
    }

    const eventName = payload.meta?.event_name ?? "unknown";

    logger.info("💳 Webhook received", {
      event:  eventName,
      dataId: payload.data?.id,
    });

    // ── Respond immediately — process async ───────────────
    // Lemon Squeezy expects 200 within 5 seconds.
    res.status(200).json({ received: true });

    // Queue for processing (idempotent via jobId deduplication)
    void queuePaymentWebhook({
      paymentEventId:   payload.data?.id ?? `unknown-${Date.now()}`,
      paymentEventType: eventName,
      payload:          rawBody,
      receivedAt:       new Date().toISOString(),
    }).catch((err) => {
      logger.error("Payment: failed to queue webhook", {
        error:     err instanceof Error ? err.message : String(err),
        eventName,
      });
      void Alerts.systemError(
        "Payment webhook queue failure",
        `Event: ${eventName} | ${err instanceof Error ? err.message : String(err)}`,
        "high"
      );
    });
  })
);

export default router;
