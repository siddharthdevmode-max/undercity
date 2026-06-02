exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createIndex("users", "firebase_uid", { name: "idx_users_firebase_uid", ifNotExists: true });
  pgm.createIndex("users", "username", { name: "idx_users_username", ifNotExists: true, where: "username IS NOT NULL" });
  pgm.createIndex("users", "last_crime_at", { name: "idx_users_last_crime", ifNotExists: true, where: "last_crime_at IS NOT NULL" });
  pgm.createIndex("user_crime_progress", ["user_id", "crime_id"], { name: "idx_progress_user_crime", ifNotExists: true, unique: true });
  pgm.createIndex("user_crime_progress", "crime_xp", { name: "idx_progress_xp", ifNotExists: true });
  pgm.createIndex("user_crime_specials", ["user_id", "crime_special_id"], { name: "idx_user_specials", ifNotExists: true, unique: true });
  pgm.createIndex("uac_violations", "created_at", { name: "idx_violations_time", ifNotExists: true });
  pgm.createIndex("uac_violations", "violation_type", { name: "idx_violations_type", ifNotExists: true });
  pgm.createIndex("uac_violations", "ip_address", { name: "idx_violations_ip", ifNotExists: true, where: "ip_address IS NOT NULL" });
  pgm.createIndex("crimes", ["is_active", "tier"], { name: "idx_crimes_active_tier", ifNotExists: true });
};

exports.down = (pgm) => {
  pgm.dropIndex("users", [], { name: "idx_users_firebase_uid", ifExists: true });
  pgm.dropIndex("users", [], { name: "idx_users_username", ifExists: true });
  pgm.dropIndex("users", [], { name: "idx_users_last_crime", ifExists: true });
  pgm.dropIndex("user_crime_progress", [], { name: "idx_progress_user_crime", ifExists: true });
  pgm.dropIndex("user_crime_progress", [], { name: "idx_progress_xp", ifExists: true });
  pgm.dropIndex("user_crime_specials", [], { name: "idx_user_specials", ifExists: true });
  pgm.dropIndex("uac_violations", [], { name: "idx_violations_time", ifExists: true });
  pgm.dropIndex("uac_violations", [], { name: "idx_violations_type", ifExists: true });
  pgm.dropIndex("uac_violations", [], { name: "idx_violations_ip", ifExists: true });
  pgm.dropIndex("crimes", [], { name: "idx_crimes_active_tier", ifExists: true });
};
