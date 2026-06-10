// ============================================================
// VITEST CONFIG — UNDERCITY (Integration Tests)
// Requires live PostgreSQL + Redis (Docker)
// Run: docker compose up -d postgres redis
// Then: npm run test:integration
// ============================================================

import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals:      true,
    environment:  "node",
    pool:         "forks",
    include: [
      "src/__tests__/integration/**/*.test.ts",
      "src/**/integration/**/*.test.ts",
    ],
    exclude:      ["node_modules/**"],
    passWithNoTests: false,
    reporters:    ["default"],
    testTimeout:  30_000,
    hookTimeout:  30_000,
    // Integration tests must run sequentially
    // Parallel runs cause DB state collisions
    sequence: {
      concurrent: false,
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      exclude: [
        "node_modules/**",
        "src/__tests__/**",
        "src/scripts/**",
        "src/config/sentry.ts",
        "src/config/firebase.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
