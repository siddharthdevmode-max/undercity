/* eslint-disable camelcase */

// ============================================================
// PAYMENT LOGS V2
//
// Fresh deployments: migration 012 already has these columns.
// ifNotExists guards make all operations idempotent.
//
// Existing deployments: adds missing LS-specific columns.
// ============================================================

exports.shorthands = undefined;

exports.up = (pgm) => {
  // BUG FIX: ifNotExists on all addColumns
  pgm.addColumns("payment_logs", {
    event_type: {
      type:        "varchar(50)",
      notNull:     false,
      default:     null,
      ifNotExists: true,
    },
    tier_granted: {
      type:        "varchar(20)",
      notNull:     false,
      default:     null,
      ifNotExists: true,
    },
    ls_subscription_id: {
      type:        "varchar(100)",
      notNull:     false,
      default:     null,
      ifNotExists: true,
    },
    // BUG FIX: ls_order_id missing from original migration 019
    // Needed for one-time purchase correlation in LS dashboard
    ls_order_id: {
      type:        "varchar(100)",
      notNull:     false,
      default:     null,
      ifNotExists: true,
    },
    // BUG FIX: firebase_uid for post-deletion payment history
    firebase_uid: {
      type:        "varchar(128)",
      notNull:     false,
      default:     null,
      ifNotExists: true,
    },
  });

  // CHECK constraint: valid tier values
  pgm.sql(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'payment_logs_tier_granted_check'
      ) THEN
        ALTER TABLE payment_logs
          ADD CONSTRAINT payment_logs_tier_granted_check
          CHECK (tier_granted IS NULL OR tier_granted IN ('citizen', 'contributor'));
      END IF;
    END $$;
  `);

  pgm.createIndex("payment_logs", "ls_subscription_id", {
    name:        "idx_payment_logs_ls_subscription_id",
    where:       "ls_subscription_id IS NOT NULL",
    ifNotExists: true,
  });
  pgm.createIndex("payment_logs", "tier_granted", {
    name:        "idx_payment_logs_tier_granted",
    where:       "tier_granted IS NOT NULL",
    ifNotExists: true,
  });
  pgm.createIndex("payment_logs", "firebase_uid", {
    name:        "idx_payment_logs_firebase_uid",
    ifNotExists: true,
  });
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE payment_logs
      DROP CONSTRAINT IF EXISTS payment_logs_tier_granted_check;
  `);
  pgm.dropIndex("payment_logs", [], {
    name:    "idx_payment_logs_firebase_uid",
    ifExists: true,
  });
  pgm.dropIndex("payment_logs", [], {
    name:    "idx_payment_logs_tier_granted",
    ifExists: true,
  });
  pgm.dropIndex("payment_logs", [], {
    name:    "idx_payment_logs_ls_subscription_id",
    ifExists: true,
  });
  pgm.dropColumns("payment_logs", [
    "event_type",
    "tier_granted",
    "ls_subscription_id",
    "ls_order_id",
    "firebase_uid",
  ]);
};
