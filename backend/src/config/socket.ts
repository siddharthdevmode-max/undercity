// ============================================================
// SOCKET.IO CONFIG — UNDERCITY
// Authenticated WebSocket server with rate limiting,
// room management, and clean shutdown support.
// ============================================================

import { Server as HttpServer } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import type { ExtendedError } from "socket.io/dist/namespace";
import { logger }              from "../utils/logger";
import { config }              from "./index";
import { verifyFirebaseToken } from "./firebase";
import { AppError }            from "../utils/errors";

// ─── Types ────────────────────────────────────────────────

export interface SocketData {
  uid:         string;
  email:       string | undefined;
  joinedAt:    number;
  eventCount:  number;
  lastEventAt: number;
}

// Type guard — validates socket.data has been set by auth middleware
function hasSocketData(data: unknown): data is SocketData {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof (data as SocketData).uid === "string" &&
    (data as SocketData).uid.length > 0
  );
}

// ─── Module State ─────────────────────────────────────────

let io: SocketServer | null = null;

// Online count broadcast — debounced to prevent spam
let onlineCountTimer: NodeJS.Timeout | null = null;

// ─── Rate Limiter ─────────────────────────────────────────
// BUG FIX: tracks per-socket (intentional for now)
// TODO: move to Redis-backed per-UID tracking post-launch
// For now: each socket gets its own budget — document trade-off

const SOCKET_RATE_LIMIT  = 60;
const SOCKET_RATE_WINDOW = 60_000;

function isSocketRateLimited(socket: Socket): boolean {
  if (!hasSocketData(socket.data)) return true; // no data = reject

  const data = socket.data as SocketData;
  const now  = Date.now();

  if (now - data.lastEventAt > SOCKET_RATE_WINDOW) {
    data.eventCount  = 0;
    data.lastEventAt = now;
  }

  data.eventCount++;
  return data.eventCount > SOCKET_RATE_LIMIT;
}

// ─── Online Count Broadcast ───────────────────────────────

function scheduleOnlineCountBroadcast(): void {
  if (onlineCountTimer) return;

  onlineCountTimer = setTimeout(() => {
    onlineCountTimer = null;
    if (!io) return;
    const count = io.sockets.sockets.size;
    io.emit("stats:online", { count, ts: Date.now() });
  }, 10_000);

  onlineCountTimer.unref();
}

function cancelOnlineCountBroadcast(): void {
  if (onlineCountTimer) {
    clearTimeout(onlineCountTimer);
    onlineCountTimer = null;
  }
}

// ─── Init ─────────────────────────────────────────────────

export function initSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin:      config.allowedOrigins,
      methods:     ["GET", "POST"],
      credentials: true,
    },
    transports:        ["websocket", "polling"],
    pingTimeout:       60_000,
    pingInterval:      25_000,
    maxHttpBufferSize: 1e6,
    connectionStateRecovery: {
      // 30s max — balances UX vs security (token expiry is 1h)
      maxDisconnectionDuration: 30_000,
      // SECURITY: re-verify token on reconnect — revoked tokens cannot reconnect
      skipMiddlewares: false,
    },
  });

  // ── Auth middleware ──────────────────────────────────────
  io.use(async (socket: Socket, next: (err?: ExtendedError) => void) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) {
        return next(new Error("UNAUTHORIZED: No token provided"));
      }

      // BUG FIX: uses verifyFirebaseToken (with timeout) not authAdmin directly
      const decoded = await verifyFirebaseToken(token);

      socket.data = {
        uid:         decoded.uid,
        email:       decoded.email,
        joinedAt:    Date.now(),
        eventCount:  0,
        lastEventAt: Date.now(),
      } satisfies SocketData;

      logger.debug("Socket authenticated", {
        socketId: socket.id,
        uid:      decoded.uid.slice(0, 8),
      });

      next();
    } catch (err) {
      logger.warn("Socket auth failed", {
        socketId: socket.id,
        error:    err instanceof Error ? err.message : String(err),
      });
      next(new Error("UNAUTHORIZED: Invalid token"));
    }
  });

  // ── Connection handler ───────────────────────────────────
  io.on("connection", (socket: Socket) => {
    // BUG FIX: validate socket.data before using it
    if (!hasSocketData(socket.data)) {
      logger.error("Socket connected without valid auth data — disconnecting", {
        socketId: socket.id,
      });
      socket.disconnect(true);
      return;
    }

    const { uid } = socket.data;
    socket.join(`user:${uid}`);

    logger.info("Socket connected", {
      socketId:  socket.id,
      uid:       uid.slice(0, 8),
      transport: socket.conn.transport.name,
    });

    scheduleOnlineCountBroadcast();

    // ── Events ────────────────────────────────────────────
    socket.on("ping", () => {
      if (isSocketRateLimited(socket)) {
        socket.emit("error", { code: "RATE_LIMITED", message: "Slow down" });
        return;
      }
      socket.emit("pong", { ts: Date.now() });
    });

    socket.on("join:game", () => {
      if (isSocketRateLimited(socket)) {
        socket.emit("error", { code: "RATE_LIMITED", message: "Slow down" });
        return;
      }
      socket.join("game:global");
      socket.emit("joined:game", {
        message: "Welcome to the Undercity",
        ts:      Date.now(),
      });
    });

    socket.on("disconnect", (reason: string) => {
      logger.info("Socket disconnected", {
        socketId: socket.id,
        uid:      uid.slice(0, 8),
        reason,
      });
      scheduleOnlineCountBroadcast();
    });

    socket.on("error", (err: Error) => {
      logger.error("Socket error", {
        socketId: socket.id,
        uid:      uid.slice(0, 8),
        error:    err.message,
      });
    });

    socket.emit("connected", {
      socketId: socket.id,
      ts:       Date.now(),
      message:  "Real-time connection established",
    });
  });

  logger.info("Socket.io initialized", {
    origins: config.allowedOrigins,
  });

  return io;
}

