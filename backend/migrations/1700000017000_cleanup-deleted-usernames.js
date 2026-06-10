/* eslint-disable camelcase */

// Data migration: anonymize usernames of soft-deleted users.
// Excluded: admins and developers (see migration 018 for corrected version).
// Idempotent: WHERE clause prevents double-processing.
//
// Note: cannot be reversed — original usernames are unrecoverable.
// This is correct GDPR behavior (right to erasure of PII).

exports.shorthands = undefined;

exports.up = (pgm) => {
  // BUG FIX: use pgm.sql() not db.query() — correct node-pg-migrate API
  // BUG FIX: exclude admins/developers (duplicates migration 018 fix retroactively)
  // BUG FIX: stricter pattern — only skip if username is ALREADY the deleted_ + id format
  pgm.sql(`
    UPDATE users
    SET username = CONCAT('deleted_', id::text)
    WHERE deleted_at IS NOT NULL
      AND COALESCE(is_admin,     false) = false
      AND COALESCE(is_developer, false) = false
      AND username != CONCAT('deleted_', id::text)
  `);
};

exports.down = (_pgm) => {
  // Intentionally irreversible.
  // Original usernames cannot be recovered after anonymization.
  // GDPR compliance: this is correct behavior.
};
