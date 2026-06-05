import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals:     true,
    environment: "node",
    include:     ["src/__tests__/**/*.test.ts"],
    exclude:     ["src/__tests__/api/**"],
    coverage: {
      provider:  "v8",
      reporter:  ["text", "lcov", "html"],
      reportsDirectory: "./coverage",
      thresholds: {
        lines:     60,
        functions: 60,
        branches:  50,
        statements: 60,
      },
      exclude: [
        "src/scripts/**",
        "src/types/**",
        "src/config/**",
        "src/__tests__/**",
        "src/test-utils/**",
        "dist/**",
      ],
    },
  },
});
