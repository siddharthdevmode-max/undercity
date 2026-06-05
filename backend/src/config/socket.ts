import { Server as HttpServer } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import { logger } from "../utils/logger";
import { config } from "./index";
import { adminAuth } from "./firebase";

// ============================================================
// SOCKET.IO SERVER — UNDERCITY REAL-TIME ENGINE
// Handles: notifications, game ticks, online presence
// Auth: Firebase ID token (same as REST API)
// ============================================================

let io: SocketServer | null = null;

export function initSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: config.allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e6, // 1MB max
  });

  // ── Auth Middleware ────────────────────────────────────────
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;

      if (!token) {
        return next(new Error("UNAUTHORIZED: No token provided"));
      }

      const decoded = await adminAuth.verifyIdToken(token);
      socket.data.uid      = decoded.uid;
      socket.data.email    = decoded.email;
      socket.data.joinedAt = Date.now();

      logger.info("🔌 Socket authenticated", {
        socketId: socket.id,
        uid:      decoded.uid,
      });

      next();
    } catch (err) {
      logger.warn("🔌 Socket auth failed", {
        socketId: socket.id,
        error:    err instanceof Error ? err.message : String(err),
      });
      next(new Error("UNAUTHORIZED: Invalid token"));
    }
  });

  // ── Connection Handler ─────────────────────────────────────
  io.on("connection", (socket: Socket) => {
    const uid = socket.data.uid as string;

    // Join personal room (for targeted notifications)
    socket.join(`user:${uid}`);

    logger.info("🔌 Socket connected", {
      socketId: socket.id,
      uid,
      rooms: [...socket.rooms],
    });

    // ── Ping/Pong for latency ──────────────────────────────
    socket.on("ping", () => {
      socket.emit("pong", { ts: Date.now() });
    });

    // ── Join game room ─────────────────────────────────────
    socket.on("join:game", () => {
      socket.join("game:global");
      socket.emit("joined:game", { message: "Welcome to Undercity" });
    });

    // ── Disconnect ────────────────────────────────────────
    socket.on("disconnect", (reason) => {
      logger.info("🔌 Socket disconnected", {
        socketId: socket.id,
        uid,
        reason,
      });
    });

    // ── Error ─────────────────────────────────────────────
    socket.on("error", (err) => {
      logger.error("🔌 Socket error", {
        socketId: socket.id,
        uid,
        error: err.message,
      });
    });

    // Send initial connection success
    socket.emit("connected", {
      socketId: socket.id,
      ts:       Date.now(),
      message:  "Real-time connection established",
    });
  });

  logger.info("✅ Socket.io initialized");
  return io;
}

export function getIO(): SocketServer {
  if (!io) throw new Error("Socket.io not initialized — call initSocket first");
  return io;
}

// ── Notification Helpers ───────────────────────────────────

export const SocketNotify = {
  // Send to specific user
  toUser(uid: string, event: string, data: unknown) {
    getIO().to(`user:${uid}`).emit(event, data);
  },

  // Send to all connected users
  broadcast(event: string, data: unknown) {
    getIO().emit(event, data);
  },

  // Send to game global room
  toGame(event: string, data: unknown) {
    getIO().to("game:global").emit(event, data);
  },

  // Crime result notification
  crimeResult(uid: string, result: {
    success: boolean;
    reward:  number;
    message: string;
    crime:   string;
  }) {
    this.toUser(uid, "notification", {
      type:    result.success ? "success" : "failure",
      title:   result.success ? "Crime Successful" : "Crime Failed",
      message: result.message,
      data:    { reward: result.reward, crime: result.crime },
      ts:      Date.now(),
    });
  },

  // Stat update notification
  statUpdate(uid: string, stats: Record<string, number>) {
    this.toUser(uid, "stats:update", { stats, ts: Date.now() });
  },

  // System notification
  system(uid: string, message: string) {
    this.toUser(uid, "notification", {
      type:    "system",
      title:   "System",
      message,
      ts:      Date.now(),
    });
  },

  // Online count broadcast
  onlineCount(count: number) {
    this.broadcast("stats:online", { count, ts: Date.now() });
  },
};
