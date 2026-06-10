/* eslint-disable camelcase */

exports.up = (pgm) => {
  pgm.createTable("trust_recovery_log", {
    id:           { type: "serial",       primaryKey: true },
    user_id:      { type: "integer",      notNull: true, references: "users" },
    firebase_uid: { type: "varchar(128)", notNull: true },
    old_score:    { type: "integer",      notNull: true },
    new_score:    { type: "integer",      notNull: true },
    // BUG FIX: varchar(100) — reason strings can exceed 50 chars
    reason:       { type: "varchar(100)", notNull: true },
    created_at:   { type: "timestamptz",  notNull: true, default: pgm.func("NOW()") },
  });

  pgm.createIndex("trust_recovery_log", "user_id",      { name: "idx_trust_recovery_user_id" });
  pgm.createIndex("trust_recovery_log", "created_at",   { name: "idx_trust_recovery_time" });
  // BUG FIX: index on firebase_uid for post-deletion lookups
  pgm.createIndex("trust_recovery_log", "firebase_uid", { name: "idx_trust_recovery_firebase_uid" });

  // Track last regen time and streak on users table
  // NOTE: Ideally these would be in migration 001 but are added here
  // for backwards compatibility with any deployed instances.
  // New deployments: migration 001 now includes nerve_regen_at and energy_regen_at.
  // These columns (last_trust_regen_at, trust_regen_streak) are trust-specific.
  pgm.addColumns("users", {
    last_trust_regen_at: { type: "timestamptz", default: null,    ifNotExists: true },
    trust_regen_streak:  { type: "integer", notNull: true, default: 0, ifNotExists: true },
  });
};

exports.down = (pgm) => {
  pgm.dropTable("trust_recovery_log", { cascade: true });
  pgm.dropColumns("users", ["last_trust_regen_at", "trust_regen_streak"]);
};

exports.shorthands = undefined;
