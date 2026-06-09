// ============================================================
// USER EVENTS — UNIT TESTS
// FIX: don't mutate private field — use unsubscribe pattern instead
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import { userEvents } from '../../utils/userEvents';

describe('UserEventBus', () => {

  it('subscribe returns unsubscribe function', () => {
    const cb    = vi.fn();
    const unsub = userEvents.subscribe(cb);
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('emit calls all active subscribers with stats', () => {
    const cb1   = vi.fn();
    const cb2   = vi.fn();
    const u1    = userEvents.subscribe(cb1);
    const u2    = userEvents.subscribe(cb2);

    userEvents.emit({ money: 1000, nerve: 25 });

    expect(cb1).toHaveBeenCalledWith({ money: 1000, nerve: 25 });
    expect(cb2).toHaveBeenCalledWith({ money: 1000, nerve: 25 });

    u1(); u2();
  });

  it('unsubscribed listener is not called', () => {
    const cb    = vi.fn();
    const unsub = userEvents.subscribe(cb);
    unsub();
    userEvents.emit({ money: 500 });
    expect(cb).not.toHaveBeenCalled();
  });

  it('emits partial stats update', () => {
    const cb    = vi.fn();
    const unsub = userEvents.subscribe(cb);
    userEvents.emit({ nerve: 15 });
    expect(cb).toHaveBeenCalledWith({ nerve: 15 });
    unsub();
  });

  it('multiple emits call subscriber each time', () => {
    const cb    = vi.fn();
    const unsub = userEvents.subscribe(cb);

    userEvents.emit({ money: 100 });
    userEvents.emit({ money: 200 });
    userEvents.emit({ money: 300 });

    expect(cb).toHaveBeenCalledTimes(3);
    unsub();
  });

  it('emit with empty object does not throw', () => {
    const cb    = vi.fn();
    const unsub = userEvents.subscribe(cb);
    expect(() => userEvents.emit({})).not.toThrow();
    unsub();
  });

  it('can have multiple independent subscriptions', () => {
    const results: number[] = [];
    const u1 = userEvents.subscribe(() => results.push(1));
    const u2 = userEvents.subscribe(() => results.push(2));

    userEvents.emit({ money: 0 });

    expect(results).toContain(1);
    expect(results).toContain(2);
    expect(results.length).toBe(2);

    u1(); u2();
  });

  it('second unsubscribe call is safe (idempotent)', () => {
    const cb    = vi.fn();
    const unsub = userEvents.subscribe(cb);
    unsub();
    expect(() => unsub()).not.toThrow();
  });

  it('subscriber added after emit does not receive past events', () => {
    userEvents.emit({ money: 9999 });
    const cb    = vi.fn();
    const unsub = userEvents.subscribe(cb);
    expect(cb).not.toHaveBeenCalled();
    unsub();
  });
});
