import Stripe from "stripe";
import { logger } from "../utils/logger";

// ============================================================
// STRIPE CONFIG — UNDERCITY PAYMENTS
// Products: Point packs (premium currency)
// ============================================================

if (!process.env.STRIPE_SECRET_KEY) {
  logger.warn("⚠️  STRIPE_SECRET_KEY not set — payments disabled");
}

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-06-30.basil",
      typescript: true,
    })
  : null;

// ── Point Packs (premium currency) ────────────────────────
export const POINT_PACKS = [
  {
    id:        "starter",
    name:      "Starter Pack",
    points:    100,
    bonus:     0,
    priceUsd:  499,   // $4.99 in cents
    priceId:   process.env.STRIPE_PRICE_STARTER || "",
    popular:   false,
  },
  {
    id:        "hustler",
    name:      "Hustler Pack",
    points:    500,
    bonus:     50,    // 10% bonus
    priceUsd:  1999,  // $19.99
    priceId:   process.env.STRIPE_PRICE_HUSTLER || "",
    popular:   true,
  },
  {
    id:        "kingpin",
    name:      "Kingpin Pack",
    points:    1200,
    bonus:     200,   // 16% bonus
    priceUsd:  3999,  // $39.99
    priceId:   process.env.STRIPE_PRICE_KINGPIN || "",
    popular:   false,
  },
  {
    id:        "overlord",
    name:      "Overlord Pack",
    points:    2500,
    bonus:     500,   // 20% bonus
    priceUsd:  6999,  // $69.99
    priceId:   process.env.STRIPE_PRICE_OVERLORD || "",
    popular:   false,
  },
] as const;

export type PointPackId = typeof POINT_PACKS[number]["id"];
