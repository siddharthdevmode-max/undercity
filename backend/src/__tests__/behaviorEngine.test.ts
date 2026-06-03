import { describe, it, expect, beforeEach, vi } from "vitest";

const mockStore = vi.hoisted(() => ({
  data: {} as Record<string, string[]>,
}));

vi.mock("../config/redis", () => ({
  default: {
    rpush: vi.fn(async (key: string, _value: string) => {
      // Don't actually push — we control the data via seedTimings
      // This prevents real Date.now() from disrupting seeded timestamps
      if (!mockStore.data[key]) mockStore.data[key] = [];
      return mockStore.data[key].length;
    }),
    ltrim: vi.fn(async () => {}),
    expire: vi.fn(async () => 1),
    lrange: vi.fn(async (key: string) => mockStore.data[key] ?? []),
  },
}));

vi.mock("../services/trustEngine", () => ({
  flagUser: vi.fn().mockResolvedValue({
    newTrustScore: 85,
    tier: "CLEAN",
    isBanned: false,
  }),
}));

import { recordAndAnalyze, analyzeBehavior } from "../services/behaviorEngine";
import { flagUser } from "../services/trustEngine";

function seedTimings(uid: string, timestamps: number[]) {
  mockStore.data[`timing:${uid}`] = timestamps.map(String);
}

describe("behaviorEngine — recordAndAnalyze", () => {
  beforeEach(() => {
    mockStore.data = {};
    vi.clearAllMocks();
  });

  it("returns null when fewer than 7 attempts in store", async () => {
    // With rpush mocked to not add, 5 stored = 5 < MIN_ATTEMPTS_TO_ANALYZE (8)
    seedTimings("test-few", [1000, 2000, 3000, 4000, 5000]);
    const result = await recordAndAnalyze("test-few");
    expect(result).toBeNull();
  });

  it("returns analysis object after 8+ timestamps", async () => {
    const now = Date.now();
    seedTimings("test-enough", Array.from({ length: 10 }, (_, i) => now + i * 500));
    const result = await recordAndAnalyze("test-enough");
    expect(result).not.toBeNull();
    expect(result).toHaveProperty("isBotLike");
    expect(result).toHaveProperty("stddev");
    expect(result).toHaveProperty("attemptCount");
  });

  it("detects bot-like timing (equal intervals → stddev = 0)", async () => {
    const now = Date.now();
    // All gaps exactly 100ms → stddev = 0 → isBotLike = true
    seedTimings("test-bot", Array.from({ length: 10 }, (_, i) => now + i * 100));
    const result = await recordAndAnalyze("test-bot");
    expect(result).not.toBeNull();
    expect(result!.stddev).toBe(0);
    expect(result!.isBotLike).toBe(true);
  });

  it("does not flag human-like timing (high stddev)", async () => {
    const now = Date.now();
    // Very irregular gaps: 200, 3000, 500, 5000, 1200, 800, 4500, 200, 2000
    const offsets = [0, 200, 3200, 3700, 8700, 9900, 10700, 15200, 15400, 17400];
    seedTimings("test-human", offsets.map((t) => now + t));
    const result = await recordAndAnalyze("test-human");
    expect(result).not.toBeNull();
    expect(result!.stddev).toBeGreaterThan(150);
    expect(result!.isBotLike).toBe(false);
  });
});

describe("behaviorEngine — analyzeBehavior", () => {
  beforeEach(() => {
    mockStore.data = {};
    vi.clearAllMocks();
  });

  it("calls flagUser when bot-like behavior detected", async () => {
    const uid = "test-flag-bot";
    const now = Date.now();
    // Equal intervals → stddev = 0 → flagged
    seedTimings(uid, Array.from({ length: 10 }, (_, i) => now + i * 50));
    await analyzeBehavior(uid, "127.0.0.1", "TestAgent/1.0");
    expect(flagUser).toHaveBeenCalledWith(
      expect.objectContaining({
        firebaseUid:   uid,
        violationType: "SUSPICIOUS_TIMING",
      })
    );
  });

  it("does not flag human-like behavior", async () => {
    const uid = "test-noflag";
    const now = Date.now();
    const offsets = [0, 800, 3300, 5000, 9200, 12000, 16500, 20000, 25000, 30000];
    seedTimings(uid, offsets.map((t) => now + t));
    await analyzeBehavior(uid, "127.0.0.1", "TestAgent/1.0");
    expect(flagUser).not.toHaveBeenCalled();
  });

  it("does nothing when fewer than 8 attempts", async () => {
    await analyzeBehavior("test-few-2", "127.0.0.1", "TestAgent/1.0");
    expect(flagUser).not.toHaveBeenCalled();
  });
});
