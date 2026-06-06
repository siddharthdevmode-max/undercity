import { useEffect, useRef } from "react";
import { useAuth } from "./useAuth";
import {
  connectSocket,
  disconnectSocket,
  onNotification,
  onStatsUpdate,
  onOnlineCount,
  type GameNotification,
  type StatsUpdate,
  type OnlineCount,
} from "../services/socket";
import { toast } from "../utils/toast";

// ============================================================
// useSocket — Auto-connect/disconnect with auth lifecycle
// ============================================================

export function useSocket() {
  const { user } = useAuth();
  const connected = useRef(false);

  useEffect(() => {
    if (!user) {
      disconnectSocket();
      connected.current = false;
      return;
    }

    if (connected.current) return;

    connectSocket()
      .then(() => {
        connected.current = true;
      })
      .catch((err: unknown) => {
        toast.error("Connection failed. Retrying...");
        console.error("Socket connect failed:", err);
      });

    return () => {
      disconnectSocket();
      connected.current = false;
    };
  }, [user]);
}

// ── useNotifications ────────────────────────────────────────
export function useNotifications() {
  useEffect(() => {
    const unsub = onNotification((n: GameNotification) => {
      switch (n.type) {
        case "success":
          toast.success(n.message);
          break;
        case "failure":
          toast.error(n.message);
          break;
        case "info":
          toast.info(n.message);
          break;
        case "system":
          toast.warning(n.message);
          break;
      }
    });

    return unsub;
  }, []);
}

// ── useOnlineCount ──────────────────────────────────────────
export function useOnlineCount(cb: (count: number) => void) {
  const cbRef = useRef(cb);

  useEffect(() => {
    cbRef.current = cb;
  });

  useEffect(() => {
    const unsub = onOnlineCount((o: OnlineCount) => {
      cbRef.current(o.count);
    });

    return unsub;
  }, []);
}

// ── useStatsUpdate ──────────────────────────────────────────
export function useStatsUpdate(cb: (stats: Record<string, number>) => void) {
  const cbRef = useRef(cb);

  useEffect(() => {
    cbRef.current = cb;
  });

  useEffect(() => {
    const unsub = onStatsUpdate((s: StatsUpdate) => {
      cbRef.current(s.stats);
    });

    return unsub;
  }, []);
}
