/* eslint-disable camelcase */

// Corrected re-run of migration 017 with admin/developer exclusion.
// On existing deployments where 017 incorrectly anonymized admin accounts,
// this is a no-op (admins are not soft-deleted in normal operation).
// On fresh deployments: 017 already handles this correctly — this is a no-op.
//
// Name is kept as-is for migration history continuity.

exports.shorthands = undefined;

exports.up = (pgm) => {
  // BUG FIX: pgm.sql() not db.query()
  pgm.sql(`
    UPDATE users
    SET username = CONCAT('deleted_', id::text)
    WHERE deleted_at IS NOT NULL
      AND username != CONCAT('deleted_', id::text)
      AND COALESCE(is_admin,     false) = false
      AND COALESCE(is_developer, false) = false
  `);
};

exports.down = (_pgm) => {
  // Intentionally irreversible.
  // Original usernames cannot be recovered after anonymization.
};
