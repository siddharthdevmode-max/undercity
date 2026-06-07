// ============================================================
// PAYMENTS CONFIG — UNDERCITY
// ============================================================
// Stripe removed (Indian solo dev limitation).
// Lemon Squeezy integration planned for Phase 3 (Sept 2026).
//
// This file kept as a placeholder so legacy imports don't break.
// Will be renamed to lemonsqueezy.ts in Phase 3.
// ============================================================

import { logger } from "../utils/logger";

if (!process.env.LEMONSQUEEZY_API_KEY) {
  logger.debug("Payments disabled — LEMONSQUEEZY_API_KEY not set (expected in Phase 0-2)");
}

// Stub for legacy imports — always null until Phase 3
export const stripe = null;

// Point packs — pricing structure stays the same for Lemon Squeezy
export const POINT_PACKS = [
  {
    id:       "starter",
    name:     "Starter Pack",
    points:   100,
    bonus:    0,
    priceUsd: 499,
    priceId:  "",
    popular:  false,
  },
  {
    id:       "hustler",
    name:     "Hustler Pack",
    points:   500,
    bonus:    50,
    priceUsd: 1999,
    priceId:  "",
    popular:  true,
  },
  {
    id:       "kingpin",
    name:     "Kingpin Pack",
    points:   1200,
    bonus:    200,
    priceUsd: 3999,
    priceId:  "",
    popular:  false,
  },
  {
    id:       "overlord",
    name:     "Overlord Pack",
    points:   2500,
    bonus:    500,
    priceUsd: 6999,
    priceId:  "",
    popular:  false,
  },
] as const;

export type PointPackId = typeof POINT_PACKS[number]["id"];
