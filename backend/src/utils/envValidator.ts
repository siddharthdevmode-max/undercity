// ============================================================
// ENV VALIDATOR — UNDERCITY
// Validates all environment variables at startup using Zod.
// Crashes fast on missing required vars in production.
// Warns about missing optional-but-important vars.
// Kept in sync with config/index.ts.
//
// IMPORTANT:
// Empty strings from .env (e.g. SENTRY_DSN=) are treated as
// "unset" for optional variables, not as invalid values.
//
// PAYMENTS:
// Stripe support removed (Indian solo dev limitation).
// Lemon Squeezy will be integrated in Phase 3 (Sept 2026).
// ============================================================

import { z }          from "zod";
import { existsSync } from "fs";
import { logger }     from "./logger";

// ─── Helpers ──────────────────────────────────────────────

const numericString = z.string().regex(/^\d+$/, "Must be a numeric string");
const urlString     = z.string().url("Must be a valid URL");
const boolString    = z.enum(["true", "false", "1", "0"]);

// Convert blank strings ("") to undefined for optional vars
function optionalEnv<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((value) => {
    if (typeof value === "string" && value.trim() === "") {
      return undefined;
    }
    return value;
  }, schema.optional());
}

// ─── Schema ───────────────────────────────────────────────

const envSchema = z.object({

  // ── Core ──────────────────────────────────────────────
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT:     numericString.default("5000"),

  // ── Database ──────────────────────────────────────────
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // ── Redis ─────────────────────────────────────────────
  REDIS_HOST:     z.string().default("127.0.0.1"),
  REDIS_PORT:     numericString.default("6379"),
  REDIS_PASSWORD: optionalEnv(z.string()),
  REDIS_TLS:      optionalEnv(boolString),

  // ── CORS ──────────────────────────────────────────────
  ALLOWED_ORIGINS: optionalEnv(z.string()),

  // ── Logging ───────────────────────────────────────────
  LOG_LEVEL: z
    .enum(["error", "warn", "info", "http", "debug"])
    .default("info"),

  // ── Firebase ──────────────────────────────────────────
  FIREBASE_SERVICE_ACCOUNT_JSON: optionalEnv(z.string()),

  // ── Cloudflare Turnstile ──────────────────────────────
  TURNSTILE_SECRET_KEY: optionalEnv(z.string()),

  // ── Sentry ────────────────────────────────────────────
  SENTRY_DSN:                optionalEnv(urlString),
  SENTRY_RELEASE:            optionalEnv(z.string()),
  SENTRY_TRACES_SAMPLE_RATE: optionalEnv(z.string()),

  // ── Payments (Lemon Squeezy — Phase 3) ────────────────
  // TODO: Add in Phase 3 (September 2026)
  LEMONSQUEEZY_API_KEY:        optionalEnv(z.string()),
  LEMONSQUEEZY_STORE_ID:       optionalEnv(z.string()),
  LEMONSQUEEZY_WEBHOOK_SECRET: optionalEnv(z.string()),

  // ── Alerts ────────────────────────────────────────────
  DISCORD_ALERT_WEBHOOK: optionalEnv(urlString),
  SLACK_ALERT_WEBHOOK:   optionalEnv(urlString),
  FORCE_ALERTS:          optionalEnv(boolString),

  // ── Security ──────────────────────────────────────────
  BLOCKED_COUNTRIES: optionalEnv(z.string()),
  CSP_REPORT_URI:    optionalEnv(urlString),
  FINGERPRINT_SALT:  optionalEnv(z.string()),

  // ── Rate Limiting ─────────────────────────────────────
  RATE_LIMIT_WINDOW_MS:      optionalEnv(numericString),
  RATE_LIMIT_MAX:            optionalEnv(numericString),
  RATE_LIMIT_AUTH_WINDOW_MS: optionalEnv(numericString),
  RATE_LIMIT_AUTH_MAX:       optionalEnv(numericString),

  // ── Game Config ───────────────────────────────────────
  GAME_TICK_MS:       optionalEnv(numericString),
  IDEMPOTENCY_TTL_MS: optionalEnv(numericString),
  MAX_ENERGY_DEFAULT: optionalEnv(numericString),
  MAX_NERVE_DEFAULT:  optionalEnv(numericString),
  ENERGY_REGEN_SEC:   optionalEnv(numericString),
  NERVE_REGEN_SEC:    optionalEnv(numericString),

  // ── Email ─────────────────────────────────────────────
  // z.string().min(5) used instead of z.string().email()
  // because .gg TLDs can fail some RFC validators
  EMAIL_FROM:     optionalEnv(z.string().min(5)),
  EMAIL_PROVIDER: optionalEnv(z.enum(["console", "sendgrid", "resend"])),
  EMAIL_API_KEY:  optionalEnv(z.string()),
  // Resend is our email provider — separate from generic EMAIL_API_KEY
  RESEND_API_KEY: optionalEnv(z.string()),

  // ── Feature Flags ─────────────────────────────────────
  FEATURE_MAINTENANCE:  optionalEnv(boolString),
  FEATURE_REGISTRATION: optionalEnv(boolString),
  FEATURE_PAYMENTS:     optionalEnv(boolString),
  FEATURE_VPN_CHECK:    optionalEnv(boolString),
  FEATURE_API_DOCS:     optionalEnv(boolString),

  // ── Admin / Roles ─────────────────────────────────────
  ADMIN_UIDS:     optionalEnv(z.string()),
  DEV_UIDS:       optionalEnv(z.string()),
  MODERATOR_UIDS: optionalEnv(z.string()),
});

