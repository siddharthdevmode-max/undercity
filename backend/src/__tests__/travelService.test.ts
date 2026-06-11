import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/database", () => ({ pool: { query: vi.fn() }, withTransaction: vi.fn() }));
vi.mock("../utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { pool } from "../config/database";
import { listCities, startFlight, getTravelStatus } from "../services/travelService";

describe("travelService", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe("listCities", () => {
    it("returns cities with unlock status", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ id: 1, level: 10 }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [{ id: 1, name: "London", description: "", country: "UK", flight_cost: 15000, flight_time: 600, min_level: 10 }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      const result = await listCities(1);
      expect(result.cities).toBeDefined();
    });
  });

  describe("startFlight", () => {
    it("starts a flight", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ id: 1, money: 50000, level: 15 }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [{ id: 2, name: "Tokyo", flight_cost: 25000, flight_time: 900, min_level: 15 }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never)
        .mockResolvedValueOnce({ rowCount: 1 } as never)
        .mockResolvedValueOnce({ rowCount: 1 } as never);
      const result = await startFlight(1, 2);
      expect(result.message).toContain("Tokyo");
      expect(result.cost).toBe(25000);
    });

    it("throws if cannot afford", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ id: 1, money: 1000, level: 15 }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [{ id: 2, name: "Tokyo", flight_cost: 25000, flight_time: 900, min_level: 15 }], rowCount: 1 } as never);
      await expect(startFlight(1, 2)).rejects.toThrow(/flight/i);
    });
  });

  describe("getTravelStatus", () => {
    it("returns not traveling when no active flight", async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      const status = await getTravelStatus(1);
      expect(status.traveling).toBe(false);
    });
  });
});
