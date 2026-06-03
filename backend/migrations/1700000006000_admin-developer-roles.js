/* eslint-disable camelcase */

exports.up = (pgm) => {
  pgm.addColumns("users", {
    is_admin:     { type: "boolean", notNull: true, default: false },
    is_developer: { type: "boolean", notNull: true, default: false },
  });

  // Indexes for fast role checks (admin panel, UAC bypass, etc)
  pgm.createIndex("users", "is_admin",     { where: "is_admin = true" });
  pgm.createIndex("users", "is_developer", { where: "is_developer = true" });
};

exports.down = (pgm) => {
  pgm.dropIndex("users", "is_developer");
  pgm.dropIndex("users", "is_admin");
  pgm.dropColumns("users", ["is_admin", "is_developer"]);
};
