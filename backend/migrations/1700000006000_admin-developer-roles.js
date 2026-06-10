/* eslint-disable camelcase */

// NOTE: Role system uses TWO mechanisms:
//   1. DB columns (is_admin, is_developer) — persistent, survives restarts
//   2. ADMIN_UIDS / DEV_UIDS env vars — override for emergency access
// requireAdmin middleware checks BOTH. They must be kept in sync.
// Adding a new admin: set is_admin=true in DB AND add UID to ADMIN_UIDS env var.

exports.up = (pgm) => {
  pgm.addColumns("users", {
    is_admin: {
      type:        "boolean",
      notNull:     true,
      default:     false,
      ifNotExists: true,
    },
    is_developer: {
      type:        "boolean",
      notNull:     true,
      default:     false,
      ifNotExists: true,
    },
  });

  // Partial indexes — only the few admins/devs are indexed
  // Used by: requireAdmin middleware, admin panel listing
  pgm.createIndex("users", "is_admin", {
    name:        "idx_users_is_admin",
    where:       "is_admin = true",
    ifNotExists: true,
  });
  pgm.createIndex("users", "is_developer", {
    name:        "idx_users_is_developer",
    where:       "is_developer = true",
    ifNotExists: true,
  });
};

exports.down = (pgm) => {
  pgm.dropIndex("users", "is_admin", {
    name:    "idx_users_is_admin",
    ifExists: true,
  });
  pgm.dropIndex("users", "is_developer", {
    name:    "idx_users_is_developer",
    ifExists: true,
  });
  pgm.dropColumns("users", ["is_admin", "is_developer"]);
};

exports.shorthands = undefined;
