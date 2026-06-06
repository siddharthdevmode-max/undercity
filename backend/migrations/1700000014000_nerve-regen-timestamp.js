/* eslint-disable camelcase */

exports.up = (pgm) => {
  // ── Per-user nerve regen timestamp ─────────────────────
  // Used by nerveService for tier-aware regen.
  // NULL = never regenerated → will qualify immediately.
  pgm.addColumns("users", {
    last_nerve_update: {
      type:    "timestamptz",
      default: null,
      comment: "Last time this user received +1 nerve from regen tick.",
    },
  });

  // ── Index for efficient regen queries ──────────────────
  // The regen query filters on: user_tier + nerve < max_nerve + last_nerve_update
  // Partial index: only users who NEED regen (nerve < max_nerve)
  pgm.createIndex("users", ["user_tier", "last_nerve_update"], {
    name:  "idx_users_nerve_regen",
    where: "nerve < max_nerve AND deleted_at IS NULL",
  });
};

exports.down = (pgm) => {
  pgm.dropIndex("users", [], { name: "idx_users_nerve_regen" });
  pgm.dropColumns("users", ["last_nerve_update"]);
};
