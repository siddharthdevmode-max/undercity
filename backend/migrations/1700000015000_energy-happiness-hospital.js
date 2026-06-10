/* eslint-disable camelcase */

// Energy, happiness, and hospital columns.
// NOTE: These columns are now also in migration 001 (initial schema).
// ifNotExists guards make this idempotent for both:
//   - Fresh deployments (migration 001 adds them, this is a no-op)
//   - Existing deployments (migration 001 didn't have them, this adds them)

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns("users", {
    energy: {
      type:        "integer",
      notNull:     true,
      default:     100,
      ifNotExists: true,
    },
    max_energy: {
      type:        "integer",
      notNull:     true,
      default:     100,
      ifNotExists: true,
    },
    // BUG FIX: last_energy_update for time-based regen (mirrors last_nerve_update)
    last_energy_update: {
      type:        "timestamptz",
      default:     null,
      notNull:     false,
      ifNotExists: true,
    },
    // BUG FIX: happiness default 100 (not 50) — consistent with migration 001
    // Players just registered; starting happiness should be high
    happiness: {
      type:        "integer",
      notNull:     true,
      default:     100,
      ifNotExists: true,
    },
    max_happiness: {
      type:        "integer",
      notNull:     true,
      default:     100,
      ifNotExists: true,
    },
    hospital_until: {
      type:        "timestamptz",
      default:     null,
      ifNotExists: true,
    },
  });

  // Index for energy regen queries (mirrors nerve regen index)
  pgm.createIndex("users", ["user_tier", "last_energy_update"], {
    name:        "idx_users_energy_regen",
    where:       "energy < max_energy AND deleted_at IS NULL",
    ifNotExists: true,
  });

  // Index for hospital release (game tick checks this every 60s)
  pgm.createIndex("users", "hospital_until", {
    name:        "idx_users_hospital_until",
    where:       "hospital_until IS NOT NULL",
    ifNotExists: true,
  });
};

exports.down = (pgm) => {
  pgm.dropIndex("users", [], {
    name:    "idx_users_energy_regen",
    ifExists: true,
  });
  pgm.dropIndex("users", [], {
    name:    "idx_users_hospital_until",
    ifExists: true,
  });
  pgm.dropColumns("users", [
    "energy",
    "max_energy",
    "last_energy_update",
    "happiness",
    "max_happiness",
    "hospital_until",
  ]);
};
