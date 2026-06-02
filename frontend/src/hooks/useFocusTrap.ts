import { useEffect, useRef } from 'react';

// ============================================================
// useFocusTrap
// Traps keyboard focus inside the given container while active
// Auto-focuses the first focusable element on open
// Restores focus to the previously focused element on close
// ============================================================

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const containerRef = useRef<T | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    // Remember what was focused before opening
    previouslyFocused.current = document.activeElement as HTMLElement;

    const container = containerRef.current;
    if (!container) return;

    // Auto-focus first focusable element (or container itself)
    const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    const first = focusables[0];
    if (first) {
      first.focus();
    } else {
      container.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => !el.hasAttribute('disabled'));

      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const firstEl = focusable[0];
      const lastEl  = focusable[focusable.length - 1];

      if (e.shiftKey) {
        // Shift+Tab on first → wrap to last
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        // Tab on last → wrap to first
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus to whatever opened the modal
      previouslyFocused.current?.focus();
    };
  }, [active]);

  return containerRef;
}
