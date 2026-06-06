import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// CONFIG MOCK — disable config.isTest guard
// fingerprintEngine.ts returns early when config.isTest = true
// We must override this so the function body actually runs
// ============================================================

vi.mock("../config", () => ({
  config: {
    isTest:            false,
    isProduction:      false,
    nodeEnv:           "test",
    logLevel:          "silent",
    fingerprintSalt:   "test-salt-32-chars-minimum-here!",
  },
}));

// ============================================================
// POOL MOCK
// ============================================================

const mockQuery = vi.hoisted(() => vi.fn());

vi.mock("../config/database", () => ({
  pool: { query: mockQuery },
}));

// ============================================================
// REDIS MOCK — engine uses redis.exists + redis.set for VPN debounce
// ============================================================

vi.mock("../config/redis", () => ({
  redis: {
    exists: vi.fn().mockResolvedValue(1), // pretend VPN already checked → skip
    set:    vi.fn().mockResolvedValue("OK"),
    get:    vi.fn().mockResolvedValue(null),
  },
}));

// ============================================================
// LOGGER MOCK
// ============================================================

vi.mock("../utils/logger", () => ({
  logger: {
    error: vi.fn(),
    warn:  vi.fn(),
    info:  vi.fn(),
    debug: vi.fn(),
  },
}));

// ============================================================
// IMMUNITY + VPN MOCKS
// ============================================================

vi.mock("../services/immunityCheck", () => ({
  isImmuneFromUAC: vi.fn().mockResolvedValue(false),
}));

vi.mock("../services/vpnDetection", () => ({
  checkVpnProxy: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports (after all mocks) ──────────────────────────────

import {
  recordFingerprint,
  checkMultiAccount,
} from "../services/fingerprintEngine";

// ============================================================
// recordFingerprint
// ============================================================

describe("fingerprintEngine — recordFingerprint", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it("inserts fingerprint record into DB", async () => {
    await recordFingerprint("test-uid", "192.168.1.1", "Mozilla/5.0");
    // No visitorId → exactly 1 INSERT (legacy hash only)
    expect(mockQuery).toHaveBeenCalledOnce();
    const sql = mockQuery.mock.calls[0]![0] as string;
    expect(sql).toContain("INSERT INTO device_fingerprints");
    expect(sql).toContain("ON CONFLICT");
    const params = mockQuery.mock.calls[0]![1] as unknown[];
    expect(params[0]).toBe("test-uid");
    expect(params[2]).toBe("192.168.1.1");
    expect(params[3]).toBe("Mozilla/5.0");
  });

  it("strips ::ffff: IPv6 prefix from IP address", async () => {
    await recordFingerprint("test-uid", "::ffff:192.168.1.1", "Mozilla/5.0");
    expect(mockQuery).toHaveBeenCalledOnce();
    const params = mockQuery.mock.calls[0]![1] as string[];
    expect(params[2]).toBe("192.168.1.1");
    expect(params[2]).not.toContain("::ffff:");
  });

  it("does nothing when IP is missing", async () => {
    await recordFingerprint("test-uid", undefined, "Mozilla/5.0");
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("does nothing when userAgent is missing", async () => {
    await recordFingerprint("test-uid", "192.168.1.1", undefined);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("handles DB errors gracefully without throwing", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB connection failed"));
    await expect(
      recordFingerprint("test-uid", "192.168.1.1", "Mozilla/5.0")
    ).resolves.toBeUndefined();
  });

  it("stores fingerprint hash not raw IP+UA", async () => {
    await recordFingerprint("test-uid", "10.0.0.1", "Chrome/100");
    expect(mockQuery).toHaveBeenCalledOnce();
    const params = mockQuery.mock.calls[0]![1] as string[];
    // params[1] = fingerprintHash — full SHA256 = 64 hex chars
    expect(params[1]).toHaveLength(64);
    expect(params[1]).not.toContain("10.0.0.1");
    expect(params[1]).not.toContain("Chrome");
    expect(params[1]).toMatch(/^[a-f0-9]{64}$/);
  });
});

// ============================================================
// checkMultiAccount
// ============================================================

describe("fingerprintEngine — checkMultiAccount", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("returns empty when no other accounts found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await checkMultiAccount("uid-1", "192.168.1.1", "Mozilla/5.0");
    expect(result.otherAccountsCount).toBe(0);
    expect(result.otherUids).toEqual([]);
  });

  it("returns other UIDs when multi-account detected", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { firebase_uid: "other-uid-1" },
        { firebase_uid: "other-uid-2" },
      ],
    });
    const result = await checkMultiAccount("uid-1", "192.168.1.1", "Mozilla/5.0");
    expect(result.otherAccountsCount).toBe(2);
    expect(result.otherUids).toContain("other-uid-1");
    expect(result.otherUids).toContain("other-uid-2");
  });

  it("returns empty when IP is missing", async () => {
    const result = await checkMultiAccount("uid-1", undefined, "Mozilla/5.0");
    expect(result.otherAccountsCount).toBe(0);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns empty when userAgent is missing", async () => {
    const result = await checkMultiAccount("uid-1", "192.168.1.1", undefined);
    expect(result.otherAccountsCount).toBe(0);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("handles DB errors gracefully", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));
    const result = await checkMultiAccount("uid-1", "192.168.1.1", "Mozilla/5.0");
    expect(result.otherAccountsCount).toBe(0);
    expect(result.otherUids).toEqual([]);
  });

  it("generates consistent hash for same IP+UA combination", async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await checkMultiAccount("uid-1", "10.0.0.1", "Chrome/100");
    await checkMultiAccount("uid-2", "10.0.0.1", "Chrome/100");
    const hashes1 = (mockQuery.mock.calls[0]![1] as [string[], string])[0];
    const hashes2 = (mockQuery.mock.calls[1]![1] as [string[], string])[0];
    // Same IP + UA → identical legacy hash
    expect(hashes1[0]).toBe(hashes2[0]);
    expect(hashes1[0]).toHaveLength(64);
    expect(hashes1[0]).toMatch(/^[a-f0-9]{64}$/);
  });

  it("generates different hash for different IP", async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await checkMultiAccount("uid-1", "10.0.0.1", "Chrome/100");
    await checkMultiAccount("uid-2", "10.0.0.2", "Chrome/100");
    const hash1 = (mockQuery.mock.calls[0]![1] as string[])[0];
    const hash2 = (mockQuery.mock.calls[1]![1] as string[])[0];
    expect(hash1).not.toBe(hash2);
  });
});
