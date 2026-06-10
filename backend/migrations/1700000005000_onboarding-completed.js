/* eslint-disable camelcase */

exports.up = (pgm) => {
  pgm.addColumns("users", {
    onboarding_completed: {
      type:        "boolean",
      notNull:     true,
      default:     false,
      ifNotExists: true,
    },
    // BUG FIX: timestamp for analytics + GDPR timeline
    onboarding_completed_at: {
      type:        "timestamptz",
      notNull:     false,
      default:     null,
      ifNotExists: true,
    },
  });

  // Partial index — only incomplete onboardings (vast majority complete)
  // Used by admin dashboard: "show users who never finished onboarding"
  pgm.createIndex("users", "onboarding_completed", {
    name:        "idx_users_onboarding_incomplete",
    where:       "onboarding_completed = false",
    ifNotExists: true,
  });
};

exports.down = (pgm) => {
  pgm.dropIndex("users", "onboarding_completed", {
    name:    "idx_users_onboarding_incomplete",
    ifExists: true,
  });
  pgm.dropColumns("users", [
    "onboarding_completed",
    "onboarding_completed_at",
  ]);
};

exports.shorthands = undefined;
