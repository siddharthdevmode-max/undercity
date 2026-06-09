// ============================================================
// SECURITY MIDDLEWARE — UNDERCITY
// Helmet, compression, morgan, security headers.
// CSP hardened with upgrade-insecure-requests + base-uri.
// ============================================================

import { Express, Request, Response, NextFunction } from "express";
import helmet      from "helmet";
import compression from "compression";
import morgan      from "morgan";
import { config }  from "../config";
import { logger }  from "../utils/logger";

type CspDirectives = NonNullable<
  NonNullable<Parameters<typeof helmet.contentSecurityPolicy>[0]>["directives"]
>;

export function setupSecurityMiddleware(app: Express): void {

  const apiOrigins = config.isProduction
    ? [
        "https://api.undercity.online",
        "wss://api.undercity.online",
      ]
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

    // FIX: Prevents base tag injection attacks
    // Without this, attacker can inject <base href="https://evil.com">
    // and hijack all relative URLs on the page
    baseUri: ["'self'"],

    // FIX: Force HTTPS for all subresource requests in production
    // Without this, browsers may load mixed content (http:// assets)
    // even when the page is served over HTTPS
    ...(config.isProduction
      ? { upgradeInsecureRequests: [] }
      : {}),
  };

  if (config.cspReportUri) {
    cspDirectives["reportUri"] = [config.cspReportUri];
  }

  app.use(
    helmet({
      contentSecurityPolicy: { directives: cspDirectives },
      hsts: config.isProduction
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
      crossOriginEmbedderPolicy: false,
    })
  );

  if (config.isProduction) {
    app.use(
      compression({
        filter: (req: Request, res: Response) => {
          if (req.headers["x-no-compression"]) return false;
          return compression.filter(req, res);
        },
        level: 6,
      })
    );
  }

  if (!config.isTest) {
    app.use(
      morgan(config.isProduction ? "combined" : "dev", {
        stream: { write: (msg: string) => logger.http(msg.trim()) },
        skip:   (req: Request) => req.path.startsWith("/api/health"),
      })
    );
  }

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options",  "nosniff");
    res.setHeader("X-Frame-Options",         "DENY");
    res.setHeader("X-XSS-Protection",        "0");
    res.setHeader("Referrer-Policy",         "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=()"
    );
    next();
  });

  logger.info("Security middleware configured", {
    hsts:        config.isProduction,
    compression: config.isProduction,
    morgan:      !config.isTest,
  });
}
