// ============================================================
// LOAD TEST ENVIRONMENT
//
// Called at the top of vitest.config.ts setupFiles.
// Must run before ANY other import that reads process.env.
//
// STRATEGY:
//   1. If .env.test exists (local dev) → load it
//   2. If not (CI) → env vars already set by GitHub Actions
//   3. After loading, fill in any missing vars with safe defaults
//   4. Validate required vars are present — fail fast if not
//
// ESM COMPATIBILITY:
//   Uses process.cwd() instead of __dirname (ESM-safe).
//   __dirname is not available in ESM modules.
// ============================================================

import { config as dotenvConfig } from "dotenv";
import { resolve }                from "path";
import { existsSync }             from "fs";

// ── Load .env.test if it exists ────────────────────────────

const testEnvPath = resolve(process.cwd(), ".env.test");

if (existsSync(testEnvPath)) {
  const result = dotenvConfig({ path: testEnvPath, override: true });

  if (result.error) {
    console.error(`[loadTestEnv] Failed to parse .env.test: ${result.error.message}`);
    process.exit(1);
  }

  console.log("[loadTestEnv] Loaded .env.test (local dev mode)");
} else {
  console.log("[loadTestEnv] .env.test not found — using CI environment variables");
}

// ── Always force NODE_ENV=test ─────────────────────────────
process.env["NODE_ENV"] = "test";

// ── Safe defaults for vars that may be missing in CI ──────
// These are test-safe placeholders — never real credentials.
// They ensure modules that read config don't crash on import.

const TEST_DEFAULTS: Record<string, string> = {
  // Database
  DATABASE_URL:           "postgresql://postgres:postgres@localhost:5432/undercity_test",

  // Redis
  REDIS_HOST:             "127.0.0.1",
  REDIS_PORT:             "6379",
  REDIS_TLS:              "false",

  // Firebase (test stub — mockFirebase.ts handles actual calls)
  FIREBASE_PROJECT_ID:    "undercity-test",

  // Security
  FINGERPRINT_SALT:       "test-fingerprint-salt-not-real",
  ALLOWED_ORIGINS:        "http://localhost:3000",

  // Payments — Lemon Squeezy placeholders (Phase 3)
  LEMONSQUEEZY_API_KEY:        "test_lemon_api_key_placeholder",
  LEMONSQUEEZY_STORE_ID:       "test_store_id_placeholder",
  LEMONSQUEEZY_WEBHOOK_SECRET: "test_lemon_webhook_placeholder",

  // Game config
  GAME_TICK_MS:           "60000",
  IDEMPOTENCY_TTL_MS:     "86400000",
  MAX_ENERGY_DEFAULT:     "100",
  MAX_NERVE_DEFAULT:      "30",
  ENERGY_REGEN_SEC:       "300",
  NERVE_REGEN_SEC:        "300",

  // Feature flags (all disabled in tests)
  FEATURE_MAINTENANCE_MODE:   "false",
  FEATURE_REGISTRATION_OPEN:  "true",
  FEATURE_PAYMENTS_ENABLED:   "false",
  FEATURE_VPN_CHECK_ENABLED:  "false",

  // Email (noop in tests)
  EMAIL_FROM:     "test@undercity.gg",
  EMAIL_PROVIDER: "test",
  EMAIL_API_KEY:  "test-key",

  // Sentry (disabled in tests — no DSN)
  SENTRY_DSN: "",
};

let defaultsApplied = 0;
for (const [key, value] of Object.entries(TEST_DEFAULTS)) {
  if (!process.env[key]) {
    process.env[key] = value;
    defaultsApplied++;
  }
}

if (defaultsApplied > 0) {
  console.log(`[loadTestEnv] Applied ${defaultsApplied} default env vars`);
}

// ── Validate required test vars are set ────────────────────
// These MUST be set — either from .env.test, CI env, or defaults above.
// If any are missing after all the above, something is wrong.

const REQUIRED_IN_TEST = [
  "DATABASE_URL",
  "REDIS_HOST",
  "NODE_ENV",
  "FINGERPRINT_SALT",
  "FIREBASE_PROJECT_ID",
] as const;

const missing = REQUIRED_IN_TEST.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(
    `[loadTestEnv] FATAL: Missing required test environment variables:\n  ${missing.join("\n  ")}`
  );
  process.exit(1);
}

// ── Confirm test mode ──────────────────────────────────────
if (process.env["NODE_ENV"] !== "test") {
  console.error("[loadTestEnv] FATAL: NODE_ENV must be 'test'. Got:", process.env["NODE_ENV"]);
  process.exit(1);
}

console.log("[loadTestEnv] Test environment ready ✅");
