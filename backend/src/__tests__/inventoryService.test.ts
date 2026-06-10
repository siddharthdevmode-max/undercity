// ============================================================
// INVENTORY SERVICE — UNIT TESTS
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({}));

vi.mock("../config/database", () => ({
  pool: { query: vi.fn() },
}));

vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { pool } from "../config/database";
import { getInventory, useItem, dropItem } from "../services/inventoryService";
import { ValidationError, NotFoundError } from "../utils/errors";

function resetMocks(): void {
  vi.clearAllMocks();
}

const MOCK_INVENTORY_ROW = {
  id: 1, user_id: 1, item_id: 5, quantity: 3,
  acquired_at: "2025-01-01T00:00:00Z",
  item_name: "Bandage", item_description: "Heals 25 HP",
  item_category: "medical", item_usable: true, item_base_price: 100,
};

const MOCK_ITEM = {
  id: 5, name: "Bandage", category: "medical", usable: true, base_price: 100,
};

describe("getInventory", () => {
  beforeEach(() => resetMocks());

  it("returns items with total count", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ total: 2 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [MOCK_INVENTORY_ROW, { ...MOCK_INVENTORY_ROW, id: 2, item_name: "Painkiller" }], rowCount: 2 } as never);

    const result = await getInventory(1);
    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toHaveProperty("item_name");
    expect(result.items[0]).toHaveProperty("item_category");
  });

  it("filters by category when provided", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ total: 0 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await getInventory(1, "weapon");
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("i.category = $2"),
      [1, "weapon"]
    );
  });

  it("returns zero total when rows is empty", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ total: 0 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const result = await getInventory(1);
    expect(result.total).toBe(0);
    expect(result.items).toHaveLength(0);
  });

  it("filters by user_id with deleted_at IS NULL", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ total: 0 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await getInventory(42);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("ui.user_id = $1"),
      [42]
    );
  });

  it("orders by category then name", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ total: 0 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await getInventory(1);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("ORDER BY i.category, i.name"),
      expect.any(Array)
    );
  });
});

