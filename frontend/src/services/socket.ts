import { io, Socket } from "socket.io-client";
import { getAuth } from "firebase/auth";

// SOCKET.IO CLIENT - UNDERCITY REAL-TIME

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace("/api", "")
  || "http://localhost:5000";

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
    reconnectionAttempts: 5,
    reconnectionDelay:    2000,
  });

  socket.on("connect", () => {
    console.info("[Socket] Connected:", socket?.id);
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  });

  socket.on("disconnect", (reason) => {
    console.warn("[Socket] Disconnected:", reason);
    if (reason === "io server disconnect") {
      reconnectTimer = setTimeout(() => { connectSocket().catch(console.error); }, 5000);
    }
  });

  socket.on("connect_error", (err) => {
    console.error("[Socket] Connection error:", err.message);
  });

  return socket;
}

export function disconnectSocket(): void {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (socket) { socket.disconnect(); socket = null; }
}

export function getSocket(): Socket | null { return socket; }

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

export function onNotification(cb: (n: GameNotification) => void): () => void {
  socket?.on("notification", cb);
  return () => { socket?.off("notification", cb); };
}

export function onStatsUpdate(cb: (s: StatsUpdate) => void): () => void {
  socket?.on("stats:update", cb);
  return () => { socket?.off("stats:update", cb); };
}

export function onOnlineCount(cb: (o: OnlineCount) => void): () => void {
  socket?.on("stats:online", cb);
  return () => { socket?.off("stats:online", cb); };
}

export function joinGame(): void { socket?.emit("join:game"); }

export function pingServer(cb: (latency: number) => void): void {
  const start = Date.now();
  socket?.emit("ping");
  socket?.once("pong", () => cb(Date.now() - start));
}
