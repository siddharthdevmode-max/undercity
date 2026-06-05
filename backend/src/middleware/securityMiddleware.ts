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
// - Permissions-Policy header
// - CSP Report URI
// - Compression with threshold
// - Morgan piped to Winston
// ============================================================

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

          scriptSrc: config.isProduction
            ? ["'self'", getNonce]
            : ["'self'", "'unsafe-inline'", getNonce],

          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com",
          ],

          fontSrc:  ["'self'", "https://fonts.gstatic.com", "data:"],
          imgSrc:   ["'self'", "data:", "https:"],

          connectSrc: [
            "'self'",
            // Firebase Auth
            "https://identitytoolkit.googleapis.com",
            "https://securetoken.googleapis.com",
            "https://accounts.google.com",
            // Firebase Firestore/Storage (add if used)
            "https://*.firebaseio.com",
            "https://*.googleapis.com",
            // Cloudflare Turnstile
            "https://challenges.cloudflare.com",
            // FingerprintJS
            "https://fp.undercity.app",
            // ip-api VPN check (backend only — but keep for safety)
            ...(config.isDevelopment ? ["http://ip-api.com"] : []),
          ],

          // Cloudflare Turnstile needs to load its script
          scriptSrcElem: [
            "'self'",
            "https://challenges.cloudflare.com",
            ...(config.isDevelopment ? ["'unsafe-inline'"] : []),
          ],

          // Turnstile iframe
          frameSrc: [
            "https://challenges.cloudflare.com",
          ],

          objectSrc:      ["'none'"],
          frameAncestors: ["'none'"],
          baseUri:        ["'self'"],
          formAction:     ["'self'"],

          // CSP violation reporting
          ...(config.isProduction && process.env.CSP_REPORT_URI
            ? { reportUri: [process.env.CSP_REPORT_URI] }
            : {}),

          upgradeInsecureRequests: config.isProduction ? [] : null,
        },
      },

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

  // ─── Step 3: Permissions-Policy (browser feature restrictions) ───
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader(
      "Permissions-Policy",
      [
        "camera=()",
        "microphone=()",
        "geolocation=()",
        "payment=()",
        "usb=()",
        "magnetometer=()",
        "gyroscope=()",
        "accelerometer=()",
        "autoplay=(self)",
        "fullscreen=(self)",
      ].join(", ")
    );
    next();
  });

  // ─── Step 4: Compression ───
  app.use(
    compression({
      threshold: 1024,
      filter: (req, res) => {
        if (req.headers["x-no-compression"]) return false;
        return compression.filter(req, res);
      },
    })
  );

  // ─── Step 5: HTTP request logging → Winston ───
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
    `HSTS: ${config.isProduction ? "ON" : "OFF (dev)"} | ` +
    `Permissions-Policy: ON`
  );
}
