import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { config } from "../config";

// ============================================================
// WINSTON LOGGER
// - Dev:  colorized, human-readable console output
// - Prod: JSON to console + rotating file (log aggregator ready)
// - Test: error level only — no noise in test output
// ============================================================

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const devFormat = printf(({
  level,
  message,
  timestamp: ts,
  requestId,
  ...meta
}) => {
  const reqId   = requestId ? `[${String(requestId).substring(0, 8)}] ` : "";
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  return `${ts} ${level}: ${reqId}${message}${metaStr}`;
});

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

const devFormatFull = combine(
  colorize(),
  timestamp({ format: "HH:mm:ss" }),
  devFormat
);

// ─── Transports ───────────────────────────────────────────

const transports: winston.transport[] = [
  new winston.transports.Console(),
];

if (config.isProduction) {
  transports.push(
    new DailyRotateFile({
      filename:      "logs/error-%DATE%.log",
      datePattern:   "YYYY-MM-DD",
      level:         "error",
      maxSize:       "20m",
      maxFiles:      "14d",
      zippedArchive: true,
    }),
    new DailyRotateFile({
      filename:      "logs/combined-%DATE%.log",
      datePattern:   "YYYY-MM-DD",
      maxSize:       "20m",
      maxFiles:      "7d",
      zippedArchive: true,
    })
  );
}

// ─── Logger instance ──────────────────────────────────────

export const logger = winston.createLogger({
  level:       config.logLevel,
  format:      config.isProduction ? prodFormat : devFormatFull,
  transports,
  silent:      false,
  exitOnError: false,
});

if (config.isTest) {
  logger.level = "error";
}

// ============================================================
// ERROR RATE TRACKER
// Counts errors per minute — triggers alert if threshold hit
// Only active in production
// ============================================================

let errorCount       = 0;
let errorWindowStart = Date.now();

const ERROR_RATE_THRESHOLD = 50;   // errors per window
const ERROR_RATE_WINDOW_MS = 60_000; // 1 minute

function trackErrorRate(): void {
  if (!config.isProduction) return;

  errorCount++;
  const now = Date.now();

  if (now - errorWindowStart > ERROR_RATE_WINDOW_MS) {
    if (errorCount > ERROR_RATE_THRESHOLD) {
      // Lazy import to avoid circular dependency
      import("./alerts").then(({ Alerts }) => {
        Alerts.highErrorRate(errorCount, 1);
      }).catch(() => {});
    }
    errorCount       = 0;
    errorWindowStart = now;
  }
}

// ─── Override error() to track rate ──────────────────────
const originalError = logger.error.bind(logger);
logger.error = ((...args: Parameters<typeof originalError>) => {
  trackErrorRate();
  return originalError(...args);
}) as typeof logger.error;

// ============================================================
// REQUEST-SCOPED LOGGER
// Attaches requestId to every log line automatically
// ============================================================

export function getRequestLogger(
  req: { requestId?: string } | string | undefined
) {
  const requestId =
    typeof req === "string"
      ? req
      : (req as { requestId?: string } | undefined)?.requestId;

  return {
    info:  (message: string, meta?: Record<string, unknown>) =>
      logger.info(message,  { requestId, ...meta }),
    warn:  (message: string, meta?: Record<string, unknown>) =>
      logger.warn(message,  { requestId, ...meta }),
    error: (message: string, meta?: Record<string, unknown>) =>
      logger.error(message, { requestId, ...meta }),
    debug: (message: string, meta?: Record<string, unknown>) =>
      logger.debug(message, { requestId, ...meta }),
    http:  (message: string, meta?: Record<string, unknown>) =>
      logger.http(message,  { requestId, ...meta }),
  };
}
