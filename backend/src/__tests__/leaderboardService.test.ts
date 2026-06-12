import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/database", () => ({ pool: { query: vi.fn() }, withTransaction: vi.fn() }));
vi.mock("../utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { pool } from "../config/database";
import { getLeaderboard } from "../services/leaderboardService";

describe("leaderboardService", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe("getLeaderboard", () => {
    const mockUsers = [
      { id: 1, username: "alpha", level: 50, value: 5000 },
      { id: 2, username: "beta", level: 40, value: 4000 },
    ];

    it("returns entries by level", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ total: 10 }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: mockUsers, rowCount: 2 } as never);
      const result = await getLeaderboard("level");
      expect(result.total).toBe(10);
      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].rank).toBe(1);
      expect(result.entries[0].username).toBe("alpha");
    });

    it("returns entries by money", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ total: 5 }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: mockUsers, rowCount: 2 } as never);
      const result = await getLeaderboard("money");
      expect(result.entries[0].value).toBe(5000);
    });

    it("returns entries by points", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ total: 5 }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: mockUsers, rowCount: 2 } as never);
      const result = await getLeaderboard("points");
      expect(result.entries).toHaveLength(2);
    });

    it("returns entries by crimes with join", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ total: 5 }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: mockUsers, rowCount: 2 } as never);
      const result = await getLeaderboard("crimes");
      expect(result.entries).toHaveLength(2);
    });

    it("defaults to level for unknown type", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ total: 5 }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: mockUsers, rowCount: 2 } as never);
      const result = await getLeaderboard("invalid" as never);
      expect(result.entries[0].level).toBe(50);
    });

    it("respects limit and offset", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ total: 10 }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [mockUsers[1]], rowCount: 1 } as never);
      const result = await getLeaderboard("level", 1, 1);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].rank).toBe(2);
    });

    it("returns empty when no users", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ total: 0 }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      const result = await getLeaderboard("level");
      expect(result.entries).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });
});
