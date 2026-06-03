// ============================================================
// LOAD TEST ENV BEFORE ANYTHING ELSE
// In CI: env vars are already set via GitHub Actions env
// Locally: loads .env.test file
// ============================================================
import { config } from "dotenv";
import { resolve } from "path";
import { existsSync } from "fs";

const testEnvPath = resolve(__dirname, "../../.env.test");

if (existsSync(testEnvPath)) {
  // Local development — load .env.test
  config({
    path: testEnvPath,
    override: true,
  });
} else {
  // CI — env vars already set by GitHub Actions
  // Just ensure NODE_ENV is test
  process.env.NODE_ENV = "test";
}
