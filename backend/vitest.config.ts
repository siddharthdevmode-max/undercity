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
      reporter: ["text", "lcov"],
      exclude:  [
        "node_modules/**",
        "src/__tests__/**",
        "src/test-utils/**",
        "src/scripts/**",
      ],
    },
    setupFiles: [],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  // Force ESM to silence the Vite CJS Node API deprecation warning
  esbuild: {
    target: "node18",
  },
});
