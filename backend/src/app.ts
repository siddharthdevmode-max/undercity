import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

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
import { logger }                from "./utils/logger";
import { requestId }             from "./middleware/requestId";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { setupGracefulShutdown } from "./utils/gracefulShutdown";
import { setupApiDocs }          from "./utils/apiDocs";
import { setupSecurityMiddleware } from "./middleware/securityMiddleware";

const app = express();

app.set("trust proxy", 1);

setupSecurityMiddleware(app);

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
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-uac-challenge",
      "x-request-id",
      "x-idempotency-key",
      "x-turnstile-token",
      "x-fp-visitor",
    ],
  })
);

app.use(express.json({ limit: "100kb" }));
app.use(requestId);

setupApiDocs(app);

app.use("/api/health",    healthRoutes);
app.use("/api/auth",      authRoutes);
app.use("/api/crimes",    crimeRoutes);
app.use("/api/stats",     statsRoutes);
app.use("/api/challenge", challengeRoutes);
app.use("/api/admin",     adminRoutes);
app.use("/api",           honeypotRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(config.port, () => {
  logger.info(`🚀 Backend running on http://localhost:${config.port}`);
  logger.info(`🌍 Environment: ${config.nodeEnv}`);
  logger.info(`🛡️  UAC 2.0 Anti-Cheat: ACTIVE | Helmet: ON | Compression: ON`);
  logger.info(`📚 API Docs: http://localhost:${config.port}/api/docs`);
  logger.info(`💊 Health: http://localhost:${config.port}/api/health/detailed`);
});

setupGracefulShutdown(server);

export default app;
