/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.addColumn("users", {
    last_seen_at: {
      type: "timestamptz",
      default: pgm.func("NOW()"),
    },
  });

  pgm.addIndex("users", ["last_seen_at"], {
    name: "idx_users_last_seen_at",
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.dropIndex("users", ["last_seen_at"], {
    name: "idx_users_last_seen_at",
  });
  pgm.dropColumn("users", "last_seen_at");
};
