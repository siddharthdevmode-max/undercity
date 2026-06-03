import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import crypto from "crypto";
import { IncomingMessage, ServerResponse } from "http";
import { Express, Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import { config } from "../config";

// ============================================================
// SECURITY MIDDLEWARE
// - Helmet with full CSP using per-request nonces
// - Nonce replaces unsafe-inline in production
// - COEP enabled for cross-origin isolation
// - HSTS in production only
// - Compression with threshold
// - Morgan piped to Winston
// ============================================================

// Helmet's nonce callbacks receive IncomingMessage/ServerResponse
// not Express Request/Response — use the http types here
function getNonce(_req: IncomingMessage, res: ServerResponse): string {
  return `'nonce-${(res as unknown as Response).locals.cspNonce}'`;
}

export function setupSecurityMiddleware(app: Express) {

  // ─── Step 1: Generate nonce BEFORE helmet runs ───
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.locals.cspNonce = crypto.randomBytes(16).toString("base64");
    next();
  });

  // ─── Step 2: Helmet with nonce-based CSP ───
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],

          // Production: nonce only — no unsafe-inline
          // Development: also allow unsafe-inline for Swagger UI
          scriptSrc: config.isProduction
            ? ["'self'", getNonce]
            : ["'self'", "'unsafe-inline'", getNonce],

          styleSrc: [
            "'self'",
            "'unsafe-inline'",               // Required for Swagger UI
            "https://fonts.googleapis.com",
          ],

          fontSrc:  ["'self'", "https://fonts.gstatic.com", "data:"],
          imgSrc:   ["'self'", "data:", "https:"],

          connectSrc: [
            "'self'",
            "https://identitytoolkit.googleapis.com",
            "https://securetoken.googleapis.com",
          ],

          objectSrc:      ["'none'"],
          frameAncestors: ["'none'"],
          baseUri:        ["'self'"],
          formAction:     ["'self'"],
          upgradeInsecureRequests: config.isProduction ? [] : null,
        },
      },

      // COEP enabled — cross-origin isolation
      crossOriginEmbedderPolicy: { policy: "require-corp" },
      crossOriginResourcePolicy: { policy: "cross-origin" },
      crossOriginOpenerPolicy:   { policy: "same-origin" },
      referrerPolicy:            { policy: "strict-origin-when-cross-origin" },

      hsts: config.isProduction
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,

      noSniff:       true,
      frameguard:    { action: "deny" },
      hidePoweredBy: true,
    })
  );

  // ─── Step 3: Compression ───
  app.use(
    compression({
      threshold: 1024,
      filter: (req, res) => {
        if (req.headers["x-no-compression"]) return false;
        return compression.filter(req, res);
      },
    })
  );

  // ─── Step 4: HTTP request logging → Winston ───
  const morganStream = {
    write: (message: string) => logger.http(message.trim()),
  };

  app.use(
    morgan(
      ":method :url :status :res[content-length] - :response-time ms",
      {
        stream: morganStream,
        skip: (req) =>
          req.url === "/api/health" ||
          req.url === "/api/health/detailed",
      }
    )
  );

  logger.info("✅ Security middleware loaded");
  logger.info(
    `🔒 COEP: require-corp | CSP nonce: active | ` +
    `HSTS: ${config.isProduction ? "ON" : "OFF (dev)"}`
  );
}
