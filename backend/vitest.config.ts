// ============================================================
// VITEST CONFIG — UNDERCITY (Unit Tests)
// Runs fast unit tests only. No DB/Redis required.
// For integration tests: npm run test:integration
// ============================================================

import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals:     true,
    environment: "node",
    pool:        "threads",
    include:     ["src/__tests__/**/*.test.ts"],
    exclude:     [
      "src/__tests__/integration/**",
      "node_modules/**",
    ],
    testTimeout: 10_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      exclude: [
        "node_modules/**",
        "src/__tests__/**",
        "src/test-utils/**",
        "src/scripts/**",
        // Sentry/Firebase init — cannot test without real credentials
        "src/config/sentry.ts",
        "src/config/firebase.ts",
        // Logger transport internals — Winston internals, not game logic
        "src/utils/logger.ts",
        // Alert delivery internals — fetch/Discord/Slack HTTP calls
        // Core sendAlert() logic IS tested via alerts.test.ts
        // Delivery functions require live webhooks — excluded from coverage
        "src/utils/alerts.ts",
      ],
      thresholds: {
        // Realistic production thresholds for game logic files
        // Logger and alerts delivery excluded above — they skew the numbers
        statements: 80,
        branches:   72,
        functions:  80,
        lines:      80,
        perFile:    false,
      },
    },
    setupFiles: [],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
