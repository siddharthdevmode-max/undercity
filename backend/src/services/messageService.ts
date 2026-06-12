import { pool } from "../config/database";
import { ValidationError, NotFoundError } from "../utils/errors";

export interface Message {
  id: number;
  sender_id: number;
  recipient_id: number;
  subject: string;
  body: string;
  read: boolean;
  sender_deleted: boolean;
  recipient_deleted: boolean;
  created_at: string;
}

interface MessageWithUser extends Message {
  sender_username: string;
  recipient_username: string;
}

export async function getInbox(userId: number, page: number = 1): Promise<{ messages: MessageWithUser[]; total: number; unread: number }> {
  const perPage = 20;
  const offset = (page - 1) * perPage;

  const countR = await pool.query(
    "SELECT COUNT(*) FROM user_messages WHERE recipient_id = $1 AND recipient_deleted = false",
    [userId]
  );
  const total = parseInt(countR.rows[0].count, 10);

  const unreadR = await pool.query(
    "SELECT COUNT(*) FROM user_messages WHERE recipient_id = $1 AND recipient_deleted = false AND read = false",
    [userId]
  );
  const unread = parseInt(unreadR.rows[0].count, 10);

  const dataR = await pool.query(`
    SELECT m.*, su.username AS sender_username, ru.username AS recipient_username
    FROM user_messages m
    JOIN users su ON su.id = m.sender_id
    JOIN users ru ON ru.id = m.recipient_id
    WHERE m.recipient_id = $1 AND m.recipient_deleted = false
    ORDER BY m.created_at DESC
    LIMIT $2 OFFSET $3
  `, [userId, perPage, offset]);

  return { messages: dataR.rows, total, unread };
}

export async function getSentMessages(userId: number, page: number = 1): Promise<{ messages: MessageWithUser[]; total: number }> {
  const perPage = 20;
  const offset = (page - 1) * perPage;

  const countR = await pool.query(
    "SELECT COUNT(*) FROM user_messages WHERE sender_id = $1 AND sender_deleted = false",
    [userId]
  );
  const total = parseInt(countR.rows[0].count, 10);

  const dataR = await pool.query(`
    SELECT m.*, su.username AS sender_username, ru.username AS recipient_username
    FROM user_messages m
    JOIN users su ON su.id = m.sender_id
    JOIN users ru ON ru.id = m.recipient_id
    WHERE m.sender_id = $1 AND m.sender_deleted = false
    ORDER BY m.created_at DESC
    LIMIT $2 OFFSET $3
  `, [userId, perPage, offset]);

  return { messages: dataR.rows, total };
}

export async function getMessage(messageId: number, userId: number): Promise<MessageWithUser> {
  const r = await pool.query(`
    SELECT m.*, su.username AS sender_username, ru.username AS recipient_username
    FROM user_messages m
    JOIN users su ON su.id = m.sender_id
    JOIN users ru ON ru.id = m.recipient_id
    WHERE m.id = $1 AND (m.recipient_id = $2 OR m.sender_id = $2)
      AND (m.recipient_deleted = false OR m.sender_deleted = false)
  `, [messageId, userId]);

  if (r.rows.length === 0) throw new NotFoundError("Message");

  if (r.rows[0].recipient_id === userId && !r.rows[0].read) {
    await pool.query("UPDATE user_messages SET read = true WHERE id = $1", [messageId]);
    r.rows[0].read = true;
  }

  return r.rows[0];
}

export async function sendMessage(senderId: number, recipientUsername: string, subject: string, body: string): Promise<Message> {
  if (!subject.trim() && !body.trim()) throw new ValidationError("Message cannot be empty");
  if (recipientUsername.length < 1) throw new ValidationError("Recipient username is required");

  const userR = await pool.query(
    "SELECT id FROM users WHERE username = $1 AND deleted_at IS NULL",
    [recipientUsername]
  );
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const recipientId = userR.rows[0].id;

  if (recipientId === senderId) throw new ValidationError("You cannot send a message to yourself");

  const r = await pool.query(`
    INSERT INTO user_messages (sender_id, recipient_id, subject, body)
    VALUES ($1, $2, $3, $4) RETURNING *
  `, [senderId, recipientId, subject.trim().substring(0, 255), body.trim()]);

  return r.rows[0];
}

export async function deleteMessage(messageId: number, userId: number): Promise<void> {
  const r = await pool.query(
    "SELECT id, sender_id, recipient_id FROM user_messages WHERE id = $1",
    [messageId]
  );
  if (r.rows.length === 0) throw new NotFoundError("Message");

  const msg = r.rows[0];

  if (msg.sender_id === userId && msg.recipient_id === userId) {
    await pool.query("DELETE FROM user_messages WHERE id = $1", [messageId]);
  } else if (msg.sender_id === userId) {
    await pool.query("UPDATE user_messages SET sender_deleted = true WHERE id = $1", [messageId]);
  } else if (msg.recipient_id === userId) {
    await pool.query("UPDATE user_messages SET recipient_deleted = true WHERE id = $1", [messageId]);
  } else {
    throw new NotFoundError("Message");
  }
}

export async function getUnreadCount(userId: number): Promise<number> {
  const r = await pool.query(
    "SELECT COUNT(*) FROM user_messages WHERE recipient_id = $1 AND recipient_deleted = false AND read = false",
    [userId]
  );
  return parseInt(r.rows[0].count, 10);
}
