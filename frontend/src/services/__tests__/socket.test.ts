/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Firebase mock ─────────────────────────────────────────────
let mockCurrentUser: { getIdToken: (force?: boolean) => Promise<string> } | null = {
  getIdToken: () => Promise.resolve('fresh-firebase-token'),
};

vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: mockCurrentUser }),
}));

vi.mock('../../firebase', () => ({ auth: {} }));

// ── Socket.io mock ────────────────────────────────────────────
type EventCb = (...args: unknown[]) => void;

interface MockSocket {
  connected:  boolean;
  auth:       Record<string, unknown>;
  io: {
    on:       ReturnType<typeof vi.fn>;
    _trigger: (e: string, ...a: unknown[]) => Promise<void>;
  };
  on:         ReturnType<typeof vi.fn>;
  off:        ReturnType<typeof vi.fn>;
  once:       ReturnType<typeof vi.fn>;
  emit:       ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  _trigger:   (event: string, ...args: unknown[]) => void;
  _handlers:   Record<string, EventCb[]>;
  _ioHandlers: Record<string, EventCb[]>;
}

function makeMockSocket(): MockSocket {
  const handlers:   Record<string, EventCb[]> = {};
  const ioHandlers: Record<string, EventCb[]> = {};

  return {
    connected: false,
    auth:      {},
    io: {
      on: vi.fn((event: string, cb: EventCb) => {
        ioHandlers[event] = ioHandlers[event] ?? [];
        ioHandlers[event].push(cb);
      }),
      _trigger: async (event: string, ...args: unknown[]) => {
        for (const cb of ioHandlers[event] ?? []) {
          try { await Promise.resolve(cb(...args)); } catch { /* swallow like real socket.io */ }
        }
      },
    },
    on: vi.fn((event: string, cb: EventCb) => {
      handlers[event] = handlers[event] ?? [];
      handlers[event].push(cb);
    }),
    off: vi.fn((event: string, cb: EventCb) => {
      if (handlers[event]) {
        handlers[event] = handlers[event].filter(h => h !== cb);
      }
    }),
    once: vi.fn((event: string, cb: EventCb) => {
      handlers[event] = handlers[event] ?? [];
      handlers[event].push(cb);
    }),
    emit:       vi.fn(),
    disconnect: vi.fn(),
    _trigger: (event: string, ...args: unknown[]) => {
      handlers[event]?.forEach(cb => cb(...args));
    },
    _handlers:   handlers,
    _ioHandlers: ioHandlers,
  };
}

let currentMockSocket = makeMockSocket();

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => currentMockSocket),
}));

// ── Imports AFTER all vi.mock calls ──────────────────────────
import {
  connectSocket,
  disconnectSocket,
  getSocket,
  onNotification,
  onStatsUpdate,
  onOnlineCount,
  joinGame,
  pingServer,
} from '../socket';

import { io } from 'socket.io-client';

// ── Reset between tests ───────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  currentMockSocket = makeMockSocket();
  (io as ReturnType<typeof vi.fn>).mockReturnValue(currentMockSocket);
  mockCurrentUser = {
    getIdToken: () => Promise.resolve('fresh-firebase-token'),
  };
  disconnectSocket();
});

// ═════════════════════════════════════════════════════════════
describe('connectSocket', () => {
  it('creates socket with fresh firebase token', async () => {
    await connectSocket();

    expect(io).toHaveBeenCalledWith(
      window.location.origin,
      expect.objectContaining({
        auth:       { token: 'fresh-firebase-token' },
        transports: ['websocket', 'polling'],
      })
    );
  });

  it('returns existing socket if already connected', async () => {
    currentMockSocket.connected = true;
    await connectSocket();
    await connectSocket();
    expect(io).toHaveBeenCalledTimes(1);
  });

  it('throws when no firebase user', async () => {
    mockCurrentUser = null;
    await expect(connectSocket()).rejects.toThrow('Not authenticated');
  });

  it('attaches pending listeners to socket after connect', async () => {
    const cb = vi.fn();
    const unsub = onNotification(cb);

    await connectSocket();

    expect(currentMockSocket.on).toHaveBeenCalledWith(
      'notification',
      expect.any(Function)
    );

    unsub();
  });

  it('registers connect, disconnect, connect_error handlers', async () => {
    await connectSocket();

    const events = (currentMockSocket.on as ReturnType<typeof vi.fn>)
      .mock.calls.map((args: unknown[]) => args[0] as string);

    expect(events).toContain('connect');
    expect(events).toContain('disconnect');
    expect(events).toContain('connect_error');
  });
});

// ═════════════════════════════════════════════════════════════
describe('disconnectSocket', () => {
  it('disconnects and nulls socket', async () => {
    await connectSocket();
    expect(getSocket()).not.toBeNull();

    disconnectSocket();

    expect(currentMockSocket.disconnect).toHaveBeenCalled();
    expect(getSocket()).toBeNull();
  });

  it('is safe to call when no socket exists', () => {
    expect(() => disconnectSocket()).not.toThrow();
  });

  it('clears pending listeners on disconnect', () => {
    onNotification(vi.fn());
    disconnectSocket();
    expect(getSocket()).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════
describe('event listeners', () => {
  beforeEach(async () => {
    await connectSocket();
  });

  it('onNotification registers and unregisters notification', () => {
    const cb = vi.fn();
    const unsub = onNotification(cb);

    expect(currentMockSocket.on).toHaveBeenCalledWith('notification', expect.any(Function));

    unsub();
    expect(currentMockSocket.off).toHaveBeenCalledWith('notification', expect.any(Function));
  });

  it('onStatsUpdate registers stats:update', () => {
    onStatsUpdate(vi.fn());
    expect(currentMockSocket.on).toHaveBeenCalledWith('stats:update', expect.any(Function));
  });

  it('onOnlineCount registers stats:online', () => {
    onOnlineCount(vi.fn());
    expect(currentMockSocket.on).toHaveBeenCalledWith('stats:online', expect.any(Function));
  });

  it('joinGame emits join:game', () => {
    joinGame();
    expect(currentMockSocket.emit).toHaveBeenCalledWith('join:game');
  });

  it('pingServer emits ping and registers pong once-listener', () => {
    pingServer(vi.fn());
    expect(currentMockSocket.emit).toHaveBeenCalledWith('ping');
    expect(currentMockSocket.once).toHaveBeenCalledWith('pong', expect.any(Function));
  });
});

// ═════════════════════════════════════════════════════════════
describe('reconnect token refresh', () => {
  it('refreshes firebase token on reconnect_attempt', async () => {
    const getIdTokenSpy = vi.fn().mockResolvedValue('refreshed-token');
    mockCurrentUser = { getIdToken: getIdTokenSpy };

    await connectSocket();
    await currentMockSocket.io._trigger('reconnect_attempt');

    expect(getIdTokenSpy).toHaveBeenCalledWith(true);
  });

  it('disconnects when token refresh fails on reconnect_attempt', async () => {
    await connectSocket();

    mockCurrentUser = {
      getIdToken: vi.fn().mockRejectedValue(new Error('token expired')),
    };

    await currentMockSocket.io._trigger('reconnect_attempt');

    expect(currentMockSocket.disconnect).toHaveBeenCalled();
  });
});
