/* eslint-disable camelcase */

// ============================================================
// FIX: idempotency_keys.idempotency_key varchar(64) → varchar(128)
//
// Fresh deployments: migration 005 already creates varchar(128).
// This ALTER is idempotent — varchar(128) → varchar(128) is a no-op.
//
// Existing deployments with old migration 005 (varchar(64)):
// This correctly expands the column.
// Note: expanding varchar in Postgres does NOT rewrite the table.
// ============================================================

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.alterColumn("idempotency_keys", "idempotency_key", {
    type:    "varchar(128)",
    notNull: true,
  });
};

exports.down = (pgm) => {
  // BUG FIX: guard against data loss — keys > 64 chars cannot be truncated
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM idempotency_keys
        WHERE LENGTH(idempotency_key) > 64
      ) THEN
        RAISE EXCEPTION
          'Cannot rollback: idempotency keys exist with length > 64 chars. '
          'Truncating would corrupt data.';
      END IF;
    END $$;
  `);

  pgm.alterColumn("idempotency_keys", "idempotency_key", {
    type:    "varchar(64)",
    notNull: true,
  });
};
