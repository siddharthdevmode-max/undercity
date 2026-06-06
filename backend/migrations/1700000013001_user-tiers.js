/* eslint-disable camelcase */

exports.up = (pgm) => {
  // ── Create user_tier enum ──────────────────────────────
  pgm.createType("user_tier_enum", ["player", "citizen", "contributor"]);

  // ── Add tier columns to users ──────────────────────────
  pgm.addColumns("users", {
    user_tier: {
      type:    "user_tier_enum",
      notNull: true,
      default: "player",
    },
    tier_expires_at: {
      type:    "timestamptz",
      default: null,
      comment: "When citizen/contributor status expires. NULL = permanent or free player.",
    },
    tier_granted_at: {
      type:    "timestamptz",
      default: null,
      comment: "When current tier was activated.",
    },
    tier_granted_by: {
      type:    "varchar(50)",
      default: null,
      comment: "How tier was granted: stripe, admin, citizen_pack, system",
    },
  });

  // ── Index for tier-aware queries (regen, expiry checks) ─
  pgm.createIndex("users", "user_tier", { name: "idx_users_user_tier" });
  pgm.createIndex("users", "tier_expires_at", {
    name:  "idx_users_tier_expires_at",
    where: "tier_expires_at IS NOT NULL",
  });
};

exports.down = (pgm) => {
  pgm.dropIndex("users", [], { name: "idx_users_tier_expires_at" });
  pgm.dropIndex("users", [], { name: "idx_users_user_tier" });
  pgm.dropColumns("users", [
    "tier_granted_by",
    "tier_granted_at",
    "tier_expires_at",
    "user_tier",
  ]);
  pgm.dropType("user_tier_enum");
};
