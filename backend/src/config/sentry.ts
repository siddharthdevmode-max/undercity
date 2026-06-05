import * as Sentry from "@sentry/node";
import { logger } from "../utils/logger";

// ============================================================
// SENTRY ERROR MONITORING
// Only initializes if SENTRY_DSN is set
// Disabled in test environment automatically
// ============================================================

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    logger.warn("⚠️  Sentry not configured (SENTRY_DSN missing) — error monitoring disabled");
    return;
  }

  if (process.env.NODE_ENV === "test") {
    logger.info("ℹ️  Sentry disabled in test environment");
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",

    // ── Performance Monitoring ──
    // Lower in production to save quota
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // ── Release Tracking ──
    release: process.env.SENTRY_RELEASE || "undercity-backend@dev",

    // ── Privacy: Don't send personally identifiable info by default ──
    sendDefaultPii: false,

    // ── Filter out noisy/expected errors ──
    beforeSend(event, hint) {
      const error = hint.originalException as Error | undefined;

      // Ignore validation errors (user-caused, not bugs)
      if (error?.name === "ValidationError") return null;

      // Ignore 401/403 — those are auth failures, not bugs
      if (error?.message?.includes("Invalid token")) return null;
      if (error?.message?.includes("No token provided")) return null;

      // Ignore rate limit errors (expected)
      if (error?.name === "RateLimitError") return null;

      // Ignore CORS errors (expected for blocked origins)
      if (error?.message?.includes("Not allowed by CORS")) return null;

      return event;
    },

    // ── Don't capture these patterns ──
    ignoreErrors: [
      "Non-Error promise rejection captured",
      "ResizeObserver loop limit exceeded",
    ],
  });

  logger.info(`📡 Sentry initialized | env: ${process.env.NODE_ENV} | release: ${process.env.SENTRY_RELEASE || "undercity-backend@dev"}`);
}

// ============================================================
// Helper: Capture custom errors with context
// ============================================================
export function captureError(
  error: Error,
  context?: Record<string, unknown>
): void {
  if (!process.env.SENTRY_DSN) return;

  Sentry.withScope((scope) => {
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        scope.setExtra(key, value);
      }
    }
    Sentry.captureException(error);
  });
}

// ============================================================
// Helper: Add user context to errors
// ============================================================
export function setSentryUser(uid: string, username?: string): void {
  if (!process.env.SENTRY_DSN) return;
  Sentry.setUser({
    id: uid.substring(0, 8),  // partial UID for privacy
    username: username || "unknown",
  });
}

export function clearSentryUser(): void {
  if (!process.env.SENTRY_DSN) return;
  Sentry.setUser(null);
}

export { Sentry };
