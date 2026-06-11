import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/database", () => ({ pool: { query: vi.fn() }, withTransaction: vi.fn(async (fn) => fn({ query: vi.fn() })) }));
vi.mock("../utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { pool } from "../config/database";
import { getArticles } from "../services/newspaperService";

describe("newspaperService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns articles with pagination", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ count: "5" }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ id: 1, title: "Big News", content: "Something happened", category: "crime", important: false, created_at: "" }], rowCount: 1 } as never);
    const result = await getArticles();
    expect(result.articles.length).toBeGreaterThan(0);
    expect(result.total).toBe(5);
  });

  it("filters by category", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ count: "2" }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ id: 2, title: "Economy", content: "Markets", category: "economy", important: false, created_at: "" }], rowCount: 1 } as never);
    const result = await getArticles("economy");
    expect(result.articles[0].category).toBe("economy");
  });
});
