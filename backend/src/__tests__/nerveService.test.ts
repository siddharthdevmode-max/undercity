// ============================================================
// NERVE SERVICE — UNIT TESTS
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────

const mocks = vi.hoisted(() => {
  const mockPoolQuery   = vi.fn();
  const mockClientQuery = vi.fn();
  const mockClient      = { query: mockClientQuery };
  return { mockPoolQuery, mockClientQuery, mockClient };
});

vi.mock("../config/database", () => ({
  pool: {
    query:   mocks.mockPoolQuery,
    connect: vi.fn().mockResolvedValue(mocks.mockClient),
    on:      vi.fn(),
    totalCount: 1, idleCount: 1, waitingCount: 0,
  },
  withTransaction: vi.fn(),
  getPoolStats:    vi.fn().mockReturnValue({ total: 1, idle: 1, waiting: 0 }),
}));

vi.mock("../config/redis", () => ({
  default: { get: vi.fn().mockResolvedValue(null), set: vi.fn(), on: vi.fn(), status: "ready" },
  redis:   { get: vi.fn().mockResolvedValue(null), set: vi.fn(), on: vi.fn(), status: "ready" },
}));

vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Import after mocks ─────────────────────────────────────

import { deductNerve, getNerveStatus, regenNerveByTier } from "../services/nerveService";

// ============================================================
// deductNerve
// ============================================================

describe("deductNerve", () => {

  beforeEach(() => vi.clearAllMocks());

  it("returns success: true and updated nerve when sufficient", async () => {
    mocks.mockClientQuery.mockResolvedValueOnce({ rows: [{ nerve: 25 }], rowCount: 1 });
    const result = await deductNerve(1, 5, mocks.mockClient as never);
    expect(result.success).toBe(true);
    expect(result.currentNerve).toBe(25);
  });

  it("returns success: false when nerve is insufficient (rowCount 0)", async () => {
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [],              rowCount: 0 }) // UPDATE fails
      .mockResolvedValueOnce({ rows: [{ nerve: 2 }],  rowCount: 1 }); // SELECT current
    const result = await deductNerve(1, 10, mocks.mockClient as never);
    expect(result.success).toBe(false);
    expect(result.currentNerve).toBe(2);
  });

  it("returns currentNerve: 0 if user not found on failure path", async () => {
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // UPDATE
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SELECT — user missing
    const result = await deductNerve(999, 5, mocks.mockClient as never);
    expect(result.success).toBe(false);
    expect(result.currentNerve).toBe(0);
  });

  it("uses pool directly when no client is provided", async () => {
    mocks.mockPoolQuery.mockResolvedValueOnce({ rows: [{ nerve: 20 }], rowCount: 1 });
    const result = await deductNerve(1, 5);
    expect(result.success).toBe(true);
    expect(result.currentNerve).toBe(20);
    expect(mocks.mockPoolQuery).toHaveBeenCalled();
  });

  it("passes correct SQL params: [userId, amount]", async () => {
    mocks.mockClientQuery.mockResolvedValueOnce({ rows: [{ nerve: 15 }], rowCount: 1 });
    await deductNerve(42, 7, mocks.mockClient as never);
    expect(mocks.mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("nerve - $2"),
      [42, 7]
    );
  });

  it("handles zero amount deduction", async () => {
    mocks.mockClientQuery.mockResolvedValueOnce({ rows: [{ nerve: 30 }], rowCount: 1 });
    const result = await deductNerve(1, 0, mocks.mockClient as never);
    expect(result.success).toBe(true);
  });
});

// ============================================================
// getNerveStatus
// ============================================================

