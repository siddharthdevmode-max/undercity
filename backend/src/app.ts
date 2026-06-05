import dotenv from "dotenv";
dotenv.config();

import { initSentry, Sentry } from "./config/sentry";
initSentry();

import express from "express";
import cors from "cors";
import http from "http";

import { validateEnv } from "./utils/envValidator";
validateEnv();

import { config } from "./config";
import { initSocket } from "./config/socket";
import { startGameTick, stopGameTick } from "./services/gameTick";

import authRoutes      from "./routes/authRoutes";
import crimeRoutes     from "./routes/crimeRoutes";
import statsRoutes     from "./routes/statsRoutes";
import challengeRoutes from "./routes/challengeRoutes";
import honeypotRoutes  from "./routes/honeypotRoutes";
import adminRoutes     from "./routes/adminRoutes";
import healthRoutes    from "./routes/healthRoutes";
import gdprRoutes      from "./routes/gdprRoutes";
import mfaRoutes       from "./routes/mfaRoutes";
import supportRoutes from "./routes/supportRoutes";
import paymentRoutes from "./routes/paymentRoutes";

import { logger }                  from "./utils/logger";
import { requestId }               from "./middleware/requestId";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { setupGracefulShutdown }   from "./utils/gracefulShutdown";
import { setupApiDocs }            from "./utils/apiDocs";
import { setupSecurityMiddleware } from "./middleware/securityMiddleware";
import {
  globalLimiter,
  ipBlacklist,
  bruteForceProtection,
} from "./middleware/rateLimiter";
import {
  sanitizeBody,
  sanitizeQuery,
  sanitizeParams,
} from "./middleware/sanitizeMiddleware";
import { Alerts } from "./utils/alerts";

const app = express();

// ── Create HTTP server (required for Socket.io) ────────────
const httpServer = http.createServer(app);

// ── Initialize Socket.io ───────────────────────────────────
const io = initSocket(httpServer);
// Make io available to routes if needed
app.set("io", io);

app.set("trust proxy", 1);

setupSecurityMiddleware(app);
app.use(ipBlacklist);
app.use(globalLimiter);

logger.info(`🌐 CORS allowed origins: ${config.allowedOrigins.join(", ")}`);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (config.allowedOrigins.includes(origin)) return callback(null, true);
      logger.warn(`🚫 CORS blocked request from origin: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods:        ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-uac-challenge",
      "x-request-id",
      "x-idempotency-key",
      "x-turnstile-token",
      "x-fp-visitor",
      "x-integrity",
      "x-api-version",
    ],
    exposedHeaders: [
      "x-request-id",
      "x-api-version",
      "RateLimit-Limit",
      "RateLimit-Remaining",
      "RateLimit-Reset",
    ],
  })
);

app.use(express.json({ limit: "100kb" }));
app.use(requestId);
app.use(sanitizeBody);
app.use(sanitizeQuery);
app.use(sanitizeParams);

app.use((_req, res, next) => {
  res.setHeader("x-api-version", "1");
  next();
});

setupApiDocs(app);

app.use("/api/auth",    bruteForceProtection);
app.use("/api/v1/auth", bruteForceProtection);

// ─── v1 routes ───
app.use("/api/v1/health",    healthRoutes);
app.use("/api/v1/auth",      authRoutes);
app.use("/api/v1/crimes",    crimeRoutes);
app.use("/api/v1/stats",     statsRoutes);
app.use("/api/v1/challenge", challengeRoutes);
app.use("/api/v1/admin",     adminRoutes);
app.use("/api/v1/gdpr",      gdprRoutes);
app.use("/api/v1/mfa",       mfaRoutes);
app.use("/api/v1/support",   supportRoutes);

// ─── Legacy routes ───
app.use("/api/health",    healthRoutes);
app.use("/api/auth",      authRoutes);
app.use("/api/crimes",    crimeRoutes);
app.use("/api/stats",     statsRoutes);
app.use("/api/challenge", challengeRoutes);
app.use("/api/admin",     adminRoutes);
app.use("/api/gdpr",      gdprRoutes);
app.use("/api/mfa",       mfaRoutes);
app.use("/api/support",   supportRoutes);

// ─── Honeypot (must be after all real routes) ───
app.use("/api",    honeypotRoutes);
app.use("/api/v1", honeypotRoutes);

Sentry.setupExpressErrorHandler(app);
app.use(notFoundHandler);
app.use(errorHandler);

// ── Start HTTP server (NOT app.listen — use httpServer) ────
const server = httpServer.listen(config.port, () => {
  logger.info(`🚀 Backend running on http://localhost:${config.port}`);
  logger.info(`🌍 Environment: ${config.nodeEnv}`);
  logger.info(`🔌 Socket.io: ACTIVE`);
  logger.info(`🛡️  UAC 2.0: ACTIVE | Helmet: ON | Compression: ON`);
  logger.info(`🚦 Rate limiter: ON | IP Blacklist: ON | Brute Force: ON`);
  logger.info(`🧹 Sanitization: ON | XSS: ON`);
  logger.info(`🔀 API: /api/v1/* + legacy /api/*`);
  logger.info(`📚 Docs: http://localhost:${config.port}/api/docs`);
  logger.info(`💊 Health: http://localhost:${config.port}/api/health/detailed`);

  // ── Production only jobs ──
  if (config.isProduction) {
    // Scheduled BullMQ jobs
    import("./queues/scheduler")
      .then(({ setupScheduledJobs }) => setupScheduledJobs())
      .then(() => logger.info("⏰ Scheduled jobs: ACTIVE"))
      .catch((err: unknown) => {
        logger.error("⏰ Scheduled jobs FAILED", {
          error: err instanceof Error ? err.message : String(err),
        });
      });

    // Game tick engine
    startGameTick();
    logger.info("⏱️  Game tick: ACTIVE");
  } else {
    logger.info("⏰ Scheduled jobs: SKIPPED (dev mode)");
    logger.info("⏱️  Game tick: SKIPPED (dev mode)");
  }

  Alerts.serverStarted(config.port, config.nodeEnv);
});

// ── Graceful shutdown including game tick ──────────────────
process.on("SIGTERM", () => stopGameTick());
process.on("SIGINT",  () => stopGameTick());

setupGracefulShutdown(server);

export default app;
