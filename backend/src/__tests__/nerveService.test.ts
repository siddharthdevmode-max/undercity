// ============================================================
// NERVE SERVICE TESTS
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/database", () => ({
  pool: { query: vi.fn() },
}));

vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../config/tiers", () => ({
  TIER_CONFIG: {
    player:      { nerveRegenSec: 300 },
    citizen:     { nerveRegenSec: 300 },
    contributor: { nerveRegenSec: 180 },
  },
}));

import { pool } from "../config/database";

const { regenNerveByTier, getNerveStatus, deductNerve } =
  await import("../services/nerveService");

describe("regenNerveByTier", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns totals for both tier groups", async () => {
    vi.mocked(pool.query).mockResolvedValue({ rowCount: 5, rows: [] } as never);

    const result = await regenNerveByTier();

    expect(result).toHaveProperty("player_citizen");
    expect(result).toHaveProperty("contributor");
    expect(result.total).toBe(10); // 5 each for 2 groups
  });

  it("handles partial tier failure gracefully", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rowCount: 3, rows: [] } as never)
      .mockRejectedValueOnce(new Error("DB error"));

    const result = await regenNerveByTier();

    expect(result.player_citizen).toBe(3);
    expect(result.contributor).toBe(0);
    expect(result.total).toBe(3);
  });
});

describe("deductNerve", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns success=true when nerve deducted", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ nerve: 28 }],
      rows:     [{ nerve: 28 }],
    } as never);

    const result = await deductNerve(1, 2);
    expect(result.success).toBe(true);
    expect(result.currentNerve).toBe(28);
  });

  it("returns success=false when not enough nerve", async () => {
    // First query: rowCount = 0 (not enough nerve)
    vi.mocked(pool.query).mockResolvedValueOnce({ rowCount: 0, rows: [] } as never);
    // Second query: fetch current nerve
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ nerve: 1 }] } as never);

    const result = await deductNerve(1, 10);
    expect(result.success).toBe(false);
    expect(result.currentNerve).toBe(1);
  });
});

describe("getNerveStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null if user not found", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);
    const result = await getNerveStatus(999);
    expect(result).toBeNull();
  });

  it("returns correct nerve status", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{
        nerve:             25,
        max_nerve:         30,
        user_tier:         "player",
        last_nerve_update: new Date(Date.now() - 60_000).toISOString(),
      }],
    } as never);

    const result = await getNerveStatus(1);
    expect(result).not.toBeNull();
    expect(result!.nerve).toBe(25);
    expect(result!.maxNerve).toBe(30);
    expect(result!.tier).toBe("player");
    expect(result!.regenRateSec).toBe(300);
    expect(result!.secondsUntilNext).toBeGreaterThan(0);
  });

  it("secondsUntilNext is 0 when nerve is full", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{
        nerve:             30,
        max_nerve:         30,
        user_tier:         "player",
        last_nerve_update: new Date().toISOString(),
      }],
    } as never);

    const result = await getNerveStatus(1);
    expect(result!.secondsUntilNext).toBe(0);
  });
});
