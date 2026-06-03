import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// MOCK POOL — must use vi.hoisted
// ============================================================

const mockQuery = vi.hoisted(() => vi.fn());

vi.mock("../config/database", () => ({
  pool: { query: mockQuery },
}));

vi.mock("../utils/logger", () => ({
  logger: {
    error: vi.fn(),
    warn:  vi.fn(),
    info:  vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  recordFingerprint,
  checkMultiAccount,
} from "../services/fingerprintEngine";

describe("fingerprintEngine — recordFingerprint", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it("inserts fingerprint record into DB", async () => {
    await recordFingerprint("test-uid", "192.168.1.1", "Mozilla/5.0");
    expect(mockQuery).toHaveBeenCalledOnce();
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain("INSERT INTO device_fingerprints");
    expect(sql).toContain("ON CONFLICT");
  });

  it("strips ::ffff: IPv6 prefix from IP address", async () => {
    await recordFingerprint("test-uid", "::ffff:192.168.1.1", "Mozilla/5.0");
    expect(mockQuery).toHaveBeenCalledOnce();
    const params = mockQuery.mock.calls[0][1] as string[];
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
    const params = mockQuery.mock.calls[0][1] as string[];
    // params[1] is fingerprintHash — should be 32 char hex, not raw values
    expect(params[1]).toHaveLength(32);
    expect(params[1]).not.toContain("10.0.0.1");
    expect(params[1]).not.toContain("Chrome");
  });
});

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
    const hash1 = (mockQuery.mock.calls[0][1] as string[])[0];
    const hash2 = (mockQuery.mock.calls[1][1] as string[])[0];
    expect(hash1).toStrictEqual(hash2);
  });

  it("generates different hash for different IP", async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await checkMultiAccount("uid-1", "10.0.0.1", "Chrome/100");
    await checkMultiAccount("uid-2", "10.0.0.2", "Chrome/100");
    const hash1 = (mockQuery.mock.calls[0][1] as string[])[0];
    const hash2 = (mockQuery.mock.calls[1][1] as string[])[0];
    expect(hash1).not.toBe(hash2);
  });
});
