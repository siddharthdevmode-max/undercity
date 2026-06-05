import dotenv from "dotenv";
dotenv.config();

import { initSentry, Sentry } from "./config/sentry";
initSentry();

import express from "express";
import cors from "cors";

import { validateEnv } from "./utils/envValidator";
validateEnv();

import { config } from "./config";
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
import { logger }                    from "./utils/logger";
import { requestId }                 from "./middleware/requestId";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { setupGracefulShutdown }     from "./utils/gracefulShutdown";
import { setupApiDocs }              from "./utils/apiDocs";
import { setupSecurityMiddleware }   from "./middleware/securityMiddleware";
import { globalLimiter, ipBlacklist, bruteForceProtection } from "./middleware/rateLimiter";
import { sanitizeBody, sanitizeQuery, sanitizeParams } from "./middleware/sanitizeMiddleware";
import { Alerts } from "./utils/alerts";
import { setupScheduledJobs } from "./queues/scheduler";

const app = express();

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

// ─── Honeypot (after all real routes) ───
app.use("/api",    honeypotRoutes);
app.use("/api/v1", honeypotRoutes);

Sentry.setupExpressErrorHandler(app);
app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(config.port, () => {
  logger.info(`🚀 Backend running on http://localhost:${config.port}`);
  logger.info(`🌍 Environment: ${config.nodeEnv}`);
  logger.info(`🛡️  UAC 2.0: ACTIVE | Helmet: ON | Compression: ON`);
  logger.info(`🚦 Rate limiter: ON | IP Blacklist: ON | Brute Force: ON`);
  logger.info(`🧹 Sanitization: ON | XSS: ON`);
  logger.info(`🔀 API: /api/v1/* + legacy /api/*`);
  logger.info(`📚 Docs: http://localhost:${config.port}/api/docs`);
  logger.info(`💊 Health: http://localhost:${config.port}/api/health/detailed`);
  logger.info(`🔐 MFA: /api/v1/mfa/status`);
  logger.info(`🎫 Support: /api/v1/support/ticket`);

  if (config.isProduction) {
    setupScheduledJobs().catch((err) => {
      logger.error("Failed to setup scheduled jobs", {
        error: err instanceof Error ? err.message : String(err),
      });
    });
    logger.info("⏰ Scheduled jobs: ACTIVE");
  } else {
    logger.info("⏰ Scheduled jobs: SKIPPED (dev mode)");
  }

  Alerts.serverStarted(config.port, config.nodeEnv);
});

setupGracefulShutdown(server);

export default app;
