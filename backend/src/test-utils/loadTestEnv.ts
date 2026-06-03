// ============================================================
// LOAD TEST ENV BEFORE ANYTHING ELSE
// This runs before app.ts imports dotenv
// Overrides local .env with test database settings
// ============================================================
import { config } from "dotenv";
import { resolve } from "path";

// Load .env.test — overrides .env values
config({
  path: resolve(__dirname, "../../.env.test"),
  override: true,
});
