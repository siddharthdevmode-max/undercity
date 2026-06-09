/* eslint-disable camelcase */

// ============================================================
// PHASE 1 CRITICAL FIXES
//
// 1. Add ban columns to users (ban_type, ban_reason, etc)
//    banCheck.ts references these — they were never migrated
//
// 2. Fix idempotency_keys table:
//    - Add firebase_uid column (code queries by uid not user_id)
//    - Add response_status column (was missing, INSERT fails without it)
//    - Make user_id NULLABLE (middleware inserts without user_id)
//    - Add index on (firebase_uid, idempotency_key) for fast lookups
//    - Drop old (user_id, idempotency_key) unique constraint
//
// 3. Fix auth_access_log unique constraint:
//    - (firebase_uid, ip_address) UNIQUE is wrong — same user
//      can log in from same IP many times. Drop the unique constraint.
//
// 4. Fix slow_queries timestamp → timestamptz (global consistency)
//
// 5. Add firebase_uid index to trust_recovery_log (daily regen query)
//
// 6. Rename stripe_session_id → payment_session_id (provider-agnostic)
// ============================================================

exports.up = async (pgm) => {

  // ── 1. Ban columns on users ────────────────────────────
  // banCheck.ts reads: ban_type, ban_reason, ban_expires_at
  // These were never added to the schema — critical bug.
  // NOTE: is_soft_banned NOT added — banCheck uses is_shadow_banned instead.

  pgm.addColumns("users", {
    ban_type: {
      type:    "varchar(20)",
      default: null,
      comment: "soft | hard | shadow | null",
    },
    ban_reason: {
      type:    "text",
      default: null,
    },
    ban_expires_at: {
      type:    "timestamptz",
      default: null,
    },
  });

  pgm.createIndex("users", "ban_expires_at", {
    name:  "idx_users_ban_expires_at",
    where: "ban_expires_at IS NOT NULL",
  });

  // ── 2. Fix idempotency_keys ────────────────────────────
  // The middleware queries by firebase_uid but the table only
  // has user_id. Add firebase_uid column.
  // Also add response_status which the INSERT uses but was missing.
  // CRITICAL: make user_id nullable — middleware inserts WITHOUT user_id.

  pgm.alterColumn("idempotency_keys", "user_id", {
    type:    "integer",
    notNull: false,   // FIX: was NOT NULL — every middleware INSERT fails
  });

  pgm.addColumns("idempotency_keys", {
    firebase_uid: {
      type:    "varchar(128)",
      notNull: false,
    },
    response_status: {
      type:    "integer",
      notNull: false,
      default: 200,
    },
  });

  // Drop the old unique constraint on (user_id, idempotency_key)
  // — user_id is now nullable and middleware doesn't provide it
  pgm.dropConstraint(
    "idempotency_keys",
    "idempotency_keys_user_key_unique",
    { ifExists: true }
  );

  // Add unique constraint on (firebase_uid, idempotency_key)
  pgm.addConstraint(
    "idempotency_keys",
    "idempotency_keys_uid_key_unique",
    "UNIQUE (firebase_uid, idempotency_key)"
  );

  pgm.createIndex("idempotency_keys", ["firebase_uid", "idempotency_key"], {
    name: "idx_idempotency_uid_key",
  });

  // ── 3. Fix auth_access_log unique constraint ───────────
  // The unique constraint on (firebase_uid, ip_address) is wrong:
  // A user logs in from the same IP every time → second login fails.
  // Fix: drop unique, replace with non-unique index.

  pgm.dropIndex("auth_access_log", [], {
    name:     "auth_access_log_uid_ip_unique",
    ifExists: true,
  });

  pgm.createIndex("auth_access_log", ["firebase_uid", "ip_address"], {
    name:        "idx_auth_access_log_uid_ip",
    ifNotExists: true,
  });

  // ── 4. Fix slow_queries timestamp → timestamptz ────────
  pgm.alterColumn("slow_queries", "created_at", {
    type:    "timestamptz",
    notNull: true,
    default: pgm.func("CURRENT_TIMESTAMP"),
  });

  // ── 5. firebase_uid index on trust_recovery_log ────────
  pgm.createIndex("trust_recovery_log", "firebase_uid", {
    name:        "idx_trust_recovery_firebase_uid",
    ifNotExists: true,
  });

  // ── 6. Rename stripe_session_id → payment_session_id ──
  pgm.renameColumn("payment_logs", "stripe_session_id", "payment_session_id");
};

exports.down = async (pgm) => {
  pgm.renameColumn("payment_logs", "payment_session_id", "stripe_session_id");

  pgm.dropIndex("trust_recovery_log", [], {
    name: "idx_trust_recovery_firebase_uid", ifExists: true,
  });

  pgm.alterColumn("slow_queries", "created_at", {
    type: "timestamp", notNull: true, default: pgm.func("CURRENT_TIMESTAMP"),
  });

  pgm.dropIndex("auth_access_log", [], {
    name: "idx_auth_access_log_uid_ip", ifExists: true,
  });

  pgm.addConstraint(
    "auth_access_log",
    "auth_access_log_uid_ip_unique",
    "UNIQUE (firebase_uid, ip_address)"
  );

  pgm.dropIndex("idempotency_keys", [], {
    name: "idx_idempotency_uid_key", ifExists: true,
  });

  pgm.dropConstraint("idempotency_keys", "idempotency_keys_uid_key_unique", {
    ifExists: true,
  });

  pgm.dropColumns("idempotency_keys", ["firebase_uid", "response_status"]);

  pgm.alterColumn("idempotency_keys", "user_id", {
    type:    "integer",
    notNull: true,
  });

  pgm.dropIndex("users", [], {
    name: "idx_users_ban_expires_at", ifExists: true,
  });

  pgm.dropColumns("users", [
    "ban_type", "ban_reason", "ban_expires_at",
  ]);
};
