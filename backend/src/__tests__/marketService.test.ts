// ============================================================
// MARKET SERVICE — UNIT TESTS
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const mockClientQuery = vi.fn();
  const mockClient = { query: mockClientQuery };
  const mockTx = vi.fn(async (fn: (client: unknown) => Promise<unknown>) => fn(mockClient));
  return { mockClientQuery, mockClient, mockTx };
});

vi.mock("../config/database", () => ({
  pool: { query: vi.fn() },
  withTransaction: mocks.mockTx,
}));

vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../services/bankService", () => ({
  applyMoneyChange: vi.fn(),
}));

import { pool, withTransaction } from "../config/database";
import {
  listItem,
  buyItem,
  cancelListing,
  getListings,
  getMyListings,
  expireListings,
} from "../services/marketService";
import { ValidationError, NotFoundError, InsufficientFundsError } from "../utils/errors";

const MOCK_ITEM = { id: 1, name: "Test Item", sellable: true, tradeable: true };
const MOCK_LISTING = {
  id: 10, seller_id: 2, item_id: 1,
  quantity: 5, quantity_left: 5,
  price_per_unit: 1000,
  sold: false, listed_at: "2025-01-01T00:00:00Z",
  expires_at: "2025-01-08T00:00:00Z",
};
const MOCK_BUYER = { id: 1, money: 50000 };
const MOCK_INVENTORY = { quantity: 10 };

function resetMocks(): void {
  vi.clearAllMocks();
  mocks.mockClientQuery.mockReset();
}

describe("listItem", () => {
  beforeEach(() => resetMocks());

  it("throws NotFoundError when item does not exist", async () => {
    mocks.mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await expect(listItem(1, 999, 1, 100)).rejects.toThrow(NotFoundError);
  });

  it("throws ValidationError when item is not sellable", async () => {
    mocks.mockClientQuery.mockResolvedValueOnce({ rows: [{ ...MOCK_ITEM, sellable: false }], rowCount: 1 });
    mocks.mockClientQuery.mockResolvedValueOnce({ rows: [MOCK_INVENTORY], rowCount: 1 });
    await expect(listItem(1, 1, 1, 100)).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError when item is not tradeable", async () => {
    mocks.mockClientQuery.mockResolvedValueOnce({ rows: [{ ...MOCK_ITEM, tradeable: false }], rowCount: 1 });
    mocks.mockClientQuery.mockResolvedValueOnce({ rows: [MOCK_INVENTORY], rowCount: 1 });
    await expect(listItem(1, 1, 1, 100)).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError when user does not have enough items", async () => {
    mocks.mockClientQuery.mockResolvedValueOnce({ rows: [MOCK_ITEM], rowCount: 1 });
    mocks.mockClientQuery.mockResolvedValueOnce({ rows: [{ quantity: 0 }], rowCount: 1 });
    await expect(listItem(1, 1, 5, 100)).rejects.toThrow(ValidationError);
  });

  it("deducts inventory and inserts listing", async () => {
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [MOCK_ITEM], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [MOCK_INVENTORY], rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ ...MOCK_LISTING, seller_id: 1 }], rowCount: 1 });

    const listing = await listItem(1, 1, 3, 500);
    expect(listing.quantity).toBe(5);
    expect(withTransaction).toHaveBeenCalled();
    expect(mocks.mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE user_inventory SET quantity = quantity -"),
      [1, 1, 3]
    );
  });

  it("checks is_active filter on items", async () => {
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [MOCK_ITEM], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [MOCK_INVENTORY], rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rows: [MOCK_LISTING], rowCount: 1 });

    await listItem(1, 1, 1, 100);
    expect(mocks.mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("is_active = TRUE"),
      [1]
    );
  });
});

