// ============================================================
// USER EVENTS — UNIT TESTS
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userEvents } from '../../utils/userEvents';

describe('UserEventBus', () => {
  beforeEach(() => {
    // Clear listeners between tests by creating fresh instance
    userEvents['listeners'] = new Set();
  });

  it('subscribe returns unsubscribe function', () => {
    const cb   = vi.fn();
    const unsub = userEvents.subscribe(cb);
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('emit calls all subscribers with stats', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    userEvents.subscribe(cb1);
    userEvents.subscribe(cb2);
    userEvents.emit({ money: 1000, nerve: 25 });
    expect(cb1).toHaveBeenCalledWith({ money: 1000, nerve: 25 });
    expect(cb2).toHaveBeenCalledWith({ money: 1000, nerve: 25 });
  });

  it('unsubscribed listener is not called', () => {
    const cb    = vi.fn();
    const unsub = userEvents.subscribe(cb);
    unsub();
    userEvents.emit({ money: 500 });
    expect(cb).not.toHaveBeenCalled();
  });

  it('emits partial stats update', () => {
    const cb = vi.fn();
    userEvents.subscribe(cb);
    userEvents.emit({ nerve: 15 });
    expect(cb).toHaveBeenCalledWith({ nerve: 15 });
  });

  it('multiple emits call subscriber each time', () => {
    const cb = vi.fn();
    userEvents.subscribe(cb);
    userEvents.emit({ money: 100 });
    userEvents.emit({ money: 200 });
    userEvents.emit({ money: 300 });
    expect(cb).toHaveBeenCalledTimes(3);
  });

  it('emit with empty object does not throw', () => {
    const cb = vi.fn();
    userEvents.subscribe(cb);
    expect(() => userEvents.emit({})).not.toThrow();
  });

  it('can have multiple independent subscriptions', () => {
    const results: number[] = [];
    userEvents.subscribe(() => results.push(1));
    userEvents.subscribe(() => results.push(2));
    userEvents.emit({ money: 0 });
    expect(results).toContain(1);
    expect(results).toContain(2);
    expect(results.length).toBe(2);
  });
});
