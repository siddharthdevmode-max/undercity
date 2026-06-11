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
import { listProperties, buyProperty, collectIncome } from "../services/propertyService";

describe("propertyService", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.mockClientQuery.mockReset(); });

  describe("listProperties", () => {
    it("returns properties with ownership info", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ id: 1, level: 10, money: 50000 }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [{ id: 1, name: "Shack", price: 10000, daily_income: 100, min_level: 1, is_active: true }, { id: 3, name: "Mansion", price: 100000, daily_income: 1000, min_level: 10, is_active: true }], rowCount: 2 } as never)
        .mockResolvedValueOnce({ rows: [{ property_id: 1 }, { property_id: 3 }], rowCount: 2 } as never);
      const result = await listProperties(1);
      expect(result.properties.length).toBeGreaterThan(0);
      expect(result.owned).toContain(1);
    });
  });

  describe("buyProperty", () => {
    it("buys property when affordable", async () => {
      mocks.mockClientQuery
        .mockResolvedValueOnce({ rows: [{ id: 1, level: 10, money: 50000 }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [{ id: 2, name: "Condo", price: 25000, daily_income: 300, min_level: 5, is_active: true }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never)
        .mockResolvedValueOnce({ rowCount: 1 } as never)
        .mockResolvedValueOnce({ rowCount: 1 } as never);
      const result = await buyProperty(1, 2);
      expect(result.message).toContain("Condo");
      expect(result.property).toBeDefined();
    });
  });

  describe("collectIncome", () => {
    it("collects from owned properties", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ id: 1, name: "Shack", daily_income: 100 }, { id: 2, name: "Condo", daily_income: 300 }], rowCount: 2 } as never)
        .mockResolvedValueOnce({ rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [{ money: 50400 }], rowCount: 1 } as never);
      const result = await collectIncome(1);
      expect(result.totalIncome).toBe(400);
      expect(result.money).toBe(50400);
    });
  });
});
