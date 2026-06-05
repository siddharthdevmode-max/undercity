export const config = {
  // ─── Server ───
  port:    parseInt(process.env.PORT    || "5000", 10),
  nodeEnv: process.env.NODE_ENV         || "development",

  // ─── Database ───
  databaseUrl: process.env.DATABASE_URL || "",

  // ─── Redis ───
  redis: {
    host:     process.env.REDIS_HOST     || "127.0.0.1",
    port:     parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  // ─── Auth / Admin ───
  adminUids: (process.env.ADMIN_UIDS || "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean),

  // ─── CORS ───
  allowedOrigins: (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),

  // ─── Logging ───
  logLevel: (process.env.LOG_LEVEL || "info") as
    "error" | "warn" | "info" | "debug",

  // ─── Firebase ───
  firebaseServiceAccountJson:
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON || undefined,

  // ─── Cloudflare Turnstile ───
  turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY || "",

  // ─── Sentry ───
  sentryDsn:     process.env.SENTRY_DSN     || undefined,
  sentryRelease: process.env.SENTRY_RELEASE || "undercity-backend@dev",

  // ─── Alerts ───
  discordAlertWebhook: process.env.DISCORD_ALERT_WEBHOOK || undefined,
  slackAlertWebhook:   process.env.SLACK_ALERT_WEBHOOK   || undefined,

  // ─── Security ───
  blockedCountries: (process.env.BLOCKED_COUNTRIES || "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean),

  cspReportUri: process.env.CSP_REPORT_URI || undefined,

  // ─── Derived helpers ───
  get isProduction() { return this.nodeEnv === "production"; },
  get isDevelopment() { return this.nodeEnv === "development"; },
  get isTest()        { return this.nodeEnv === "test"; },
} as const;
