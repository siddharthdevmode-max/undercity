/* eslint-disable camelcase */

// ============================================================
// CRITICAL FIX: money column INTEGER → BIGINT
// INTEGER max = 2,147,483,647 (~$2.1B)
// BIGINT  max = 9,223,372,036,854,775,807
// Without this, wealthy players will hit overflow
// ============================================================

exports.up = (pgm) => {
  // Alter money column to BIGINT
  pgm.alterColumn("users", "money", {
    type: "bigint",
    notNull: true,
    default: 750,
  });

  // Also fix hidden_cpl to NUMERIC for precision
  pgm.alterColumn("user_crime_progress", "hidden_cpl", {
    type: "numeric(12,4)",
    notNull: true,
    default: 0,
  });

  // Add index on trust_score for admin queries
  pgm.createIndex("users", "trust_score", {
    name: "idx_users_trust_score",
    ifNotExists: true,
    where: "trust_score < 100",
  });

  // Add index for last_crime_at for stats queries
  pgm.createIndex("users", "last_crime_at", {
    name: "idx_users_last_crime_at",
    ifNotExists: true,
    where: "last_crime_at IS NOT NULL",
  });
};

exports.down = (pgm) => {
  pgm.dropIndex("users", [], { name: "idx_users_trust_score",  ifExists: true });
  pgm.dropIndex("users", [], { name: "idx_users_last_crime_at", ifExists: true });

  pgm.alterColumn("user_crime_progress", "hidden_cpl", {
    type: "real",
    notNull: true,
    default: 0,
  });

  pgm.alterColumn("users", "money", {
    type: "integer",
    notNull: true,
    default: 750,
  });
};
