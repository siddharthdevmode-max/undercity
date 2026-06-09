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
      provider: "v8",
      reporter: ["text", "json", "html"],
      include:  ["src/**/*.{ts,tsx}"],
      exclude: [
        // Test infra
        "src/test/**",
        "src/main.tsx",
        "src/**/*.d.ts",

        // UI — requires real browser/Firebase/DOM
        "src/pages/**",
        "src/components/**",
        "src/App.tsx",
        "src/firebase.ts",
        "src/context/**",
        "src/hooks/**",
        "src/lib/**",
        "src/types/**",

        // Services that need live Firebase/fetch/socket
        // These are covered by integration tests
        "src/services/api.ts",
        "src/services/crimes.ts",
        "src/services/socket.ts",
        "src/services/fingerprint.ts",
        "src/services/admin.ts",
        "src/services/features.ts",
        "src/services/news.ts",
      ],
      thresholds: {
        // Measuring only: utils + services/stats + services/analytics
        lines:      80,
        functions:  80,
        branches:   70,
        statements: 80,
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
