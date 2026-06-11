import { describe, it, expect, vi, beforeEach } from "vitest";

const mockQuery = vi.fn();
const mockTickQuery = vi.fn();
vi.mock("../config/database", () => ({
  pool: { query: (...args: unknown[]) => mockQuery(...args) },
  tickPool: { query: (...args: unknown[]) => mockTickQuery(...args) },
}));

vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../config/tiers", () => ({
  TIER_CONFIG: {
    player:      { nerveRegenSec: 300, energyRegenSec: 900, maxNerve: 130, maxEnergy: 100, xpMultiplier: 1.0, crimeMultiplier: 0.0, price: 0, durationDays: 0 },
    citizen:     { nerveRegenSec: 300, energyRegenSec: 720, maxNerve: 130, maxEnergy: 100, xpMultiplier: 1.0, crimeMultiplier: 0.0, price: 499, durationDays: 31 },
    contributor: { nerveRegenSec: 180, energyRegenSec: 600, maxNerve: 130, maxEnergy: 100, xpMultiplier: 1.0, crimeMultiplier: 0.0, price: 799, durationDays: 31 },
  },
}));

import { regenNerveByTier, deductNerve, getNerveStatus } from "../services/nerveService";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("regenNerveByTier", () => {
  it("returns aggregated result from both tier groups", async () => {
    mockTickQuery
      .mockResolvedValueOnce({ rowCount: 10 }) // player/citizen batch
      .mockResolvedValueOnce({ rowCount: 5 }); // contributor batch

    const result = await regenNerveByTier();
    expect(result.player_citizen).toBe(10);
    expect(result.contributor).toBe(5);
    expect(result.total).toBe(15);
  });

  it("handles partial failure gracefully", async () => {
    mockTickQuery
      .mockResolvedValueOnce({ rowCount: 10 })
      .mockRejectedValueOnce(new Error("DB error"));

    const result = await regenNerveByTier();
    expect(result.player_citizen).toBe(10);
    expect(result.contributor).toBe(0);
  });

  it("returns zero when both queries fail", async () => {
    mockTickQuery
      .mockRejectedValueOnce(new Error("DB error"))
      .mockRejectedValueOnce(new Error("DB error"));

    const result = await regenNerveByTier();
    expect(result.total).toBe(0);
  });
});

describe("deductNerve", () => {
  it("returns success when nerve is deducted", async () => {
    mockTickQuery.mockResolvedValue({ rowCount: 1, rows: [{ nerve: 40 }] });
    const result = await deductNerve(1, 10);
    expect(result.success).toBe(true);
    expect(result.currentNerve).toBe(40);
  });

  it("returns failure when not enough nerve", async () => {
    mockTickQuery
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ nerve: 3 }] });
    const result = await deductNerve(1, 10);
    expect(result.success).toBe(false);
    expect(result.currentNerve).toBe(3);
  });
});

describe("getNerveStatus", () => {
  it("returns null when user not found", async () => {
    mockTickQuery.mockResolvedValue({ rows: [] });
    const result = await getNerveStatus(999);
    expect(result).toBeNull();
  });

  it("returns nerve status for existing user", async () => {
    mockTickQuery.mockResolvedValue({
      rows: [{ nerve: 50, max_nerve: 100, user_tier: "player", last_nerve_update: new Date().toISOString() }],
    });
    const result = await getNerveStatus(1);
    expect(result).not.toBeNull();
    expect(result!.nerve).toBe(50);
    expect(result!.maxNerve).toBe(100);
    expect(result!.tier).toBe("player");
    expect(result!.regenRateSec).toBe(300);
  });
});