// ─── Production-only required fields ─────────────────────
// NOTE: Payment provider keys removed for now.
// Will be added back in Phase 3 (Lemon Squeezy integration).

const PROD_REQUIRED: Array<keyof z.infer<typeof envSchema>> = [
  "DATABASE_URL",
  "ALLOWED_ORIGINS",
  "TURNSTILE_SECRET_KEY",
  "FINGERPRINT_SALT",
];

// ─── Validator ────────────────────────────────────────────

export function validateEnv(): void {
  const isProduction = process.env.NODE_ENV === "production";
  const isTest       = process.env.NODE_ENV === "test";

  // ── Parse and validate schema ────────────────────────
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `  • ${issue.path.join(".")}: ${issue.message}`
    );
    logger.error(
      "❌ Environment validation failed:\n" + errors.join("\n")
    );
    process.exit(1);
  }

  const env = result.data;

  // ── Production-required checks ───────────────────────
  if (isProduction) {
    const missing = PROD_REQUIRED.filter(
      (key) => !process.env[key]?.trim()
    );

    if (missing.length > 0) {
      logger.error(
        "❌ Missing required production environment variables:\n" +
        missing.map((k) => `  • ${k}`).join("\n")
      );
      process.exit(1);
    }
  }

  // ── Firebase credential check ─────────────────────────
  if (!isTest) {
    const hasEnvJson = !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
    const hasFile    = existsSync("firebase-service-account.json");

    if (!hasEnvJson && !hasFile) {
      logger.error(
        "❌ Firebase credentials missing.\n" +
        "  Set FIREBASE_SERVICE_ACCOUNT_JSON env var\n" +
        "  or place firebase-service-account.json in backend/"
      );
      process.exit(1);
    }
  }

  // ── Production warnings ───────────────────────────────
  if (isProduction) {
    if (!env.SENTRY_DSN) {
      logger.warn("⚠️  SENTRY_DSN not set — error monitoring disabled");
    }
    if (!env.DISCORD_ALERT_WEBHOOK && !env.SLACK_ALERT_WEBHOOK) {
      logger.warn(
        "⚠️  No alert webhooks — DISCORD_ALERT_WEBHOOK or SLACK_ALERT_WEBHOOK recommended"
      );
    }
    if (!env.ALLOWED_ORIGINS) {
      logger.warn("⚠️  ALLOWED_ORIGINS not set — CORS may block all requests");
    }
    if (!env.FINGERPRINT_SALT) {
      logger.warn("⚠️  FINGERPRINT_SALT not set — fingerprinting will use insecure default");
    }
    if (!env.LEMONSQUEEZY_API_KEY) {
      logger.warn("⚠️  LEMONSQUEEZY_API_KEY not set — payments disabled (add in Phase 3)");
    }
    if (!process.env.RESEND_API_KEY?.trim()) {
      logger.warn("⚠️  RESEND_API_KEY not set — transactional emails disabled");
    }
  }

  // ── Dev/staging warnings ──────────────────────────────
  if (!isProduction && !isTest) {
    if (!env.TURNSTILE_SECRET_KEY) {
      logger.warn("⚠️  TURNSTILE_SECRET_KEY not set — using test bypass token");
    }
  }

  logger.info("✅ Environment variables validated", {
    env:          env.NODE_ENV,
    port:         env.PORT,
    firebase:     isTest ? "skipped" : "configured",
    sentry:       !!env.SENTRY_DSN,
    alerts:       !!(env.DISCORD_ALERT_WEBHOOK || env.SLACK_ALERT_WEBHOOK),
    payments:     !!env.LEMONSQUEEZY_API_KEY,
    maintenance:  env.FEATURE_MAINTENANCE === "true",
    apiDocs:      env.FEATURE_API_DOCS === "true",
  });
}
