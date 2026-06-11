import { pool } from "../config/database";

interface Article { id: number; title: string; content: string; category: string; important: boolean; created_at: string; }

export async function getArticles(category?: string, page: number = 1): Promise<{ articles: Article[]; total: number }> {
  const perPage = 20;
  const offset = (page - 1) * perPage;
  const params: unknown[] = [];
  let where = "";
  if (category) { params.push(category); where = `WHERE category = $${params.length}`; }
  const countR = await pool.query(`SELECT COUNT(*) FROM newspaper_articles ${where}`, params);
  const dataR = await pool.query(`SELECT * FROM newspaper_articles ${where} ORDER BY important DESC, created_at DESC LIMIT ${perPage} OFFSET ${offset}`, params);
  return { articles: dataR.rows, total: parseInt(countR.rows[0].count, 10) };
}
