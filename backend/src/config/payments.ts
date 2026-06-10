// ============================================================
// LEMON SQUEEZY PAYMENT CONFIG — UNDERCITY
//
// Products:
//   Black Card (citizen)  — one-time purchase, 31 days
//   Contributor           — monthly subscription
//
// Set these in .env:
//   LEMONSQUEEZY_BLACK_CARD_VARIANT_ID=123456
//   LEMONSQUEEZY_CONTRIBUTOR_VARIANT_ID=789012
//   LEMONSQUEEZY_STORE_ID=your-store-id
//   LEMONSQUEEZY_WEBHOOK_SECRET=your-webhook-secret
//   LEMONSQUEEZY_API_KEY=your-api-key
// ============================================================

import type { UserTier } from "./tiers";

// ─── Variant ID validation ────────────────────────────────

function validateVariantId(raw: string | undefined, name: string): string | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  // BUG FIX: Lemon Squeezy variant IDs are numeric — validate
  if (!/^\d+$/.test(trimmed)) {
    // eslint-disable-next-line no-console
    console.warn(
      `[Payments] ${name} variant ID "${trimmed}" is not numeric — ` +
      `expected a numeric Lemon Squeezy variant ID. Ignoring.`
    );
    return null;
  }
  return trimmed;
}

// ─── Variant Map ──────────────────────────────────────────
// BUG FIX: built lazily via getter so it always reads current
// process.env (safe even if loaded before dotenv.config())
// BUG FIX: Object.freeze() prevents mutation

function buildVariantMap(): Readonly<Record<string, UserTier>> {
  const map: Record<string, UserTier> = {};

  const blackCardId   = validateVariantId(
    process.env["LEMONSQUEEZY_BLACK_CARD_VARIANT_ID"],
    "BLACK_CARD"
  );
  const contributorId = validateVariantId(
    process.env["LEMONSQUEEZY_CONTRIBUTOR_VARIANT_ID"],
    "CONTRIBUTOR"
  );

  if (blackCardId)   map[blackCardId]   = "citizen";
  if (contributorId) map[contributorId] = "contributor";

  return Object.freeze(map);
}

// Cached after first access — module-level singleton
let _variantMap: Readonly<Record<string, UserTier>> | null = null;

export function getVariantMap(): Readonly<Record<string, UserTier>> {
  if (!_variantMap) _variantMap = buildVariantMap();
  return _variantMap;
}

// For backwards compatibility — direct access
// BUG FIX: now lazy (reads env at first access not at import time)
export const LS_VARIANT_MAP = new Proxy({} as Record<string, UserTier>, {
  get(_target, prop: string) {
    return getVariantMap()[prop];
  },
  has(_target, prop: string) {
    return prop in getVariantMap();
  },
  ownKeys() {
    return Object.keys(getVariantMap());
  },
});

// ─── Checkout URLs ────────────────────────────────────────

function getCheckoutUrl(envKey: string): string | null {
  const raw = process.env[envKey]?.trim();
  if (!raw) return null;
  // Basic URL validation
  try {
    new URL(raw);
    return raw;
  } catch {
    // eslint-disable-next-line no-console
    console.warn(`[Payments] ${envKey} is not a valid URL: "${raw}"`);
    return null;
  }
}

export const CHECKOUT_URLS = {
  get citizen()     { return getCheckoutUrl("LEMONSQUEEZY_BLACK_CARD_URL"); },
  get contributor() { return getCheckoutUrl("LEMONSQUEEZY_CONTRIBUTOR_URL"); },
} as const;

// BUG FIX: helper that throws if URL is not configured
// Use in payment routes to fail fast with a clear error
export function requireCheckoutUrl(tier: "citizen" | "contributor"): string {
  const url = CHECKOUT_URLS[tier];
  if (!url) {
    throw new Error(
      `Checkout URL for tier "${tier}" is not configured. ` +
      `Set LEMONSQUEEZY_${tier === "citizen" ? "BLACK_CARD" : "CONTRIBUTOR"}_URL in .env`
    );
  }
  return url;
}

// ─── Webhook Events ───────────────────────────────────────
// BUG FIX: added subscription_paused and order_refunded

export const HANDLED_WEBHOOK_EVENTS = new Set([
  "order_created",           // one-time purchase (Black Card)
  "order_refunded",          // BUG FIX: refund → revoke tier
  "subscription_created",    // new subscriber
  "subscription_renewed",    // monthly renewal
  "subscription_cancelled",  // cancellation scheduled (still active until end)
  "subscription_expired",    // subscription fully ended
  "subscription_resumed",    // resumed after pause
  "subscription_paused",     // BUG FIX: paused → should suspend tier
]) as ReadonlySet<string>;

// ─── Helpers ─────────────────────────────────────────────

export function getTierForVariant(variantId: string): UserTier | null {
  return getVariantMap()[variantId] ?? null;
}

export function isVariantConfigured(variantId: string): boolean {
  return variantId in getVariantMap();
}

/**
 * Check if payments are fully configured.
 * Returns array of missing config items (empty = all good).
 */
export function getPaymentConfigErrors(): string[] {
  const errors: string[] = [];
  const map = getVariantMap();

  if (!process.env["LEMONSQUEEZY_API_KEY"]?.trim()) {
    errors.push("LEMONSQUEEZY_API_KEY not set");
  }
  if (!process.env["LEMONSQUEEZY_WEBHOOK_SECRET"]?.trim()) {
    errors.push("LEMONSQUEEZY_WEBHOOK_SECRET not set");
  }
  if (!process.env["LEMONSQUEEZY_STORE_ID"]?.trim()) {
    errors.push("LEMONSQUEEZY_STORE_ID not set");
  }
  if (!Object.values(map).includes("citizen")) {
    errors.push("LEMONSQUEEZY_BLACK_CARD_VARIANT_ID not set or invalid");
  }
  if (!Object.values(map).includes("contributor")) {
    errors.push("LEMONSQUEEZY_CONTRIBUTOR_VARIANT_ID not set or invalid");
  }

  return errors;
}
