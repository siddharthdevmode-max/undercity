// ============================================================
// SENTRY CONFIG — UNDERCITY
// initSentry() must be called after validateEnv() + config
// import. Uses config.sentry values instead of process.env.
// ============================================================

import * as Sentry from "@sentry/node";
import { config } from "./index";

let _initialized = false;

// ─── Init ─────────────────────────────────────────────────

export function initSentry(): void {
  if (_initialized) return;
  _initialized = true;

  const dsn         = config.sentry.dsn;
  const release     = config.sentry.release ?? "undercity-backend@dev";
  const environment = config.nodeEnv || "development";
  const isProd      = config.isProduction;

  const tracesSampleRate = isProd
    ? config.sentry.tracesSampleRate ?? 0.1
    : 1.0;

  if (!dsn) {
    // Optional in dev — production warning is in envValidator
    return;
  }

  Sentry.init({
    dsn,
    release,
    environment,
    tracesSampleRate,
    sendDefaultPii: false,

    // BUG FIX: use partial message matching that actually works
    // These are substrings of full error messages, not just error codes
    ignoreErrors: [
      "read ECONNRESET",
      "connect ECONNREFUSED",
      "connect ETIMEDOUT",
      "socket hang up",
      "ECONNRESET",
      "ECONNREFUSED",
      "ETIMEDOUT",
      // Custom app error codes that are expected/handled
      "ERR_1001",
      "ERR_1002",
      "ERR_9001",
    ],

    // Filter out health check noise
    beforeSend(event) {
      const url = event.request?.url ?? "";
      if (url.includes("/api/health")) return null;
      return event;
    },
  });
}

// ─── Flush helper (call during graceful shutdown) ─────────
// BUG FIX: exported so gracefulShutdown can await it
// Prevents events from being lost on process exit

export async function flushSentry(timeoutMs = 2_000): Promise<void> {
  try {
    await Sentry.flush(timeoutMs);
  } catch {
    // Never block shutdown on Sentry flush failure
  }
}

export { Sentry };
