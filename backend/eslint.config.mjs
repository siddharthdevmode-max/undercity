import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // Completely ignore scripts — they use console.log intentionally
    ignores: ["dist/", "node_modules/", "src/scripts/**"],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["src/**/*.ts"],
    rules: {
      // Disallow any — enforce proper types
      "@typescript-eslint/no-explicit-any": "error",
      // Disallow console in app code (use logger)
      "no-console": "error",
      // Unused vars — prefix with _ to suppress
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ],
    },
  }
);
