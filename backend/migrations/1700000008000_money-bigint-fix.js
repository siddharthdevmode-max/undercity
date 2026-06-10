/* eslint-disable camelcase */

// ============================================================
// MIGRATION 008 — MONEY BIGINT + PRECISION FIXES
//
// Context: migration 001 now creates money as bigint from the start.
// On fresh deployments, the ALTER COLUMN money is a no-op (same type).
// On existing deployments that ran the old migration 001, this is the fix.
//
// hidden_cpl: real → numeric(12,4) for precision in crime level math.
// ============================================================

exports.up = (pgm) => {
  // BUG FIX: guard against redundancy — ALTER to same type is a no-op in Postgres
  // but we keep this for existing deployments that ran the old integer migration 001
  pgm.alterColumn("users", "money", {
    type:    "bigint",
    notNull: true,
    default: 750,
  });

  // Upgrade hidden_cpl precision (real = ~6 decimal digits, numeric(12,4) = exact)
  pgm.alterColumn("user_crime_progress", "hidden_cpl", {
    type:    "numeric(12,4)",
    notNull: true,
    default: 0,
  });

  // Trust score partial index — admin queries for low-trust users
  pgm.createIndex("users", "trust_score", {
    name:        "idx_users_trust_score",
    ifNotExists: true,
    where:       "trust_score < 100",
  });

  // BUG FIX: do NOT create idx_users_last_crime_at — duplicate of idx_users_last_crime
  // from migration 002. Having both wastes storage and slows writes.
  // The existing idx_users_last_crime covers all queries on last_crime_at.
};

exports.down = (pgm) => {
  pgm.dropIndex("users", [], {
    name:    "idx_users_trust_score",
    ifExists: true,
  });

  pgm.alterColumn("user_crime_progress", "hidden_cpl", {
    type:    "real",
    notNull: true,
    default: 0,
  });

  // BUG FIX: DO NOT roll back money to integer.
  // If any user has money > 2,147,483,647, rolling back to integer
  // will fail with "integer out of range" or silently corrupt data.
  // Rolling back this migration is not supported if data exists.
  // To manually rollback: ensure no user has money > 2147483647 first.
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM users WHERE money > 2147483647) THEN
        RAISE EXCEPTION
          'Cannot rollback money column to integer: users exist with money > 2,147,483,647. '
          'Clear high balances first.';
      END IF;
    END $$;
  `);

  pgm.alterColumn("users", "money", {
    type:    "integer",
    notNull: true,
    default: 750,
  });
};

exports.shorthands = undefined;
