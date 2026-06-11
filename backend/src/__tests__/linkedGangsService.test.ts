import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/database", () => ({ pool: { query: vi.fn() }, withTransaction: vi.fn(async (fn) => fn({ query: vi.fn() })) }));
vi.mock("../utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { pool } from "../config/database";
import { getAlliances, requestAlliance, respondAlliance } from "../services/linkedGangsService";

describe("linkedGangsService", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getAlliances", () => {
    it("returns alliances for a gang", async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ id: 1, gang_a_id: 1, gang_b_id: 2, status: "allied", gang_name: "Allies", gang_tag: "ALY" }], rowCount: 1 } as never);
      const alliances = await getAlliances(1);
      expect(alliances.length).toBeGreaterThan(0);
    });
  });

  describe("requestAlliance", () => {
    it("creates pending alliance", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ gang_id: 1, role: "leader" }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rowCount: 1 } as never);
      await expect(requestAlliance(1, 2)).resolves.not.toThrow();
    });

    it("throws if not a leader", async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      await expect(requestAlliance(1, 2)).rejects.toThrow(/leader/i);
    });
  });

  describe("respondAlliance", () => {
    it("accepts or rejects alliance", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ gang_id: 2, role: "leader" }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rowCount: 1 } as never);
      await expect(respondAlliance(3, 1, true)).resolves.not.toThrow();
    });
  });
});
