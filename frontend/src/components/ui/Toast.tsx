import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import "../../styles/Toast.css";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastData {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

// ============================================================
// Global Toast Manager (singleton pattern)
// ============================================================

type ToastListener = (toasts: ToastData[]) => void;

class ToastManager {
  private toasts: ToastData[] = [];
  private listeners: Set<ToastListener> = new Set();

  subscribe(listener: ToastListener) {
    this.listeners.add(listener);
    listener(this.toasts);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l([...this.toasts]));
  }

  show(type: ToastType, message: string, duration = 4000) {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const toast: ToastData = { id, type, message, duration };
    this.toasts.push(toast);
    this.notify();

    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
    return id;
  }

  dismiss(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }
}

const manager = new ToastManager();

// ============================================================
// Public API - use these anywhere in the app
// ============================================================

export const toast = {
  success: (message: string, duration?: number) => manager.show("success", message, duration),
  error: (message: string, duration?: number) => manager.show("error", message, duration),
  warning: (message: string, duration?: number) => manager.show("warning", message, duration),
  info: (message: string, duration?: number) => manager.show("info", message, duration),
  dismiss: (id: string) => manager.dismiss(id),
};

// ============================================================
// Toast Container Component (mount once in App.tsx)
// ============================================================

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  useEffect(() => {
    const unsubscribe = manager.subscribe(setToasts);
    return () => { unsubscribe(); };
  }, []);

  const handleDismiss = useCallback((id: string) => {
    manager.dismiss(id);
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="toast-container">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={handleDismiss} />
      ))}
    </div>,
    document.body
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastData; onDismiss: (id: string) => void }) {
  const [isLeaving, setIsLeaving] = useState(false);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  const icons: Record<ToastType, string> = {
    success: "✅",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️",
  };

  return (
    <div className={`toast toast-${toast.type} ${isLeaving ? "toast-leaving" : ""}`}>
      <span className="toast-icon">{icons[toast.type]}</span>
      <span className="toast-message">{toast.message}</span>
      <button className="toast-close" onClick={handleClose} aria-label="Dismiss">×</button>
    </div>
  );
}
