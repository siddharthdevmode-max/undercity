// ============================================================
// VITEST CONFIG — UNDERCITY (Integration Tests)
// Requires running DB + Redis.
// Run with: npm run test:integration
// ============================================================

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals:     true,
    environment: "node",
    pool:        "threads",
    include:     ["src/__tests__/integration/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
    },
    setupFiles: [],
  },
});
