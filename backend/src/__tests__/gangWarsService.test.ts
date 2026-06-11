import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/database", () => ({ pool: { query: vi.fn() }, withTransaction: vi.fn(async (fn) => fn({ query: vi.fn() })) }));
vi.mock("../utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { pool } from "../config/database";
import { getWars, declareWar } from "../services/gangWarsService";

describe("gangWarsService", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getWars", () => {
    it("returns wars for a gang", async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ id: 1, attacker_id: 1, defender_id: 2, status: "active", attacker_score: 10, defender_score: 5, attacker_name: "Alpha", defender_name: "Beta" }], rowCount: 1 } as never);
      const wars = await getWars(1);
      expect(wars.length).toBeGreaterThan(0);
    });
  });

  describe("declareWar", () => {
    it("declares war as leader", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ gang_id: 1, role: "leader" }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rowCount: 1 } as never);
      await expect(declareWar(1, 2)).resolves.not.toThrow();
    });

    it("throws if not a leader", async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      await expect(declareWar(1, 2)).rejects.toThrow(/leader/i);
    });

    it("throws if declaring war on own gang", async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ gang_id: 1, role: "leader" }], rowCount: 1 } as never);
      await expect(declareWar(1, 1)).rejects.toThrow(/yourself/i);
    });
  });
});
