import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../config", () => ({
  config: {
    isTest:       false,
    isProduction: false,
    nodeEnv:      "test",
    logLevel:     "silent",
  },
}));

const mockStore = vi.hoisted(() => ({
  strings:    {} as Record<string, string>,
  lists:      {} as Record<string, string[]>,
  sortedSets: {} as Record<string, Map<string, number>>,
}));

vi.mock("../config/redis", () => {
  const makePipeline = () => {
    let _incrbyKey = "";
    let _incrbyAmt = 0;

    const pipe = {
      rpush:            vi.fn().mockReturnThis(),
      ltrim:            vi.fn().mockReturnThis(),
      expire:           vi.fn().mockReturnThis(),
      zadd:             vi.fn().mockReturnThis(),
      zremrangebyscore: vi.fn().mockReturnThis(),

      incrby: vi.fn((key: string, amount: number) => {
        _incrbyKey = key;
        _incrbyAmt = amount;
        return pipe;
      }),

      exec: vi.fn(async () => {
        if (_incrbyKey) {
          const current = parseInt(mockStore.strings[_incrbyKey] ?? "0", 10);
          const next    = current + _incrbyAmt;
          mockStore.strings[_incrbyKey] = String(next);
          return [[null, next], [null, "OK"]];
        }
        return [[null, 1], [null, "OK"]];
      }),
    };
    return pipe;
  };

  return {
    redis: {
      pipeline: vi.fn(makePipeline),

      rpush: vi.fn(async (key: string, value: string) => {
        if (!mockStore.lists[key]) mockStore.lists[key] = [];
        if (!key.startsWith("timing:")) {
          mockStore.lists[key].push(value);
        }
        return mockStore.lists[key].length;
      }),

      ltrim: vi.fn(async (key: string, start: number, stop: number) => {
        if (!mockStore.lists[key]) return;
        const len       = mockStore.lists[key].length;
        const realStart = start < 0 ? Math.max(0, len + start) : start;
        const realStop  = stop  < 0 ? len + stop               : stop;
        mockStore.lists[key] = mockStore.lists[key].slice(realStart, realStop + 1);
      }),

      lrange: vi.fn(async (key: string, start: number, stop: number) => {
        if (!mockStore.lists[key]) return [];
        const list      = mockStore.lists[key];
        const len       = list.length;
        const realStart = start < 0 ? Math.max(0, len + start) : start;
        const realStop  = stop  < 0 ? len + stop : Math.min(stop, len - 1);
        return list.slice(realStart, realStop + 1);
      }),

      get: vi.fn(async (key: string) => mockStore.strings[key] ?? null),

      set: vi.fn(async (key: string, val: string, ...args: unknown[]) => {
        const isNx = args.includes("NX");
        if (isNx && mockStore.strings[key] !== undefined) return null;
        mockStore.strings[key] = String(val);
        return "OK";
      }),

      incrby: vi.fn(async (key: string, amount: number) => {
        const current          = parseInt(mockStore.strings[key] ?? "0", 10);
        const next             = current + amount;
        mockStore.strings[key] = String(next);
        return next;
      }),

      mget: vi.fn(async (...keys: unknown[]) => {
        const resolvedKeys = Array.isArray(keys[0])
          ? (keys[0] as string[])
          : (keys as string[]);
        return resolvedKeys.map((k) => mockStore.strings[k] ?? null);
      }),

      exists: vi.fn(async (key: string) =>
        mockStore.strings[key] !== undefined ? 1 : 0
      ),

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

      zremrangebyscore: vi.fn(async (
        key: string,
        min: string | number,
        max: string | number
      ) => {
        if (!mockStore.sortedSets[key]) return 0;
        const minVal = min === "-inf" ? -Infinity : Number(min);
        const maxVal = max === "+inf" ?  Infinity : Number(max);
        let removed  = 0;
        for (const [member, score] of mockStore.sortedSets[key].entries()) {
          if (score >= minVal && score <= maxVal) {
            mockStore.sortedSets[key].delete(member);
            removed++;
          }
        }
        return removed;
      }),

      expire: vi.fn(async () => 1),
    },
  };
});

vi.mock("../services/trustEngine", () => ({
  flagUser: vi.fn().mockResolvedValue({
    newTrustScore: 85,
    tier:          "CLEAN",
    isBanned:      false,
  }),
}));

