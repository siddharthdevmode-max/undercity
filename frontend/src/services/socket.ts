import { io, Socket } from "socket.io-client";
import { getAuth } from "firebase/auth";

const SOCKET_URL = window.location.origin;

let socket: Socket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

// ── Pending listener registry ──────────────────────────────
// Listeners registered before socket connects are queued here
// and attached when the socket is created.

type ListenerEntry = { event: string; cb: (...args: unknown[]) => void };
const pendingListeners: ListenerEntry[] = [];

function attachPendingListeners(): void {
  if (!socket) return;
  for (const { event, cb } of pendingListeners) {
    socket.on(event, cb);
  }
}

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

  // Attach any listeners registered before connect
  attachPendingListeners();

  socket.on("connect", () => {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  });

  socket.on("disconnect", (reason) => {
    if (reason === "io server disconnect") {
      reconnectTimer = setTimeout(() => {
        connectSocket().catch(console.error);
      }, 5000);
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
  // Clear pending listeners on logout so they don't pile up
  pendingListeners.length = 0;
}

export function getSocket(): Socket | null { return socket; }

// ── Safe event registration ────────────────────────────────
// If socket exists: attach immediately
// If not: queue for when socket connects

function safeOn(event: string, cb: (...args: unknown[]) => void): () => void {
  if (socket) {
    socket.on(event, cb);
  } else {
    pendingListeners.push({ event, cb });
  }
  return () => {
    socket?.off(event, cb);
    const idx = pendingListeners.findIndex(
      (e) => e.event === event && e.cb === cb
    );
    if (idx !== -1) pendingListeners.splice(idx, 1);
  };
}

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
  return safeOn("notification", cb as (...args: unknown[]) => void);
}

export function onStatsUpdate(cb: (s: StatsUpdate) => void): () => void {
  return safeOn("stats:update", cb as (...args: unknown[]) => void);
}

export function onOnlineCount(cb: (o: OnlineCount) => void): () => void {
  return safeOn("stats:online", cb as (...args: unknown[]) => void);
}

export function joinGame(): void { socket?.emit("join:game"); }

export function pingServer(cb: (latency: number) => void): void {
  const start = Date.now();
  socket?.emit("ping");
  socket?.once("pong", () => cb(Date.now() - start));
}
