/* eslint-disable camelcase */

// ============================================================
// ADMIN AUDIT LOG + SUPPORT TICKETS
//
// admin_audit_log:
//   Immutable — admins CANNOT delete their own audit trail.
//   No FK to users — audit trail must persist even if admin account deleted.
//   Application layer must prevent admin self-deletion of logs.
//
// support_tickets:
//   No FK to users — tickets persist after GDPR deletion (legal requirement).
//   GDPR deletion must manually anonymize firebase_uid in this table.
//   updated_at: must be set explicitly in every UPDATE query (no trigger).
// ============================================================

exports.up = (pgm) => {
  pgm.createTable("admin_audit_log", {
    id: {
      type:       "bigserial",
      primaryKey: true,
    },
    admin_firebase_uid: {
      type:    "varchar(128)",
      notNull: true,
    },
    // BUG FIX: varchar(20) to match users.username (not varchar(50))
    admin_username: {
      type:    "varchar(20)",
      notNull: false,
    },
    action_type: {
      type:    "varchar(50)",
      notNull: true,
    },
    target_firebase_uid: {
      type:    "varchar(128)",
      notNull: false,
    },
    // BUG FIX: varchar(20) to match users.username
    target_username: {
      type:    "varchar(20)",
      notNull: false,
    },
    details: {
      type:    "jsonb",
      notNull: true,
      default: pgm.func("'{}'::jsonb"),
    },
    ip_address: {
      type:    "varchar(45)",
      notNull: false,
    },
    created_at: {
      type:    "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
  });

  pgm.createIndex("admin_audit_log", "admin_firebase_uid",  { name: "idx_audit_admin_uid" });
  pgm.createIndex("admin_audit_log", "target_firebase_uid", { name: "idx_audit_target_uid" });
  pgm.createIndex("admin_audit_log", "action_type",         { name: "idx_audit_action" });
  pgm.createIndex("admin_audit_log", "created_at",          { name: "idx_audit_time" });

  // ── Support Tickets ────────────────────────────────────
  // No FK to users: tickets survive GDPR deletion.
  // GDPR handler must anonymize firebase_uid here on account deletion.
  pgm.createTable("support_tickets", {
    id: {
      type:       "bigserial",
      primaryKey: true,
    },
    firebase_uid: {
      type:    "varchar(128)",
      notNull: true,
    },
    username: {
      type:    "varchar(20)",          // BUG FIX: match users.username
      notNull: false,
    },
    subject: {
      type:    "varchar(200)",
      notNull: true,
    },
    message: {
      type:    "text",
      notNull: true,
    },
    category: {
      type:    "varchar(50)",
      notNull: true,
      default: pgm.func("'general'"),
    },
    status: {
      type:    "varchar(20)",
      notNull: true,
      default: pgm.func("'open'"),
    },
    admin_response: {
      type:    "text",
      notNull: false,
    },
    // Stores firebase_uid of responding admin (not a FK — admin may be deleted)
    responded_by: {
      type:    "varchar(128)",
      notNull: false,
    },
    responded_at: {
      type:    "timestamptz",
      notNull: false,
    },
    created_at: {
      type:    "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
    // NOTE: updated_at is NOT auto-updated by Postgres.
    // Every UPDATE to this table MUST include: updated_at = NOW()
    updated_at: {
      type:    "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
  });

  pgm.createIndex("support_tickets", "firebase_uid", { name: "idx_support_firebase_uid" });
  pgm.createIndex("support_tickets", "status",       { name: "idx_support_status" });
  pgm.createIndex("support_tickets", "created_at",   { name: "idx_support_time" });
};

exports.down = (pgm) => {
  pgm.dropTable("support_tickets",  { cascade: true });
  pgm.dropTable("admin_audit_log",  { cascade: true });
};

exports.shorthands = undefined;
