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

        // ── Infra: requires real credentials/network ──────────
        "src/config/sentry.ts",
        "src/config/firebase.ts",
        "src/utils/logger.ts",
        "src/utils/alerts.ts",

        // ── Config files: require real running services ────────
        "src/config/database.ts",
        "src/config/redis.ts",
        "src/config/socket.ts",
        "src/config/index.ts",
        "src/config/payments.ts",

        // ── App/Server boot: requires full stack ──────────────
        "src/app.ts",
        "src/server.ts",

        // ── Routes: require live HTTP server ──────────────────
        // Covered by Phase 17 Postman + integration tests
        "src/routes/**",

        // ── Controllers: require DB + full middleware chain ───
        "src/controllers/**",

        // ── Middleware: require Express request lifecycle ─────
        // Core logic tested where possible via unit tests
        // Full chain requires integration tests
        "src/middleware/**",

        // ── Queues: require live Redis + BullMQ ───────────────
        // Covered by integration tests
        "src/queues/**",

        // ── Types: no logic to test ───────────────────────────
        "src/types/**",

        // ── Migrations: SQL DDL files, not testable as JS ─────
        "migrations/**",
      ],
      thresholds: {
        statements: 90,
        branches:   80,
        functions:  90,
        lines:      90,
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
