exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns("users", {
    deleted_at: { type: "timestamp", notNull: false, default: null },
    deletion_reason: { type: "text", notNull: false },
  });
  pgm.createIndex("users", "id", { name: "idx_users_active", ifNotExists: true, where: "deleted_at IS NULL" });
};

exports.down = (pgm) => {
  pgm.dropIndex("users", [], { name: "idx_users_active", ifExists: true });
  pgm.dropColumns("users", ["deleted_at", "deletion_reason"]);
};
