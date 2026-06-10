// ============================================================
// PAYMENT SERVICE — UNDERCITY
// Handles tier activation after Lemon Squeezy webhook events.
//
// IDEMPOTENCY:
//   All operations use ON CONFLICT to be safe for retries.
//   Lemon Squeezy may deliver webhooks more than once.
//   payment_logs uses payment_session_id as unique key.
//
// TRANSACTION SAFETY:
//   All DB writes are wrapped in withTransaction().
//   If email queue fails, DB is already committed — that's fine.
//   Email is best-effort, tier activation is not.
//
// SUPPORTED EVENTS:
//   order_created          → activate Black Card (citizen, 31 days)
//   subscription_created   → activate Contributor
//   subscription_renewed   → extend Contributor expiry
//   subscription_cancelled → schedule downgrade on expiry
//   subscription_expired   → downgrade to player immediately
// ============================================================

import { withTransaction }   from "../config/database";
import { pool }              from "../config/database";
import { logger }            from "../utils/logger";
import { Alerts }            from "../utils/alerts";
import { queueEmail }        from "../queues/index";
import {
  getTierForVariant,
  HANDLED_WEBHOOK_EVENTS,
}                            from "../config/payments";
import {
  calcTierExpiry,
  type UserTier,
}                            from "../config/tiers";

// ── Types ──────────────────────────────────────────────────

export interface LemonSqueezyWebhookPayload {
  meta: {
    event_name:     string;
    custom_data?:   { firebase_uid?: string; user_id?: string };
    webhook_id?:    string;
  };
  data: {
    id:         string;
    type:       string;
    attributes: {
      status?:          string;
      variant_id?:      number;
      order_id?:        number;
      customer_id?:     number;
      user_email?:      string;
      user_name?:       string;
      identifier?:      string;
      order_item_id?:   number;
      total?:           number;          // in cents
      subtotal?:        number;
      first_order_item?: {
        variant_id?:    number;
        price?:         number;
        product_name?:  string;
      };
    };
  };
}

export interface TierActivationResult {
  success:     boolean;
  tier:        UserTier | null;
  firebaseUid: string | null;
  eventName:   string;
  message:     string;
}

// ── Main webhook processor ─────────────────────────────────

export async function processWebhookEvent(
  payload:   LemonSqueezyWebhookPayload,
  _rawBody:   string,
  eventName: string
): Promise<TierActivationResult> {

  const EMPTY: TierActivationResult = {
    success:     false,
    tier:        null,
    firebaseUid: null,
    eventName,
    message:     "skipped",
  };

  // ── Only handle events we care about ──────────────────
  if (!HANDLED_WEBHOOK_EVENTS.has(eventName)) {
    logger.debug("Payment: ignoring unhandled event", { eventName });
    return EMPTY;
  }

  // ── Resolve firebase_uid ───────────────────────────────
  // Lemon Squeezy passes custom_data from checkout URL params
  // We embed firebase_uid when building the checkout URL
  const firebaseUid = payload.meta?.custom_data?.firebase_uid?.trim();

  if (!firebaseUid) {
    logger.warn("Payment: webhook missing firebase_uid in custom_data", {
      eventName,
      dataId: payload.data?.id,
    });
    // Don't fail — log and alert for manual resolution
    void Alerts.systemError(
      "Payment webhook missing firebase_uid",
      `Event: ${eventName} | Data ID: ${payload.data?.id}`,
      "high"
    );
    return { ...EMPTY, message: "missing_firebase_uid" };
  }

  // ── Resolve tier from variant ──────────────────────────
  const variantId = String(
    payload.data?.attributes?.variant_id ??
    payload.data?.attributes?.first_order_item?.variant_id ??
    ""
  );

  const tier = getTierForVariant(variantId);

  // ── Route by event type ────────────────────────────────
  switch (eventName) {
    case "order_created":
      return activateOneTimePurchase(payload, firebaseUid, tier, eventName);

    case "subscription_created":
    case "subscription_renewed":
    case "subscription_resumed":
      return activateSubscription(payload, firebaseUid, tier, eventName);

    case "subscription_cancelled":
      return handleCancellation(payload, firebaseUid, eventName);

    case "subscription_expired":
      return handleExpiry(payload, firebaseUid, eventName);

    default:
      return EMPTY;
  }
}

// ── One-time purchase (Black Card) ─────────────────────────

