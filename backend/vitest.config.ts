import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "dist/",
        "**/*.config.*",
        "**/scripts/**",
        "**/test-utils/**",
        "**/__tests__/api/**",
      ],
      thresholds: {
        lines:     60,
        functions: 60,
        branches:  50,
      },
    },
    testTimeout: 15000,
    // Exclude integration tests from default run
    exclude: [
      "node_modules/**",
      "dist/**",
      "src/__tests__/api/**",
    ],
  },
});
