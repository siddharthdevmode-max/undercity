import { pool } from "../config/database";
import { ValidationError, NotFoundError } from "../utils/errors";

interface CalendarEvent { id: number; title: string; description: string; event_date: string; created_at: string; }

export async function getEvents(userId: number, month: string): Promise<CalendarEvent[]> {
  const r = await pool.query(
    `SELECT * FROM calendar_events WHERE user_id = $1 AND to_char(event_date, 'YYYY-MM') = $2 ORDER BY event_date`,
    [userId, month]
  );
  return r.rows;
}

export async function createEvent(userId: number, title: string, description: string, eventDate: string): Promise<CalendarEvent> {
  if (!title.trim()) throw new ValidationError("Title is required");
  const date = new Date(eventDate);
  if (isNaN(date.getTime())) throw new ValidationError("Invalid date");
  const r = await pool.query(
    `INSERT INTO calendar_events (user_id, title, description, event_date) VALUES ($1, $2, $3, $4) RETURNING *`,
    [userId, title.trim(), description.trim(), eventDate]
  );
  return r.rows[0];
}

export async function deleteEvent(eventId: number, userId: number): Promise<void> {
  const r = await pool.query("DELETE FROM calendar_events WHERE id = $1 AND user_id = $2 RETURNING id", [eventId, userId]);
  if (r.rows.length === 0) throw new NotFoundError("Event");
}
