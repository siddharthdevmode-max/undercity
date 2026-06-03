exports.up = async (pgm) => {
  pgm.addColumn("users", {
    onboarding_completed: {
      type: "boolean",
      notNull: true,
      default: false,
    },
  });
};

exports.down = async (pgm) => {
  pgm.dropColumn("users", "onboarding_completed");
};
