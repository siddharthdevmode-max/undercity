// ============================================================
// BANK SERVICE — UNIT TESTS
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

import { pool, withTransaction } from "../config/database";
import {
  getBalance,
  getTransactionHistory,
  depositCash,
  withdrawCash,
  transferCash,
  applyMoneyChange,
} from "../services/bankService";
import { ValidationError, NotFoundError, InsufficientFundsError } from "../utils/errors";

const MOCK_USER = {
  id: 1, username: "testuser", money: 5000, points: 100,
};

function resetMocks(): void {
  vi.clearAllMocks();
  mocks.mockClientQuery.mockReset();
  mocks.mockClientQuery.mockResolvedValue({ rows: [MOCK_USER], rowCount: 1 });
}

describe("getBalance", () => {
  beforeEach(() => resetMocks());

  it("returns money and points for existing user", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ money: 10000, points: 50 }], rowCount: 1 } as never);
    const balance = await getBalance(1);
    expect(balance.money).toBe(10000);
    expect(balance.points).toBe(50);
  });

  it("throws NotFoundError when user does not exist", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await expect(getBalance(999)).rejects.toThrow(NotFoundError);
  });

  it("queries with deleted_at IS NULL filter", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ money: 100, points: 0 }], rowCount: 1 } as never);
    await getBalance(42);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("deleted_at IS NULL"), [42]);
  });
});

describe("getTransactionHistory", () => {
  beforeEach(() => resetMocks());

  it("returns paginated transactions with total count", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ total: 5 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({
        rows: [
          { id: 2, user_id: 1, type: "deposit", amount: 1000, balance_before: 4000, balance_after: 5000, reference_type: null, reference_id: null, description: "test", created_at: "2025-01-01T00:00:00Z" },
          { id: 1, user_id: 1, type: "withdraw", amount: 500, balance_before: 4500, balance_after: 4000, reference_type: null, reference_id: null, description: "test", created_at: "2025-01-01T00:00:01Z" },
        ],
        rowCount: 2,
      } as never);

    const result = await getTransactionHistory(1, 10, 0);
    expect(result.total).toBe(5);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].type).toBe("deposit");
  });

  it("returns zero total when count is null", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ total: null }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const result = await getTransactionHistory(1, 20, 0);
    expect(result.total).toBe(0);
    expect(result.transactions).toHaveLength(0);
  });

  it("orders by created_at DESC", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ total: 0 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await getTransactionHistory(1, 20, 0);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("ORDER BY created_at DESC"), [1, 20, 0]);
  });
});

describe("depositCash", () => {
  beforeEach(() => resetMocks());

  it("throws ValidationError for non-positive amount", async () => {
    await expect(depositCash(1, 0)).rejects.toThrow(ValidationError);
    await expect(depositCash(1, -100)).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError when user has no cash to deposit", async () => {
    mocks.mockClientQuery.mockResolvedValue({ rows: [{ ...MOCK_USER, money: 0 }], rowCount: 1 });
    await expect(depositCash(1, 1000)).rejects.toThrow(ValidationError);
  });

  it("deducts money and returns updated user", async () => {
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [MOCK_USER], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ ...MOCK_USER, money: 3000 }], rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 });

    const result = await depositCash(1, 2000);
    expect(result.money).toBe(3000);
    expect(withTransaction).toHaveBeenCalled();
  });

  it("deposits at most the user's current cash", async () => {
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [{ ...MOCK_USER, money: 500 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ ...MOCK_USER, money: 0 }], rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 });

    const result = await depositCash(1, 999999);
    expect(result.money).toBe(0);
  });

  it("logs a bank_transaction record", async () => {
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [MOCK_USER], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ ...MOCK_USER, money: 3000 }], rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 });

    await depositCash(1, 2000);

    expect(mocks.mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO bank_transactions"),
      expect.arrayContaining([1, "deposit", 2000, 5000, 3000])
    );
  });
});

describe("withdrawCash", () => {
  beforeEach(() => resetMocks());

  it("throws ValidationError for non-positive amount", async () => {
    await expect(withdrawCash(1, 0)).rejects.toThrow(ValidationError);
    await expect(withdrawCash(1, -50)).rejects.toThrow(ValidationError);
  });

  it("throws InsufficientFundsError when amount exceeds balance", async () => {
    mocks.mockClientQuery.mockResolvedValue({ rows: [{ ...MOCK_USER, money: 100 }], rowCount: 1 });
    await expect(withdrawCash(1, 200)).rejects.toThrow(InsufficientFundsError);
  });

  it("adds money and returns updated user", async () => {
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [MOCK_USER], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ ...MOCK_USER, money: 7000 }], rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 });

    const result = await withdrawCash(1, 2000);
    expect(result.money).toBe(7000);
  });

  it("logs a bank_transaction record", async () => {
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [MOCK_USER], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ ...MOCK_USER, money: 7000 }], rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 });

    await withdrawCash(1, 2000);

    expect(mocks.mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO bank_transactions"),
      expect.arrayContaining([1, "withdraw", 2000, 5000, 7000])
    );
  });
});

