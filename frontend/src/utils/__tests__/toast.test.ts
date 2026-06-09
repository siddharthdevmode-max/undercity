// ============================================================
// TOAST — UNIT TESTS
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toastManager, toast, showToast, dismissToast } from '../../utils/toast';

// Helper — clear all toasts between tests
function clearToasts() {
  const toasts = (toastManager as unknown as { toasts: { id: string }[] }).toasts;
  [...toasts].forEach(t => toastManager.dismiss(t.id));
}

describe('toastManager', () => {
  beforeEach(() => clearToasts());

  it('subscribe calls listener immediately with current toasts', () => {
    const cb = vi.fn();
    const unsub = toastManager.subscribe(cb);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(Array.isArray(cb.mock.calls[0][0])).toBe(true);
    unsub();
  });

  it('subscribe returns an unsubscribe function', () => {
    const cb    = vi.fn();
    const unsub = toastManager.subscribe(cb);
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('show notifies subscribers with new toast', () => {
    const cb    = vi.fn();
    const unsub = toastManager.subscribe(cb);
    cb.mockClear();
    toastManager.show('success', 'Hello!', 0);
    expect(cb).toHaveBeenCalled();
    const toasts = cb.mock.calls[0][0] as { message: string; type: string }[];
    const added  = toasts.find(t => t.message === 'Hello!');
    expect(added).toBeDefined();
    expect(added!.type).toBe('success');
    unsub();
  });

  it('show returns a string id', () => {
    const id = toastManager.show('info', 'Test', 0);
    expect(typeof id).toBe('string');
    expect(id.startsWith('toast-')).toBe(true);
  });

  it('dismiss removes toast by id', () => {
    const cb    = vi.fn();
    const unsub = toastManager.subscribe(cb);
    cb.mockClear();
    const id = toastManager.show('info', 'To dismiss', 0);
    cb.mockClear();
    toastManager.dismiss(id);
    const latest = cb.mock.calls[0][0] as { id: string }[];
    expect(latest.find(t => t.id === id)).toBeUndefined();
    unsub();
  });

  it('generated toast ids are unique', () => {
    const id1 = toastManager.show('success', 'First',  0);
    const id2 = toastManager.show('success', 'Second', 0);
    expect(id1).not.toBe(id2);
  });

  it('unsubscribed listener is not called', () => {
    const cb    = vi.fn();
    const unsub = toastManager.subscribe(cb);
    unsub();
    cb.mockClear();
    toastManager.show('success', 'After unsub', 0);
    expect(cb).not.toHaveBeenCalled();
  });

  it('multiple subscribers all receive updates', () => {
    const cb1    = vi.fn();
    const cb2    = vi.fn();
    const unsub1 = toastManager.subscribe(cb1);
    const unsub2 = toastManager.subscribe(cb2);
    cb1.mockClear();
    cb2.mockClear();
    toastManager.show('warning', 'Broadcast', 0);
    expect(cb1).toHaveBeenCalled();
    expect(cb2).toHaveBeenCalled();
    unsub1();
    unsub2();
  });

  it('auto-dismisses after duration', async () => {
    vi.useFakeTimers();
    const cb    = vi.fn();
    const unsub = toastManager.subscribe(cb);
    cb.mockClear();
    const id = toastManager.show('info', 'Temporary', 500);
    cb.mockClear();
    vi.advanceTimersByTime(600);
    const latest = cb.mock.calls[cb.mock.calls.length - 1]?.[0] as { id: string }[] | undefined;
    expect(latest?.find(t => t.id === id)).toBeUndefined();
    unsub();
    vi.useRealTimers();
  });
});

describe('toast helpers', () => {
  beforeEach(() => clearToasts());
  afterEach(() => clearToasts());

  it('toast.success adds a success toast and returns id', () => {
    const id = toast.success('Done!', 0);
    expect(typeof id).toBe('string');
  });

  it('toast.error adds an error toast', () => {
    const cb    = vi.fn();
    const unsub = toastManager.subscribe(cb);
    cb.mockClear();
    toast.error('Oops!', 0);
    const toasts = cb.mock.calls[0][0] as { type: string; message: string }[];
    expect(toasts.find(t => t.message === 'Oops!')!.type).toBe('error');
    unsub();
  });

  it('toast.warning adds a warning toast', () => {
    const cb    = vi.fn();
    const unsub = toastManager.subscribe(cb);
    cb.mockClear();
    toast.warning('Watch out!', 0);
    const toasts = cb.mock.calls[0][0] as { type: string; message: string }[];
    expect(toasts.find(t => t.message === 'Watch out!')!.type).toBe('warning');
    unsub();
  });

  it('toast.info adds an info toast', () => {
    const cb    = vi.fn();
    const unsub = toastManager.subscribe(cb);
    cb.mockClear();
    toast.info('FYI', 0);
    const toasts = cb.mock.calls[0][0] as { type: string; message: string }[];
    expect(toasts.find(t => t.message === 'FYI')!.type).toBe('info');
    unsub();
  });

  it('toast.dismiss removes toast by id', () => {
    const id = toast.success('To remove', 0);
    const cb  = vi.fn();
    const unsub = toastManager.subscribe(cb);
    cb.mockClear();
    toast.dismiss(id);
    const latest = cb.mock.calls[0][0] as { id: string }[];
    expect(latest.find(t => t.id === id)).toBeUndefined();
    unsub();
  });
});

describe('showToast', () => {
  beforeEach(() => clearToasts());
  afterEach(() => clearToasts());

  it('showToast(type, message) works', () => {
    const cb    = vi.fn();
    const unsub = toastManager.subscribe(cb);
    cb.mockClear();
    showToast('success', 'Via showToast', 0);
    const toasts = cb.mock.calls[0][0] as { type: string; message: string }[];
    const t      = toasts.find(t => t.message === 'Via showToast');
    expect(t!.type).toBe('success');
    unsub();
  });

  it('showToast(message, type) backward-compat works', () => {
    const cb    = vi.fn();
    const unsub = toastManager.subscribe(cb);
    cb.mockClear();
    showToast('Backward compat', 'error', 0);
    const toasts = cb.mock.calls[0][0] as { type: string; message: string }[];
    const t      = toasts.find(t => t.message === 'Backward compat');
    expect(t!.type).toBe('error');
    unsub();
  });

  it('showToast(message) defaults to info', () => {
    const cb    = vi.fn();
    const unsub = toastManager.subscribe(cb);
    cb.mockClear();
    showToast('Just a message', 0);
    const toasts = cb.mock.calls[0][0] as { type: string; message: string }[];
    const t      = toasts.find(t => t.message === 'Just a message');
    expect(t!.type).toBe('info');
    unsub();
  });

  it('showToast returns a string id', () => {
    const id = showToast('success', 'Test', 0);
    expect(typeof id).toBe('string');
  });
});

describe('dismissToast', () => {
  beforeEach(() => clearToasts());

  it('dismissToast removes toast by id', () => {
    const id  = toast.success('To dismiss', 0);
    const cb  = vi.fn();
    const unsub = toastManager.subscribe(cb);
    cb.mockClear();
    dismissToast(id);
    const latest = cb.mock.calls[0][0] as { id: string }[];
    expect(latest.find(t => t.id === id)).toBeUndefined();
    unsub();
  });
});
