import Stripe from "stripe";
import { logger } from "../utils/logger";

// ============================================================
// STRIPE CONFIG — UNDERCITY PAYMENTS
// ============================================================

if (!process.env.STRIPE_SECRET_KEY) {
  logger.warn("⚠️  STRIPE_SECRET_KEY not set — payments disabled");
}

// Use InstanceType to get the correct type from the Stripe constructor
type StripeInstance = InstanceType<typeof Stripe>;

export const stripe: StripeInstance | null = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      typescript: true,
    })
  : null;

export const POINT_PACKS = [
  {
    id:       "starter",
    name:     "Starter Pack",
    points:   100,
    bonus:    0,
    priceUsd: 499,
    priceId:  process.env.STRIPE_PRICE_STARTER || "",
    popular:  false,
  },
  {
    id:       "hustler",
    name:     "Hustler Pack",
    points:   500,
    bonus:    50,
    priceUsd: 1999,
    priceId:  process.env.STRIPE_PRICE_HUSTLER || "",
    popular:  true,
  },
  {
    id:       "kingpin",
    name:     "Kingpin Pack",
    points:   1200,
    bonus:    200,
    priceUsd: 3999,
    priceId:  process.env.STRIPE_PRICE_KINGPIN || "",
    popular:  false,
  },
  {
    id:       "overlord",
    name:     "Overlord Pack",
    points:   2500,
    bonus:    500,
    priceUsd: 6999,
    priceId:  process.env.STRIPE_PRICE_OVERLORD || "",
    popular:  false,
  },
] as const;

export type PointPackId = typeof POINT_PACKS[number]["id"];