describe("useItem", () => {
  beforeEach(() => resetMocks());

  it("throws ValidationError when user does not have the item", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await expect(useItem(1, 5, 1)).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError when not enough quantity", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ quantity: 1 }], rowCount: 1 } as never);
    await expect(useItem(1, 5, 5)).rejects.toThrow(ValidationError);
  });

  it("throws NotFoundError when item does not exist", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ quantity: 5 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await expect(useItem(1, 999, 1)).rejects.toThrow(NotFoundError);
  });

  it("throws ValidationError when item is not usable", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ quantity: 5 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ ...MOCK_ITEM, usable: false }], rowCount: 1 } as never);
    await expect(useItem(1, 5, 1)).rejects.toThrow(ValidationError);
  });

  it("medical item heals life", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ quantity: 3 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [MOCK_ITEM], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ life: 50, max_life: 100 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rowCount: 1 } as never)
      .mockResolvedValueOnce({ rowCount: 1 } as never)
      .mockResolvedValueOnce({ rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ quantity: 2 }], rowCount: 1 } as never);

    const result = await useItem(1, 5, 1);
    expect(result.effects.life).toBe(25);
    expect(result.remaining).toBe(2);
  });

  it("medical item caps healing at max_life", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ quantity: 3 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [MOCK_ITEM], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ life: 99, max_life: 100 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rowCount: 1 } as never)
      .mockResolvedValueOnce({ rowCount: 1 } as never)
      .mockResolvedValueOnce({ rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ quantity: 2 }], rowCount: 1 } as never);

    const result = await useItem(1, 5, 1);
    expect(result.effects.life).toBe(1);
  });

  it("throws ValidationError when already at full health (medical)", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ quantity: 3 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [MOCK_ITEM], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ life: 100, max_life: 100 }], rowCount: 1 } as never);
    await expect(useItem(1, 5, 1)).rejects.toThrow(ValidationError);
  });

  it("Energy Drink restores energy", async () => {
    const energyDrink = { ...MOCK_ITEM, name: "Energy Drink", category: "drug", id: 10 };
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ quantity: 5 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [energyDrink], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ energy: 30, max_energy: 100, nerve: 50, max_nerve: 50 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rowCount: 1 } as never)
      .mockResolvedValueOnce({ rowCount: 1 } as never)
      .mockResolvedValueOnce({ rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ quantity: 4 }], rowCount: 1 } as never);

    const result = await useItem(1, 10, 1);
    expect(result.effects.energy).toBe(20);
    expect(result.remaining).toBe(4);
  });

  it("Nerve Tonic restores nerve", async () => {
    const nerveTonic = { ...MOCK_ITEM, name: "Nerve Tonic", category: "drug", id: 11 };
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ quantity: 4 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [nerveTonic], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ energy: 100, max_energy: 100, nerve: 30, max_nerve: 50 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rowCount: 1 } as never)
      .mockResolvedValueOnce({ rowCount: 1 } as never)
      .mockResolvedValueOnce({ rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ quantity: 3 }], rowCount: 1 } as never);

    const result = await useItem(1, 11, 1);
    expect(result.effects.nerve).toBe(10);
  });

  it("throws ValidationError when energy is already full (Energy Drink)", async () => {
    const energyDrink = { ...MOCK_ITEM, name: "Energy Drink", category: "drug", id: 10 };
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ quantity: 5 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [energyDrink], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ energy: 100, max_energy: 100, nerve: 50, max_nerve: 50 }], rowCount: 1 } as never);
    await expect(useItem(1, 10, 1)).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError when nerve is already full (Nerve Tonic)", async () => {
    const nerveTonic = { ...MOCK_ITEM, name: "Nerve Tonic", category: "drug", id: 11 };
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ quantity: 4 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [nerveTonic], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ energy: 100, max_energy: 100, nerve: 50, max_nerve: 50 }], rowCount: 1 } as never);
    await expect(useItem(1, 11, 1)).rejects.toThrow(ValidationError);
  });

  it("default category items heal small amount", async () => {
    const miscItem = { ...MOCK_ITEM, name: "Snack", category: "misc", id: 20 };
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ quantity: 2 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [miscItem], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ life: 50, max_life: 100 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rowCount: 1 } as never)
      .mockResolvedValueOnce({ rowCount: 1 } as never)
      .mockResolvedValueOnce({ rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ quantity: 1 }], rowCount: 1 } as never);

    const result = await useItem(1, 20, 1);
    expect(result.effects.life).toBe(15);
    expect(result.remaining).toBe(1);
  });

  it("decrements inventory after use", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ quantity: 3 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [MOCK_ITEM], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ life: 50, max_life: 100 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rowCount: 1 } as never)
      .mockResolvedValueOnce({ rowCount: 1 } as never)
      .mockResolvedValueOnce({ rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ quantity: 2 }], rowCount: 1 } as never);

    await useItem(1, 5, 1);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE user_inventory SET quantity = quantity -"),
      [1, 5, 1]
    );
  });

  it("logs bank_transaction with item_use type", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ quantity: 3 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [MOCK_ITEM], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ life: 50, max_life: 100 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rowCount: 1 } as never)
      .mockResolvedValueOnce({ rowCount: 1 } as never)
      .mockResolvedValueOnce({ rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ quantity: 2 }], rowCount: 1 } as never);

    await useItem(1, 5, 1);
    expect(pool.query).toHaveBeenNthCalledWith(6,
      expect.stringContaining("INSERT INTO bank_transactions"),
      [1, "Used 1x Bandage"]
    );
  });
});

describe("dropItem", () => {
  beforeEach(() => resetMocks());

  it("throws ValidationError when user does not have the item", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await expect(dropItem(1, 5, 1)).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError when not enough quantity", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ quantity: 1 }], rowCount: 1 } as never);
    await expect(dropItem(1, 5, 5)).rejects.toThrow(ValidationError);
  });

  it("decrements inventory", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ quantity: 10 }], rowCount: 1 } as never);
    await dropItem(1, 5, 3);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE user_inventory SET quantity = quantity -"),
      [1, 5, 3]
    );
  });

  it("defaults to quantity=1 when not specified", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ quantity: 10 }], rowCount: 1 } as never);
    await dropItem(1, 5);
    expect(pool.query).toHaveBeenNthCalledWith(2,
      expect.stringContaining("UPDATE user_inventory"),
      [1, 5, 1]
    );
  });
});
