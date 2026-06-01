import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

import { validateEnv } from "./utils/envValidator";
validateEnv();

import authRoutes from "./routes/authRoutes";
import crimeRoutes from "./routes/crimeRoutes";
import statsRoutes from "./routes/statsRoutes";
import challengeRoutes from "./routes/challengeRoutes";
import honeypotRoutes from "./routes/honeypotRoutes";
import adminRoutes from "./routes/adminRoutes";
import healthRoutes from "./routes/healthRoutes";
import { config } from "./config";
import { logger } from "./utils/logger";
import { requestId } from "./middleware/requestId";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { setupGracefulShutdown } from "./utils/gracefulShutdown";
import { setupApiDocs } from "./utils/apiDocs";
import { setupSecurityMiddleware } from "./middleware/securityMiddleware";

const app = express();

// ─── Production middleware (Helmet, Compression, Morgan) ───
setupSecurityMiddleware(app);

// ─── Core middleware ───
app.use(cors());
app.use(express.json({ limit: "100kb" })); // Prevent huge payloads
app.use(requestId);
app.set("trust proxy", 1);

// ─── API Documentation ───
setupApiDocs(app);

// ─── Routes ───
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/crimes", crimeRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/challenge", challengeRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", honeypotRoutes);

// ─── Error handlers (MUST be last) ───
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Start server ───
const server = app.listen(config.port, () => {
  logger.info(`🚀 Backend running on http://localhost:${config.port}`);
  logger.info(`🛡️  UAC Anti-Cheat: ACTIVE | Helmet: ON | Compression: ON`);
  logger.info(`📚 API Docs: http://localhost:${config.port}/api/docs`);
  logger.info(`💊 Health: http://localhost:${config.port}/api/health/detailed`);
  logger.info(`📊 Logger: ${process.env.NODE_ENV || "development"} mode`);
});

setupGracefulShutdown(server);

export default app;
