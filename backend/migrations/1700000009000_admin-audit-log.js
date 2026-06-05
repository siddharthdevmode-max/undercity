/* eslint-disable camelcase */

// ============================================================
// ADMIN AUDIT LOG
// Records every admin action with who/what/when
// Immutable — admins cannot delete their own audit trail
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
    admin_username: {
      type:    "varchar(50)",
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
    target_username: {
      type:    "varchar(50)",
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
      default: pgm.func("CURRENT_TIMESTAMP"),
    },
  });

  pgm.createIndex("admin_audit_log", ["admin_firebase_uid"]);
  pgm.createIndex("admin_audit_log", ["target_firebase_uid"]);
  pgm.createIndex("admin_audit_log", ["action_type"]);
  pgm.createIndex("admin_audit_log", ["created_at"]);

  // Support tickets table
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
      type:    "varchar(50)",
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
      default: "'general'",
    },
    status: {
      type:    "varchar(20)",
      notNull: true,
      default: "'open'",
    },
    admin_response: {
      type:    "text",
      notNull: false,
    },
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
      default: pgm.func("CURRENT_TIMESTAMP"),
    },
    updated_at: {
      type:    "timestamptz",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP"),
    },
  });

  pgm.createIndex("support_tickets", ["firebase_uid"]);
  pgm.createIndex("support_tickets", ["status"]);
  pgm.createIndex("support_tickets", ["created_at"]);
};

exports.down = (pgm) => {
  pgm.dropTable("support_tickets");
  pgm.dropTable("admin_audit_log");
};
