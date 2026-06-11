import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/database", () => ({ pool: { query: vi.fn() }, withTransaction: vi.fn(async (fn) => fn({ query: vi.fn() })) }));
vi.mock("../utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { pool } from "../config/database";
import { getEvents, createEvent, deleteEvent } from "../services/calendarService";

describe("calendarService", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getEvents", () => {
    it("returns events for month", async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ id: 1, title: "Test", description: "", event_date: "2026-06-15", created_at: "" }], rowCount: 1 } as never);
      const events = await getEvents(1, "2026-06");
      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe("createEvent", () => {
    it("creates an event", async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ id: 1, title: "Heist", description: "Big job", event_date: "2026-07-01", created_at: "" }], rowCount: 1 } as never);
      const ev = await createEvent(1, "Heist", "Big job", "2026-07-01");
      expect(ev.title).toBe("Heist");
    });

    it("throws for empty title", async () => {
      await expect(createEvent(1, "", "desc", "2026-07-01")).rejects.toThrow(/title/i);
    });
  });

  describe("deleteEvent", () => {
    it("deletes own event", async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 } as never);
      await expect(deleteEvent(1, 1)).resolves.not.toThrow();
    });

    it("throws if not found", async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      await expect(deleteEvent(999, 1)).rejects.toThrow();
    });
  });
});