describe("transferCash", () => {
  const recipientUser = { id: 2, username: "recipient", money: 1000, points: 0 };

  beforeEach(() => resetMocks());

  it("throws ValidationError for non-positive amount", async () => {
    await expect(transferCash(1, "recipient", 0)).rejects.toThrow(ValidationError);
  });

  it("throws InsufficientFundsError when sender has insufficient money", async () => {
    mocks.mockClientQuery.mockResolvedValue({ rows: [{ ...MOCK_USER, money: 50 }], rowCount: 1 });
    await expect(transferCash(1, "recipient", 100)).rejects.toThrow(InsufficientFundsError);
  });

  it("throws NotFoundError when recipient does not exist", async () => {
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [MOCK_USER], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await expect(transferCash(1, "nobody", 100)).rejects.toThrow(NotFoundError);
  });

  it("throws ValidationError when transferring to self", async () => {
    const selfUser = { ...MOCK_USER, id: 1, username: "testuser" };
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [selfUser], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ ...selfUser, id: 1 }], rowCount: 1 });
    await expect(transferCash(1, "testuser", 100)).rejects.toThrow(ValidationError);
  });

  it("transfers amount minus tax and returns sender, recipient, taxPaid", async () => {
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [MOCK_USER], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [recipientUser], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ ...MOCK_USER, money: 3000 }], rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 });

    const result = await transferCash(1, "recipient", 2000);
    expect(result.sender.money).toBe(3000);
    expect(result.recipient.money).toBe(1000 + 2000 - 100);
    expect(result.taxPaid).toBe(100);
  });

  it("uses case-insensitive username lookup", async () => {
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [MOCK_USER], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [recipientUser], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ ...MOCK_USER, money: 4900 }], rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 });

    await transferCash(1, "RECIPIENT", 100);
    expect(mocks.mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("LOWER(username) = LOWER($1)"),
      ["RECIPIENT"]
    );
  });

  it("logs tax transaction when tax > 0", async () => {
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [MOCK_USER], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [recipientUser], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ ...MOCK_USER, money: 4900 }], rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 });

    await transferCash(1, "recipient", 100);

    const txInsertCalls = mocks.mockClientQuery.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === "string" && call[0].includes("INSERT INTO bank_transactions")
    );
    const taxCalls = txInsertCalls.filter((call: unknown[]) => call[1]?.includes?.("tax"));
    expect(taxCalls.length).toBeGreaterThanOrEqual(1);
  });
});

describe("applyMoneyChange", () => {
  beforeEach(() => resetMocks());

  it("throws InsufficientFundsError when delta would make money negative (non-penalty)", async () => {
    mocks.mockClientQuery.mockResolvedValue({ rows: [{ ...MOCK_USER, money: 100 }], rowCount: 1 });
    await expect(applyMoneyChange(1, -200, "admin_adjust")).rejects.toThrow(InsufficientFundsError);
  });

  it("allows negative delta for crime_penalty type", async () => {
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [{ ...MOCK_USER, money: 100 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ ...MOCK_USER, money: 0 }], rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 });

    const result = await applyMoneyChange(1, -500, "crime_penalty");
    expect(result.money).toBe(0);
  });

  it("returns updated user with new balance", async () => {
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [MOCK_USER], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ ...MOCK_USER, money: 7000 }], rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 });

    const result = await applyMoneyChange(1, 2000, "crime_reward", { description: "Crime payout" });
    expect(result.money).toBe(7000);
  });

  it("logs the transaction with provided metadata", async () => {
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [MOCK_USER], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ ...MOCK_USER, money: 7000 }], rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 });

    await applyMoneyChange(1, 2000, "crime_reward", {
      referenceType: "crime", referenceId: "42", description: "Shoplift payout",
    });

    expect(mocks.mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO bank_transactions"),
      expect.arrayContaining([1, "crime_reward", 2000, 5000, 7000, "crime", "42", "Shoplift payout"])
    );
  });

  it("uses GREATEST(money + delta, 0) for floor", async () => {
    mocks.mockClientQuery
      .mockResolvedValueOnce({ rows: [{ ...MOCK_USER, money: 100 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ ...MOCK_USER, money: 0 }], rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 });

    const result = await applyMoneyChange(1, -500, "crime_penalty");
    expect(result.money).toBe(0);
  });
});
