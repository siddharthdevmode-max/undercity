/* eslint-disable camelcase */

exports.up = (pgm) => {
  // ── Users ──────────────────────────────────────────────
  pgm.createIndex("users", "firebase_uid", {
    name: "idx_users_firebase_uid",
    ifNotExists: true,
  });
  pgm.createIndex("users", "username", {
    name: "idx_users_username",
    ifNotExists: true,
    where: "username IS NOT NULL",
  });
  pgm.createIndex("users", "last_crime_at", {
    name: "idx_users_last_crime",
    ifNotExists: true,
    where: "last_crime_at IS NOT NULL",
  });
  // BUG FIX: game tick queries jailed users every 60s — needs index
  pgm.createIndex("users", "jail_until", {
    name: "idx_users_jail_until",
    ifNotExists: true,
    where: "jail_until IS NOT NULL",
  });
  // Hospital release queries
  pgm.createIndex("users", "hospital_until", {
    name: "idx_users_hospital_until",
    ifNotExists: true,
    where: "hospital_until IS NOT NULL",
  });
  // Soft delete queries
  pgm.createIndex("users", "deleted_at", {
    name: "idx_users_deleted_at",
    ifNotExists: true,
    where: "deleted_at IS NULL",
  });

  // ── User Crime Progress ────────────────────────────────
  // BUG FIX: unique constraint now in migration 001 as a table constraint
  // The constraint auto-creates a unique index — do NOT duplicate it here
  // Only create the xp index (non-unique, for leaderboard queries)
  pgm.createIndex("user_crime_progress", "crime_xp", {
    name: "idx_progress_xp",
    ifNotExists: true,
  });

  // ── User Crime Specials ────────────────────────────────
  // Unique constraint created in migration 001 — skip duplicate here
  // Add user_id-only index for "show all specials for user" queries
  pgm.createIndex("user_crime_specials", "user_id", {
    name: "idx_user_specials_user",
    ifNotExists: true,
  });

  // ── UAC Violations ────────────────────────────────────
  pgm.createIndex("uac_violations", "created_at", {
    name: "idx_violations_time",
    ifNotExists: true,
  });
  pgm.createIndex("uac_violations", "violation_type", {
    name: "idx_violations_type",
    ifNotExists: true,
  });
  pgm.createIndex("uac_violations", "ip_address", {
    name: "idx_violations_ip",
    ifNotExists: true,
    where: "ip_address IS NOT NULL",
  });
  // BUG FIX: trust engine + admin panel look up violations by firebase_uid
  pgm.createIndex("uac_violations", "firebase_uid", {
    name: "idx_violations_firebase_uid",
    ifNotExists: true,
  });
  // BUG FIX: admin panel looks up violations by user_id
  pgm.createIndex("uac_violations", "user_id", {
    name: "idx_violations_user_id",
    ifNotExists: true,
    where: "user_id IS NOT NULL",
  });

  // ── Device Fingerprints ────────────────────────────────
  // BUG FIX: fingerprint engine looks up by firebase_uid — needs index
  pgm.createIndex("device_fingerprints", "firebase_uid", {
    name: "idx_fingerprints_firebase_uid",
    ifNotExists: true,
  });
  pgm.createIndex("device_fingerprints", "fingerprint_hash", {
    name: "idx_fingerprints_hash",
    ifNotExists: true,
  });

  // ── Crimes ────────────────────────────────────────────
  pgm.createIndex("crimes", ["is_active", "tier"], {
    name: "idx_crimes_active_tier",
    ifNotExists: true,
  });
};

exports.down = (pgm) => {
  // BUG FIX: consistent drop syntax with ifExists
  const drops = [
    ["users",                "idx_users_firebase_uid"],
    ["users",                "idx_users_username"],
    ["users",                "idx_users_last_crime"],
    ["users",                "idx_users_jail_until"],
    ["users",                "idx_users_hospital_until"],
    ["users",                "idx_users_deleted_at"],
    ["user_crime_progress",  "idx_progress_xp"],
    ["user_crime_specials",  "idx_user_specials_user"],
    ["uac_violations",       "idx_violations_time"],
    ["uac_violations",       "idx_violations_type"],
    ["uac_violations",       "idx_violations_ip"],
    ["uac_violations",       "idx_violations_firebase_uid"],
    ["uac_violations",       "idx_violations_user_id"],
    ["device_fingerprints",  "idx_fingerprints_firebase_uid"],
    ["device_fingerprints",  "idx_fingerprints_hash"],
    ["crimes",               "idx_crimes_active_tier"],
  ];

  for (const [table, name] of drops) {
    pgm.dropIndex(table, [], { name, ifExists: true });
  }
};
