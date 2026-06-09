// ============================================================
// EXPRESS APP — UNDERCITY
// Pure Express app factory. No boot logic, no process.exit,
// no DB/Redis connections. Safe to import in tests.
// Boot logic lives in server.ts.
// Sentry init lives in server.ts (after validateEnv).
// ============================================================

import { Sentry } from "./config/sentry";

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import http from "http";

import { config }  from "./config";
import { logger }  from "./utils/logger";

import { initSocket } from "./config/socket";

import { setupSecurityMiddleware }       from "./middleware/securityMiddleware";
import { requestId }                     from "./middleware/requestId";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { trackRequests }                 from "./utils/gracefulShutdown";
import { setupApiDocs }                  from "./utils/apiDocs";
import {
  globalLimiter,
  ipBlacklist,
  bruteForceProtection,
}                                        from "./middleware/rateLimiter";
import {
  sanitizeBody,
  sanitizeQuery,
  sanitizeParams,
}                                        from "./middleware/sanitizeMiddleware";
import { MaintenanceError }              from "./utils/errors";

import authRoutes      from "./routes/authRoutes";
import crimeRoutes     from "./routes/crimeRoutes";
import statsRoutes     from "./routes/statsRoutes";
import challengeRoutes from "./routes/challengeRoutes";
import honeypotRoutes  from "./routes/honeypotRoutes";
import adminRoutes     from "./routes/adminRoutes";
import healthRoutes    from "./routes/healthRoutes";
import gdprRoutes      from "./routes/gdprRoutes";
import mfaRoutes       from "./routes/mfaRoutes";
import supportRoutes   from "./routes/supportRoutes";
import paymentRoutes   from "./routes/paymentRoutes";

// ── App + HTTP server ──────────────────────────────────────

const app        = express();
const httpServer = http.createServer(app);

app.set("trust proxy", 1);

const io = initSocket(httpServer);
app.set("io", io);

// ── Middleware stack ───────────────────────────────────────

app.use((req: Request, res: Response, next: NextFunction) => {
  trackRequests(req, res, next);
});

setupSecurityMiddleware(app);
app.use(requestId);
app.use(ipBlacklist);
app.use(globalLimiter);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (config.allowedOrigins.includes(origin)) return callback(null, true);
      logger.warn("CORS blocked", { origin });
      return callback(new Error("Origin not allowed by CORS"));
    },
    credentials:    true,
    methods:        ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Request-ID",
      "X-Idempotency-Key",
      "X-Turnstile-Token",
      "X-FP-Visitor",
      "X-Integrity",
      "X-API-Version",
      "X-UAC-Challenge",
      "X-Signature",
    ],
    exposedHeaders: [
      "X-Request-ID",
      "X-API-Version",
      "Retry-After",
      "RateLimit-Limit",
      "RateLimit-Remaining",
      "RateLimit-Reset",
    ],
  })
);

// ── IMPORTANT: Webhook route needs raw body ─────────────────
// Mount BEFORE express.json() so the webhook handler receives
// the raw Buffer needed for HMAC signature verification.
// All other payment routes get parsed JSON normally.
app.use(
  "/api/v1/payments/webhook",
  express.raw({ type: "*/*", limit: "100kb" })
);

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(sanitizeBody);
app.use(sanitizeQuery);
app.use(sanitizeParams);

app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-API-Version", "1");
  next();
});

setupApiDocs(app);

// ── Routes ─────────────────────────────────────────────────

app.use("/api/v1/health", healthRoutes);
app.use("/api/health",    healthRoutes);

app.use("/api/v1/auth", bruteForceProtection);

app.use((req: Request, _res: Response, next: NextFunction) => {
  if (
    req.path.startsWith("/api/health") ||
    req.path.startsWith("/api/v1/health")
  ) {
    return next();
  }
  if (config.features.maintenanceMode) {
    return next(new MaintenanceError());
  }
  next();
});

app.use("/api/v1/auth",      authRoutes);
app.use("/api/v1/crimes",    crimeRoutes);
app.use("/api/v1/stats",     statsRoutes);
app.use("/api/v1/challenge", challengeRoutes);
app.use("/api/v1/admin",     adminRoutes);
app.use("/api/v1/gdpr",      gdprRoutes);
app.use("/api/v1/mfa",       mfaRoutes);
app.use("/api/v1/support",   supportRoutes);
app.use("/api/v1/payments",  paymentRoutes);

app.use("/api/v1", honeypotRoutes);
app.use("/api",    honeypotRoutes);

// ── Error handlers ────────────────────────────────────────
app.use(notFoundHandler);
Sentry.setupExpressErrorHandler(app);
app.use(errorHandler);

// ── Exports ───────────────────────────────────────────────
export { httpServer };
export default app;
