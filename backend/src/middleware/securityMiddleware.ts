import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import { Express } from "express";
import { logger } from "../utils/logger";

// ============================================================
// PRODUCTION-GRADE MIDDLEWARE STACK
// ============================================================

export function setupSecurityMiddleware(app: Express) {
  // ─── Helmet: HTTP security headers ───
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disabled for Swagger UI compatibility
      crossOriginEmbedderPolicy: false,
    })
  );

  // ─── Compression: Gzip responses ───
  app.use(
    compression({
      threshold: 1024, // Only compress responses > 1KB
      filter: (req, res) => {
        if (req.headers["x-no-compression"]) return false;
        return compression.filter(req, res);
      },
    })
  );

  // ─── Morgan: HTTP request logging ───
  const morganStream = {
    write: (message: string) => logger.info(message.trim()),
  };

  app.use(
    morgan(
      ":method :url :status :res[content-length] - :response-time ms",
      {
        stream: morganStream,
        skip: (req) => req.url === "/api/health", // Don't spam health checks
      }
    )
  );

  logger.info("✅ Security middleware loaded (Helmet + Compression + Morgan)");
}
