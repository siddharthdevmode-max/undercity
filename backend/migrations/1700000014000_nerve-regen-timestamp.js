/* eslint-disable camelcase */

// last_nerve_update: timestamp of last +1 nerve regen for this user.
// NULL = never regenerated → qualifies for regen immediately on next tick.
// Updated by nerveService.regenNerve() every time nerve is incremented.

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns("users", {
    last_nerve_update: {
      type:        "timestamptz",
      default:     null,
      notNull:     false,
      ifNotExists: true,
    },
  });

  // Composite partial index — only users who need regen
  // Covers the game tick query:
  //   SELECT id, user_tier, last_nerve_update FROM users
  //   WHERE nerve < max_nerve AND deleted_at IS NULL
  //   AND (last_nerve_update IS NULL OR last_nerve_update <= $1)
  pgm.createIndex("users", ["user_tier", "last_nerve_update"], {
    name:        "idx_users_nerve_regen",
    where:       "nerve < max_nerve AND deleted_at IS NULL",
    ifNotExists: true,
  });
};

exports.down = (pgm) => {
  pgm.dropIndex("users", [], {
    name:    "idx_users_nerve_regen",
    ifExists: true,
  });
  pgm.dropColumns("users", ["last_nerve_update"]);
};
