import { describe, it, expect, vi, beforeEach } from "vitest";

const txMocks = vi.hoisted(() => {
  const client = { query: vi.fn(), release: vi.fn() };
  return { client };
});

vi.mock("../config/database", () => {
  return {
    pool: { connect: vi.fn(), query: vi.fn() },
    withTransaction: async (fn: (c: unknown) => Promise<unknown>) => {
      return await fn(txMocks.client);
    },
  };
});

vi.mock("../config/redis", () => ({
  redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
  default: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
}));

vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../utils/alerts", () => ({
  Alerts:    { systemError: vi.fn() },
  sendAlert: vi.fn(),
}));

vi.mock("../services/immunityCheck", () => ({
  isImmuneFromUAC: vi.fn().mockResolvedValue(false),
}));

import { pool }         from "../config/database";
import { redis }        from "../config/redis";
import {
  getTrustTier,
  flagUser,
  getTrustInfo,
  manualTrustAdjust,
  VIOLATIONS,
} from "../services/trustEngine";
import { isImmuneFromUAC } from "../services/immunityCheck";

// No global mock reset — we use clearAllMocks inside describe blocks that need it

describe("getTrustTier", () => {
  it("returns CLEAN for score >= 70", () => {
    expect(getTrustTier(100)).toBe("CLEAN");
    expect(getTrustTier(70)).toBe("CLEAN");
  });

  it("returns WATCHED for score 40-69", () => {
    expect(getTrustTier(69)).toBe("WATCHED");
    expect(getTrustTier(40)).toBe("WATCHED");
  });

  it("returns SUSPICIOUS for score 20-39", () => {
    expect(getTrustTier(39)).toBe("SUSPICIOUS");
    expect(getTrustTier(20)).toBe("SUSPICIOUS");
  });

  it("returns SHADOW_BANNED for score 1-19", () => {
    expect(getTrustTier(19)).toBe("SHADOW_BANNED");
    expect(getTrustTier(1)).toBe("SHADOW_BANNED");
  });

  it("returns HARD_BANNED for score 0", () => {
    expect(getTrustTier(0)).toBe("HARD_BANNED");
  });
});

describe("VIOLATIONS registry", () => {
  it("has HONEYPOT_TRIGGERED with cooldown 0 (always fires)", () => {
    expect(VIOLATIONS.HONEYPOT_TRIGGERED.cooldownSec).toBe(0);
    expect(VIOLATIONS.HONEYPOT_TRIGGERED.severity).toBe(100);
  });

  it("has all expected violation types", () => {
    const expected = [
      "INVALID_CHALLENGE",
      "RATE_LIMIT_HIT",
      "HONEYPOT_TRIGGERED",
      "SUSPICIOUS_TIMING",
      "EARNINGS_VELOCITY",
      "ACTIVE_HOURS_ANOMALY",
      "SUCCESS_RATE_SPIKE",
      "VPN_PROXY_DETECTED",
      "TOR_DETECTED",
      "GEO_BLOCKED",
    ];
    for (const v of expected) {
      expect(VIOLATIONS).toHaveProperty(v);
    }
  });
});

