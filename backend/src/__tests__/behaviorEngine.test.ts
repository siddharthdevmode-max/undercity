import { describe, it, expect, beforeEach, vi } from "vitest";

// ============================================================
// MOCK REDIS — full mock supporting all Redis commands used
// Timing keys are special-cased so seeded timestamps do not get
// polluted by a fresh Date.now() push during tests.
// ============================================================

const mockStore = vi.hoisted(() => ({
  strings: {} as Record<string, string>,
  lists: {} as Record<string, string[]>,
  sortedSets: {} as Record<string, Map<string, number>>,
}));

vi.mock("../config/redis", () => ({
  default: {
    // List operations
    rpush: vi.fn(async (key: string, value: string) => {
      if (!mockStore.lists[key]) mockStore.lists[key] = [];

      // Preserve seeded timing windows exactly as-is for timing tests
      if (key.startsWith("timing:")) {
        return mockStore.lists[key].length;
      }

      mockStore.lists[key].push(value);
      return mockStore.lists[key].length;
    }),

    ltrim: vi.fn(async (key: string, start: number, stop: number) => {
      if (!mockStore.lists[key]) return;
      const len = mockStore.lists[key].length;
      const realStart = start < 0 ? Math.max(0, len + start) : start;
      const realStop = stop < 0 ? len + stop : stop;
      mockStore.lists[key] = mockStore.lists[key].slice(realStart, realStop + 1);
    }),

    lrange: vi.fn(async (key: string, start: number, stop: number) => {
      if (!mockStore.lists[key]) return [];
      const len = mockStore.lists[key].length;
      const realStart = start < 0 ? Math.max(0, len + start) : start;
      const realStop = stop < 0 ? len + stop : stop;
      return mockStore.lists[key].slice(realStart, realStop + 1);
    }),

    // String operations
    get: vi.fn(async (key: string) => mockStore.strings[key] || null),

    incrby: vi.fn(async (key: string, amount: number) => {
      const current = parseInt(mockStore.strings[key] || "0");
      const next = current + amount;
      mockStore.strings[key] = String(next);
      return next;
    }),

    // Sorted set operations
    zadd: vi.fn(async (key: string, score: number, member: string) => {
      if (!mockStore.sortedSets[key]) mockStore.sortedSets[key] = new Map();
      mockStore.sortedSets[key].set(member, score);
      return 1;
    }),

    zrange: vi.fn(async (key: string) => {
      if (!mockStore.sortedSets[key]) return [];
      return Array.from(mockStore.sortedSets[key].keys());
    }),

    zcard: vi.fn(async (key: string) => {
      if (!mockStore.sortedSets[key]) return 0;
      return mockStore.sortedSets[key].size;
    }),

    zremrangebyscore: vi.fn(async (key: string, min: string | number, max: string | number) => {
      if (!mockStore.sortedSets[key]) return 0;

      const minVal = min === "-inf" ? -Infinity : Number(min);
      const maxVal = max === "+inf" ? Infinity : Number(max);

      let removed = 0;
      for (const [member, score] of mockStore.sortedSets[key].entries()) {
        if (score >= minVal && score <= maxVal) {
          mockStore.sortedSets[key].delete(member);
          removed++;
        }
      }
      return removed;
    }),

    // Common
    expire: vi.fn(async () => 1),
  },
}));

vi.mock("../services/trustEngine", () => ({
  flagUser: vi.fn().mockResolvedValue({
    newTrustScore: 85,
    tier: "CLEAN",
    isBanned: false,
  }),
}));

import {
  recordAndAnalyze,
  analyzeBehavior,
  trackEarningsVelocity,
  trackActiveHours,
  trackSuccessRate,
} from "../services/behaviorEngine";
import { flagUser } from "../services/trustEngine";

function seedTimings(uid: string, timestamps: number[]) {
  mockStore.lists[`timing:${uid}`] = timestamps.map(String);
}

function resetMocks() {
  mockStore.strings = {};
  mockStore.lists = {};
  mockStore.sortedSets = {};
  vi.clearAllMocks();
}

describe("behaviorEngine — recordAndAnalyze", () => {
  beforeEach(resetMocks);

  it("returns null when fewer than 8 attempts in store", async () => {
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
    seedTimings("test-bot", Array.from({ length: 10 }, (_, i) => now + i * 100));
    const result = await recordAndAnalyze("test-bot");
    expect(result).not.toBeNull();
    expect(result!.stddev).toBe(0);
    expect(result!.isBotLike).toBe(true);
  });

  it("does not flag human-like timing (high stddev)", async () => {
    const now = Date.now();
    const offsets = [0, 200, 3200, 3700, 8700, 9900, 10700, 15200, 15400, 17400];
    seedTimings("test-human", offsets.map((t) => now + t));
    const result = await recordAndAnalyze("test-human");
    expect(result).not.toBeNull();
    expect(result!.stddev).toBeGreaterThan(150);
    expect(result!.isBotLike).toBe(false);
  });
});

