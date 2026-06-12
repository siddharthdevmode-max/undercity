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
  // Use raw SQL with existence checks — node-pg-migrate's ifNotExists
  // on addColumns individual columns does NOT generate IF NOT EXISTS SQL.
  pgm.sql(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payment_logs' AND column_name = 'event_type'
      ) THEN
        ALTER TABLE payment_logs
          ADD event_type varchar(50) DEFAULT NULL;
      END IF;
    END $$;
  `);
  pgm.sql(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payment_logs' AND column_name = 'tier_granted'
      ) THEN
        ALTER TABLE payment_logs
          ADD tier_granted varchar(20) DEFAULT NULL;
      END IF;
    END $$;
  `);
  pgm.sql(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payment_logs' AND column_name = 'ls_subscription_id'
      ) THEN
        ALTER TABLE payment_logs
          ADD ls_subscription_id varchar(100) DEFAULT NULL;
      END IF;
    END $$;
  `);
  pgm.sql(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payment_logs' AND column_name = 'ls_order_id'
      ) THEN
        ALTER TABLE payment_logs
          ADD ls_order_id varchar(100) DEFAULT NULL;
      END IF;
    END $$;
  `);
  pgm.sql(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payment_logs' AND column_name = 'firebase_uid'
      ) THEN
        ALTER TABLE payment_logs
          ADD firebase_uid varchar(128) DEFAULT NULL;
      END IF;
    END $$;
  `);

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
