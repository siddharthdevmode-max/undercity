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
    testTimeout:  10_000,
    hookTimeout:  10_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      exclude: [
        "node_modules/**",
        "src/__tests__/**",
        "src/test-utils/**",
        "src/scripts/**",
        // ── Justified exclusions ──────────────────────────────
        // Sentry init: requires real credentials + network
        "src/config/sentry.ts",
        // Firebase init: requires real service account
        "src/config/firebase.ts",
        // Winston transport internals: not game logic
        "src/utils/logger.ts",
        // Alert delivery: Discord/Slack HTTP calls require live webhooks
        // Core sendAlert() IS tested via alerts.test.ts
        "src/utils/alerts.ts",
      ],
      thresholds: {
        // Target: 100% on all game logic
        // Exclusions above remove untestable infra code
        // These thresholds apply to everything NOT excluded
        statements: 95,
        branches:   90,
        functions:  95,
        lines:      95,
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
