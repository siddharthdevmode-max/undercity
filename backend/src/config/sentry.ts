// ============================================================
// SENTRY CONFIG — UNDERCITY
// Must be imported and initSentry() called before any other
// import in app.ts. Reads env directly — intentional exception
// to the "use config/index.ts" rule because Sentry must init
// before dotenv in some setups.
// ============================================================

import * as Sentry from "@sentry/node";

let _initialized = false;

export function initSentry(): void {
  if (_initialized) return;
  _initialized = true;

  const dsn          = process.env.SENTRY_DSN?.trim();
  const release      = process.env.SENTRY_RELEASE?.trim() || "undercity-backend@dev";
  const environment  = process.env.NODE_ENV               || "development";
  const isProduction = environment === "production";

  const tracesSampleRate = isProduction
    ? parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.1")
    : 1.0;

  if (!dsn) {
    // Sentry is optional — missing DSN is not an error
    // Production warning is emitted by envValidator instead
    return;
  }

  Sentry.init({
    dsn,
    release,
    environment,
    tracesSampleRate,
    sendDefaultPii: false,
    ignoreErrors: [
      "ECONNRESET",
      "ECONNREFUSED",
      "ETIMEDOUT",
      "ERR_1001",
      "ERR_1002",
      "ERR_9001",
    ],
  });
}

export { Sentry };
