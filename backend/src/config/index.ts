// ============================================================
// CONFIG — UNDERCITY
// Single source of truth for all environment-derived config.
// All values are read once at startup and frozen.
// ============================================================

function required(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === "") {
    throw new Error(`[Config] Missing required environment variable: ${key}`);
  }
  return value.trim();
}

function optional(key: string, fallback: string): string {
  return process.env[key]?.trim() || fallback;
}

function optionalInt(
  key: string,
  fallback: number,
  min?: number,
  max?: number
): number {
  const val = process.env[key];
  if (!val) return fallback;
  const parsed = parseInt(val, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`[Config] ${key} must be an integer, got: "${val}"`);
  }
  if (min !== undefined && parsed < min) {
    throw new Error(`[Config] ${key} must be >= ${min}, got: ${parsed}`);
  }
  if (max !== undefined && parsed > max) {
    throw new Error(`[Config] ${key} must be <= ${max}, got: ${parsed}`);
  }
  return parsed;
}

function optionalFloat(
  key: string,
  fallback: number,
  min?: number,
  max?: number
): number {
  const val = process.env[key];
  if (!val) return fallback;
  const parsed = parseFloat(val);
  if (Number.isNaN(parsed)) {
    throw new Error(`[Config] ${key} must be a float, got: "${val}"`);
  }
  if (min !== undefined && parsed < min) {
    throw new Error(`[Config] ${key} must be >= ${min}, got: ${parsed}`);
  }
  if (max !== undefined && parsed > max) {
    throw new Error(`[Config] ${key} must be <= ${max}, got: ${parsed}`);
  }
  return parsed;
}

function optionalList(key: string): string[] {
  return (process.env[key] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function optionalBool(key: string, fallback: boolean): boolean {
  const val = process.env[key]?.trim().toLowerCase();
  if (!val) return fallback;
  if (val === "true"  || val === "1") return true;
  if (val === "false" || val === "0") return false;
  throw new Error(`[Config] ${key} must be true/false, got: "${val}"`);
}

function optionalSecret(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

// ── Environment ───────────────────────────────────────────

const nodeEnv = optional("NODE_ENV", "development") as
  | "production"
  | "development"
  | "test";

const isProduction  = nodeEnv === "production";
const isDevelopment = nodeEnv === "development";
const isTest        = nodeEnv === "test";

// ── Config Builder ────────────────────────────────────────

function buildConfig() {
  // ALLOWED_ORIGINS — read once
  const originList = optionalList("ALLOWED_ORIGINS");
  const allowedOrigins = isProduction
    ? (() => {
        if (originList.length === 0) {
          throw new Error(
            "[Config] ALLOWED_ORIGINS is required in production. " +
            "Set it to a comma-separated list, " +
            "e.g. https://undercity.online,https://www.undercity.online"
          );
        }
        return originList;
      })()
    : originList.length > 0
      ? originList
      : ["http://localhost:5173", "http://localhost:3000"];

  // EMAIL
  const emailProvider = optional("EMAIL_PROVIDER", "console") as
    | "console"
    | "sendgrid"
    | "resend";
  const emailApiKey =
    optionalSecret("RESEND_API_KEY") ?? optionalSecret("EMAIL_API_KEY");

  if (isProduction && emailProvider !== "console" && !emailApiKey) {
    throw new Error(
      `[Config] EMAIL_PROVIDER is "${emailProvider}" but no API key found. ` +
      "Set RESEND_API_KEY or EMAIL_API_KEY."
    );
  }

  // PAYMENTS
  const paymentsEnabled = optionalBool("FEATURE_PAYMENTS", isProduction);
  const lsWebhookSecret = optionalSecret("LEMONSQUEEZY_WEBHOOK_SECRET");

  if (isProduction && paymentsEnabled && !lsWebhookSecret) {
    throw new Error(
      "[Config] LEMONSQUEEZY_WEBHOOK_SECRET is required when payments are enabled."
    );
  }

  // GAME TICK — minimum 10 seconds
  const tickIntervalMs = optionalInt("GAME_TICK_MS", 60_000, 10_000, 3_600_000);

  return {
    port:           optionalInt("PORT", 5000, 1, 65535),
    nodeEnv,
    isProduction,
    isDevelopment,
    isTest,

    databaseUrl: isTest
      ? optional("DATABASE_URL", "postgres://localhost:5432/undercity_test")
      : required("DATABASE_URL"),

    redis: {
      host:     optional("REDIS_HOST", "127.0.0.1"),
      port:     optionalInt("REDIS_PORT", 6379, 1, 65535),
      password: optionalSecret("REDIS_PASSWORD"),
      tls:      optionalBool("REDIS_TLS", false),
    },

    adminUids: optionalList("ADMIN_UIDS"),
    devUids:   optionalList("DEV_UIDS"),

    allowedOrigins,

    logLevel: optional("LOG_LEVEL", isProduction ? "info" : "debug") as
      | "error"
      | "warn"
      | "info"
      | "http"
      | "debug",

    turnstileSecretKey: isProduction
      ? required("TURNSTILE_SECRET_KEY")
      : optional("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA"),

    sentry: {
      dsn:              optionalSecret("SENTRY_DSN"),
      release:          optional("SENTRY_RELEASE", "undercity-backend@dev"),
      tracesSampleRate: isProduction
        ? optionalFloat("SENTRY_TRACES_SAMPLE_RATE", 0.1, 0.0, 1.0)
        : 1.0,
    },

    lemonSqueezy: {
      apiKey:        optionalSecret("LEMONSQUEEZY_API_KEY"),
      webhookSecret: lsWebhookSecret,
      storeId:       optionalSecret("LEMONSQUEEZY_STORE_ID"),
    },

    discordAlertWebhook: optionalSecret("DISCORD_ALERT_WEBHOOK"),
    slackAlertWebhook:   optionalSecret("SLACK_ALERT_WEBHOOK"),

    blockedCountries: optionalList("BLOCKED_COUNTRIES"),
    cspReportUri:     optionalSecret("CSP_REPORT_URI"),

    rateLimit: {
      windowMs:        optionalInt("RATE_LIMIT_WINDOW_MS",      60_000,  1_000),
      maxRequests:     optionalInt("RATE_LIMIT_MAX",            100,     1),
      authWindowMs:    optionalInt("RATE_LIMIT_AUTH_WINDOW_MS", 900_000, 1_000),
      authMaxRequests: optionalInt("RATE_LIMIT_AUTH_MAX",       10,      1),
    },

    game: {
      tickIntervalMs,
      idempotencyTtlMs: optionalInt("IDEMPOTENCY_TTL_MS", 300_000, 1_000),
    },

    email: {
      from:   optional("EMAIL_FROM", "noreply@undercity.online"),
      apiKey: emailApiKey,
    },

    features: {
      maintenanceMode: optionalBool("FEATURE_MAINTENANCE", false),
      paymentsEnabled,
      enableApiDocs:   optionalBool("FEATURE_API_DOCS",   !isProduction),
    },

    firebaseServiceAccountJson: optionalSecret("FIREBASE_SERVICE_ACCOUNT_JSON"),

    logDir: optional("LOG_DIR", "logs"),

    forceAlerts: optionalBool("FORCE_ALERTS", false),

    databaseSsl:                optionalBool("DATABASE_SSL",                     false),
    databaseSslRejectUnauthorized: optionalBool("DATABASE_SSL_REJECT_UNAUTHORIZED", true),
  };
}

export const config = buildConfig();
export type Config  = typeof config;
