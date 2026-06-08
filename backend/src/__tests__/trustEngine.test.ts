// ============================================================
// TRUST ENGINE — UNIT TESTS
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────

const mocks = vi.hoisted(() => {
  const mockPoolQuery   = vi.fn();
  const mockClientQuery = vi.fn();
  const mockClientRelease = vi.fn();
  const mockClient      = {
    query:   mockClientQuery,
    release: mockClientRelease,
  };
  const mockRedisSet = vi.fn();
  const mockRedisGet = vi.fn();

  return {
    mockPoolQuery,
    mockClientQuery,
    mockClientRelease,
    mockClient,
    mockRedisSet,
    mockRedisGet,
  };
});

vi.mock("../config/database", () => ({
  pool: {
    query:        mocks.mockPoolQuery,
    connect:      vi.fn().mockResolvedValue(mocks.mockClient),
    on:           vi.fn(),
    totalCount:   1,
    idleCount:    1,
    waitingCount: 0,
  },
  withTransaction: vi.fn(),
  getPoolStats:    vi.fn().mockReturnValue({ total: 1, idle: 1, waiting: 0 }),
}));

vi.mock("../config/redis", () => ({
  default: {
    get:    mocks.mockRedisGet,
    set:    mocks.mockRedisSet,
    on:     vi.fn(),
    status: "ready",
  },
  redis: {
    get:    mocks.mockRedisGet,
    set:    mocks.mockRedisSet,
    on:     vi.fn(),
    status: "ready",
  },
}));

vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../utils/alerts", () => ({
  Alerts: {
    systemError:       vi.fn().mockResolvedValue(undefined),
    hardBan:           vi.fn(),
    softBan:           vi.fn(),
    massViolation:     vi.fn(),
    honeypotTriggered: vi.fn(),
    suspiciousLogin:   vi.fn(),
  },
  sendAlert: vi.fn(),
}));

vi.mock("../services/immunityCheck", () => ({
  isImmuneFromUAC: vi.fn().mockResolvedValue(false),
}));

// ── Import after mocks ─────────────────────────────────────

import {
  getTrustTier,
  flagUser,
  getTrustInfo,
  manualTrustAdjust,
} from "../services/trustEngine";
import { isImmuneFromUAC } from "../services/immunityCheck";

// ============================================================
// HELPERS
// ============================================================

/**
 * Wire up the mock client for a flagUser call against a live user.
 * Call sequence inside flagUser:
 *   1. BEGIN
 *   2. SELECT user FOR UPDATE
 *   3. UPDATE users  (only if NOT already banned)
 *   4. INSERT uac_violations
 *   5. COMMIT
 */
function mockFlagUserFlow(
  trustScore    = 100,
  is_hard_banned = false
) {
  mocks.mockClientQuery
    .mockResolvedValueOnce({ rows: [], rowCount: 0 })          // BEGIN
    .mockResolvedValueOnce({                                    // SELECT user
      rows:     [{ id: 1, trust_score: trustScore, is_hard_banned }],
      rowCount: 1,
    })
    .mockResolvedValueOnce({ rows: [], rowCount: 1 })           // UPDATE users
    .mockResolvedValueOnce({ rows: [], rowCount: 1 })           // INSERT uac_violations
    .mockResolvedValueOnce({ rows: [], rowCount: 0 });          // COMMIT
}

/**
 * Wire up the mock client for an already-hard-banned flagUser call.
 * Skips the UPDATE users step — only logs the violation.
 *   1. BEGIN
 *   2. SELECT user FOR UPDATE  → is_hard_banned = true
 *   3. INSERT uac_violations   (audit trail only)
 *   4. COMMIT
 */
function mockAlreadyBannedFlow() {
  mocks.mockClientQuery
    .mockResolvedValueOnce({ rows: [], rowCount: 0 })          // BEGIN
    .mockResolvedValueOnce({                                    // SELECT user
      rows:     [{ id: 1, trust_score: 0, is_hard_banned: true }],
      rowCount: 1,
    })
    .mockResolvedValueOnce({ rows: [], rowCount: 1 })           // INSERT uac_violations
    .mockResolvedValueOnce({ rows: [], rowCount: 0 });          // COMMIT
}

// ============================================================
// getTrustTier
// ============================================================

