/* eslint-disable camelcase */

// Auth access log — records every login/auth event.
// High-volume table: expect millions of rows over time.
// Cleanup: DELETE FROM auth_access_log WHERE accessed_at < NOW() - INTERVAL '90 days'
// Run cleanup as a scheduled job (cleanIdempotencyKeys pattern).

exports.up = (pgm) => {
  pgm.createTable("auth_access_log", {
    id: {
      type:       "bigserial",
      primaryKey: true,
    },
    // Nullable user_id — pre-registration auth events have no user yet
    user_id: {
      type:    "integer",
      notNull: false,
      references: "users",
    },
    firebase_uid: {
      type:    "varchar(128)",
      notNull: true,
    },
    ip_address: {
      type:    "varchar(45)",      // IPv6 max = 45 chars
      notNull: true,
    },
    user_agent: {
      type:    "text",
      notNull: false,
    },
    // BUG FIX: notNull: true — boolean flag must not be NULL
    is_new_ip: {
      type:    "boolean",
      notNull: true,
      default: false,
    },
    action: {
      type:    "varchar(50)",      // login, register, logout, token_refresh
      notNull: true,
      default: "'login'",
    },
    accessed_at: {
      type:    "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
  });

  // Lookup by user
  pgm.createIndex("auth_access_log", "firebase_uid", {
    name: "idx_auth_log_firebase_uid",
  });
  // Lookup by IP (suspicious IP investigation)
  pgm.createIndex("auth_access_log", "ip_address", {
    name: "idx_auth_log_ip",
  });
  // BUG FIX: time-based queries (admin dashboard, cleanup)
  pgm.createIndex("auth_access_log", "accessed_at", {
    name: "idx_auth_log_time",
  });
  // Composite: "has this user logged in from this IP before?" (is_new_ip logic)
  // BUG FIX: NOT unique — this is a log, not a registry
  // Use SELECT COUNT(*) WHERE firebase_uid=$1 AND ip_address=$2 for is_new_ip check
  pgm.createIndex("auth_access_log", ["firebase_uid", "ip_address"], {
    name: "idx_auth_log_uid_ip",
  });
};

exports.down = (pgm) => {
  pgm.dropTable("auth_access_log", { cascade: true });
};

exports.shorthands = undefined;
