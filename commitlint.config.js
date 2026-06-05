module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",     // New feature
        "fix",      // Bug fix
        "chore",    // Maintenance
        "docs",     // Documentation
        "style",    // Formatting
        "refactor", // Code restructure
        "test",     // Tests
        "perf",     // Performance
        "ci",       // CI/CD changes
        "revert",   // Revert commit
        "migration", // DB migration
        "security", // Security fix
      ],
    ],
    "subject-case":      [2, "always", "lower-case"],
    "subject-max-length": [2, "always", 100],
    "body-max-line-length": [2, "always", 150],
  },
};