vi.mock("../services/immunityCheck", () => ({
  isImmuneFromUAC: vi.fn().mockResolvedValue(false),
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

function resetStore() {
  mockStore.strings    = {};
  mockStore.lists      = {};
  mockStore.sortedSets = {};
  vi.clearAllMocks();
}

// ── recordAndAnalyze ──────────────────────────────────────

describe("behaviorEngine — recordAndAnalyze", () => {
  beforeEach(resetStore);

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
    const now     = Date.now();
    const offsets = [0, 200, 3200, 3700, 8700, 9900, 10700, 15200, 15400, 17400];
    seedTimings("test-human", offsets.map((t) => now + t));
    const result = await recordAndAnalyze("test-human");
    expect(result).not.toBeNull();
    expect(result!.stddev).toBeGreaterThan(150);
    expect(result!.isBotLike).toBe(false);
  });
});

// ── analyzeBehavior ───────────────────────────────────────

describe("behaviorEngine — analyzeBehavior", () => {
  beforeEach(resetStore);

  it("calls flagUser when bot-like behavior detected", async () => {
    const uid = "test-flag-bot";
    const now = Date.now();
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
    const uid     = "test-noflag";
    const now     = Date.now();
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

// ── trackEarningsVelocity ─────────────────────────────────
// Engine constants:
//   EARNINGS_SPIKE_MULTIPLIER = 10
//   EARNINGS_MIN_SAMPLES      = 5
//   EARNINGS_MIN_FLOOR        = 500
//
// To trigger: currentHourTotal > avgEarnings * 10
//             AND avgEarnings >= 500
//
// Seed: 6 past hours at $1000/hr each → avg = $1000 (above $500 floor)
//       Current hour seeded at $50000 → after incrby +100 = $50100
//       $50100 > $1000 * 10 ($10000) → FLAG ✅

describe("behaviorEngine — trackEarningsVelocity", () => {
  beforeEach(resetStore);

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
    const uid           = "test-velocity";
    const now           = Date.now();
    const currentBucket = Math.floor(now / (3600 * 1000));

    // Seed 6 past hour buckets in history sorted set
    const historyKey = `earnings:hist:${uid}`;
    mockStore.sortedSets[historyKey] = new Map();
    for (let i = 1; i <= 6; i++) {
      const bucket = currentBucket - i;
      mockStore.sortedSets[historyKey].set(`${bucket}`, bucket);
    }

    // Seed past hour totals at $1000 each → avg = $1000 (above $500 floor)
    for (let i = 1; i <= 6; i++) {
      const bucket = currentBucket - i;
      mockStore.strings[`earnings:total:${uid}:${bucket}`] = "1000";
    }

    // Seed current hour at $50000
    // Pipeline incrby adds moneyEarned (100) → total = $50100
    // $50100 > $1000 * 10 → triggers flag
    mockStore.strings[`earnings:h:${uid}:${currentBucket}`] = "50000";

    await trackEarningsVelocity(uid, 100, "127.0.0.1", "TestAgent");

    expect(flagUser).toHaveBeenCalledWith(
      expect.objectContaining({
        firebaseUid:   uid,
        violationType: "EARNINGS_VELOCITY",
      })
    );
  });
});

// ── trackActiveHours ──────────────────────────────────────

describe("behaviorEngine — trackActiveHours", () => {
  beforeEach(resetStore);

  it("does not flag with low activity", async () => {
    await trackActiveHours("test-uid", "127.0.0.1", "TestAgent");
    expect(flagUser).not.toHaveBeenCalled();
  });

  it("flags when active 23+ hours in 24h", async () => {
    const uid           = "test-active";
    const activeKey     = `active:${uid}`;
    const now           = Date.now();
    const currentBucket = Math.floor(now / (15 * 60 * 1000));

    mockStore.sortedSets[activeKey] = new Map();
    for (let i = 0; i < 93; i++) {
      const bucket = currentBucket - i;
      mockStore.sortedSets[activeKey].set(bucket.toString(), bucket);
    }

    await trackActiveHours(uid, "127.0.0.1", "TestAgent");

    expect(flagUser).toHaveBeenCalledWith(
      expect.objectContaining({
        firebaseUid:   uid,
        violationType: "ACTIVE_HOURS_ANOMALY",
      })
    );
  });
});

// ── trackSuccessRate ──────────────────────────────────────

describe("behaviorEngine — trackSuccessRate", () => {
  beforeEach(resetStore);

  it("does not flag with insufficient data", async () => {
    await trackSuccessRate("test-uid", true);
    expect(flagUser).not.toHaveBeenCalled();
  });

  it("flags when success rate spikes 30%+ above baseline", async () => {
    const uid         = "test-spike";
    const recentKey   = `sr:recent:${uid}`;
    const baselineKey = `sr:base:${uid}`;

    mockStore.lists[baselineKey] = [
      ...Array.from({ length: 15 }, () => "1"),
      ...Array.from({ length: 35 }, () => "0"),
      ...Array.from({ length: 15 }, () => "1"),
      ...Array.from({ length: 35 }, () => "0"),
    ];

    mockStore.lists[recentKey] = [
      ...Array.from({ length: 40 }, () => "1"),
      ...Array.from({ length: 10 }, () => "0"),
    ];

    await trackSuccessRate(uid, true, "127.0.0.1", "TestAgent");

    expect(flagUser).toHaveBeenCalledWith(
      expect.objectContaining({
        firebaseUid:   uid,
        violationType: "SUCCESS_RATE_SPIKE",
      })
    );
  });

  it("does not flag normal success rates", async () => {
    const uid         = "test-normal";
    const recentKey   = `sr:recent:${uid}`;
    const baselineKey = `sr:base:${uid}`;

    mockStore.lists[baselineKey] = [
      ...Array.from({ length: 25 }, () => "1"),
      ...Array.from({ length: 25 }, () => "0"),
      ...Array.from({ length: 25 }, () => "1"),
      ...Array.from({ length: 25 }, () => "0"),
    ];

    mockStore.lists[recentKey] = [
      ...Array.from({ length: 28 }, () => "1"),
      ...Array.from({ length: 22 }, () => "0"),
    ];

    await trackSuccessRate(uid, true, "127.0.0.1", "TestAgent");

    expect(flagUser).not.toHaveBeenCalled();
  });
});
