import { z } from "zod";
import { existsSync } from "fs";
import { logger } from "./logger";

const envSchema = z.object({
  // ─── Required ───
  NODE_ENV:        z.enum(["development", "production", "test"]).default("development"),
  PORT:            z.string().regex(/^\d+$/).default("5000"),
  DATABASE_URL:    z.string().min(1, "DATABASE_URL is required"),
  ALLOWED_ORIGINS: z.string().min(1, "ALLOWED_ORIGINS is required"),

  // ─── Redis ───
  REDIS_HOST:      z.string().default("127.0.0.1"),
  REDIS_PORT:      z.string().regex(/^\d+$/).default("6379"),
  REDIS_PASSWORD:  z.string().optional(),

  // ─── Admin ───
  ADMIN_UIDS:      z.string().optional(),

  // ─── Logging ───
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),

  // ─── Firebase ───
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),

  // ─── Cloudflare Turnstile ───
  TURNSTILE_SECRET_KEY: z.string().optional(),

  // ─── Sentry ───
  SENTRY_DSN:     z.string().url().optional(),
  SENTRY_RELEASE: z.string().optional(),

  // ─── Alerts ───
  DISCORD_ALERT_WEBHOOK: z.string().url().optional(),
  SLACK_ALERT_WEBHOOK:   z.string().url().optional(),
  FORCE_ALERTS:          z.string().optional(),

  // ─── Security ───
  BLOCKED_COUNTRIES: z.string().optional(),
  CSP_REPORT_URI:    z.string().url().optional(),
});

export function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errs = result.error.issues.map(
      (i) => `  - ${i.path.join(".")}: ${i.message}`
    );
    logger.error("❌ Invalid environment variables:\n" + errs.join("\n"));
    process.exit(1);
  }

  // Firebase credentials check
  const hasEnvJson = !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const hasFile    = existsSync("firebase-service-account.json");
  const isTest     = process.env.NODE_ENV === "test";

  if (!hasEnvJson && !hasFile && !isTest) {
    logger.error(
      "❌ Firebase credentials missing. " +
      "Set FIREBASE_SERVICE_ACCOUNT_JSON or provide firebase-service-account.json"
    );
    process.exit(1);
  }

  // Warn about missing optional but important vars
  if (!process.env.TURNSTILE_SECRET_KEY && process.env.NODE_ENV === "production") {
    logger.warn("⚠️  TURNSTILE_SECRET_KEY not set — bot protection disabled in production!");
  }

  if (!process.env.SENTRY_DSN) {
    logger.warn("⚠️  SENTRY_DSN not set — error monitoring disabled");
  }

  if (!process.env.DISCORD_ALERT_WEBHOOK && !process.env.SLACK_ALERT_WEBHOOK) {
    logger.warn("⚠️  No alert webhooks configured — DISCORD_ALERT_WEBHOOK or SLACK_ALERT_WEBHOOK recommended");
  }

  logger.info("✅ Environment variables validated");
  return result.data;
}

export function getAllowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}
