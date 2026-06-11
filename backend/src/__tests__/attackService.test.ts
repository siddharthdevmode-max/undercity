import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const mockClientQuery = vi.fn();
  const mockClient = { query: mockClientQuery };
  const mockTx = vi.fn(async (fn: (client: unknown) => Promise<unknown>) => fn(mockClient));
  return { mockClientQuery, mockClient, mockTx };
});

vi.mock("../config/database", () => ({ pool: { query: vi.fn() }, withTransaction: mocks.mockTx }));
vi.mock("../utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { pool } from "../config/database";
import { searchTarget, attack, getAttackLog } from "../services/attackService";

describe("attackService", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.mockClientQuery.mockReset(); });

  describe("searchTarget", () => {
    it("returns a valid target", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ id: 1, level: 10 }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [{ id: 5, username: "target1", level: 8 }], rowCount: 1 } as never);
      const target = await searchTarget(1);
      expect(target.id).toBe(5);
      expect(target.username).toBeTruthy();
    });
  });

  describe("attack", () => {
    beforeEach(() => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);
    });
    afterEach(() => { vi.restoreAllMocks(); });

    it("executes attack and returns result", async () => {
      mocks.mockClientQuery
        .mockResolvedValueOnce({ rows: [{ id: 1, username: "attacker", level: 10, money: 2000, nerve: 10, life: 100, max_life: 100, strength: 10, speed: 10, defense: 10, dexterity: 10 }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [{ id: 5, username: "target", level: 8, money: 800, life: 100, max_life: 100, strength: 5, speed: 5, defense: 5, dexterity: 5 }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rowCount: 1 } as never)
        .mockResolvedValueOnce({ rowCount: 1 } as never)
        .mockResolvedValueOnce({ rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [{ money: 2120, nerve: 5, life: 94 }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [{ username: "target", money: 680, life: 84 }], rowCount: 1 } as never);
      const result = await attack(1, 5);
      expect(["attacker_win", "target_win", "mugged", "hospitalized", "stalemate"]).toContain(result.result);
    });

    it("throws if not enough nerve", async () => {
      mocks.mockClientQuery
        .mockResolvedValueOnce({ rows: [{ id: 1, username: "attacker", level: 10, money: 2000, nerve: 2, life: 100, max_life: 100, strength: 10, speed: 10, defense: 10, dexterity: 10 }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [{ id: 5, username: "target", level: 8, money: 800, life: 100, max_life: 100, strength: 5, speed: 5, defense: 5, dexterity: 5 }], rowCount: 1 } as never);
      await expect(attack(1, 5)).rejects.toThrow(/nerve/i);
    });
  });

  describe("getAttackLog", () => {
    it("returns log entries", async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ id: 1, attacker_id: 1, result: "mugged", attacker_hp: 6, target_hp: 16, money_stolen: 120, attacker_nerve: 5, created_at: new Date().toISOString(), target_name: "tgt" }], rowCount: 1 } as never);
      const log = await getAttackLog(1);
      expect(log.length).toBeGreaterThan(0);
    });
  });
});
