// ============================================================
// EXPRESS APP — UNDERCITY
// Pure Express app factory. No boot logic, no process.exit,
// no DB/Redis connections. Safe to import in tests.
// Boot logic lives in server.ts.
// ============================================================

import { Sentry } from "./config/sentry";

import express, {
  Request,
  Response,
  NextFunction,
} from "express";
import cors    from "cors";
import http    from "http";

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
import bankRoutes      from "./routes/bankRoutes";
import marketRoutes    from "./routes/marketRoutes";
import inventoryRoutes from "./routes/inventoryRoutes";
import referralRoutes      from "./routes/referralRoutes";
import leaderboardRoutes   from "./routes/leaderboardRoutes";
import profileRoutes       from "./routes/profileRoutes";
import gymRoutes           from "./routes/gymRoutes";
import attackRoutes        from "./routes/attackRoutes";
import travelRoutes        from "./routes/travelRoutes";
import jobRoutes           from "./routes/jobRoutes";
import propertyRoutes      from "./routes/propertyRoutes";
import casinoRoutes        from "./routes/casinoRoutes";
import forumRoutes         from "./routes/forumRoutes";
import calendarRoutes      from "./routes/calendarRoutes";
import newspaperRoutes     from "./routes/newspaperRoutes";
import missionRoutes       from "./routes/missionRoutes";
import gangRoutes          from "./routes/gangRoutes";
import linkedGangsRoutes   from "./routes/linkedGangsRoutes";
import gangWarsRoutes      from "./routes/gangWarsRoutes";

// ── App + HTTP server ──────────────────────────────────────

const app        = express();
const httpServer = http.createServer(app);

app.set("trust proxy", 1);

const io = initSocket(httpServer);

// ── Socket.IO on app ─────────────────────────────────────
// Usage in routes: const io = req.app.get("io")
app.set("io", io);

// ── Request timeout (30s hard limit) ─────────────────────
// Prevents slow DB queries from holding connections forever.
// Health check exempted — it should always respond quickly.
const REQUEST_TIMEOUT_MS = 30_000;

function requestTimeout(req: Request, res: Response, next: NextFunction): void {
  if (req.path.startsWith("/api/health") || req.path.startsWith("/api/v1/health")) {
    return next();
  }

  const timer = setTimeout(() => {
    if (!res.headersSent) {
      logger.warn("Request timeout", {
        method: req.method,
        path:   req.path,
        ip:     req.ip,
      });
      res.status(503).json({
        error:   "Request timeout",
        code:    "REQUEST_TIMEOUT",
        details: null,
      });
    }
  }, REQUEST_TIMEOUT_MS);

  res.on("finish", () => clearTimeout(timer));
  res.on("close",  () => clearTimeout(timer));
  next();
}

// ── Maintenance mode check ────────────────────────────────
const HEALTH_PATHS = ["/api/health", "/api/v1/health"] as const;

function maintenanceCheck(req: Request, _res: Response, next: NextFunction): void {
  const isHealthPath = HEALTH_PATHS.some((p) => req.path.startsWith(p));
  if (!isHealthPath && config.features.maintenanceMode) {
    return next(new MaintenanceError());
  }
  next();
}

// ── Middleware stack ───────────────────────────────────────

app.use(trackRequests);
app.use(requestTimeout);

setupSecurityMiddleware(app);
app.use(requestId);
app.use(ipBlacklist);
app.use(globalLimiter);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (curl, Postman, server-to-server)
      if (!origin) return callback(null, true);
      if (config.allowedOrigins.includes(origin)) return callback(null, true);
      logger.warn("CORS blocked", { origin });
      // Never expose the origin in the error — generic message only
      return callback(new Error("Not allowed by CORS policy"));
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

// ── IMPORTANT: Webhook needs raw body ────────────────────
// Mount BEFORE express.json() — webhook HMAC needs raw Buffer.
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

app.use(maintenanceCheck);

setupApiDocs(app);

// ── Routes ─────────────────────────────────────────────────

// Health (no rate limit, no auth)
app.use("/api/v1/health", healthRoutes);
app.use("/api/health",    healthRoutes);

// Auth (brute force protection on BOTH versioned + non-versioned paths)
app.use("/api/v1/auth", bruteForceProtection, authRoutes);

// Game routes
app.use("/api/v1/crimes",    crimeRoutes);
app.use("/api/v1/stats",     statsRoutes);
app.use("/api/v1/challenge", challengeRoutes);
app.use("/api/v1/admin",     adminRoutes);
app.use("/api/v1/gdpr",      gdprRoutes);
app.use("/api/v1/mfa",       mfaRoutes);
app.use("/api/v1/support",   supportRoutes);
app.use("/api/v1/payments",  paymentRoutes);
app.use("/api/v1/bank",      bankRoutes);
app.use("/api/v1/market",    marketRoutes);
app.use("/api/v1/inventory", inventoryRoutes);
app.use("/api/v1/referral",  referralRoutes);
app.use("/api/v1/leaderboard", leaderboardRoutes);
app.use("/api/v1/profile",     profileRoutes);
app.use("/api/v1/gym",         gymRoutes);
app.use("/api/v1/attack",      attackRoutes);
app.use("/api/v1/travel",      travelRoutes);
app.use("/api/v1/jobs",        jobRoutes);
app.use("/api/v1/properties",  propertyRoutes);
app.use("/api/v1/casino",      casinoRoutes);
app.use("/api/v1/forum",       forumRoutes);
app.use("/api/v1/calendar",    calendarRoutes);
app.use("/api/v1/newspaper",   newspaperRoutes);
app.use("/api/v1/missions",    missionRoutes);
app.use("/api/v1/gang",        gangRoutes);
app.use("/api/v1/linked-gangs", linkedGangsRoutes);
app.use("/api/v1/gang-wars",   gangWarsRoutes);

// Honeypot — single mount with wildcard to avoid double-firing
// Catches scanner paths like /wp-admin, /phpMyAdmin, etc.
app.use(honeypotRoutes);

// ── Error handlers ─────────────────────────────────────────
app.use(notFoundHandler);
Sentry.setupExpressErrorHandler(app);
app.use(errorHandler);

// ── Exports ───────────────────────────────────────────────
export { httpServer };
export default app;
