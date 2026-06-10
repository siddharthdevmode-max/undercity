/* eslint-disable camelcase */

// ============================================================
// FIX: payment_logs.user_id ON DELETE CASCADE → SET NULL
//
// CASCADE deletes payment records when a user is deleted.
// This is wrong — payment logs are financial records and must
// be retained for legal/audit purposes (GDPR right to erasure
// applies to PII, not financial transaction records).
//
// Fix: SET NULL — the record stays, user_id becomes null.
// Firebase UID in the log is sufficient to identify the user
// for audit purposes even after account deletion.
// ============================================================

exports.up = (pgm) => {
  // Drop the existing FK constraint
  pgm.dropConstraint("payment_logs", "payment_logs_user_id_fkey", {
    ifExists: true,
  });

  // Re-add with SET NULL instead of CASCADE
  pgm.addConstraint(
    "payment_logs",
    "payment_logs_user_id_fkey",
    `FOREIGN KEY (user_id)
     REFERENCES users(id)
     ON DELETE SET NULL`
  );

  // Also make user_id nullable to support SET NULL
  pgm.alterColumn("payment_logs", "user_id", {
    type:    "integer",
    notNull: false,
  });
};

exports.down = (pgm) => {
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
