/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.createTable("auth_access_log", {
    id: {
      type:           "bigserial",
      primaryKey:     true,
    },
    firebase_uid: {
      type:      "text",
      notNull:   true,
    },
    ip_address: {
      type:      "text",
      notNull:   true,
    },
    user_agent: {
      type:      "text",
      notNull:   false,
    },
    is_new_ip: {
      type:      "boolean",
      default:   false,
    },
    accessed_at: {
      type:      "timestamptz",
      notNull:   true,
      default:   pgm.func("CURRENT_TIMESTAMP"),
    },
  });

  pgm.createIndex("auth_access_log", ["firebase_uid"]);
  pgm.createIndex("auth_access_log", ["ip_address"]);
  pgm.createIndex("auth_access_log", ["firebase_uid", "ip_address"], {
    unique: true,
    name:   "auth_access_log_uid_ip_unique",
  });
};

exports.down = (pgm) => {
  pgm.dropTable("auth_access_log");
};
