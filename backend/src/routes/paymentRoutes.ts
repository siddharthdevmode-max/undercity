// ============================================================
// PAYMENT ROUTES — UNDERCITY
// Lemon Squeezy integration
//
// GET  /tiers     — Public tier info
// GET  /checkout  — Checkout URL with user ID embedded
// POST /webhook   — HMAC-signed webhook handler
// ============================================================

import { Router, Request, Response } from "express";
import crypto                         from "crypto";
import { verifyFirebaseToken }         from "../middleware/firebaseAuth";
import { paymentLimiter }              from "../middleware/rateLimiter";
import { noCache }                     from "../middleware/cacheHeaders";
import { asyncHandler }                from "../utils/asyncHandler";
import { logger }                      from "../utils/logger";
import { Alerts }                      from "../utils/alerts";
import { config }                      from "../config";
import { TIER_CONFIG }                 from "../config/tiers";
import { CHECKOUT_URLS, HANDLED_WEBHOOK_EVENTS } from "../config/payments";
import { queuePaymentWebhook }         from "../queues/index";

const router = Router();

// ── GET /api/payments/tiers ───────────────────────────────

router.get("/tiers", noCache, (_req: Request, res: Response) => {
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
        priceUsd: TIER_CONFIG.citizen.priceUsd,
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
        priceUsd: TIER_CONFIG.contributor.priceUsd,
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
});

// ── GET /api/payments/checkout ────────────────────────────

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

    const checkoutUrl = `${baseUrl}?checkout[custom][firebase_uid]=${encodeURIComponent(uid)}`;

    logger.info("Checkout URL requested", { uid: uid.substring(0, 8), tier });

    // BUG FIX: don't expose internal tierConfig in response
    res.json({ tier, checkoutUrl });
  })
);

// ── POST /api/payments/webhook ────────────────────────────

interface WebhookPayload {
  meta?: {
    event_name?: string;
    custom_data?: Record<string, unknown>;
  };
  data?: {
    id?:         string;
    attributes?: Record<string, unknown>;
  };
}

router.post(
  "/webhook",
  asyncHandler(async (req: Request, res: Response) => {
    const webhookSecret = config.lemonSqueezy.webhookSecret;

    if (!webhookSecret) {
      logger.error("Payment: LEMONSQUEEZY_WEBHOOK_SECRET not set");
      res.status(500).json({ error: "WEBHOOK_SECRET_NOT_CONFIGURED" });
      return;
    }

    const rawBody: string = Buffer.isBuffer(req.body)
      ? req.body.toString("utf-8")
      : typeof req.body === "string"
        ? req.body
        : JSON.stringify(req.body);

    const signature = req.headers["x-signature"] as string | undefined;

    if (!signature) {
      logger.warn("Payment: webhook missing x-signature");
      res.status(401).json({ error: "MISSING_SIGNATURE" });
      return;
    }

    const expectedSig = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody, "utf-8")
      .digest("hex");

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

    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody) as WebhookPayload;
    } catch {
      res.status(400).json({ error: "INVALID_JSON" });
      return;
    }

    const eventName = payload.meta?.event_name ?? "unknown";

    // BUG FIX: check against HANDLED_WEBHOOK_EVENTS before queuing
    if (!HANDLED_WEBHOOK_EVENTS.has(eventName)) {
      logger.info("Payment: ignoring unhandled webhook event", { eventName });
      res.status(200).json({ received: true, handled: false });
      return;
    }

    logger.info("Webhook received", { event: eventName, dataId: payload.data?.id });

    // Respond immediately — LS expects 200 within 5s
    res.status(200).json({ received: true, handled: true });

    void queuePaymentWebhook({
      paymentEventId:   payload.data?.id ?? `unknown-${Date.now()}`,
      paymentEventType: eventName,
      payload:          rawBody,
      receivedAt:       new Date().toISOString(),
    }).catch((err) => {
      logger.error("Payment: failed to queue webhook", {
        error: err instanceof Error ? err.message : String(err),
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
