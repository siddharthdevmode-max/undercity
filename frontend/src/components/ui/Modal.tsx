import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import '../../styles/ConfirmModal.css';

// ============================================================
// MODAL
// Reusable modal wrapper with full a11y
// - role="dialog", aria-modal, aria-labelledby
// - Focus trap (Tab cycles within)
// - ESC to close
// - Click overlay to close
// - Restores focus on close
// ============================================================

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  closeOnOverlayClick?: boolean;
  className?: string;
  titleId?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  closeOnOverlayClick = true,
  className = '',
  titleId = 'modal-title',
}: ModalProps) {
  const containerRef = useFocusTrap<HTMLDivElement>(isOpen);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="confirm-overlay"
      onClick={closeOnOverlayClick ? onClose : undefined}
    >
      <div
        ref={containerRef}
        className={`confirm-modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id={titleId} className="confirm-title">{title}</h3>
        {children}
      </div>
    </div>,
    document.body
  );
}