describe("buyItem", () => {
  beforeEach(() => resetMocks());

  it("throws NotFoundError when listing does not exist", async () => {
    mocks.mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await expect(buyItem(1, 999)).rejects.toThrow(NotFoundError);
  });

  it("throws ValidationError when buying own listing", async () => {
    const ownListing = { ...MOCK_LISTING, seller_id: 1 };
    mocks.mockClientQuery.mockResolvedValueOnce({ rows: [ownListing], rowCount: 1 });
    await expect(buyItem(1, 10)).rejects.toThrow(ValidationError);
  });

  it("throws NotFoundError when buyer user does not exist", async () => {
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [MOCK_LISTING], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await expect(buyItem(1, 10)).rejects.toThrow(NotFoundError);
  });

  it("throws InsufficientFundsError when buyer cannot afford", async () => {
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [MOCK_LISTING], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ ...MOCK_BUYER, money: 500 }], rowCount: 1 });
    await expect(buyItem(1, 10)).rejects.toThrow(InsufficientFundsError);
  });

  it("buys 1 unit, deducts money, credits seller, updates listing", async () => {
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [MOCK_LISTING], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [MOCK_BUYER], rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rows: [MOCK_INVENTORY], rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 });

    const result = await buyItem(1, 10);
    expect(result.totalCost).toBe(1000);
    expect(withTransaction).toHaveBeenCalled();
  });

  it("uses FOR UPDATE on listing row lock", async () => {
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [MOCK_LISTING], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [MOCK_BUYER], rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rows: [MOCK_INVENTORY], rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 });

    await buyItem(1, 10);
    expect(mocks.mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("FOR UPDATE"),
      [10]
    );
  });

  it("marks listing sold when last unit bought", async () => {
    const singleListing = { ...MOCK_LISTING, quantity_left: 1 };
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [singleListing], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [MOCK_BUYER], rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rows: [MOCK_INVENTORY], rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 });

    await buyItem(1, 10);
    expect(mocks.mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("quantity_left = 0, sold = TRUE"),
      [10]
    );
  });

  it("creates new inventory row when buyer does not have the item", async () => {
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [MOCK_LISTING], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [MOCK_BUYER], rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rowCount: 1 });

    await buyItem(1, 10);
    expect(mocks.mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO user_inventory"),
      [1, 1, 1]
    );
  });
});

describe("cancelListing", () => {
  beforeEach(() => resetMocks());

  it("throws NotFoundError when listing does not exist", async () => {
    mocks.mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await expect(cancelListing(1, 999)).rejects.toThrow(NotFoundError);
  });

  it("throws ValidationError when not the seller", async () => {
    const otherSeller = { ...MOCK_LISTING, seller_id: 5 };
    mocks.mockClientQuery.mockResolvedValueOnce({ rows: [otherSeller], rowCount: 1 });
    await expect(cancelListing(1, 10)).rejects.toThrow(ValidationError);
  });

  it("returns remaining items to seller inventory and marks listing sold", async () => {
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [MOCK_LISTING], rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 });

    await cancelListing(2, 10);
    expect(mocks.mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE user_inventory SET quantity = quantity +"),
      [2, 1, 5]
    );
    expect(mocks.mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE market_listings SET sold = TRUE, quantity_left = 0"),
      [10]
    );
  });
});

describe("getListings", () => {
  beforeEach(() => resetMocks());

  it("returns active listings with item name and seller username", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ total: 2 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ ...MOCK_LISTING, item_name: "Test", category: "misc", seller_username: "seller" }], rowCount: 1 } as never);

    const result = await getListings();
    expect(result.total).toBe(2);
    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]).toHaveProperty("item_name");
    expect(result.listings[0]).toHaveProperty("seller_username");
  });

  it("filters by item name (LIKE)", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ total: 0 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await getListings({ itemName: "sword" });
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("LOWER(i.name) LIKE LOWER($1)"),
      expect.arrayContaining(["%sword%"])
    );
  });

  it("filters by category", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ total: 0 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await getListings({ category: "weapon" });
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("i.category = $1"),
      ["weapon"]
    );
  });

  it("sorts by price ASC when sort=price order=asc", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ total: 0 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await getListings({ sort: "price", order: "asc" });
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("ORDER BY ml.price_per_unit ASC"),
      expect.any(Array)
    );
  });

  it("filters out expired listings (expires_at > NOW())", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ total: 0 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await getListings();
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("ml.expires_at > NOW()"),
      expect.any(Array)
    );
  });
});

describe("getMyListings", () => {
  beforeEach(() => resetMocks());

  it("returns unsold listings for the user with item_name", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ ...MOCK_LISTING, item_name: "My Item" }],
      rowCount: 1,
    } as never);

    const listings = await getMyListings(2);
    expect(listings).toHaveLength(1);
    expect(listings[0]).toHaveProperty("item_name");
  });

  it("filters by seller_id and sold = FALSE", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await getMyListings(42);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("ml.seller_id = $1 AND ml.sold = FALSE"),
      [42]
    );
  });
});

describe("expireListings", () => {
  beforeEach(() => resetMocks());

  it("marks expired listings as sold and returns count", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }], rowCount: 2 } as never);
    const count = await expireListings();
    expect(count).toBe(2);
  });

  it("returns 0 when no listings expired", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const count = await expireListings();
    expect(count).toBe(0);
  });

  it("only marks listings that are sold=FALSE and expires_at <= NOW()", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await expireListings();
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("sold = FALSE AND expires_at <= NOW()")
    );
  });
});
