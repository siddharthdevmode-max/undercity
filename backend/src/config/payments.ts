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
//
// How to get these:
//   1. Create product in Lemon Squeezy dashboard
//   2. Create variant (one-time or subscription)
//   3. Copy the variant ID from the variant URL
// ============================================================

import type { UserTier } from "./tiers";

// ── Lemon Squeezy variant IDs ──────────────────────────────
// These map LS variant IDs → internal tier names
// Add variant ID to .env and it auto-maps here

export const LS_VARIANT_MAP: Record<string, UserTier> = (() => {
  const map: Record<string, UserTier> = {};

  const blackCardId   = process.env.LEMONSQUEEZY_BLACK_CARD_VARIANT_ID?.trim();
  const contributorId = process.env.LEMONSQUEEZY_CONTRIBUTOR_VARIANT_ID?.trim();

  if (blackCardId)   map[blackCardId]   = "citizen";
  if (contributorId) map[contributorId] = "contributor";

  return map;
})();

// ── Checkout URLs ──────────────────────────────────────────
// These are the Lemon Squeezy hosted checkout URLs
// SWAP_ON_VPS: set these in .env after creating products in LS dashboard
// Format: https://your-store.lemonsqueezy.com/checkout/buy/VARIANT_ID

export const CHECKOUT_URLS = {
  citizen:     process.env.LEMONSQUEEZY_BLACK_CARD_URL?.trim()     ?? null,
  contributor: process.env.LEMONSQUEEZY_CONTRIBUTOR_URL?.trim()    ?? null,
} as const;

// ── Webhook events we handle ───────────────────────────────
export const HANDLED_WEBHOOK_EVENTS = new Set([
  "order_created",           // one-time purchase completed (Black Card)
  "subscription_created",    // new subscriber
  "subscription_renewed",    // monthly renewal
  "subscription_cancelled",  // cancellation scheduled
  "subscription_expired",    // subscription ended
  "subscription_resumed",    // resumed after pause
]) as ReadonlySet<string>;

// ── Helper: get tier for a variant ────────────────────────
export function getTierForVariant(variantId: string): UserTier | null {
  return LS_VARIANT_MAP[variantId] ?? null;
}

// ── Helper: is variant ID configured ──────────────────────
export function isVariantConfigured(variantId: string): boolean {
  return variantId in LS_VARIANT_MAP;
}