describe("getNerveStatus", () => {

  beforeEach(() => vi.clearAllMocks());

  it("returns null when user not found", async () => {
    mocks.mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const result = await getNerveStatus(999);
    expect(result).toBeNull();
  });

  it("returns correct nerve status for player tier", async () => {
    mocks.mockPoolQuery.mockResolvedValueOnce({
      rows: [{ nerve: 25, max_nerve: 30, user_tier: "player", last_nerve_update: new Date().toISOString() }],
      rowCount: 1,
    });
    const result = await getNerveStatus(1);
    expect(result).not.toBeNull();
    expect(result!.nerve).toBe(25);
    expect(result!.maxNerve).toBe(30);
    expect(result!.tier).toBe("player");
    expect(result!.regenRateSec).toBe(300);
  });

  it("contributor tier has regenRateSec of 180", async () => {
    mocks.mockPoolQuery.mockResolvedValueOnce({
      rows: [{ nerve: 20, max_nerve: 30, user_tier: "contributor", last_nerve_update: new Date().toISOString() }],
      rowCount: 1,
    });
    const result = await getNerveStatus(1);
    expect(result!.regenRateSec).toBe(180);
  });

  it("citizen tier has regenRateSec of 300", async () => {
    mocks.mockPoolQuery.mockResolvedValueOnce({
      rows: [{ nerve: 20, max_nerve: 30, user_tier: "citizen", last_nerve_update: new Date().toISOString() }],
      rowCount: 1,
    });
    const result = await getNerveStatus(1);
    expect(result!.regenRateSec).toBe(300);
  });

  it("returns secondsUntilNext: 0 when nerve is at max", async () => {
    mocks.mockPoolQuery.mockResolvedValueOnce({
      rows: [{ nerve: 30, max_nerve: 30, user_tier: "player", last_nerve_update: new Date().toISOString() }],
      rowCount: 1,
    });
    const result = await getNerveStatus(1);
    expect(result!.secondsUntilNext).toBe(0);
  });

  it("returns positive secondsUntilNext when nerve is below max and recently updated", async () => {
    const oneSecondAgo = new Date(Date.now() - 1000).toISOString();
    mocks.mockPoolQuery.mockResolvedValueOnce({
      rows: [{ nerve: 20, max_nerve: 30, user_tier: "player", last_nerve_update: oneSecondAgo }],
      rowCount: 1,
    });
    const result = await getNerveStatus(1);
    expect(result!.secondsUntilNext).toBeGreaterThan(0);
    expect(result!.secondsUntilNext).toBeLessThanOrEqual(300);
  });

  it("handles null last_nerve_update", async () => {
    mocks.mockPoolQuery.mockResolvedValueOnce({
      rows: [{ nerve: 30, max_nerve: 30, user_tier: "player", last_nerve_update: null }],
      rowCount: 1,
    });
    const result = await getNerveStatus(1);
    expect(result).not.toBeNull();
    expect(result!.secondsUntilNext).toBe(0); // nerve at max
  });

  it("defaults to player tier when user_tier is null", async () => {
    mocks.mockPoolQuery.mockResolvedValueOnce({
      rows: [{ nerve: 15, max_nerve: 30, user_tier: null, last_nerve_update: new Date().toISOString() }],
      rowCount: 1,
    });
    const result = await getNerveStatus(1);
    expect(result!.tier).toBe("player");
    expect(result!.regenRateSec).toBe(300);
  });

  it("returns correct interface shape", async () => {
    mocks.mockPoolQuery.mockResolvedValueOnce({
      rows: [{ nerve: 10, max_nerve: 30, user_tier: "citizen", last_nerve_update: new Date(Date.now() - 60_000).toISOString() }],
      rowCount: 1,
    });
    const result = await getNerveStatus(1);
    expect(result).toMatchObject({
      nerve:            expect.any(Number),
      maxNerve:         expect.any(Number),
      tier:             expect.any(String),
      regenRateSec:     expect.any(Number),
      secondsUntilNext: expect.any(Number),
    });
  });
});

// ============================================================
// regenNerveByTier
// ============================================================

describe("regenNerveByTier", () => {

  beforeEach(() => vi.clearAllMocks());

  it("returns NerveRegenResult with correct shape", async () => {
    mocks.mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    const result = await regenNerveByTier();
    expect(result).toMatchObject({
      player:      expect.any(Number),
      citizen:     expect.any(Number),
      contributor: expect.any(Number),
      total:       expect.any(Number),
    });
    expect(result.total).toBe(result.player + result.citizen + result.contributor);
  });

  it("counts updated rows per tier", async () => {
    mocks.mockPoolQuery
      .mockResolvedValueOnce({ rows: new Array(10).fill({}), rowCount: 10 }) // player
      .mockResolvedValueOnce({ rows: new Array(5).fill({}),  rowCount: 5  }) // citizen
      .mockResolvedValueOnce({ rows: new Array(2).fill({}),  rowCount: 2  }); // contributor
    const result = await regenNerveByTier();
    expect(result.player).toBe(10);
    expect(result.citizen).toBe(5);
    expect(result.contributor).toBe(2);
    expect(result.total).toBe(17);
  });

  it("handles DB errors gracefully — continues other tiers", async () => {
    mocks.mockPoolQuery
      .mockRejectedValueOnce(new Error("DB timeout")) // player fails
      .mockResolvedValueOnce({ rows: [{}], rowCount: 1 }) // citizen succeeds
      .mockResolvedValueOnce({ rows: [],   rowCount: 0 }); // contributor
    const result = await regenNerveByTier();
    expect(typeof result.total).toBe("number");
    expect(result.total).toBeGreaterThanOrEqual(0);
  });

  it("total is 0 when no users need regen", async () => {
    mocks.mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    const result = await regenNerveByTier();
    expect(result.total).toBe(0);
    expect(result.player).toBe(0);
    expect(result.citizen).toBe(0);
    expect(result.contributor).toBe(0);
  });
});
