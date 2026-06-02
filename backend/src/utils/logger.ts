import winston from "winston";

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Pretty format for development
const devFormat = printf(({ level, message, timestamp, requestId, ...meta }) => {
  const reqId = requestId ? `[${String(requestId).substring(0, 8)}] ` : "";
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  return `${timestamp} ${level}: ${reqId}${message}${metaStr}`;
});

// JSON format for production (parseable by log aggregators)
const prodFormat = combine(timestamp(), errors({ stack: true }), json());

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format:
    process.env.NODE_ENV === "production"
      ? prodFormat
      : combine(colorize(), timestamp({ format: "HH:mm:ss" }), devFormat),
  transports: [new winston.transports.Console()],
  silent: process.env.NODE_ENV === "test",
});

// ============================================================
// Request-scoped logger
// Usage in controllers:
//   const log = getRequestLogger(req);
//   log.info("Something happened");
// ============================================================
export function getRequestLogger(req: { requestId?: string } | string | undefined) {
  const requestId =
    typeof req === "string"
      ? req
      : (req as any)?.requestId;

  return {
    info: (message: string, meta?: any) =>
      logger.info(message, { requestId, ...meta }),
    warn: (message: string, meta?: any) =>
      logger.warn(message, { requestId, ...meta }),
    error: (message: string, meta?: any) =>
      logger.error(message, { requestId, ...meta }),
    debug: (message: string, meta?: any) =>
      logger.debug(message, { requestId, ...meta }),
  };
}
