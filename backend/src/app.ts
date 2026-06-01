import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes";
import crimeRoutes from "./routes/crimeRoutes";
import statsRoutes from "./routes/statsRoutes";
import challengeRoutes from "./routes/challengeRoutes";
import { config } from "./config";
import { pool } from "./config/database";
import redis from "./config/redis";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// ── Routes ──
app.use("/api/auth", authRoutes);
app.use("/api/crimes", crimeRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/challenge", challengeRoutes);

// ── Health check ──
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    const redisPing = await redis.ping();
    res.json({ 
      status: "ok", 
      database: "connected",
      redis: redisPing === "PONG" ? "connected" : "error"
    });
  } catch (error) {
    res.status(500).json({ status: "error", database: "not connected" });
  }
});

// ── Start server ──
app.listen(config.port, () => {
  console.log(`🚀 Backend running on http://localhost:${config.port}`);
});

export default app;
