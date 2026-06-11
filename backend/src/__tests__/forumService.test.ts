import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/database", () => ({ pool: { query: vi.fn() }, withTransaction: vi.fn(async (fn) => fn({ query: vi.fn() })) }));
vi.mock("../utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { pool } from "../config/database";
import { getCategories, getThreads, getThread, createThread, replyToThread } from "../services/forumService";

describe("forumService", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getCategories", () => {
    it("returns categories", async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ id: 1, name: "General", description: "", sort_order: 1, thread_count: "5", last_post: null }], rowCount: 1 } as never);
      const cats = await getCategories();
      expect(cats.length).toBeGreaterThan(0);
    });
  });

  describe("getThreads", () => {
    it("returns threads with pagination", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ count: "10" }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [{ id: 1, category_id: 1, title: "Test", content: "", is_pinned: false, is_locked: false, created_at: "", updated_at: "", username: "user", post_count: "3" }], rowCount: 1 } as never);
      const result = await getThreads();
      expect(result.threads.length).toBeGreaterThan(0);
      expect(result.total).toBe(10);
    });
  });

  describe("getThread", () => {
    it("returns thread with posts", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ id: 1, category_id: 1, title: "Test", content: "Hello", is_pinned: false, is_locked: false, created_at: "", updated_at: "", username: "user", post_count: "1" }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [{ id: 1, content: "Reply", created_at: "", username: "other" }], rowCount: 1 } as never);
      const result = await getThread(1);
      expect(result.thread.title).toBe("Test");
      expect(result.posts.length).toBeGreaterThan(0);
    });
  });

  describe("createThread", () => {
    it("creates a thread", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [{ id: 10, category_id: 1, user_id: 1, title: "New", content: "Body" }], rowCount: 1 } as never);
      const thread = await createThread(1, 1, "New", "Body");
      expect(thread.title).toBe("New");
    });

    it("throws on empty title", async () => {
      await expect(createThread(1, 1, "", "Body")).rejects.toThrow(/title/i);
    });
  });

  describe("replyToThread", () => {
    it("adds reply to unlocked thread", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ id: 1, is_locked: false }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [{ id: 5, thread_id: 1, user_id: 1, content: "Nice!" }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rowCount: 1 } as never);
      const post = await replyToThread(1, 1, "Nice!");
      expect(post.content).toBe("Nice!");
    });

    it("throws on locked thread", async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ id: 1, is_locked: true }], rowCount: 1 } as never);
      await expect(replyToThread(1, 1, "Bad")).rejects.toThrow(/locked/i);
    });
  });
});