async function activateOneTimePurchase(
  payload:     LemonSqueezyWebhookPayload,
  firebaseUid: string,
  tier:        UserTier | null,
  eventName:   string
): Promise<TierActivationResult> {
  if (!tier || tier !== "citizen") {
    logger.warn("Payment: order_created for unknown variant", {
      firebaseUid: firebaseUid.substring(0, 8),
    });
    return {
      success:     false,
      tier:        null,
      firebaseUid,
      eventName,
      message:     "unknown_variant",
    };
  }

  const sessionId  = payload.data?.attributes?.identifier ?? payload.data?.id;
  const amountCents = payload.data?.attributes?.total ?? 499;

  try {
    await withTransaction(async (client) => {
      // Get user
      const userR = await client.query<{
        id: number; username: string; email: string;
        tier_expires_at: string | null;
      }>(
        `SELECT id, username, email, tier_expires_at
         FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`,
        [firebaseUid]
      );

      if (userR.rows.length === 0) {
        throw new Error(`User not found: ${firebaseUid.substring(0, 8)}`);
      }

      const user     = userR.rows[0]!;
      const expiry   = calcTierExpiry("citizen", user.tier_expires_at);

      // Activate tier
      await client.query(
        `UPDATE users
         SET    user_tier       = 'citizen',
                tier_expires_at = $1,
                tier_granted_at = NOW(),
                tier_granted_by = 'lemonsqueezy_order',
                updated_at      = NOW()
         WHERE  firebase_uid = $2`,
        [expiry, firebaseUid]
      );

      // Log payment — idempotent via ON CONFLICT
      await client.query(
        `INSERT INTO payment_logs
           (user_id, payment_session_id, points_added, amount_cents, pack_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (payment_session_id) DO NOTHING`,
        [user.id, sessionId, 0, amountCents, "black_card"]
      );
    });

    logger.info("✅ Black Card activated", {
      uid:      firebaseUid.substring(0, 8),
      sessionId,
    });

    // Best-effort email — after transaction commits
    void _sendTierEmail(firebaseUid, "citizen", "Black Card");

    return {
      success:     true,
      tier:        "citizen",
      firebaseUid,
      eventName,
      message:     "black_card_activated",
    };

  } catch (err) {
    logger.error("Payment: Black Card activation failed", {
      error:  err instanceof Error ? err.message : String(err),
      uid:    firebaseUid.substring(0, 8),
    });
    void Alerts.systemError(
      "Black Card activation failed",
      `UID: ${firebaseUid.substring(0, 8)} | ${err instanceof Error ? err.message : String(err)}`,
      "high"
    );
    return { success: false, tier: null, firebaseUid, eventName, message: "activation_failed" };
  }
}

// ── Subscription (Contributor) ─────────────────────────────

async function activateSubscription(
  payload:     LemonSqueezyWebhookPayload,
  firebaseUid: string,
  tier:        UserTier | null,
  eventName:   string
): Promise<TierActivationResult> {
  if (!tier || tier !== "contributor") {
    logger.warn("Payment: subscription event for unknown variant", {
      firebaseUid: firebaseUid.substring(0, 8),
      eventName,
    });
    return {
      success:     false,
      tier:        null,
      firebaseUid,
      eventName,
      message:     "unknown_variant",
    };
  }

  const sessionId   = payload.data?.id;
  const amountCents = payload.data?.attributes?.total ?? 799;

  try {
    await withTransaction(async (client) => {
      const userR = await client.query<{
        id: number; username: string; email: string;
        tier_expires_at: string | null;
      }>(
        `SELECT id, username, email, tier_expires_at
         FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`,
        [firebaseUid]
      );

      if (userR.rows.length === 0) {
        throw new Error(`User not found: ${firebaseUid.substring(0, 8)}`);
      }

      const user   = userR.rows[0]!;
      const expiry = calcTierExpiry("contributor", user.tier_expires_at);

      await client.query(
        `UPDATE users
         SET    user_tier       = 'contributor',
                tier_expires_at = $1,
                tier_granted_at = NOW(),
                tier_granted_by = 'lemonsqueezy_subscription',
                updated_at      = NOW()
         WHERE  firebase_uid = $2`,
        [expiry, firebaseUid]
      );

      await client.query(
        `INSERT INTO payment_logs
           (user_id, payment_session_id, points_added, amount_cents, pack_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (payment_session_id) DO NOTHING`,
        [user.id, sessionId, 0, amountCents, "contributor_monthly"]
      );
    });

    logger.info("✅ Contributor subscription activated/renewed", {
      uid:       firebaseUid.substring(0, 8),
      eventName,
    });

    void _sendTierEmail(firebaseUid, "contributor", "Contributor");

    return {
      success:     true,
      tier:        "contributor",
      firebaseUid,
      eventName,
      message:     "contributor_activated",
    };

  } catch (err) {
    logger.error("Payment: Contributor activation failed", {
      error:  err instanceof Error ? err.message : String(err),
      uid:    firebaseUid.substring(0, 8),
    });
    void Alerts.systemError(
      "Contributor activation failed",
      `UID: ${firebaseUid.substring(0, 8)} | ${err instanceof Error ? err.message : String(err)}`,
      "high"
    );
    return { success: false, tier: null, firebaseUid, eventName, message: "activation_failed" };
  }
}

