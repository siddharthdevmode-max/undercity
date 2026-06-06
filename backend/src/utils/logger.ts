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

const LOG_DIR = path.resolve(process.cwd(), "logs");

if (config.isProduction && !fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const { combine, timestamp, printf, colorize, errors, json, splat } = winston.format;

const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  splat(),
  printf(({ level, message, timestamp: ts, requestId, stack, ...meta }) => {
    const reqPart   = requestId ? `[${String(requestId).slice(0, 8)}] ` : "";
    const metaKeys  = Object.keys(meta);
    const metaPart  = metaKeys.length > 0 ? ` ${JSON.stringify(meta)}` : "";
    const stackPart = stack ? `\n${stack}` : "";
    return `${ts} ${level}: ${reqPart}${message}${metaPart}${stackPart}`;
  })
);

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  splat(),
  json()
);

function buildTransports(): winston.transport[] {
  const list: winston.transport[] = [
    new winston.transports.Console({
      silent: config.isTest,
      format: config.isProduction ? prodFormat : devFormat,
    }),
  ];

  if (config.isProduction) {
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

  return list;
}

export const logger = winston.createLogger({
  level:       config.isTest ? "silent" : config.logLevel,
  format:      prodFormat,
  transports:  buildTransports(),
  exitOnError: false,
});

// ── Error Rate Tracking ───────────────────────────────────

const ERROR_RATE_THRESHOLD = 50;
const ERROR_RATE_WINDOW_MS = 60_000;

let errorCount       = 0;
let errorWindowStart = Date.now();
let alertInCooldown  = false;

function trackErrorRate(): void {
  if (!config.isProduction || alertInCooldown) return;

  const now = Date.now();
  if (now - errorWindowStart > ERROR_RATE_WINDOW_MS) {
    errorCount       = 0;
    errorWindowStart = now;
  }

  errorCount++;

  if (errorCount >= ERROR_RATE_THRESHOLD) {
    alertInCooldown = true;

    import("./alerts")
      .then(({ Alerts }) => Alerts.highErrorRate(errorCount, 1))
      .catch(() => {});

    setTimeout(() => {
      alertInCooldown  = false;
      errorCount       = 0;
      errorWindowStart = Date.now();
    }, 300_000);
  }
}

// Wrap logger.error to track error rate.
// We store the original, call it, then track — avoids any type gymnastics.
const _origError = logger.error.bind(logger);

logger.error = function (
  message: string | object,
  ...splat: unknown[]
): winston.Logger {
  trackErrorRate();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (_origError as any)(message, ...splat);
};

// ── Child Logger ──────────────────────────────────────────

export function getRequestLogger(requestId: string | undefined) {
  return logger.child({ requestId });
}

export type RequestLogger = ReturnType<typeof getRequestLogger>;
