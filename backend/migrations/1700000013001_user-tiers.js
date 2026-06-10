/* eslint-disable camelcase */

// NOTE: Using varchar + CHECK CONSTRAINT instead of PostgreSQL enum.
// Rationale: enums cannot be modified in a transaction (no rollback).
// If a new tier is added, ALTER TABLE ADD CONSTRAINT is simpler than
// ALTER TYPE ADD VALUE (which cannot be done in BEGIN/COMMIT blocks).

exports.shorthands = undefined;

exports.up = (pgm) => {
  // BUG FIX: varchar + CHECK instead of enum
  // Safer for future tier additions without complex migrations
  pgm.addColumns("users", {
    user_tier: {
      type:    "varchar(20)",
      notNull: true,
      default: pgm.func("'player'"),
    },
    tier_expires_at: {
      type:    "timestamptz",
      default: null,
    },
    tier_granted_at: {
      type:    "timestamptz",
      default: null,
    },
    // BUG FIX: CHECK constraint on tier_granted_by for valid sources
    tier_granted_by: {
      type:    "varchar(50)",
      default: null,
    },
  });

  // CHECK constraint: valid tier values
  pgm.addConstraint(
    "users",
    "users_user_tier_check",
    "CHECK (user_tier IN ('player', 'citizen', 'contributor'))"
  );

  // CHECK constraint: valid granted_by sources
  pgm.addConstraint(
    "users",
    "users_tier_granted_by_check",
    "CHECK (tier_granted_by IS NULL OR tier_granted_by IN " +
    "('lemonsqueezy', 'admin', 'system', 'citizen_pack'))"
  );

  // BUG FIX: partial indexes on paid tiers only (not the majority 'player' tier)
  pgm.createIndex("users", "user_tier", {
    name:  "idx_users_citizen_tier",
    where: "user_tier = 'citizen'",
  });
  pgm.createIndex("users", "user_tier", {
    name:  "idx_users_contributor_tier",
    where: "user_tier = 'contributor'",
  });
  // Index for expiry checking (game tick)
  pgm.createIndex("users", "tier_expires_at", {
    name:  "idx_users_tier_expires_at",
    where: "tier_expires_at IS NOT NULL",
  });
};

exports.down = (pgm) => {
  pgm.dropConstraint("users", "users_tier_granted_by_check", { ifExists: true });
  pgm.dropConstraint("users", "users_user_tier_check",       { ifExists: true });
  pgm.dropIndex("users", [], { name: "idx_users_tier_expires_at",  ifExists: true });
  pgm.dropIndex("users", [], { name: "idx_users_contributor_tier", ifExists: true });
  pgm.dropIndex("users", [], { name: "idx_users_citizen_tier",     ifExists: true });
  pgm.dropColumns("users", [
    "tier_granted_by",
    "tier_granted_at",
    "tier_expires_at",
    "user_tier",
  ]);
};
