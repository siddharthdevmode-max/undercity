// ============================================================
// SENTRY CONFIG — UNDERCITY
// initSentry() must be called before any other local import
// in server.ts. Reads process.env directly — intentional
// exception to "use config/index.ts" rule.
// ============================================================

import * as Sentry from "@sentry/node";

let _initialized = false;

// ─── Safe float parser ────────────────────────────────────

function parseSampleRate(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = parseFloat(raw);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 1) {
    // Do not throw — Sentry config failure should not crash the server
    // eslint-disable-next-line no-console
    console.warn(
      `[Sentry] Invalid sample rate "${raw}" — using fallback ${fallback}`
    );
    return fallback;
  }
  return parsed;
}

// ─── Init ─────────────────────────────────────────────────

export function initSentry(): void {
  if (_initialized) return;
  _initialized = true;

  const dsn         = process.env["SENTRY_DSN"]?.trim();
  const release     = process.env["SENTRY_RELEASE"]?.trim() || "undercity-backend@dev";
  const environment = process.env["NODE_ENV"] || "development";
  const isProd      = environment === "production";

  // BUG FIX: validated float with bounds
  const tracesSampleRate = isProd
    ? parseSampleRate(process.env["SENTRY_TRACES_SAMPLE_RATE"], 0.1)
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
