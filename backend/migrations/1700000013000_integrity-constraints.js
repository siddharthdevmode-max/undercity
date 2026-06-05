/* eslint-disable camelcase */

// ============================================================
// DATA INTEGRITY CONSTRAINTS
// Prevents impossible game states at DB level
// ============================================================

exports.up = (pgm) => {

  // ── Money cannot go negative ──
  pgm.addConstraint("users", "chk_money_non_negative",
    "CHECK (money >= 0)"
  );

  // ── Points cannot go negative ──
  pgm.addConstraint("users", "chk_points_non_negative",
    "CHECK (points >= 0)"
  );

  // ── Level must be 1 or higher ──
  pgm.addConstraint("users", "chk_level_positive",
    "CHECK (level >= 1)"
  );

  // ── Nerve cannot exceed max_nerve and must be >= 0 ──
  pgm.addConstraint("users", "chk_nerve_range",
    "CHECK (nerve >= 0 AND nerve <= max_nerve)"
  );

  // ── Life cannot exceed max_life and must be >= 0 ──
  pgm.addConstraint("users", "chk_life_range",
    "CHECK (life >= 0 AND life <= max_life)"
  );

  // ── Trust score must be 0-100 ──
  pgm.addConstraint("users", "chk_trust_score_range",
    "CHECK (trust_score >= 0 AND trust_score <= 100)"
  );

  // ── total_flags cannot go negative ──
  pgm.addConstraint("users", "chk_total_flags_non_negative",
    "CHECK (total_flags >= 0)"
  );

  // ── Crime rewards must be non-negative ──
  pgm.addConstraint("crimes", "chk_crime_rewards_non_negative",
    "CHECK (min_reward >= 0 AND max_reward >= 0 AND max_reward >= min_reward)"
  );

  // ── Nerve cost must be positive ──
  pgm.addConstraint("crimes", "chk_nerve_cost_positive",
    "CHECK (nerve_cost > 0)"
  );

  // ── Crime progress stats must be non-negative ──
  pgm.addConstraint("user_crime_progress", "chk_crime_progress_non_negative",
    "CHECK (attempts >= 0 AND successes >= 0 AND failures >= 0 AND crit_failures >= 0)"
  );

  // ── Successes + failures cannot exceed attempts ──
  pgm.addConstraint("user_crime_progress", "chk_crime_totals_consistent",
    "CHECK (successes + failures + crit_failures <= attempts)"
  );

  // ── Payment logs must have positive amounts ──
  pgm.addConstraint("payment_logs", "chk_payment_positive",
    "CHECK (points_added > 0 AND amount_cents > 0)"
  );

  // ── UAC violations must have non-negative severity ──
  pgm.addConstraint("uac_violations", "chk_violation_severity_non_negative",
    "CHECK (severity >= 0)"
  );

  // ── Additional missing indexes ──
  pgm.createIndex("uac_violations", "firebase_uid", {
    name:      "idx_violations_firebase_uid",
    ifNotExists: true,
  });

  pgm.createIndex("device_fingerprints", "firebase_uid", {
    name:      "idx_fingerprints_firebase_uid",
    ifNotExists: true,
  });

  pgm.createIndex("users", "trust_score", {
    name:      "idx_users_banned",
    where:     "is_hard_banned = TRUE OR is_shadow_banned = TRUE",
    ifNotExists: true,
  });

  pgm.createIndex("users", "last_seen_at", {
    name:      "idx_users_last_seen",
    ifNotExists: true,
    where:     "last_seen_at IS NOT NULL",
  });
};

exports.down = (pgm) => {
  pgm.dropConstraint("users", "chk_money_non_negative",           { ifExists: true });
  pgm.dropConstraint("users", "chk_points_non_negative",          { ifExists: true });
  pgm.dropConstraint("users", "chk_level_positive",               { ifExists: true });
  pgm.dropConstraint("users", "chk_nerve_range",                  { ifExists: true });
  pgm.dropConstraint("users", "chk_life_range",                   { ifExists: true });
  pgm.dropConstraint("users", "chk_trust_score_range",            { ifExists: true });
  pgm.dropConstraint("users", "chk_total_flags_non_negative",     { ifExists: true });
  pgm.dropConstraint("crimes", "chk_crime_rewards_non_negative",  { ifExists: true });
  pgm.dropConstraint("crimes", "chk_nerve_cost_positive",         { ifExists: true });
  pgm.dropConstraint("user_crime_progress", "chk_crime_progress_non_negative", { ifExists: true });
  pgm.dropConstraint("user_crime_progress", "chk_crime_totals_consistent",     { ifExists: true });
  pgm.dropConstraint("payment_logs", "chk_payment_positive",                   { ifExists: true });
  pgm.dropConstraint("uac_violations", "chk_violation_severity_non_negative",  { ifExists: true });
  pgm.dropIndex("uac_violations",       [], { name: "idx_violations_firebase_uid", ifExists: true });
  pgm.dropIndex("device_fingerprints",  [], { name: "idx_fingerprints_firebase_uid", ifExists: true });
  pgm.dropIndex("users",                [], { name: "idx_users_banned",    ifExists: true });
  pgm.dropIndex("users",                [], { name: "idx_users_last_seen", ifExists: true });
};
