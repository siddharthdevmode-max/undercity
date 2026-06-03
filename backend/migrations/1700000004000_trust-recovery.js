/* eslint-disable camelcase */

exports.up = (pgm) => {
  pgm.createTable("trust_recovery_log", {
    id:           { type: "serial",       primaryKey: true },
    user_id:      { type: "integer",      notNull: true, references: "users" },
    firebase_uid: { type: "varchar(128)", notNull: true },
    old_score:    { type: "integer",      notNull: true },
    new_score:    { type: "integer",      notNull: true },
    reason:       { type: "varchar(50)",  notNull: true },
    created_at:   { type: "timestamptz",  notNull: true, default: pgm.func("NOW()") },
  });

  pgm.createIndex("trust_recovery_log", "user_id");
  pgm.createIndex("trust_recovery_log", "created_at");

  // Track last regen time on users table
  pgm.addColumns("users", {
    last_trust_regen_at: { type: "timestamptz", default: null },
    trust_regen_streak:  { type: "integer", notNull: true, default: 0 },
  });
};

exports.down = (pgm) => {
  pgm.dropTable("trust_recovery_log");
  pgm.dropColumns("users", ["last_trust_regen_at", "trust_regen_streak"]);
};
