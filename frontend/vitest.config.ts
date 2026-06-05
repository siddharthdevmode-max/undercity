import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals:     true,
    environment: "jsdom",
    setupFiles:  ["./src/test/setup.ts"],
    include:     ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider:   "v8",
      reporter:   ["text", "json", "html"],
      include:    ["src/**/*.{ts,tsx}"],
      exclude:    [
        "src/test/**",
        "src/main.tsx",
        "src/**/*.d.ts",
      ],
      thresholds: {
        lines:      50,
        functions:  50,
        branches:   45,
        statements: 50,
      },
    },
  },
  resolve: {
    alias: {
      "@":           resolve(__dirname, "./src"),
      "@components": resolve(__dirname, "./src/components"),
      "@pages":      resolve(__dirname, "./src/pages"),
      "@hooks":      resolve(__dirname, "./src/hooks"),
      "@services":   resolve(__dirname, "./src/services"),
      "@utils":      resolve(__dirname, "./src/utils"),
    },
  },
});