describe("getTrustTier", () => {
  it("returns CLEAN for score >= 70",        () => expect(getTrustTier(70)).toBe("CLEAN"));
  it("returns CLEAN for score = 100",        () => expect(getTrustTier(100)).toBe("CLEAN"));
  it("returns WATCHED for score = 69",       () => expect(getTrustTier(69)).toBe("WATCHED"));
  it("returns WATCHED for score = 40",       () => expect(getTrustTier(40)).toBe("WATCHED"));
  it("returns SUSPICIOUS for score = 20",    () => expect(getTrustTier(20)).toBe("SUSPICIOUS"));
  it("returns SUSPICIOUS for score = 39",    () => expect(getTrustTier(39)).toBe("SUSPICIOUS"));
  it("returns SHADOW_BANNED for score = 1",  () => expect(getTrustTier(1)).toBe("SHADOW_BANNED"));
  it("returns SHADOW_BANNED for score = 19", () => expect(getTrustTier(19)).toBe("SHADOW_BANNED"));
  it("returns HARD_BANNED for score = 0",    () => expect(getTrustTier(0)).toBe("HARD_BANNED"));
});

// ============================================================
// flagUser
// ============================================================

describe("flagUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isImmuneFromUAC).mockResolvedValue(false);
    // Default: Redis SET returns "OK" — not on cooldown
    mocks.mockRedisSet.mockResolvedValue("OK");
  });

  it("reduces trust score by violation severity", async () => {
    mockFlagUserFlow(100);
    const result = await flagUser({
      firebaseUid:   "test-uid-123",
      violationType: "SUSPICIOUS_TIMING", // severity = 15 → 100-15 = 85
    });
    expect(result.newTrustScore).toBe(85);
    expect(result.isBanned).toBe(false);
    expect(result.skipped).toBe(false);
  });

  it("sets isBanned true when score reaches 0", async () => {
    mockFlagUserFlow(5); // 5 - 15 = -10 → clamped to 0
    const result = await flagUser({
      firebaseUid:   "test-uid-123",
      violationType: "SUSPICIOUS_TIMING",
    });
    expect(result.newTrustScore).toBe(0);
    expect(result.isBanned).toBe(true);
    expect(result.tier).toBe("HARD_BANNED");
  });

  it("score never goes below 0", async () => {
    mockAlreadyBannedFlow();
    const result = await flagUser({
      firebaseUid:   "test-uid-123",
      violationType: "SUSPICIOUS_TIMING",
    });
    expect(result.newTrustScore).toBe(0);
  });

  it("returns UNKNOWN when user not found", async () => {
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // SELECT — no user
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // ROLLBACK
    const result = await flagUser({
      firebaseUid:   "ghost-uid",
      violationType: "SUSPICIOUS_TIMING",
    });
    expect(result.tier).toBe("UNKNOWN");
    expect(result.skipped).toBe(true);
  });

  it("handles DB errors gracefully without throwing", async () => {
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })   // BEGIN
      .mockRejectedValueOnce(new Error("DB lost"))         // SELECT throws
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });   // ROLLBACK
    const result = await flagUser({
      firebaseUid:   "test-uid-123",
      violationType: "SUSPICIOUS_TIMING",
    });
    expect(result.skipped).toBe(true);
    expect(result.newTrustScore).toBe(100);
  });

  it("accepts optional ip, userAgent, details", async () => {
    mockFlagUserFlow(80);
    const result = await flagUser({
      firebaseUid:   "test-uid-123",
      violationType: "VPN_PROXY_DETECTED",
      details:       { vpnProvider: "NordVPN" },
      ipAddress:     "1.2.3.4",
      userAgent:     "Mozilla/5.0",
    });
    expect(result.skipped).toBe(false);
  });

  it("marks shadow banned when score drops to 1-19", async () => {
    mockFlagUserFlow(20); // 20 - 15 = 5 → SHADOW_BANNED
    const result = await flagUser({
      firebaseUid:   "test-uid-123",
      violationType: "SUSPICIOUS_TIMING",
    });
    expect(result.newTrustScore).toBe(5);
    expect(result.tier).toBe("SHADOW_BANNED");
  });

  it("skips if user is immune", async () => {
    vi.mocked(isImmuneFromUAC).mockResolvedValue(true);
    const result = await flagUser({
      firebaseUid:   "admin-uid",
      violationType: "SUSPICIOUS_TIMING",
    });
    expect(result.skipped).toBe(true);
    expect(mocks.mockClientQuery).not.toHaveBeenCalled();
  });

  it("skips when violation is on cooldown (Redis SET returns null)", async () => {
    mocks.mockRedisSet.mockResolvedValue(null); // null = already existed = on cooldown
    const result = await flagUser({
      firebaseUid:   "test-uid-123",
      violationType: "SUSPICIOUS_TIMING",
    });
    expect(result.skipped).toBe(true);
    expect(mocks.mockClientQuery).not.toHaveBeenCalled();
  });

  it("HONEYPOT_TRIGGERED always fires — cooldown=0 bypasses dedup", async () => {
    mockFlagUserFlow(100);
    const result = await flagUser({
      firebaseUid:   "test-uid-123",
      violationType: "HONEYPOT_TRIGGERED",
    });
    expect(result.skipped).toBe(false);
  });

  // ── LINE 127-132: already-hard-banned path ─────────────

  it("still logs violation when user is already hard banned (audit trail)", async () => {
    mockAlreadyBannedFlow();
    const result = await flagUser({
      firebaseUid:   "banned-uid",
      violationType: "SUSPICIOUS_TIMING",
    });
    expect(result.newTrustScore).toBe(0);
    expect(result.tier).toBe("HARD_BANNED");
    expect(result.isBanned).toBe(true);
    expect(result.skipped).toBe(false);
    expect(result.reason).toBe("already banned");

    // Violation INSERT still fires for audit trail
    const insertCall = mocks.mockClientQuery.mock.calls.find(
      (call) => typeof call[0] === "string" &&
                (call[0] as string).includes("INSERT INTO uac_violations")
    );
    expect(insertCall).toBeDefined();
  });

  it("already-hard-banned: skips UPDATE users query", async () => {
    mockAlreadyBannedFlow();
    await flagUser({
      firebaseUid:   "banned-uid",
      violationType: "RATE_LIMIT_HIT",
    });
    const updateCall = mocks.mockClientQuery.mock.calls.find(
      (call) => typeof call[0] === "string" &&
                (call[0] as string).includes("UPDATE users")
    );
    expect(updateCall).toBeUndefined();
  });

  it("releases DB client even on error (finally block)", async () => {
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })  // BEGIN
      .mockRejectedValueOnce(new Error("Explosion"))      // SELECT throws
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });  // ROLLBACK
    await flagUser({
      firebaseUid:   "test-uid",
      violationType: "SUSPICIOUS_TIMING",
    });
    expect(mocks.mockClientRelease).toHaveBeenCalled();
  });
});

