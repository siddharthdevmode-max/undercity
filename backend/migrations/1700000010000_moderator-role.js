/* eslint-disable camelcase */

// NOTE: Role system uses TWO mechanisms per role:
//   1. DB column (is_moderator) — persistent, set via admin panel
//   2. MODERATOR_UIDS env var — emergency override, bypasses DB
// requireModerator middleware checks BOTH.
//
// Moderator permissions (subset of admin):
//   - View user profiles + crime history
//   - Soft ban / temp mute players
//   - Respond to support tickets
//   - Cannot: hard ban, change game config, view audit logs, manage admins

exports.up = (pgm) => {
  pgm.addColumns("users", {
    is_moderator: {
      type:        "boolean",
      notNull:     true,
      default:     false,
      ifNotExists: true,
    },
  });

  pgm.createIndex("users", "is_moderator", {
    name:        "idx_users_is_moderator",
    where:       "is_moderator = true",
    ifNotExists: true,
  });
};

exports.down = (pgm) => {
  pgm.dropIndex("users", [], {
    name:    "idx_users_is_moderator",
    ifExists: true,
  });
  pgm.dropColumns("users", ["is_moderator"]);
};

exports.shorthands = undefined;
