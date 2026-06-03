import { z } from "zod";
import { existsSync } from "fs";
import { logger } from "./logger";

const envSchema = z.object({
  NODE_ENV:        z.enum(["development", "production", "test"]).default("development"),
  PORT:            z.string().regex(/^\d+$/).default("5000"),
  DATABASE_URL:    z.string().min(1, "DATABASE_URL is required"),
  REDIS_HOST:      z.string().default("127.0.0.1"),
  REDIS_PORT:      z.string().regex(/^\d+$/).default("6379"),
  REDIS_PASSWORD:  z.string().optional(),
  ADMIN_UIDS:      z.string().optional(),
  LOG_LEVEL:       z.enum(["error", "warn", "info", "debug"]).default("info"),
  ALLOWED_ORIGINS: z.string().min(1, "ALLOWED_ORIGINS is required"),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
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

  const hasEnvJson  = !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const hasFile     = existsSync("firebase-service-account.json");
  const isTest      = process.env.NODE_ENV === "test";

  if (!hasEnvJson && !hasFile && !isTest) {
    logger.error(
      "❌ Firebase credentials missing. " +
      "Set FIREBASE_SERVICE_ACCOUNT_JSON or provide firebase-service-account.json"
    );
    process.exit(1);
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
