import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/database", () => ({ pool: { query: vi.fn() }, withTransaction: vi.fn(async (fn) => fn({ query: vi.fn() })) }));
vi.mock("../utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { pool } from "../config/database";
import { getAvailable, startMission } from "../services/missionService";

describe("missionService", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getAvailable", () => {
    it("returns missions with status", async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ id: 1, name: "Test", description: "", objectives: [], rewards: {}, min_level: 1, repeatable: false, cooldown_h: 0, status: "new", progress: null }], rowCount: 1 } as never);
      const missions = await getAvailable(1);
      expect(missions.length).toBeGreaterThan(0);
    });
  });

  describe("startMission", () => {
    it("starts a mission when qualified", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ id: 1, name: "First Blood", description: "", min_level: 1 }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [{ level: 5 }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [{ id: 10, mission_id: 1, progress: {}, status: "active", started_at: "", completed_at: null }], rowCount: 1 } as never);
      const um = await startMission(1, 1);
      expect(um.status).toBe("active");
    });

    it("throws if level too low", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ id: 5, name: "Hard", description: "", min_level: 20 }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [{ level: 5 }], rowCount: 1 } as never);
      await expect(startMission(1, 5)).rejects.toThrow(/level/i);
    });
  });
});
