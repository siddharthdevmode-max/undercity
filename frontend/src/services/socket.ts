import { io, Socket } from "socket.io-client";
import { getAuth } from "firebase/auth";
import { logger } from "../utils/toast"; // reuse toast for notifications

// ============================================================
// SOCKET.IO CLIENT — UNDERCITY REAL-TIME
// Auto-connects with Firebase token
// Auto-reconnects on token expiry
// ============================================================

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace("/api", "")
  || "http://localhost:5000"\;

let socket: Socket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export async function connectSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) throw new Error("Not authenticated");

  const token = await user.getIdToken();

  socket = io(SOCKET_URL, {
    auth:       { token },
    transports: ["websocket", "polling"],
    reconnectionAttempts: 10,
    reconnectionDelay:    2000,
    timeout:              10000,
  });

  // ── Event Handlers ─────────────────────────────────────
  socket.on("connect", () => {
    console.info("🔌 Socket connected:", socket?.id);
    socket?.emit("join:game");
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  });

  socket.on("connected", (data: { message: string }) => {
    console.info("✅ Socket handshake:", data.message);
  });

  socket.on("disconnect", (reason) => {
    console.warn("🔌 Socket disconnected:", reason);
    // Auto-reconnect after token refresh if auth error
    if (reason === "io server disconnect") {
      reconnectTimer = setTimeout(() => {
        reconnectSocket();
      }, 3000);
    }
  });

  socket.on("connect_error", (err) => {
    console.error("🔌 Socket connection error:", err.message);
  });

  return socket;
}

export async function reconnectSocket(): Promise<void> {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  await connectSocket();
}

export function disconnectSocket(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}

// ── Typed event listeners ─────────────────────────────────

export interface GameNotification {
  type:    "success" | "failure" | "system" | "info";
  title:   string;
  message: string;
  data?:   Record<string, unknown>;
  ts:      number;
}

export interface StatsUpdate {
  stats: Record<string, number>;
  ts:    number;
}

export interface OnlineCount {
  count: number;
  ts:    number;
}

export function onNotification(
  cb: (n: GameNotification) => void
): () => void {
  socket?.on("notification", cb);
  return () => socket?.off("notification", cb);
}

export function onStatsUpdate(
  cb: (s: StatsUpdate) => void
): () => void {
  socket?.on("stats:update", cb);
  return () => socket?.off("stats:update", cb);
}

export function onOnlineCount(
  cb: (o: OnlineCount) => void
): () => void {
  socket?.on("stats:online", cb);
  return () => socket?.off("stats:online", cb);
}
