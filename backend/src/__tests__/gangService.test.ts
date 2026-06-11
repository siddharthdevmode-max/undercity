import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/database", () => ({ pool: { query: vi.fn() }, withTransaction: vi.fn(async (fn) => fn({ query: vi.fn() })) }));
vi.mock("../utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { pool } from "../config/database";
import { create, getMyGang, getGangs, join, leave, kick } from "../services/gangService";

describe("gangService", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("create", () => {
    it("creates a gang and adds leader as member", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never)
        .mockResolvedValueOnce({ rows: [{ id: 1, name: "Sinners", tag: "SIN", description: "Bad", leader_id: 1, bank: 0, respect: 0, created_at: "" }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      const gang = await create(1, "Sinners", "SIN", "Bad");
      expect(gang.name).toBe("Sinners");
      expect(gang.tag).toBe("SIN");
    });

    it("throws if already in a gang", async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 } as never);
      await expect(create(1, "Test", "TST", "")).rejects.toThrow(/already/i);
    });
  });

  describe("getMyGang", () => {
    it("returns null when not in a gang", async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      const result = await getMyGang(1);
      expect(result).toBeNull();
    });

    it("returns gang info when member", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ id: 1, name: "Sinners", tag: "SIN", description: "", leader_id: 1, bank: 0, respect: 0, created_at: "", role: "leader" }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1, role: "leader", joined_at: "", username: "user1" }, { id: 2, user_id: 2, role: "member", joined_at: "", username: "user2" }], rowCount: 2 } as never);
      const result = await getMyGang(1);
      expect(result).not.toBeNull();
      expect(result!.members.length).toBe(2);
    });
  });

  describe("getGangs", () => {
    it("returns all gangs ordered by respect", async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ id: 1, name: "Top", tag: "TOP", member_count: "10" }], rowCount: 1 } as never);
      const gangs = await getGangs();
      expect(gangs.length).toBeGreaterThan(0);
    });
  });

  describe("join", () => {
    it("joins a gang when not already a member", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never)
        .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rowCount: 1 } as never);
      await expect(join(1, 2)).resolves.not.toThrow();
    });

    it("throws if already in a gang", async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ id: 5 }], rowCount: 1 } as never);
      await expect(join(1, 2)).rejects.toThrow(/already/i);
    });
  });

  describe("leave", () => {
    it("leaves gang and deletes it if leader", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ gang_id: 1, role: "leader" }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rowCount: 1 } as never);
      await expect(leave(1)).resolves.not.toThrow();
    });
  });

  describe("kick", () => {
    it("throws if not a leader", async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      await expect(kick(1, 2)).rejects.toThrow(/leader/i);
    });
  });
});
