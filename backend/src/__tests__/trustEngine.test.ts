import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// vi.hoisted ensures mockClient exists before vi.mock runs
// ============================================================

const { mockClient, mockPoolQuery } = vi.hoisted(() => {
  const mockClient = {
    query:   vi.fn(),
    release: vi.fn(),
  };
  const mockPoolQuery = vi.fn();
  return { mockClient, mockPoolQuery };
});

vi.mock("../config/database", () => ({
  pool: {
    connect: vi.fn().mockResolvedValue(mockClient),
    query:   mockPoolQuery,
  },
}));

import { getTrustTier, flagUser, getTrustInfo } from "../services/trustEngine";

// ============================================================
// HELPERS
// ============================================================

function setupFlagUserMocks(trustScore: number) {
  mockClient.query
    .mockResolvedValueOnce(undefined)                                      // BEGIN
    .mockResolvedValueOnce({ rows: [{ id: 1, trust_score: trustScore }] }) // SELECT user
    .mockResolvedValueOnce(undefined)                                      // UPDATE user
    .mockResolvedValueOnce(undefined)                                      // INSERT violation
    .mockResolvedValueOnce(undefined);                                     // COMMIT
}

// ============================================================
// getTrustTier — pure function
// ============================================================

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

// ============================================================
// flagUser
// ============================================================

describe("flagUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reduces trust score by violation severity", async () => {
    setupFlagUserMocks(100);
    const result = await flagUser({
      firebaseUid:   "test-uid-001",
      violationType: "SUSPICIOUS_TIMING", // severity 15 → 100-15 = 85
    });
    expect(result.newTrustScore).toBe(85);
    expect(result.tier).toBe("CLEAN");
    expect(result.isBanned).toBe(false);
  });

  it("sets isBanned true when score reaches 0", async () => {
    setupFlagUserMocks(5);
    const result = await flagUser({
      firebaseUid:   "test-uid-002",
      violationType: "HONEYPOT_TRIGGERED", // severity 100, 5-100 = 0
    });
    expect(result.newTrustScore).toBe(0);
    expect(result.isBanned).toBe(true);
    expect(result.tier).toBe("HARD_BANNED");
  });

  it("score never goes below 0", async () => {
    setupFlagUserMocks(0);
    const result = await flagUser({
      firebaseUid:   "test-uid-003",
      violationType: "HONEYPOT_TRIGGERED",
    });
    expect(result.newTrustScore).toBe(0);
  });

  it("returns UNKNOWN when user not found", async () => {
    mockClient.query
      .mockResolvedValueOnce(undefined)      // BEGIN
      .mockResolvedValueOnce({ rows: [] })   // SELECT → not found
      .mockResolvedValueOnce(undefined);     // ROLLBACK

    const result = await flagUser({
      firebaseUid:   "ghost-uid",
      violationType: "RATE_LIMIT_HIT",
    });
    expect(result.tier).toBe("UNKNOWN");
    expect(result.isBanned).toBe(false);
  });

  it("handles DB errors gracefully without throwing", async () => {
    mockClient.query
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("DB connection lost"));

    const result = await flagUser({
      firebaseUid:   "test-uid-err",
      violationType: "INVALID_CHALLENGE",
    });
    expect(result.newTrustScore).toBe(100);
    expect(result.tier).toBe("ERROR");
  });

  it("accepts optional ip, userAgent, details", async () => {
    setupFlagUserMocks(80);
    const result = await flagUser({
      firebaseUid:   "test-uid-004",
      violationType: "SUSPICIOUS_TIMING",
      ipAddress:     "1.2.3.4",
      userAgent:     "TestBot/1.0",
      details:       { reason: "equal intervals" },
    });
    expect(result).toHaveProperty("newTrustScore");
    expect(result).toHaveProperty("tier");
  });

  it("marks shadow banned when score is 1-19", async () => {
    setupFlagUserMocks(25);
    const result = await flagUser({
      firebaseUid:   "test-uid-005",
      violationType: "SIGNATURE_FAILURE", // severity 20, 25-20 = 5
    });
    expect(result.newTrustScore).toBe(5);
    expect(result.tier).toBe("SHADOW_BANNED");
    expect(result.isBanned).toBe(false); // shadow ban ≠ hard ban
  });
});

// ============================================================
// getTrustInfo
// ============================================================

describe("getTrustInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns full trust info for known user", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ trust_score: 75, is_shadow_banned: false, is_hard_banned: false }],
    });
    const info = await getTrustInfo("test-uid");
    expect(info.trustScore).toBe(75);
    expect(info.tier).toBe("CLEAN");
    expect(info.isShadowBanned).toBe(false);
    expect(info.isHardBanned).toBe(false);
  });

  it("returns UNKNOWN defaults for missing user", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    const info = await getTrustInfo("ghost-uid");
    expect(info.trustScore).toBe(100);
    expect(info.tier).toBe("UNKNOWN");
    expect(info.isShadowBanned).toBe(false);
    expect(info.isHardBanned).toBe(false);
  });

  it("returns shadow banned state correctly", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ trust_score: 10, is_shadow_banned: true, is_hard_banned: false }],
    });
    const info = await getTrustInfo("shadow-uid");
    expect(info.isShadowBanned).toBe(true);
    expect(info.tier).toBe("SHADOW_BANNED");
  });

  it("returns hard banned state correctly", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ trust_score: 0, is_shadow_banned: false, is_hard_banned: true }],
    });
    const info = await getTrustInfo("hard-banned-uid");
    expect(info.isHardBanned).toBe(true);
    expect(info.tier).toBe("HARD_BANNED");
  });
});
