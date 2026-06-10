/* eslint-disable camelcase */

// last_seen_at: NULL means user has never logged in after this migration ran.
// Application must handle NULL (treat as "never seen").
// Set to NOW() on every successful authentication in authRoutes.

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns("users", {
    last_seen_at: {
      type:        "timestamptz",
      // BUG FIX: NULL default — existing users shouldn't all show
      // "last seen at migration time". App sets this on login.
      default:     null,
      notNull:     false,
      ifNotExists: true,
    },
  });

  pgm.createIndex("users", "last_seen_at", {
    name:        "idx_users_last_seen_at",
    ifNotExists: true,
    // Partial: only users who have been seen (non-NULL)
    where:       "last_seen_at IS NOT NULL",
  });
};

exports.down = (pgm) => {
  pgm.dropIndex("users", [], {
    name:    "idx_users_last_seen_at",
    ifExists: true,
  });
  pgm.dropColumns("users", ["last_seen_at"]);
};
