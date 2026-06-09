import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "src/__tests__/integration/**/*.test.ts",
      "src/**/integration/**/*.test.ts"
    ],
    passWithNoTests: false,
    reporters: ["default"],
    testTimeout: 15000,
    hookTimeout: 15000
  }
});
