import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/database", () => ({
  pool: { end: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("../config/redis", () => ({
  default: { quit: vi.fn().mockResolvedValue(undefined) },
  redis:   { quit: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("../utils/logger", () => ({
  logger: {
    info:  vi.fn(),
    warn:  vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../utils/alerts", () => ({
  Alerts: {
    gracefulShutdown: vi.fn(),
    serverStarted:    vi.fn(),
  },
}));

vi.mock("@sentry/node", () => ({
  captureException: vi.fn(),
}));

// Mock dynamic imports used in shutdown
vi.mock("../queues/index", () => ({
  closeQueues: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../queues/workers", () => ({
  closeWorkers: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/gameTick", () => ({
  stopGameTick: vi.fn(),
}));

import {
  trackRequests,
  isServerShuttingDown,
  registerCleanup,
} from "../utils/gracefulShutdown";
import type { IncomingMessage, ServerResponse } from "http";

beforeEach(() => vi.clearAllMocks());

function makeRes(): ServerResponse {
  const handlers: Record<string, Function> = {};
  return {
    on: vi.fn((event: string, handler: Function) => {
      handlers[event] = handler;
    }),
    _trigger: (event: string) => handlers[event]?.(),
  } as unknown as ServerResponse;
}

describe("trackRequests", () => {
  it("calls next()", () => {
    const req  = {} as IncomingMessage;
    const res  = makeRes();
    const next = vi.fn();
    trackRequests(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("attaches finish listener", () => {
    const req  = {} as IncomingMessage;
    const res  = makeRes();
    const next = vi.fn();
    trackRequests(req, res, next);
    expect(res.on).toHaveBeenCalledWith("finish", expect.any(Function));
  });

  it("attaches close listener", () => {
    const req  = {} as IncomingMessage;
    const res  = makeRes();
    const next = vi.fn();
    trackRequests(req, res, next);
    expect(res.on).toHaveBeenCalledWith("close", expect.any(Function));
  });

  it("does not double-decrement on finish + close", () => {
    const req     = {} as IncomingMessage;
    const res     = makeRes() as ServerResponse & { _trigger: (e: string) => void };
    const next    = vi.fn();
    trackRequests(req, res, next);
    (res as unknown as { _trigger: (e: string) => void })._trigger("finish");
    (res as unknown as { _trigger: (e: string) => void })._trigger("close");
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe("isServerShuttingDown", () => {
  it("returns boolean", () => {
    expect(typeof isServerShuttingDown()).toBe("boolean");
  });

  it("returns false when not shutting down", () => {
    expect(isServerShuttingDown()).toBe(false);
  });
});

describe("registerCleanup", () => {
  it("accepts a cleanup function without throwing", () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    expect(() => registerCleanup(fn)).not.toThrow();
  });

  it("accepts multiple cleanup functions", () => {
    const fn1 = vi.fn().mockResolvedValue(undefined);
    const fn2 = vi.fn().mockResolvedValue(undefined);
    const fn3 = vi.fn().mockResolvedValue(undefined);
    expect(() => {
      registerCleanup(fn1);
      registerCleanup(fn2);
      registerCleanup(fn3);
    }).not.toThrow();
  });
});
