import { z } from "zod";
import { logger } from "./logger";

// ============================================================
// ENV VARIABLE VALIDATION
// Crashes the app at startup if any env var is missing/invalid
// Better to fail fast than have mysterious bugs in production
// ============================================================

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().regex(/^\d+$/).default("5000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_HOST: z.string().default("127.0.0.1"),
  REDIS_PORT: z.string().regex(/^\d+$/).default("6379"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 chars"),
  ADMIN_UIDS: z.string().optional(),
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
});

export function validateEnv() {
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    const errors = result.error.issues.map(
      (i) => `  - ${i.path.join(".")}: ${i.message}`
    );
    logger.error("❌ Invalid environment variables:\n" + errors.join("\n"));
    process.exit(1);
  }
  
  logger.info("✅ Environment variables validated");
  return result.data;
}
