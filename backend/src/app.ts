import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes";
import crimeRoutes from "./routes/crimeRoutes";
import { config } from "./config";
import { pool } from "./config/database";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/crimes", crimeRoutes);

// Health check
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    res.status(500).json({ status: "error", database: "not connected" });
  }
});

// Start server
app.listen(config.port, () => {
  console.log(`🚀 Backend running on http://localhost:${config.port}`);
});

export default app;