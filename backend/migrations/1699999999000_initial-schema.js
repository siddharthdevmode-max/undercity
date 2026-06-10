/* eslint-disable camelcase */

exports.up = (pgm) => {

  // ── Users ──────────────────────────────────────────────
  pgm.createTable("users", {
    id:                 { type: "serial",       primaryKey: true },
    firebase_uid:       { type: "varchar(128)",  notNull: true, unique: true },
    // BUG FIX: email must be unique — Firebase enforces this but DB should too
    email:              { type: "varchar(255)",  notNull: true, unique: true },
    username:           { type: "varchar(20)",   notNull: true, unique: true },
    level:              { type: "integer",       notNull: true, default: 1 },
    // BUG FIX: integer overflows at $2.1B — bigint handles any game economy
    money:              { type: "bigint",        notNull: true, default: 750 },
    points:             { type: "integer",       notNull: true, default: 0 },
    nerve:              { type: "integer",       notNull: true, default: 30 },
    max_nerve:          { type: "integer",       notNull: true, default: 30 },
    // BUG FIX: nerve_regen_at is required for time-based regen in game tick
    // Without this, the tick must regen all users every tick (expensive + inaccurate)
    nerve_regen_at:     { type: "timestamptz",   default: null },
    // BUG FIX: energy columns missing from initial schema
    // Game tick regens energy — needs these from day 1
    // Happiness — decays on inactivity, affects crime success rate
    life:               { type: "integer",       notNull: true, default: 100 },
    max_life:           { type: "integer",       notNull: true, default: 100 },
    jail_until:         { type: "timestamptz",   default: null },
    federal_jail_until: { type: "timestamptz",   default: null },
    last_crime_at:      { type: "timestamptz",   default: null },
    trust_score:        { type: "integer",       notNull: true, default: 100 },
    is_shadow_banned:   { type: "boolean",       notNull: true, default: false },
    is_hard_banned:     { type: "boolean",       notNull: true, default: false },
    total_flags:        { type: "integer",       notNull: true, default: 0 },
    last_flag_reason:   { type: "text",          default: null },
    last_flag_at:       { type: "timestamptz",   default: null },
    deleted_at:         { type: "timestamptz",   default: null },
    created_at:         { type: "timestamptz",   notNull: true, default: pgm.func("NOW()") },
    updated_at:         { type: "timestamptz",   notNull: true, default: pgm.func("NOW()") },
  });

  // ── Crimes ─────────────────────────────────────────────
  pgm.createTable("crimes", {
    id:               { type: "serial",       primaryKey: true },
    crime_key:        { type: "varchar(50)",  notNull: true, unique: true },
    name:             { type: "varchar(100)", notNull: true },
    description:      { type: "text" },
    tier:             { type: "integer",      notNull: true, default: 1 },
    unlock_level:     { type: "integer",      notNull: true, default: 1 },
    nerve_cost:       { type: "integer",      notNull: true, default: 2 },
    // BUG FIX: bigint for future-proofing (tier 5 rewards up to $10M)
    min_reward:       { type: "bigint",       notNull: true, default: 0 },
    max_reward:       { type: "bigint",       notNull: true, default: 100 },
    jail_min_seconds: { type: "integer",      notNull: true, default: 0 },
    jail_max_seconds: { type: "integer",      notNull: true, default: 0 },
    is_federal:       { type: "boolean",      notNull: true, default: false },
    is_active:        { type: "boolean",      notNull: true, default: true },
    created_at:       { type: "timestamptz",  notNull: true, default: pgm.func("NOW()") },
  });

  // ── Crime Specials ──────────────────────────────────────
  pgm.createTable("crime_specials", {
    id:                 { type: "serial",       primaryKey: true },
    crime_id:           { type: "integer",      notNull: true, references: "crimes" },
    title:              { type: "varchar(100)", notNull: true },
    description:        { type: "text",         notNull: true },
    // BUG FIX: bigint for consistency with money/rewards
    reward_money:       { type: "bigint",       notNull: true, default: 0 },
    reward_points:      { type: "integer",      notNull: true, default: 0 },
    unlock_crime_level: { type: "integer",      notNull: true, default: 0 },
    is_active:          { type: "boolean",      notNull: true, default: true },
    created_at:         { type: "timestamptz",  notNull: true, default: pgm.func("NOW()") },
  });

  // ── User Crime Progress ─────────────────────────────────
  pgm.createTable("user_crime_progress", {
    id:                   { type: "serial",      primaryKey: true },
    user_id:              { type: "integer",     notNull: true, references: "users" },
    crime_id:             { type: "integer",     notNull: true, references: "crimes" },
    crime_xp:             { type: "integer",     notNull: true, default: 0 },
    crime_level:          { type: "integer",     notNull: true, default: 0 },
    hidden_cpl:           { type: "real",        notNull: true, default: 0 },
    attempts:             { type: "integer",     notNull: true, default: 0 },
    successes:            { type: "integer",     notNull: true, default: 0 },
    failures:             { type: "integer",     notNull: true, default: 0 },
    crit_failures:        { type: "integer",     notNull: true, default: 0 },
    specials_found_count: { type: "integer",     notNull: true, default: 0 },
    updated_at:           { type: "timestamptz", notNull: true, default: pgm.func("NOW()") },
  });

  // Composite unique — one progress row per user per crime
  pgm.addConstraint(
    "user_crime_progress",
    "user_crime_progress_user_crime_unique",
    "UNIQUE (user_id, crime_id)"
  );

  // ── User Crime Specials ─────────────────────────────────
  pgm.createTable("user_crime_specials", {
    id:               { type: "serial",      primaryKey: true },
    user_id:          { type: "integer",     notNull: true, references: "users" },
    crime_special_id: { type: "integer",     notNull: true, references: "crime_specials" },
    discovered_at:    { type: "timestamptz", notNull: true, default: pgm.func("NOW()") },
  });

  pgm.addConstraint(
    "user_crime_specials",
    "user_crime_specials_unique",
    "UNIQUE (user_id, crime_special_id)"
  );

  // ── UAC Violations ─────────────────────────────────────
  // user_id is nullable — violations can be logged pre-registration
  pgm.createTable("uac_violations", {
    id:             { type: "serial",       primaryKey: true },
    user_id:        { type: "integer",      references: "users" },  // nullable: intentional
    firebase_uid:   { type: "varchar(128)", notNull: true },
    violation_type: { type: "varchar(50)",  notNull: true },
    severity:       { type: "integer",      notNull: true, default: 0 },
    details:        { type: "jsonb",        notNull: true, default: pgm.func("'{}'::jsonb") },
    ip_address:     { type: "varchar(45)",  default: null },
    user_agent:     { type: "text",         default: null },
    created_at:     { type: "timestamptz",  notNull: true, default: pgm.func("NOW()") },
  });

  // ── Device Fingerprints ─────────────────────────────────
  pgm.createTable("device_fingerprints", {
    id:               { type: "serial",       primaryKey: true },
    firebase_uid:     { type: "varchar(128)", notNull: true },
    fingerprint_hash: { type: "varchar(64)",  notNull: true },
    ip_address:       { type: "varchar(45)",  default: null },
    user_agent:       { type: "text",         default: null },
    hit_count:        { type: "integer",      notNull: true, default: 1 },
    last_seen:        { type: "timestamptz",  notNull: true, default: pgm.func("NOW()") },
    created_at:       { type: "timestamptz",  notNull: true, default: pgm.func("NOW()") },
  });

  pgm.addConstraint(
    "device_fingerprints",
    "device_fingerprints_uid_hash_unique",
    "UNIQUE (firebase_uid, fingerprint_hash)"
  );
};

exports.down = (pgm) => {
  // BUG FIX: cascade on all drops — FK violations won't block rollback
  pgm.dropTable("device_fingerprints",    { cascade: true });
  pgm.dropTable("uac_violations",         { cascade: true });
  pgm.dropTable("user_crime_specials",    { cascade: true });
  pgm.dropTable("user_crime_progress",    { cascade: true });
  pgm.dropTable("crime_specials",         { cascade: true });
  pgm.dropTable("crimes",                 { cascade: true });
  pgm.dropTable("users",                  { cascade: true });
};
