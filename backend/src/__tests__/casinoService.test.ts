import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/database", () => ({ pool: { query: vi.fn() }, withTransaction: vi.fn(async (fn) => fn({ query: vi.fn() })) }));
vi.mock("../utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { pool } from "../config/database";
import { play } from "../services/casinoService";

describe("casinoService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("handles coinflip win", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ id: 1, money: 1000 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rowCount: 1 } as never)
      .mockResolvedValueOnce({ rowCount: 1 } as never);
    const result = await play(1, "coinflip", 100);
    expect(["win", "lose"]).toContain(result.result);
    expect(result.game).toBe("coinflip");
    expect(result.bet).toBe(100);
    expect(result.money).toBeGreaterThanOrEqual(900);
  });

  it("handles roulette", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ id: 1, money: 1000 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rowCount: 1 } as never)
      .mockResolvedValueOnce({ rowCount: 1 } as never);
    const result = await play(1, "roulette", 100);
    expect(["win", "lose"]).toContain(result.result);
  });

  it("handles slots", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ id: 1, money: 1000 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rowCount: 1 } as never)
      .mockResolvedValueOnce({ rowCount: 1 } as never);
    const result = await play(1, "slots", 100);
    expect(result.game).toBe("slots");
  });

  it("throws for unknown game", async () => {
    await expect(play(1, "poker", 100)).rejects.toThrow(/unknown game/i);
  });

  it("throws if not enough money", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ id: 1, money: 50 }], rowCount: 1 } as never);
    await expect(play(1, "coinflip", 100)).rejects.toThrow(/money/i);
  });
});
