// ============================================================
// SECURITY MIDDLEWARE — UNDERCITY
// Helmet CSP, Morgan logging, security headers.
//
// NOTE: compression middleware is intentionally NOT used.
// nginx handles gzip in production — double compression breaks responses.
// In development, Vite handles compression for the frontend.
// ============================================================

import { Express, Request, Response, NextFunction } from "express";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "../config";
import { logger } from "../utils/logger";

type CspDirectives = NonNullable<
  NonNullable<Parameters<typeof helmet.contentSecurityPolicy>[0]>["directives"]
>;

export function setupSecurityMiddleware(app: Express): void {

  // BUG FIX: read API origins from config (not hardcoded domain)
  const apiOrigins = config.isProduction
    ? config.allowedOrigins.flatMap((origin) => [
        origin,
        origin.replace("https://", "wss://"),
        origin.replace("http://", "ws://"),
      ])
    : [
        "http://localhost:5000",
        "ws://localhost:5000",
        "http://localhost:3000",
        "ws://localhost:3000",
      ];

  const cspDirectives: CspDirectives = {
    defaultSrc: ["'self'"],
    styleSrc:   ["'self'", "'unsafe-inline'"],
    imgSrc:     ["'self'", "data:", "https:"],
    connectSrc: ["'self'", ...apiOrigins],
    fontSrc:    ["'self'"],
    objectSrc:  ["'none'"],
    mediaSrc:   ["'none'"],
    frameSrc:   ["'none'"],
    scriptSrc:  ["'self'"],
    baseUri:    ["'self'"],
    ...(config.isProduction ? { upgradeInsecureRequests: [] } : {}),
  };

  if (config.cspReportUri) {
    cspDirectives["reportUri"] = [config.cspReportUri];
  }

  // BUG FIX: let Helmet own ALL security headers
  // Remove manual header setting below — Helmet already sets these
  // Helmet frameguard default is SAMEORIGIN — we override to DENY
  app.use(
    helmet({
      contentSecurityPolicy:   { directives: cspDirectives },
      frameguard:              { action: "deny" },       // X-Frame-Options: DENY
      noSniff:                 true,                     // X-Content-Type-Options: nosniff
      xssFilter:               false,                   // X-XSS-Protection: 0 (modern browsers use CSP)
      referrerPolicy:          { policy: "strict-origin-when-cross-origin" },
      hsts: config.isProduction
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
      crossOriginEmbedderPolicy: false,
    })
  );

  // Permissions-Policy — not yet in Helmet 7, set manually
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=()"
    );
    next();
  });

  // BUG FIX: compression removed — nginx handles gzip in production
  // Adding compression here causes double-gzip (nginx gzips already-gzipped data)

  // Morgan HTTP logging
  if (!config.isTest) {
    // BUG FIX: custom format strips query strings to avoid token leakage
    // e.g. /api/v1/auth/reset-password?token=SECRET → /api/v1/auth/reset-password
    morgan.token("clean-url", (req: Request) => {
      const url = req.url ?? "";
      const queryStart = url.indexOf("?");
      return queryStart !== -1 ? url.slice(0, queryStart) : url;
    });

    const logFormat = config.isProduction
      ? ":remote-addr :method :clean-url :status :res[content-length] :response-time ms"
      : "dev";

    app.use(
      morgan(logFormat, {
        stream: { write: (msg: string) => logger.http(msg.trim()) },
        skip:   (req: Request) =>
          req.path.startsWith("/api/health") ||
          req.path.startsWith("/api/v1/health"),
      })
    );
  }

  logger.info("Security middleware configured", {
    hsts:        config.isProduction,
    compression: false,  // nginx handles gzip
    morgan:      !config.isTest,
    cspReport:   !!config.cspReportUri,
  });
}
