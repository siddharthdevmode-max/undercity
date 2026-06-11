import { pool } from "../config/database";
import { ValidationError, NotFoundError } from "../utils/errors";

interface Category { id: number; name: string; description: string; sort_order: number; thread_count: string; last_post: Date | null; }
interface Thread { id: number; category_id: number; title: string; content: string; is_pinned: boolean; is_locked: boolean; created_at: string; updated_at: string; username: string; post_count: string; }
interface Post { id: number; thread_id: number; content: string; created_at: string; username: string; }

export async function getCategories(): Promise<Category[]> {
  const r = await pool.query(`
    SELECT c.*, COUNT(t.id)::text AS thread_count, MAX(t.updated_at) AS last_post
    FROM forum_categories c LEFT JOIN forum_threads t ON t.category_id = c.id
    GROUP BY c.id ORDER BY c.sort_order
  `);
  return r.rows;
}

export async function getThreads(categoryId?: number, page: number = 1): Promise<{ threads: Thread[]; total: number }> {
  const perPage = 20;
  const offset = (page - 1) * perPage;
  let where = "";
  const params: unknown[] = [];
  if (categoryId) { params.push(categoryId); where = `WHERE t.category_id = $${params.length}`; }

  const countR = await pool.query(`SELECT COUNT(*) FROM forum_threads t ${where}`, params);
  const total = parseInt(countR.rows[0].count, 10);

  const dataR = await pool.query(`
    SELECT t.*, u.username,
      (SELECT COUNT(*) FROM forum_posts WHERE thread_id = t.id)::text AS post_count
    FROM forum_threads t
    JOIN users u ON u.id = t.user_id
    ${where}
    ORDER BY t.is_pinned DESC, t.updated_at DESC
    LIMIT ${perPage} OFFSET ${offset}
  `, params);
  return { threads: dataR.rows, total };
}

export async function getThread(threadId: number): Promise<{ thread: Thread; posts: Post[] }> {
  const threadR = await pool.query(`
    SELECT t.*, u.username,
      (SELECT COUNT(*) FROM forum_posts WHERE thread_id = t.id)::text AS post_count
    FROM forum_threads t JOIN users u ON u.id = t.user_id WHERE t.id = $1
  `, [threadId]);
  if (threadR.rows.length === 0) throw new NotFoundError("Thread");
  const postsR = await pool.query(`
    SELECT p.*, u.username FROM forum_posts p
    JOIN users u ON u.id = p.user_id WHERE p.thread_id = $1 ORDER BY p.created_at
  `, [threadId]);
  return { thread: threadR.rows[0], posts: postsR.rows };
}

export async function createThread(userId: number, categoryId: number, title: string, content: string): Promise<Thread> {
  if (!title.trim()) throw new ValidationError("Title is required");
  if (!content.trim()) throw new ValidationError("Content is required");
  const catR = await pool.query("SELECT id FROM forum_categories WHERE id = $1", [categoryId]);
  if (catR.rows.length === 0) throw new NotFoundError("Category");
  const r = await pool.query(`
    INSERT INTO forum_threads (category_id, user_id, title, content)
    VALUES ($1, $2, $3, $4) RETURNING *
  `, [categoryId, userId, title.trim(), content.trim()]);
  return r.rows[0];
}

export async function replyToThread(threadId: number, userId: number, content: string): Promise<Post> {
  if (!content.trim()) throw new ValidationError("Content is required");
  const threadR = await pool.query("SELECT id, is_locked FROM forum_threads WHERE id = $1", [threadId]);
  if (threadR.rows.length === 0) throw new NotFoundError("Thread");
  if (threadR.rows[0].is_locked) throw new ValidationError("Thread is locked");
  const r = await pool.query(`
    INSERT INTO forum_posts (thread_id, user_id, content) VALUES ($1, $2, $3) RETURNING *
  `, [threadId, userId, content.trim()]);
  await pool.query("UPDATE forum_threads SET updated_at = NOW() WHERE id = $1", [threadId]);
  return r.rows[0];
}
