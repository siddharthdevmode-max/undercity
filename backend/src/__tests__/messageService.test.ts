import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/database", () => ({ pool: { query: vi.fn() } }));
vi.mock("../utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { pool } from "../config/database";
import {
  getInbox,
  getSentMessages,
  getMessage,
  sendMessage,
  deleteMessage,
  getUnreadCount,
} from "../services/messageService";

const mockMessage = {
  id: 1,
  sender_id: 1,
  recipient_id: 2,
  subject: "Hello",
  body: "World",
  read: false,
  sender_deleted: false,
  recipient_deleted: false,
  created_at: "2026-01-01T00:00:00Z",
  sender_username: "alice",
  recipient_username: "bob",
};

describe("messageService", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getInbox", () => {
    it("returns paginated inbox with unread count", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ count: "1" }] } as never)
        .mockResolvedValueOnce({ rows: [{ count: "1" }] } as never)
        .mockResolvedValueOnce({ rows: [mockMessage] } as never);

      const result = await getInbox(2);
      expect(result.total).toBe(1);
      expect(result.unread).toBe(1);
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].subject).toBe("Hello");
    });

    it("returns empty inbox", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ count: "0" }] } as never)
        .mockResolvedValueOnce({ rows: [{ count: "0" }] } as never)
        .mockResolvedValueOnce({ rows: [] } as never);

      const result = await getInbox(999);
      expect(result.total).toBe(0);
      expect(result.unread).toBe(0);
      expect(result.messages).toHaveLength(0);
    });
  });

  describe("getSentMessages", () => {
    it("returns paginated sent messages", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ count: "1" }] } as never)
        .mockResolvedValueOnce({ rows: [mockMessage] } as never);

      const result = await getSentMessages(1);
      expect(result.total).toBe(1);
      expect(result.messages).toHaveLength(1);
    });
  });

  describe("getMessage", () => {
    it("returns a single message and marks it read", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ ...mockMessage, read: false }] } as never)
        .mockResolvedValueOnce({ rowCount: 1 } as never);

      const msg = await getMessage(1, 2);
      expect(msg.subject).toBe("Hello");
      expect(msg.read).toBe(true);
    });

    it("does not mark read if sender views own message", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ ...mockMessage, read: false }] } as never);

      const msg = await getMessage(1, 1);
      expect(msg.subject).toBe("Hello");
      expect(msg.read).toBe(false);
    });

    it("throws NotFoundError for missing message", async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);
      await expect(getMessage(999, 1)).rejects.toThrow(/Message/);
    });
  });

  describe("sendMessage", () => {
    it("sends a message", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ id: 2 }] } as never)
        .mockResolvedValueOnce({ rows: [mockMessage] } as never);

      const msg = await sendMessage(1, "bob", "Hello", "World");
      expect(msg.subject).toBe("Hello");
    });

    it("throws on empty subject and body", async () => {
      await expect(sendMessage(1, "bob", "", "")).rejects.toThrow(/empty/i);
    });

    it("throws on missing recipient", async () => {
      await expect(sendMessage(1, "", "Hi", "Body")).rejects.toThrow(/recipient/i);
    });

    it("throws when recipient not found", async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);
      await expect(sendMessage(1, "ghost", "Hi", "Body")).rejects.toThrow(/User/);
    });

    it("throws when sending to self", async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ id: 1 }] } as never);
      await expect(sendMessage(1, "alice", "Hi", "Body")).rejects.toThrow(/yourself/i);
    });
  });

  describe("deleteMessage", () => {
    it("deletes when both sender and recipient", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ id: 1, sender_id: 1, recipient_id: 1 }] } as never)
        .mockResolvedValueOnce({ rowCount: 1 } as never);
      await expect(deleteMessage(1, 1)).resolves.toBeUndefined();
    });

    it("soft-deletes for sender", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ id: 1, sender_id: 1, recipient_id: 2 }] } as never)
        .mockResolvedValueOnce({ rowCount: 1 } as never);
      await expect(deleteMessage(1, 1)).resolves.toBeUndefined();
    });

    it("soft-deletes for recipient", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ id: 1, sender_id: 2, recipient_id: 1 }] } as never)
        .mockResolvedValueOnce({ rowCount: 1 } as never);
      await expect(deleteMessage(1, 1)).resolves.toBeUndefined();
    });

    it("throws NotFoundError for unauthorized user", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ id: 1, sender_id: 1, recipient_id: 2 }] } as never);
      await expect(deleteMessage(1, 3)).rejects.toThrow(/Message/);
    });

    it("throws NotFoundError for missing message", async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);
      await expect(deleteMessage(999, 1)).rejects.toThrow(/Message/);
    });
  });

  describe("getUnreadCount", () => {
    it("returns unread count", async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ count: "3" }] } as never);
      const count = await getUnreadCount(2);
      expect(count).toBe(3);
    });
  });
});
