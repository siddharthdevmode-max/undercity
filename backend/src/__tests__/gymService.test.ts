import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/database", () => ({ pool: { query: vi.fn() }, withTransaction: vi.fn(async (fn) => fn({ query: vi.fn() })) }));
vi.mock("../utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { pool } from "../config/database";
import { getStats, train } from "../services/gymService";

describe("gymService", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getStats", () => {
    it("returns user stats with energy", async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ strength: 10, speed: 5, defense: 8, dexterity: 3, energy: 50, max_energy: 100 }], rowCount: 1 } as never);
      const stats = await getStats(1);
      expect(stats.strength).toBe(10);
      expect(stats.energy).toBe(50);
    });

    it("throws if user not found", async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      await expect(getStats(999)).rejects.toThrow();
    });
  });

  describe("train", () => {
    it("increases stat and decreases energy on success", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ energy: 50, max_energy: 100, strength: 10, speed: 5, defense: 8, dexterity: 3 }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [{ strength: 11, energy: 40 }], rowCount: 1 } as never);
      const result = await train(1, "strength");
      expect(result.stat).toBe("strength");
      expect(result.gained).toBeGreaterThanOrEqual(1);
      expect(result.energy).toBe(40);
    });

    it("throws if not enough energy", async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ energy: 5, max_energy: 100 }], rowCount: 1 } as never);
      await expect(train(1, "strength")).rejects.toThrow(/energy/i);
    });

    it("throws for invalid stat", async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ energy: 50, max_energy: 100 }], rowCount: 1 } as never);
      await expect(train(1, "luck")).rejects.toThrow();
    });
  });
});
