import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { toastManager } from "../../utils/toast";
import type { ToastData, ToastType } from "../../utils/toast";
import "../../styles/Toast.css";

// ============================================================
// TOAST CONTAINER + TOAST ITEM
// Only component exports in this file.
// toast singleton lives in utils/toast.ts
// ============================================================

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  useEffect(() => {
    return toastManager.subscribe(setToasts);
  }, []);

  const handleDismiss = useCallback((id: string) => {
    toastManager.dismiss(id);
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <div
        className="toast-container"
        role="status"
        aria-live="polite"
        aria-atomic="false"
        aria-label="Notifications"
      >
        {toasts
          .filter((t) => t.type !== "error")
          .map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={handleDismiss} />
          ))}
      </div>

      <div
        className="toast-container toast-container-errors"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        aria-label="Error notifications"
      >
        {toasts
          .filter((t) => t.type === "error")
          .map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={handleDismiss} />
          ))}
      </div>
    </>,
    document.body
  );
}

function ToastItem({
  toast: t,
  onDismiss,
}: {
  toast: ToastData;
  onDismiss: (id: string) => void;
}) {
  const [isLeaving, setIsLeaving] = useState(false);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => onDismiss(t.id), 300);
  };

  const icons: Record<ToastType, string> = {
    success: "✅",
    error:   "❌",
    warning: "⚠️",
    info:    "ℹ️",
  };

  const labels: Record<ToastType, string> = {
    success: "Success",
    error:   "Error",
    warning: "Warning",
    info:    "Information",
  };

  return (
    <div
      className={`toast toast-${t.type} ${isLeaving ? "toast-leaving" : ""}`}
      role="none"
    >
      <span className="toast-icon" aria-hidden="true">{icons[t.type]}</span>
      <span className="toast-message">
        <span className="visually-hidden">{labels[t.type]}: </span>
        {t.message}
      </span>
      <button
        className="toast-close"
        onClick={handleClose}
        aria-label={`Dismiss ${labels[t.type].toLowerCase()} notification`}
      >
        x
      </button>
    </div>
  );
}