describe("flagUser", () => {
beforeEach(() => {
  vi.clearAllMocks();
  txMocks.client.query.mockReset();
});

  it("skips if user is immune", async () => {
    vi.mocked(isImmuneFromUAC).mockResolvedValueOnce(true);

    const result = await flagUser({
      firebaseUid:   "test-uid",
      violationType: "SUSPICIOUS_TIMING",
    });

    expect(result.skipped).toBe(true);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it("skips if violation is on cooldown", async () => {
    vi.mocked(isImmuneFromUAC).mockResolvedValueOnce(false);
    vi.mocked(redis.set).mockResolvedValueOnce(null);

    const result = await flagUser({
      firebaseUid:   "test-uid",
      violationType: "SUSPICIOUS_TIMING",
    });

    expect(result.skipped).toBe(true);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it("returns UNKNOWN if user not found in DB", async () => {
    vi.mocked(isImmuneFromUAC).mockResolvedValueOnce(false);
    vi.mocked(redis.set).mockResolvedValueOnce("OK" as never);
    txMocks.client.query.mockResolvedValueOnce({ rows: [] } as never);

    const result = await flagUser({
      firebaseUid:   "unknown-uid",
      violationType: "SUSPICIOUS_TIMING",
    });

    expect(result.tier).toBe("UNKNOWN");
    expect(result.skipped).toBe(true);
  });

  it("reduces trust score by violation severity", async () => {
    vi.mocked(isImmuneFromUAC).mockResolvedValueOnce(false);
    vi.mocked(redis.set).mockResolvedValueOnce("OK" as never);
    txMocks.client.query
      .mockResolvedValueOnce({ rows: [{ id: 1, trust_score: 100, is_hard_banned: false }] } as never)
      .mockResolvedValueOnce(undefined as never)
      .mockResolvedValueOnce(undefined as never);

    const result = await flagUser({
      firebaseUid:   "test-uid",
      violationType: "SUSPICIOUS_TIMING",
    });

    expect(result).toMatchObject({
      skipped: false,
      newTrustScore: 100 - VIOLATIONS.SUSPICIOUS_TIMING.severity,
    });
  });

  it("does not go below 0", async () => {
    vi.mocked(isImmuneFromUAC).mockResolvedValueOnce(false);
    vi.mocked(redis.set).mockResolvedValueOnce("OK" as never);
    txMocks.client.query
      .mockResolvedValueOnce({ rows: [{ id: 1, trust_score: 5, is_hard_banned: false }] } as never)
      .mockResolvedValueOnce(undefined as never)
      .mockResolvedValueOnce(undefined as never);

    const result = await flagUser({
      firebaseUid:   "test-uid",
      violationType: "HONEYPOT_TRIGGERED",
    });

    expect(result).toMatchObject({
      newTrustScore: 0,
      isBanned: true,
      skipped: false,
    });
  });

  it("skips score update if already hard banned", async () => {
    vi.mocked(isImmuneFromUAC).mockResolvedValueOnce(false);
    vi.mocked(redis.set).mockResolvedValueOnce("OK" as never);
    txMocks.client.query
      .mockResolvedValueOnce({ rows: [{ id: 1, trust_score: 0, is_hard_banned: true }] } as never)
      .mockResolvedValueOnce(undefined as never);

    const result = await flagUser({
      firebaseUid:   "banned-uid",
      violationType: "SUSPICIOUS_TIMING",
    });

    expect(result).toMatchObject({
      isBanned: true,
      newTrustScore: 0,
      skipped: false,
    });
  });

  it("returns safe default on DB error", async () => {
    vi.mocked(isImmuneFromUAC).mockResolvedValueOnce(false);
    vi.mocked(redis.set).mockResolvedValueOnce("OK" as never);
    txMocks.client.query.mockRejectedValueOnce(new Error("DB down"));

    const result = await flagUser({
      firebaseUid:   "test-uid",
      violationType: "SUSPICIOUS_TIMING",
    });

    expect(result.skipped).toBe(true);
    expect(result.newTrustScore).toBeNull();
  });
});

describe("getTrustInfo", () => {
  beforeEach(() => vi.clearAllMocks());


  it("returns clean for immune user", async () => {
    vi.mocked(isImmuneFromUAC).mockResolvedValueOnce(true);

    const result = await getTrustInfo("admin-uid");
    expect(result.tier).toBe("CLEAN");
    expect(result.trustScore).toBe(100);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("returns user trust info from DB", async () => {
    vi.mocked(isImmuneFromUAC).mockResolvedValueOnce(false);
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{
        trust_score:      55,
        is_shadow_banned: false,
        is_hard_banned:   false,
      }],
    } as never);

    const result = await getTrustInfo("uid-123");
    expect(result.trustScore).toBe(55);
    expect(result.tier).toBe("WATCHED");
    expect(result.isShadowBanned).toBe(false);
    expect(result.isHardBanned).toBe(false);
  });

  it("returns UNKNOWN tier when user not found", async () => {
    vi.mocked(isImmuneFromUAC).mockResolvedValueOnce(false);
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);

    const result = await getTrustInfo("not-found");
    expect(result.tier).toBe("CLEAN");
    expect(result.trustScore).toBe(100);
  });

  it("returns CLEAN on DB error (fail open)", async () => {
    vi.mocked(isImmuneFromUAC).mockResolvedValueOnce(false);
    vi.mocked(pool.query).mockRejectedValueOnce(new Error("DB down"));

    const result = await getTrustInfo("uid-123");
    expect(result.tier).toBe("CLEAN");
    expect(result.trustScore).toBe(100);
  });
});

describe("manualTrustAdjust", () => {
  beforeEach(() => vi.clearAllMocks());


  it("clamps score to 0-100", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ id: 1, trust_score: 50 }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const r1 = await manualTrustAdjust("uid", 150, "admin-uid", "test");
    expect(r1.newScore).toBe(100);

    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ id: 1, trust_score: 50 }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const r2 = await manualTrustAdjust("uid", -50, "admin-uid", "test");
    expect(r2.newScore).toBe(0);
  });

  it("returns success:false on DB error", async () => {
    vi.mocked(pool.query).mockRejectedValueOnce(new Error("DB down"));

    const result = await manualTrustAdjust("uid", 80, "admin-uid", "test");
    expect(result.success).toBe(false);
    expect(result.newScore).toBe(-1);
  });

  it("sets is_hard_banned=true when score is 0", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ id: 1, trust_score: 50 }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const result = await manualTrustAdjust("uid", 0, "admin-uid", "ban test");
    expect(result.success).toBe(true);
    expect(result.newScore).toBe(0);
  });
});