// ============================================================
// getTrustInfo
// ============================================================

describe("getTrustInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isImmuneFromUAC).mockResolvedValue(false);
  });

  it("returns full trust info for known user", async () => {
    mocks.mockPoolQuery.mockResolvedValueOnce({
      rows:     [{ trust_score: 85, is_shadow_banned: false, is_hard_banned: false }],
      rowCount: 1,
    });
    const result = await getTrustInfo("test-uid");
    expect(result.trustScore).toBe(85);
    expect(result.tier).toBe("CLEAN");
    expect(result.isShadowBanned).toBe(false);
    expect(result.isHardBanned).toBe(false);
  });

  it("returns UNKNOWN defaults for missing user", async () => {
    mocks.mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const result = await getTrustInfo("ghost-uid");
    expect(result.trustScore).toBe(100);
    expect(result.tier).toBe("UNKNOWN");
  });

  it("returns shadow banned state correctly", async () => {
    mocks.mockPoolQuery.mockResolvedValueOnce({
      rows:     [{ trust_score: 10, is_shadow_banned: true, is_hard_banned: false }],
      rowCount: 1,
    });
    const result = await getTrustInfo("shadow-uid");
    expect(result.isShadowBanned).toBe(true);
    expect(result.tier).toBe("SHADOW_BANNED");
  });

  it("returns hard banned state correctly", async () => {
    mocks.mockPoolQuery.mockResolvedValueOnce({
      rows:     [{ trust_score: 0, is_shadow_banned: false, is_hard_banned: true }],
      rowCount: 1,
    });
    const result = await getTrustInfo("hard-banned-uid");
    expect(result.isHardBanned).toBe(true);
    expect(result.tier).toBe("HARD_BANNED");
  });

  it("returns CLEAN defaults when immune — skips DB entirely", async () => {
    vi.mocked(isImmuneFromUAC).mockResolvedValue(true);
    const result = await getTrustInfo("dev-uid");
    expect(result.trustScore).toBe(100);
    expect(result.tier).toBe("CLEAN");
    expect(mocks.mockPoolQuery).not.toHaveBeenCalled();
  });

  it("handles DB error gracefully — returns CLEAN safe default", async () => {
    mocks.mockPoolQuery.mockRejectedValueOnce(new Error("DB down"));
    const result = await getTrustInfo("test-uid");
    expect(result.trustScore).toBe(100);
    expect(result.tier).toBe("CLEAN");
  });

  it("defaults null trust_score to 100", async () => {
    mocks.mockPoolQuery.mockResolvedValueOnce({
      rows:     [{ trust_score: null, is_shadow_banned: false, is_hard_banned: false }],
      rowCount: 1,
    });
    const result = await getTrustInfo("test-uid");
    expect(result.trustScore).toBe(100);
  });
});

