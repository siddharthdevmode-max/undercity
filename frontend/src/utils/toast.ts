// ============================================================
// TOAST SINGLETON
// Separated from Toast.tsx so context files can export
// both the manager and components without fast-refresh warnings
// ============================================================

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastData {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

type ToastListener = (toasts: ToastData[]) => void;

class ToastManager {
  private toasts: ToastData[] = [];
  private listeners: Set<ToastListener> = new Set();

  subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    listener(this.toasts);
    return () => { this.listeners.delete(listener); };
  }

  private notify() {
    this.listeners.forEach((l) => l([...this.toasts]));
  }

  show(type: ToastType, message: string, duration = 4000): string {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.toasts.push({ id, type, message, duration });
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

export const toast = {
  success: (message: string, duration?: number) =>
    manager.show("success", message, duration),
  error: (message: string, duration?: number) =>
    manager.show("error", message, duration),
  warning: (message: string, duration?: number) =>
    manager.show("warning", message, duration),
  info: (message: string, duration?: number) =>
    manager.show("info", message, duration),
  dismiss: (id: string) => manager.dismiss(id),
};

export { manager as toastManager };