// ─── Shutdown ─────────────────────────────────────────────

export async function closeSocket(): Promise<void> {
  cancelOnlineCountBroadcast();
  if (!io) return;

  await new Promise<void>((resolve) => {
    io!.close(() => {
      logger.info("Socket.io closed");
      io = null;
      resolve();
    });
  });
}

// ─── Accessors ────────────────────────────────────────────

export function getIO(): SocketServer {
  if (!io) {
    throw new AppError(
      "Socket.io not initialized",
      500,
      "SOCKET_NOT_INITIALIZED"
    );
  }
  return io;
}

// ─── Notify Helpers ───────────────────────────────────────
// Use SafeNotify in game systems (tick, queues) where socket
// may not be initialized yet.
// Use SocketNotify only in request handlers where app is fully booted.

export const SocketNotify = {
  toUser(uid: string, event: string, data: unknown): void {
    getIO().to(`user:${uid}`).emit(event, data);
  },

  toGame(event: string, data: unknown): void {
    getIO().to("game:global").emit(event, data);
  },

  broadcast(event: string, data: unknown): void {
    getIO().emit(event, data);
  },

  onlineCount(count: number): void {
    getIO().emit("stats:online", { count, ts: Date.now() });
  },

  crimeResult(
    uid: string,
    result: {
      success:   boolean;
      // BUG FIX: reward is string — BIGINT from Postgres returns as string
      reward:    string;
      message:   string;
      crime:     string;
      xpGained?: number;
    }
  ): void {
    this.toUser(uid, "notification", {
      type:    result.success ? "success" : "failure",
      title:   result.success ? "Crime Successful" : "Crime Failed",
      message: result.message,
      data: {
        reward:   result.reward,
        crime:    result.crime,
        xpGained: result.xpGained ?? 0,
      },
      ts: Date.now(),
    });
  },

  statUpdate(uid: string, stats: Record<string, number | string>): void {
    this.toUser(uid, "stats:update", { stats, ts: Date.now() });
  },

  system(
    uid:     string,
    message: string,
    level:   "info" | "warn" | "error" = "info"
  ): void {
    this.toUser(uid, "notification", {
      type:    "system",
      title:   "System",
      level,
      message,
      ts:      Date.now(),
    });
  },

  maintenance(message: string): void {
    this.broadcast("maintenance", { message, ts: Date.now() });
  },
} as const;

// ─── Safe Notify (null-guarded) ───────────────────────────
// Use in game tick and queues — socket may not be ready yet

export const SafeNotify = {
  onlineCount(count: number): void {
    if (!io) return;
    io.emit("stats:online", { count, ts: Date.now() });
  },

  toUser(uid: string, event: string, data: unknown): void {
    if (!io) return;
    io.to(`user:${uid}`).emit(event, data);
  },

  toGame(event: string, data: unknown): void {
    if (!io) return;
    io.to("game:global").emit(event, data);
  },
} as const;
