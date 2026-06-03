import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import crypto from "crypto";
import { Express, Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

export function setupSecurityMiddleware(app: Express) {
  const isProduction = process.env.NODE_ENV === "production";

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.locals.cspNonce = crypto.randomBytes(16).toString("base64");
    next();
  });

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc:     ["'self'"],
          scriptSrc:      ["'self'", "'unsafe-inline'"],
          styleSrc:       ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc:        ["'self'", "https://fonts.gstatic.com", "data:"],
          imgSrc:         ["'self'", "data:", "https:"],
          connectSrc:     ["'self'"],
          objectSrc:      ["'none'"],
          frameAncestors: ["'none'"],
          baseUri:        ["'self'"],
          formAction:     ["'self'"],
          upgradeInsecureRequests: isProduction ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      crossOriginOpenerPolicy:   { policy: "same-origin" },
      referrerPolicy:            { policy: "strict-origin-when-cross-origin" },
      hsts: isProduction
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
      noSniff:       true,
      frameguard:    { action: "deny" },
      hidePoweredBy: true,
    })
  );

  app.use(
    compression({
      threshold: 1024,
      filter: (req, res) => {
        if (req.headers["x-no-compression"]) return false;
        return compression.filter(req, res);
      },
    })
  );

  const morganStream = {
    write: (message: string) => logger.info(message.trim()),
  };

  app.use(
    morgan(":method :url :status :res[content-length] - :response-time ms", {
      stream: morganStream,
      skip: (req) => req.url === "/api/health",
    })
  );

  logger.info("✅ Security middleware loaded");
}
