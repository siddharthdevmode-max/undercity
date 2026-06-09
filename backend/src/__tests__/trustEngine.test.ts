// ============================================================
// TRUST ENGINE TESTS
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/database", () => ({
  pool: {
    connect: vi.fn(),
    query:   vi.fn(),
  },
}));

vi.mock("../config/redis", () => ({
  redis: {
    get:    vi.fn(),
    set:    vi.fn(),
    del:    vi.fn(),
    exists: vi.fn(),
  },
  default: {
    get:    vi.fn(),
    set:    vi.fn(),
    del:    vi.fn(),
    exists: vi.fn(),
  },
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

import { pool }          from "../config/database";
import { redis }         from "../config/redis";
import { getTrustTier }  from "../services/trustEngine";

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

describe("flagUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("skips if user is immune", async () => {
    const { isImmuneFromUAC } = await import("../services/immunityCheck");
    vi.mocked(isImmuneFromUAC).mockResolvedValueOnce(true);

    const { flagUser } = await import("../services/trustEngine");
    const result = await flagUser({
      firebaseUid:   "test-uid",
      violationType: "SUSPICIOUS_TIMING",
    });

    expect(result.skipped).toBe(true);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it("skips if violation is on cooldown", async () => {
    const { isImmuneFromUAC } = await import("../services/immunityCheck");
    vi.mocked(isImmuneFromUAC).mockResolvedValueOnce(false);

    // NX set returns null = key exists = on cooldown
    vi.mocked(redis.set).mockResolvedValueOnce(null);

    const { flagUser } = await import("../services/trustEngine");
    const result = await flagUser({
      firebaseUid:   "test-uid",
      violationType: "SUSPICIOUS_TIMING",
    });

    expect(result.skipped).toBe(true);
    expect(pool.connect).not.toHaveBeenCalled();
  });
});