// ============================================================
// manualTrustAdjust — LINES 300-362
// ============================================================

describe("manualTrustAdjust", () => {
  beforeEach(() => vi.clearAllMocks());

  it("successfully adjusts trust score", async () => {
    mocks.mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ trust_score: 80 }], rowCount: 1 }) // SELECT old
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })                     // UPDATE users
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });                    // INSERT log
    const result = await manualTrustAdjust("target-uid", 60, "admin-uid", "test");
    expect(result.success).toBe(true);
    expect(result.newScore).toBe(60);
  });

  it("clamps score above 100 to 100", async () => {
    mocks.mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ trust_score: 80 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const result = await manualTrustAdjust("uid", 999, "admin", "test");
    expect(result.newScore).toBe(100);
  });

  it("clamps score below 0 to 0", async () => {
    mocks.mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ trust_score: 50 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const result = await manualTrustAdjust("uid", -999, "admin", "test");
    expect(result.newScore).toBe(0);
  });

  it("sets is_hard_banned = true when score = 0", async () => {
    mocks.mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ trust_score: 50 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const result = await manualTrustAdjust("uid", 0, "admin", "hard ban");
    expect(result.success).toBe(true);
    expect(result.newScore).toBe(0);
    // UPDATE users was called with isHardBanned=true
    const updateCall = mocks.mockPoolQuery.mock.calls.find(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("UPDATE users")
    );
    expect(updateCall![1]).toContain(true); // isHardBanned
  });

  it("sets is_shadow_banned = true when score is 1-19", async () => {
    mocks.mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ trust_score: 80 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const result = await manualTrustAdjust("uid", 10, "admin", "shadow");
    expect(result.newScore).toBe(10);
    const updateCall = mocks.mockPoolQuery.mock.calls.find(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("UPDATE users")
    );
    const params = updateCall![1] as unknown[];
    expect(params[1]).toBe(true);  // isShadowBanned
    expect(params[2]).toBe(false); // isHardBanned
  });

  it("sets both bans to false when score = 100 (unban)", async () => {
    mocks.mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ trust_score: 0 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const result = await manualTrustAdjust("uid", 100, "admin", "unban");
    expect(result.newScore).toBe(100);
    const updateCall = mocks.mockPoolQuery.mock.calls.find(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("UPDATE users")
    );
    const params = updateCall![1] as unknown[];
    expect(params[1]).toBe(false); // isShadowBanned
    expect(params[2]).toBe(false); // isHardBanned
  });

  it("writes audit log to trust_recovery_log", async () => {
    mocks.mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ trust_score: 80 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    await manualTrustAdjust("target-uid", 50, "admin-uid", "audit test");
    const logCall = mocks.mockPoolQuery.mock.calls.find(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("trust_recovery_log")
    );
    expect(logCall).toBeDefined();
    expect(logCall![1]).toContain("target-uid");
    expect(logCall![1]).toContain(80);  // old_score
    expect(logCall![1]).toContain(50);  // new_score
  });

  it("reads old score before updating (for accurate audit)", async () => {
    mocks.mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ trust_score: 75 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    await manualTrustAdjust("uid", 90, "admin", "restore");
    const firstCall = mocks.mockPoolQuery.mock.calls[0];
    expect((firstCall![0] as string)).toContain("SELECT trust_score");
  });

  it("defaults old_score to 100 when user not found", async () => {
    mocks.mockPoolQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // SELECT — no user
      .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // UPDATE still runs
      .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // INSERT log
    const result = await manualTrustAdjust("ghost-uid", 50, "admin", "test");
    expect(result.success).toBe(true);
    // old_score defaults to 100 → check log call
    const logCall = mocks.mockPoolQuery.mock.calls.find(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("trust_recovery_log")
    );
    expect(logCall![1]).toContain(100); // defaulted old_score
  });

  it("returns success: false and newScore: -1 on DB error", async () => {
    mocks.mockPoolQuery.mockRejectedValueOnce(new Error("DB gone"));
    const result = await manualTrustAdjust("uid", 50, "admin", "test");
    expect(result.success).toBe(false);
    expect(result.newScore).toBe(-1);
  });
});
