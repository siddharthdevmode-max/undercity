/* eslint-disable camelcase */

// ============================================================
// FIX: payment_logs.user_id ON DELETE CASCADE → SET NULL
//
// Legal requirement: payment/financial records must survive
// account deletion. GDPR right to erasure applies to PII
// (name, email, IP) — NOT to financial transaction records.
//
// Fix:
//   - user_id: NOT NULL → nullable (required for SET NULL)
//   - FK: CASCADE → SET NULL
//   - After user deletion: user_id becomes NULL, firebase_uid
//     remains for audit trail identification.
//
// Fresh deployments: migration 012 already creates this correctly.
// This migration is idempotent — ifExists guards prevent errors.
//
// NOTE: down migration restores CASCADE which is legally incorrect.
// Only roll back if you have no payment records in production.
// ============================================================

exports.shorthands = undefined;

exports.up = (pgm) => {
  // BUG FIX: make column nullable FIRST, then alter constraint
  // (SET NULL constraint requires nullable column to already exist)
  pgm.alterColumn("payment_logs", "user_id", {
    type:    "integer",
    notNull: false,
  });

  // Drop the existing CASCADE FK (ifExists = safe on fresh deployments)
  pgm.dropConstraint("payment_logs", "payment_logs_user_id_fkey", {
    ifExists: true,
  });

  // Re-add with SET NULL
  pgm.addConstraint(
    "payment_logs",
    "payment_logs_user_id_fkey",
    `FOREIGN KEY (user_id)
     REFERENCES users(id)
     ON DELETE SET NULL`
  );

  // Partial index for admin: find orphaned payment records (user deleted)
  pgm.createIndex("payment_logs", "user_id", {
    name:        "idx_payment_logs_orphaned",
    where:       "user_id IS NULL",
    ifNotExists: true,
  });
};

exports.down = (pgm) => {
  // WARNING: This restores ON DELETE CASCADE on financial records.
  // This is legally incorrect if payment records exist in production.
  // Only roll back in development with no real payment data.
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM payment_logs LIMIT 1) THEN
        RAISE WARNING
          'Rolling back payment-logs-cascade-fix with existing payment data. '
          'This will restore ON DELETE CASCADE — financial records will be '
          'deleted when users are deleted. Ensure this is intentional.';
      END IF;
    END $$;
  `);

  pgm.dropIndex("payment_logs", [], {
    name:    "idx_payment_logs_orphaned",
    ifExists: true,
  });

  pgm.dropConstraint("payment_logs", "payment_logs_user_id_fkey", {
    ifExists: true,
  });

  pgm.alterColumn("payment_logs", "user_id", {
    type:    "integer",
    notNull: true,
  });

  pgm.addConstraint(
    "payment_logs",
    "payment_logs_user_id_fkey",
    `FOREIGN KEY (user_id)
     REFERENCES users(id)
     ON DELETE CASCADE`
  );
};
