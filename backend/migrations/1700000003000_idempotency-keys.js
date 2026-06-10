/* eslint-disable camelcase */

exports.up = (pgm) => {
  pgm.createTable("idempotency_keys", {
    id:              { type: "serial",        primaryKey: true },
    // BUG FIX: nullable user_id — pre-registration requests have no user yet
    // For auth routes (register): user_id is NULL, firebase_uid tracks the requester
    user_id:         { type: "integer",       notNull: false, references: "users" },
    // Track pre-auth requests by firebase_uid or session token hash
    firebase_uid:    { type: "varchar(128)",  notNull: false },
    // BUG FIX: varchar(128) — allows prefixed keys ("crime:uuid", hash+prefix)
    idempotency_key: { type: "varchar(128)",  notNull: true },
    endpoint:        { type: "varchar(100)",  notNull: true },
    // BUG FIX: nullable response_body — not all idempotency uses need cached response
    response_status: { type: "integer",       notNull: false },
    response_body:   { type: "jsonb",         notNull: false, default: null },
    created_at:      { type: "timestamptz",   notNull: true, default: pgm.func("NOW()") },
    expires_at:      { type: "timestamptz",   notNull: true },
  });

  // Unique: one key per user per idempotency_key string
  // Allows NULL user_id — NULL != NULL in SQL so pre-auth keys don't conflict
  pgm.addConstraint(
    "idempotency_keys",
    "idempotency_keys_user_key_unique",
    "UNIQUE (user_id, idempotency_key)"
  );

  // Pre-auth idempotency: unique per firebase_uid + key (when user_id is null)
  pgm.addConstraint(
    "idempotency_keys",
    "idempotency_keys_firebase_key_unique",
    "UNIQUE (firebase_uid, idempotency_key)"
  );

  // BUG FIX: removed duplicate index — UNIQUE constraint already creates the index
  // Only add the expires_at index for cleanup queries
  pgm.createIndex("idempotency_keys", "expires_at", {
    name: "idx_idempotency_expires_at",
  });
};

exports.down = (pgm) => {
  pgm.dropTable("idempotency_keys", { cascade: true });
};

exports.shorthands = undefined;
