import winston from "winston";

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const devFormat = printf(({ level, message, timestamp: ts, requestId, ...meta }) => {
  const reqId = requestId ? `[${String(requestId).substring(0, 8)}] ` : "";
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  return `${ts} ${level}: ${reqId}${message}${metaStr}`;
});

const prodFormat = combine(timestamp(), errors({ stack: true }), json());

const transports: winston.transport[] = [
  new winston.transports.Console(),
];

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format:
    process.env.NODE_ENV === "production"
      ? prodFormat
      : combine(colorize(), timestamp({ format: "HH:mm:ss" }), devFormat),
  transports,
  silent: false,
});

if (process.env.NODE_ENV === "test") {
  logger.level = "error";
}

export function getRequestLogger(req: { requestId?: string } | string | undefined) {
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
  };
}
