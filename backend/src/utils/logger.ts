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

// Production: also write to rotating daily log files
if (config.isProduction) {
  transports.push(
    new DailyRotateFile({
      filename:    "logs/error-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      level:       "error",
      maxSize:     "20m",
      maxFiles:    "14d",         // Keep 14 days of error logs
      zippedArchive: true,
    }),
    new DailyRotateFile({
      filename:    "logs/combined-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize:     "20m",
      maxFiles:    "7d",          // Keep 7 days of combined logs
      zippedArchive: true,
    })
  );
}

// ─── Logger instance ──────────────────────────────────────

export const logger = winston.createLogger({
  level:      config.logLevel,
  format:     config.isProduction ? prodFormat : devFormatFull,
  transports,
  silent:     false,
  // Don't exit on handled exceptions
  exitOnError: false,
});

// Test mode — suppress everything below error
if (config.isTest) {
  logger.level = "error";
}

// ============================================================
// REQUEST-SCOPED LOGGER
// Attaches requestId to every log line automatically
// Usage:
//   const log = getRequestLogger(req);
//   log.info("Crime attempted", { crime: "theft" });
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
