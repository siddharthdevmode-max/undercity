import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals:     true,
    environment: "node",
    testTimeout: 15000,

    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "dist/",
        "**/*.config.*",
        "**/scripts/**",
        "**/test-utils/**",
        "**/__tests__/api/**",  // Integration tests excluded from unit coverage
      ],
      // Raised from 60/60/50 — these are achievable with current test suite
      thresholds: {
        lines:     80,
        functions: 80,
        branches:  70,
        statements: 80,
      },
    },

    // Exclude integration tests from default unit run
    exclude: [
      "node_modules/**",
      "dist/**",
      "src/__tests__/api/**",
    ],
  },
});
