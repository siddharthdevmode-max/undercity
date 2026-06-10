/* eslint-disable camelcase */

// Payment logs — records every payment event from Lemon Squeezy.
// One row per webhook event processed.
// Immutable: never update, only insert.
// GDPR: CASCADE delete with user — payment logs deleted on account deletion.

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable("payment_logs", {
    id: {
      type:       "bigserial",          // BUG FIX: bigserial for log tables
      primaryKey: true,
    },
    user_id: {
      type:       "integer",
      notNull:    true,
      references: "users",
      onDelete:   "CASCADE",
    },
    firebase_uid: {
      type:    "varchar(128)",
      notNull: true,
    },
    // BUG FIX: provider-agnostic session/order ID (not stripe-specific)
    // Stores LS order ID for one-time purchases or LS subscription ID for recurring
    payment_session_id: {
      type:    "varchar(255)",
      notNull: true,
      unique:  true,
    },
    // Lemon Squeezy specific IDs for webhook correlation
    ls_order_id: {
      type:    "varchar(100)",
      notNull: false,
    },
    ls_subscription_id: {
      type:    "varchar(100)",
      notNull: false,
    },
    ls_variant_id: {
      type:    "varchar(50)",
      notNull: false,
    },
    // BUG FIX: tier-based model (not points-based)
    // Records what tier was granted by this payment
    tier_granted: {
      type:    "varchar(20)",           // citizen | contributor
      notNull: false,
    },
    // Webhook event type that triggered this log entry
    event_type: {
      type:    "varchar(50)",           // order_created, subscription_renewed, etc
      notNull: true,
    },
    // Amount in cents (from LS webhook total field)
    amount_cents: {
      type:    "integer",
      notNull: true,
      default: 0,
    },
    currency: {
      type:    "varchar(3)",            // USD, EUR, etc
      notNull: true,
      default: pgm.func("'USD'"),
    },
    created_at: {
      type:    "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
  });

  pgm.createIndex("payment_logs", "user_id",            { name: "idx_payment_logs_user_id" });
  pgm.createIndex("payment_logs", "payment_session_id", { name: "idx_payment_logs_session_id" });
  pgm.createIndex("payment_logs", "firebase_uid",       { name: "idx_payment_logs_firebase_uid" });
  pgm.createIndex("payment_logs", "created_at",         { name: "idx_payment_logs_time" });
  pgm.createIndex("payment_logs", "event_type",         { name: "idx_payment_logs_event" });
};

exports.down = (pgm) => {
  pgm.dropTable("payment_logs", { cascade: true });
};
