// ============================================================
// LOGGER — UNDERCITY
// Winston logger with daily rotation in production.
// Silent in test. HTTP logs captured at debug level.
// ============================================================

import path    from "path";
import fs      from "fs";
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { config } from "../config";

// ─── Log Directory ────────────────────────────────────────
// BUG FIX: wrapped in try/catch — mkdirSync at import time
// in a non-root Docker container can crash before any logging
// BUG FIX: supports LOG_DIR env var override

const LOG_DIR = process.env["LOG_DIR"]?.trim()
  || path.resolve(process.cwd(), "logs");

if (config.isProduction) {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  } catch (err) {
    // Cannot use logger here (not initialized yet) — use console
    // eslint-disable-next-line no-console
    console.warn(
      `[Logger] Could not create log directory "${LOG_DIR}": ` +
      (err instanceof Error ? err.message : String(err)) +
      ". File logging disabled — console only."
    );
  }
}

// ─── Sensitive Key Redaction ──────────────────────────────
// BUG FIX: prevents accidental leakage of secrets into logs

const SENSITIVE_KEYS = new Set([
  "password", "token", "secret", "key", "apiKey", "api_key",
  "authorization", "cookie", "private_key", "privateKey",
  "accessToken", "refreshToken", "idToken",
]);

function redactSensitive(obj: unknown, depth = 0): unknown {
  if (depth > 5 || obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map((v) => redactSensitive(v, depth + 1));

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    result[key] = SENSITIVE_KEYS.has(key.toLowerCase())
      ? "[REDACTED]"
      : redactSensitive(value, depth + 1);
  }
  return result;
}

// ─── Formats ─────────────────────────────────────────────

const { combine, timestamp, printf, colorize, errors, json, splat } =
  winston.format;

const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  splat(),
  printf(({ level, message, timestamp: ts, requestId, stack, ...meta }) => {
    const reqPart  = requestId ? `[${String(requestId).slice(0, 8)}] ` : "";
    const cleaned  = redactSensitive(meta);
    const metaKeys = Object.keys(cleaned as object);
    const metaPart = metaKeys.length > 0 ? ` ${JSON.stringify(cleaned)}` : "";
    const stackPart = stack ? `\n${stack}` : "";
    return `${ts} ${level}: ${reqPart}${message}${metaPart}${stackPart}`;
  })
);

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  splat(),
  winston.format((info) => {
    // Redact sensitive fields from all log entries in production
    const { level, message, timestamp: ts, stack, ...meta } = info;
    return {
      level,
      message,
      timestamp: ts,
      stack,
      ...redactSensitive(meta) as object,
    };
  })(),
  json()
);

// ─── Transports ───────────────────────────────────────────

function buildTransports(): winston.transport[] {
  const list: winston.transport[] = [
    new winston.transports.Console({
      silent: config.isTest,
      format: config.isProduction ? prodFormat : devFormat,
    }),
  ];

  if (config.isProduction) {
    // Only add file transport if log dir was successfully created
    const logDirExists = (() => {
      try { return fs.existsSync(LOG_DIR); }
      catch { return false; }
    })();

    if (logDirExists) {
      list.push(
        new DailyRotateFile({
          filename:      path.join(LOG_DIR, "error-%DATE%.log"),
          datePattern:   "YYYY-MM-DD",
          level:         "error",
          maxSize:       "20m",
          maxFiles:      "14d",
          zippedArchive: true,
          format:        prodFormat,
        }),
        new DailyRotateFile({
          filename:      path.join(LOG_DIR, "combined-%DATE%.log"),
          datePattern:   "YYYY-MM-DD",
          maxSize:       "50m",
          maxFiles:      "7d",
          zippedArchive: true,
          format:        prodFormat,
        })
      );
    }
  }

  return list;
}

// ─── Logger Instance ──────────────────────────────────────

export const logger = winston.createLogger({
  level:       config.isTest ? "silent" : config.logLevel,
  format:      prodFormat,
  transports:  buildTransports(),
  exitOnError: false,
});

// ─── Error Rate Tracking ──────────────────────────────────
// BUG FIX: static import (not dynamic inside hot path)
// BUG FIX: fixed-window implementation (not sliding reset)

import { sendAlert } from "./alerts";

const ERROR_RATE_THRESHOLD = 50;
const ERROR_RATE_WINDOW_MS = 60_000;

let errorCount      = 0;
let alertInCooldown = false;

// Fixed-window: reset on a real clock interval, not on next error
if (config.isProduction) setInterval(() => {
  errorCount = 0;
}, ERROR_RATE_WINDOW_MS).unref();

function trackErrorRate(): void {
  if (!config.isProduction || alertInCooldown) return;

  errorCount++;

  if (errorCount >= ERROR_RATE_THRESHOLD) {
    alertInCooldown = true;

    // BUG FIX: static import, not dynamic
    sendAlert({
      title:     "High Error Rate",
      message:   `${errorCount} errors in the last minute`,
      severity:  "critical",
      fields:    { errors: errorCount, windowMins: 1, action: "Check Sentry" },
      dedupeKey: "high-error-rate",
    });

    setTimeout(() => {
      alertInCooldown = false;
    }, 300_000).unref();
  }
}

// ─── Wrap logger.error ────────────────────────────────────
// BUG FIX: proper typing instead of any cast
// BUG FIX: preserves all Winston overload compatibility

const _origError = logger.error.bind(logger);

// Winston's error() signature: (message: string, ...meta) | (infoObj)
// We wrap to track rate, then delegate to the original
logger.error = function errorWithTracking(
  messageOrInfo: string | winston.LogEntry,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...args: any[]
): winston.Logger {
  trackErrorRate();
  return _origError(messageOrInfo as string, ...args);
} as typeof logger.error;

// ─── Child Logger ─────────────────────────────────────────

export function getRequestLogger(requestId: string | undefined) {
  return logger.child({ requestId });
}

export type RequestLogger = ReturnType<typeof getRequestLogger>;
