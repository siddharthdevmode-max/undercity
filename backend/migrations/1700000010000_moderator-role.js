/* eslint-disable camelcase */

exports.up = (pgm) => {
  pgm.addColumns("users", {
    is_moderator: {
      type:    "boolean",
      notNull: true,
      default: false,
      ifNotExists: true,
    },
  });

  pgm.createIndex("users", "is_moderator", {
    name:  "idx_users_is_moderator",
    where: "is_moderator = true",
  });
};

exports.down = (pgm) => {
  pgm.dropIndex("users", "is_moderator", {
    name:    "idx_users_is_moderator",
    ifExists: true,
  });
  pgm.dropColumns("users", ["is_moderator"]);
};
