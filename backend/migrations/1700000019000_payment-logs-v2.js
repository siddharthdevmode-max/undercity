/* eslint-disable camelcase */

// ============================================================
// PAYMENT LOGS V2 — UNDERCITY
// Adds: event_type, tier_granted, ls_subscription_id
// Removes: Stripe-specific assumptions
// payment_session_id was already renamed from stripe_session_id
// in migration 016.
// ============================================================

exports.up = async (pgm) => {
  // Add Lemon Squeezy specific columns
  pgm.addColumns("payment_logs", {
    event_type: {
      type:    "varchar(50)",
      default: null,
      comment: "Lemon Squeezy event: order_created, subscription_renewed, etc.",
    },
    tier_granted: {
      type:    "varchar(20)",
      default: null,
      comment: "Tier activated by this payment: citizen, contributor",
    },
    ls_subscription_id: {
      type:    "varchar(100)",
      default: null,
      comment: "Lemon Squeezy subscription ID for recurring payments",
    },
  });

  // Index for querying by subscription ID (renewal lookups)
  pgm.createIndex("payment_logs", "ls_subscription_id", {
    name:      "idx_payment_logs_ls_subscription_id",
    where:     "ls_subscription_id IS NOT NULL",
    ifNotExists: true,
  });

  // Index for querying by tier (analytics)
  pgm.createIndex("payment_logs", "tier_granted", {
    name:      "idx_payment_logs_tier_granted",
    where:     "tier_granted IS NOT NULL",
    ifNotExists: true,
  });
};

exports.down = async (pgm) => {
  pgm.dropIndex("payment_logs", [], {
    name: "idx_payment_logs_tier_granted",     ifExists: true,
  });
  pgm.dropIndex("payment_logs", [], {
    name: "idx_payment_logs_ls_subscription_id", ifExists: true,
  });
  pgm.dropColumns("payment_logs", [
    "event_type",
    "tier_granted",
    "ls_subscription_id",
  ]);
};
