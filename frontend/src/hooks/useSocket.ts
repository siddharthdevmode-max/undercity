import { useEffect, useRef, useCallback } from "react";
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
import { showToast } from "../utils/toast";

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
      .catch((err) => {
        console.error("Socket connect failed:", err);
      });

    return () => {
      disconnectSocket();
      connected.current = false;
    };
  }, [user]);
}

// ── useNotifications — Wire toast to socket notifications ──
export function useNotifications() {
  useEffect(() => {
    const unsub = onNotification((n: GameNotification) => {
      showToast(n.message, n.type === "success" ? "success" : "error");
    });
    return unsub;
  }, []);
}

// ── useOnlineCount — Get live online player count ──────────
export function useOnlineCount(
  cb: (count: number) => void
) {
  const cbRef = useRef(cb);
  cbRef.current = cb;

  useEffect(() => {
    const unsub = onOnlineCount((o: OnlineCount) => {
      cbRef.current(o.count);
    });
    return unsub;
  }, []);
}

// ── useStatsUpdate — React to live stat changes ────────────
export function useStatsUpdate(
  cb: (stats: Record<string, number>) => void
) {
  const cbRef = useRef(cb);
  cbRef.current = cb;

  useEffect(() => {
    const unsub = onStatsUpdate((s: StatsUpdate) => {
      cbRef.current(s.stats);
    });
    return unsub;
  }, []);
}
