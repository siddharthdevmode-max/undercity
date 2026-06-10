import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/database", () => ({
  pool: { query: vi.fn() },
}));

vi.mock("../config/redis", () => ({
  redis: {
    get:  vi.fn(),
    set:  vi.fn(),
    incr: vi.fn(),
  },
  default: {
    get:  vi.fn(),
    set:  vi.fn(),
    incr: vi.fn(),
  },
}));

vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../utils/alerts", () => ({
  Alerts: {
    gameTickFailed: vi.fn(),
    gameTickSlow:   vi.fn(),
  },
}));

vi.mock("../config/socket", () => ({
  SafeNotify: { onlineCount: vi.fn() },
}));

vi.mock("../config", () => ({
  config: {
    isTest:       true,
    isProduction: false,
    game: {
      tickIntervalMs: 60_000,
      energyRegenSec: 300,
    },
  },
}));

vi.mock("../services/nerveService", () => ({
  regenNerveByTier: vi.fn().mockResolvedValue({
    player: 5,
    citizen: 2,
    contributor: 1,
    total: 8,
  }),
}));

import { pool } from "../config/database";
import { redis } from "../config/redis";
import { SafeNotify } from "../config/socket";
import { logger } from "../utils/logger";
import {
  runGameTick,
  startGameTick,
  stopGameTick,
  getTickInfo,
} from "../services/gameTick";

beforeEach(() => {
  vi.resetAllMocks();
});

function setupRedisMocks() {
  vi.mocked(redis.get).mockResolvedValue(null);
  vi.mocked(redis.set).mockResolvedValue("OK" as never);
  vi.mocked(redis.incr).mockResolvedValue(1 as never);
}

function setupPoolMocks(rowCount = 5) {
  vi.mocked(pool.query).mockResolvedValue({
    rows: [{ count: "10" }],
    rowCount,
  } as never);
}

describe("runGameTick", () => {
  it("runs and returns a tick result", async () => {
    setupPoolMocks();
    setupRedisMocks();

    const result = await runGameTick();

    expect(result).not.toBeNull();
    expect(result).toHaveProperty("tickNumber");
    expect(result).toHaveProperty("durationMs");
    expect(result).toHaveProperty("energy");
    expect(result).toHaveProperty("nerve");
    expect(result).toHaveProperty("life");
    expect(result).toHaveProperty("happiness");
    expect(result).toHaveProperty("partialFailures");
  });

  it("returns null when previous tick still running", async () => {
    setupPoolMocks();
    setupRedisMocks();

    const p1 = runGameTick();
    const p2 = runGameTick();

    const [r1, r2] = await Promise.all([p1, p2]);
    const nullCount = [r1, r2].filter((r) => r === null).length;
    expect(nullCount).toBe(1);
  });

  it("records partial failures when one sub-task fails", async () => {
    setupRedisMocks();

    vi.mocked(pool.query)
      .mockRejectedValueOnce(new Error("energy fail"))
      .mockResolvedValueOnce({ rows: [], rowCount: 3 } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 2 } as never)
      .mockResolvedValueOnce({ rows: [{ count: "5" }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const result = await runGameTick();
    expect(result).not.toBeNull();
    expect(result!.partialFailures.length).toBeGreaterThan(0);
  });

  it("returns null when circuit breaker is open after 3 outer failures", async () => {
    setupPoolMocks();
    setupRedisMocks();

    vi.mocked(SafeNotify.onlineCount).mockImplementation(() => {
      throw new Error("notify failed");
    });

    await runGameTick();
    await runGameTick();
    await runGameTick();

    const result = await runGameTick();
    expect(result).toBeNull();
  });
});

describe("startGameTick / stopGameTick", () => {
  it("startGameTick skips in test mode", () => {
    startGameTick();
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.stringContaining("Skipping game tick in test mode")
    );
  });

  it("stopGameTick handles no active tick gracefully", () => {
    expect(() => stopGameTick()).not.toThrow();
  });
});

describe("getTickInfo", () => {
  it("returns tick info from Redis", async () => {
    vi.mocked(redis.get)
      .mockResolvedValueOnce("42")
      .mockResolvedValueOnce("2026-06-10T00:00:00.000Z")
      .mockResolvedValueOnce(String(Date.now()))
      .mockResolvedValueOnce(String(Date.now()))
      .mockResolvedValueOnce(String(Date.now()));

    const info = await getTickInfo();
    expect(info).toHaveProperty("tickCount");
    expect(info).toHaveProperty("isRunning");
    expect(info).toHaveProperty("circuitOpen");
    expect(info.tickCount).toBe(42);
  });

  it("returns safe defaults on Redis error", async () => {
    vi.mocked(redis.get).mockRejectedValue(new Error("Redis down"));

    const info = await getTickInfo();
    expect(info.tickCount).toBe(0);
    expect(info.lastTickAt).toBeNull();
  });
});
