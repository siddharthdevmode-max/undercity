import { useEffect } from 'react';
import { Modal } from './Modal';
import '../../styles/ConfirmModal.css';

// ============================================================
// CONFIRM MODAL
// Built on top of Modal — adds confirm/cancel actions
// Enter key triggers confirm
// ============================================================

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'info',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  // Enter key triggers confirm
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') onConfirm();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onConfirm]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      className={`confirm-${variant}`}
      titleId="confirm-modal-title"
    >
      <p className="confirm-message" id="confirm-modal-desc">
        {message}
      </p>
      <div className="confirm-actions">
        <button
          className="confirm-btn confirm-btn-cancel"
          onClick={onCancel}
        >
          {cancelText}
        </button>
        <button
          className={`confirm-btn confirm-btn-confirm confirm-btn-${variant}`}
          onClick={onConfirm}
          autoFocus
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}
