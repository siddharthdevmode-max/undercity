import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import { Express } from "express";
import { logger } from "../utils/logger";

// ============================================================
// PRODUCTION-GRADE MIDDLEWARE STACK
// ============================================================

export function setupSecurityMiddleware(app: Express) {
  const isProduction = process.env.NODE_ENV === "production";

  // ─── Helmet: HTTP security headers ───
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'", // Needed for Swagger UI
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'", // Needed for Swagger UI
            "https://fonts.googleapis.com",
          ],
          fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: isProduction ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false, // Required for some external resources
      crossOriginResourcePolicy: { policy: "cross-origin" },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      hsts: isProduction
        ? {
            maxAge: 31536000, // 1 year
            includeSubDomains: true,
            preload: true,
          }
        : false,
    })
  );

  // ─── Compression: Gzip responses ───
  app.use(
    compression({
      threshold: 1024,
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
    morgan(":method :url :status :res[content-length] - :response-time ms", {
      stream: morganStream,
      skip: (req) => req.url === "/api/health",
    })
  );

  logger.info("✅ Security middleware loaded (Helmet + CSP + Compression + Morgan)");
}
