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

function optionalInt(key: string, fallback: number): number {
  const val = process.env[key];
  if (!val) return fallback;
  const parsed = parseInt(val, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`[Config] ${key} must be an integer, got: "${val}"`);
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

// ---- Environment --------------------------------------------

const nodeEnv = optional("NODE_ENV", "development") as
  | "production"
  | "development"
  | "test";

const isProduction  = nodeEnv === "production";
const isDevelopment = nodeEnv === "development";
const isTest        = nodeEnv === "test";

// ---- Config Builder -----------------------------------------

function buildConfig() {
  // ── ALLOWED_ORIGINS guard ──────────────────────────────
  // In production, if ALLOWED_ORIGINS is not set we crash at
  // startup rather than silently blocking all CORS requests.
  const allowedOrigins = isProduction
    ? (() => {
        const list = optionalList("ALLOWED_ORIGINS");
        if (list.length === 0) {
          throw new Error(
            "[Config] ALLOWED_ORIGINS is required in production. " +
            "Set it to a comma-separated list of allowed origins, " +
            "e.g. https://undercity.online,https://www.undercity.online"
          );
        }
        return list;
      })()
    : ["http://localhost:5173", "http://localhost:3000"];

  // ── fingerprintSalt guard ─────────────────────────────
  // In production this MUST be a secret random value.
  // Using the dev fallback in prod means fingerprints are
  // predictable and the anti-cheat layer is compromised.
  const fingerprintSalt = isProduction
    ? required("FINGERPRINT_SALT")
    : optional("FINGERPRINT_SALT", "dev-fingerprint-salt-change-in-prod");

  return {
    port:           optionalInt("PORT", 5000),
    nodeEnv,
    isProduction,
    isDevelopment,
    isTest,

    databaseUrl: isTest
      ? optional("DATABASE_URL", "postgres://localhost:5432/undercity_test")
      : required("DATABASE_URL"),

    redis: {
      host:     optional("REDIS_HOST", "127.0.0.1"),
      port:     optionalInt("REDIS_PORT", 6379),
      password: optionalSecret("REDIS_PASSWORD"),
      tls:      isProduction ? optionalBool("REDIS_TLS", true) : false,
    },

    adminUids:     optionalList("ADMIN_UIDS"),
    devUids:       optionalList("DEV_UIDS"),
    moderatorUids: optionalList("MODERATOR_UIDS"),

    allowedOrigins,

    logLevel: optional("LOG_LEVEL", isProduction ? "info" : "debug") as
      | "error"
      | "warn"
      | "info"
      | "http"
      | "debug",

    firebaseServiceAccountJson: optionalSecret("FIREBASE_SERVICE_ACCOUNT_JSON"),

    turnstileSecretKey: isProduction
      ? required("TURNSTILE_SECRET_KEY")
      : optional("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA"),

    sentry: {
      dsn:              optionalSecret("SENTRY_DSN"),
      release:          optional("SENTRY_RELEASE", "undercity-backend@dev"),
      tracesSampleRate: isProduction
        ? parseFloat(optional("SENTRY_TRACES_SAMPLE_RATE", "0.1"))
        : 1.0,
    },

    // Payments — Lemon Squeezy (Phase 3)
    lemonSqueezy: {
      apiKey:        optionalSecret("LEMONSQUEEZY_API_KEY"),
      webhookSecret: optionalSecret("LEMONSQUEEZY_WEBHOOK_SECRET"),
      storeId:       optionalSecret("LEMONSQUEEZY_STORE_ID"),
    },

    discordAlertWebhook: optionalSecret("DISCORD_ALERT_WEBHOOK"),
    slackAlertWebhook:   optionalSecret("SLACK_ALERT_WEBHOOK"),

    blockedCountries: optionalList("BLOCKED_COUNTRIES"),
    cspReportUri:     optionalSecret("CSP_REPORT_URI"),

    // Required in production — protects anti-cheat fingerprinting
    fingerprintSalt,

    rateLimit: {
      windowMs:        optionalInt("RATE_LIMIT_WINDOW_MS",      60000),
      maxRequests:     optionalInt("RATE_LIMIT_MAX",            100),
      authWindowMs:    optionalInt("RATE_LIMIT_AUTH_WINDOW_MS", 900000),
      authMaxRequests: optionalInt("RATE_LIMIT_AUTH_MAX",       10),
    },

    game: {
      tickIntervalMs:   optionalInt("GAME_TICK_MS",         60000),
      idempotencyTtlMs: optionalInt("IDEMPOTENCY_TTL_MS",   300000),
      maxEnergyDefault: optionalInt("MAX_ENERGY_DEFAULT",   100),
      maxNerveDefault:  optionalInt("MAX_NERVE_DEFAULT",    30),
      energyRegenSec:   optionalInt("ENERGY_REGEN_SEC",     300),
      nerveRegenSec:    optionalInt("NERVE_REGEN_SEC",      300),
    },

    email: {
      from:     optional("EMAIL_FROM", "noreply@undercity.online"),
      provider: optional("EMAIL_PROVIDER", "console") as
        | "console"
        | "sendgrid"
        | "resend",
      apiKey: optionalSecret("EMAIL_API_KEY"),
    },

    features: {
      maintenanceMode:  optionalBool("FEATURE_MAINTENANCE",  false),
      registrationOpen: optionalBool("FEATURE_REGISTRATION", true),
      paymentsEnabled:  optionalBool("FEATURE_PAYMENTS",     isProduction),
      vpnCheckEnabled:  optionalBool("FEATURE_VPN_CHECK",    isProduction),
      enableApiDocs:    optionalBool("FEATURE_API_DOCS",     !isProduction),
    },
  } as const;
}

export const config = buildConfig();
export type Config  = typeof config;