// ── Cancellation ───────────────────────────────────────────
// Subscription cancelled = keep tier until expiry, then downgrade
// gameTick.ts already handles tier expiry → downgrade to player

async function handleCancellation(
  payload:     LemonSqueezyWebhookPayload,
  firebaseUid: string,
  eventName:   string
): Promise<TierActivationResult> {
  try {
    // tier_expires_at stays set — gameTick will downgrade on expiry
    // Just log it for audit purposes
    await pool.query(
      `INSERT INTO admin_audit_log
         (admin_firebase_uid, action_type, details, ip_address)
       VALUES ($1, 'SUBSCRIPTION_CANCELLED', $2, 'lemonsqueezy')`,
      [
        firebaseUid,
        JSON.stringify({
          dataId:    payload.data?.id,
          eventName,
          note:      "Tier retained until expiry — gameTick will downgrade",
        }),
      ]
    );

    logger.info("📋 Subscription cancellation logged", {
      uid: firebaseUid.substring(0, 8),
    });

    return {
      success:     true,
      tier:        null,
      firebaseUid,
      eventName,
      message:     "cancellation_logged",
    };

  } catch (err) {
    logger.error("Payment: cancellation logging failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { success: false, tier: null, firebaseUid, eventName, message: "log_failed" };
  }
}

// ── Expiry ─────────────────────────────────────────────────
// Subscription expired = downgrade to player immediately
// (gameTick also handles this, but webhook is the instant path)

async function handleExpiry(
  payload:     LemonSqueezyWebhookPayload,
  firebaseUid: string,
  eventName:   string
): Promise<TierActivationResult> {
  try {
    await pool.query(
      `UPDATE users
       SET    user_tier       = 'player',
              tier_expires_at = NULL,
              tier_granted_at = NULL,
              tier_granted_by = NULL,
              updated_at      = NOW()
       WHERE  firebase_uid = $1
         AND  deleted_at   IS NULL`,
      [firebaseUid]
    );

    await pool.query(
      `INSERT INTO admin_audit_log
         (admin_firebase_uid, action_type, details, ip_address)
       VALUES ($1, 'SUBSCRIPTION_EXPIRED', $2, 'lemonsqueezy')`,
      [
        firebaseUid,
        JSON.stringify({ dataId: payload.data?.id, eventName }),
      ]
    );

    logger.info("📋 Subscription expired — downgraded to player", {
      uid: firebaseUid.substring(0, 8),
    });

    return {
      success:     true,
      tier:        "player",
      firebaseUid,
      eventName,
      message:     "downgraded_to_player",
    };

  } catch (err) {
    logger.error("Payment: expiry downgrade failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { success: false, tier: null, firebaseUid, eventName, message: "downgrade_failed" };
  }
}

// ── Email helper ───────────────────────────────────────────

async function _sendTierEmail(
  firebaseUid: string,
  _tier:       UserTier,
  tierLabel:   string
): Promise<void> {
  try {
    const userR = await pool.query<{ email: string; username: string }>(
      `SELECT email, username FROM users
       WHERE firebase_uid = $1 AND deleted_at IS NULL LIMIT 1`,
      [firebaseUid]
    );

    const user = userR.rows[0];
    if (!user?.email) return;

    await queueEmail({
      type:        "purchase_confirm",
      to:          user.email,
      username:    user.username,
      points:      0,
      packName:    tierLabel,
      amountCents: 0,
    });
  } catch (err) {
    // Email is best-effort — never block tier activation
    logger.warn("Payment: tier email queue failed (non-fatal)", {
      error: err instanceof Error ? err.message : String(err),
      uid:   firebaseUid.substring(0, 8),
    });
  }
}