describe("behaviorEngine — analyzeBehavior", () => {
  beforeEach(resetMocks);

  it("calls flagUser when bot-like behavior detected", async () => {
    const uid = "test-flag-bot";
    const now = Date.now();
    seedTimings(uid, Array.from({ length: 10 }, (_, i) => now + i * 50));

    await analyzeBehavior(uid, "127.0.0.1", "TestAgent/1.0");

    expect(flagUser).toHaveBeenCalledWith(
      expect.objectContaining({
        firebaseUid: uid,
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

describe("behaviorEngine — trackEarningsVelocity", () => {
  beforeEach(resetMocks);

  it("does nothing when moneyEarned is 0", async () => {
    await trackEarningsVelocity("test-uid", 0);
    expect(flagUser).not.toHaveBeenCalled();
  });

  it("does nothing when moneyEarned is negative", async () => {
    await trackEarningsVelocity("test-uid", -500);
    expect(flagUser).not.toHaveBeenCalled();
  });

  it("does not flag with insufficient history", async () => {
    await trackEarningsVelocity("test-uid", 1000);
    expect(flagUser).not.toHaveBeenCalled();
  });

  it("flags when earnings spike exceeds 10x average", async () => {
    const uid = "test-velocity";
    const now = Date.now();
    const currentBucket = Math.floor(now / (3600 * 1000));

    const historyKey = `earnings:history:${uid}`;
    mockStore.sortedSets[historyKey] = new Map();

    for (let i = 1; i <= 6; i++) {
      const bucket = currentBucket - i;
      mockStore.sortedSets[historyKey].set(`${bucket}:100`, bucket);
    }

    const hourlyKey = `earnings:hourly:${uid}:${currentBucket}`;
    mockStore.strings[hourlyKey] = "5000";

    await trackEarningsVelocity(uid, 100, "127.0.0.1", "TestAgent");

    expect(flagUser).toHaveBeenCalledWith(
      expect.objectContaining({
        firebaseUid: uid,
        violationType: "EARNINGS_VELOCITY",
      })
    );
  });
});

describe("behaviorEngine — trackActiveHours", () => {
  beforeEach(resetMocks);

  it("does not flag with low activity", async () => {
    await trackActiveHours("test-uid", "127.0.0.1", "TestAgent");
    expect(flagUser).not.toHaveBeenCalled();
  });

  it("flags when active 23+ hours in 24h", async () => {
    const uid = "test-active";
    const activeKey = `active:${uid}`;
    const now = Date.now();
    const currentBucket = Math.floor(now / (15 * 60 * 1000));

    mockStore.sortedSets[activeKey] = new Map();
    for (let i = 0; i < 93; i++) {
      const bucket = currentBucket - i;
      mockStore.sortedSets[activeKey].set(bucket.toString(), bucket);
    }

    await trackActiveHours(uid, "127.0.0.1", "TestAgent");

    expect(flagUser).toHaveBeenCalledWith(
      expect.objectContaining({
        firebaseUid: uid,
        violationType: "ACTIVE_HOURS_ANOMALY",
      })
    );
  });
});

describe("behaviorEngine — trackSuccessRate", () => {
  beforeEach(resetMocks);

  it("does not flag with insufficient data", async () => {
    await trackSuccessRate("test-uid", true);
    expect(flagUser).not.toHaveBeenCalled();
  });

  it("flags when success rate spikes 30%+ above baseline", async () => {
    const uid = "test-spike";
    const recentKey = `success:recent:${uid}`;
    const baselineKey = `success:baseline:${uid}`;

    // First 50 entries ≈ 30% success so baselineOnly stays low
    const baselineData: string[] = [
      ...Array.from({ length: 15 }, () => "1"),
      ...Array.from({ length: 35 }, () => "0"),
      ...Array.from({ length: 15 }, () => "1"),
      ...Array.from({ length: 35 }, () => "0"),
    ];
    mockStore.lists[baselineKey] = baselineData;

    // 80% recent success
    const recentData: string[] = [
      ...Array.from({ length: 40 }, () => "1"),
      ...Array.from({ length: 10 }, () => "0"),
    ];
    mockStore.lists[recentKey] = recentData;

    await trackSuccessRate(uid, true, "127.0.0.1", "TestAgent");

    expect(flagUser).toHaveBeenCalledWith(
      expect.objectContaining({
        firebaseUid: uid,
        violationType: "SUCCESS_RATE_SPIKE",
      })
    );
  });

  it("does not flag normal success rates", async () => {
    const uid = "test-normal";
    const recentKey = `success:recent:${uid}`;
    const baselineKey = `success:baseline:${uid}`;

    const baselineData: string[] = [
      ...Array.from({ length: 25 }, () => "1"),
      ...Array.from({ length: 25 }, () => "0"),
      ...Array.from({ length: 25 }, () => "1"),
      ...Array.from({ length: 25 }, () => "0"),
    ];
    mockStore.lists[baselineKey] = baselineData;

    const recentData: string[] = [
      ...Array.from({ length: 28 }, () => "1"),
      ...Array.from({ length: 22 }, () => "0"),
    ];
    mockStore.lists[recentKey] = recentData;

    await trackSuccessRate(uid, true, "127.0.0.1", "TestAgent");

    expect(flagUser).not.toHaveBeenCalled();
  });
});
