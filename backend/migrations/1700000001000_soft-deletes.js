/* eslint-disable camelcase */

exports.up = (pgm) => {
  // deleted_at already exists in initial schema
  // Only add deletion_reason which is new
  pgm.addColumns("users", {
    deletion_reason: { type: "text", ifNotExists: true },
  });

  pgm.createIndex("users", ["id"], {
    name: "idx_users_active",
    where: "deleted_at IS NULL",
    ifNotExists: true,
  });
};

exports.down = (pgm) => {
  pgm.dropIndex("users", ["id"], { name: "idx_users_active" });
  pgm.dropColumns("users", ["deletion_reason"]);
};
