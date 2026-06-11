import { pool } from "../config/database";
import { ValidationError, NotFoundError, ConflictError } from "../utils/errors";

interface Gang { id: number; name: string; tag: string; description: string; leader_id: number; bank: number; respect: number; created_at: string; member_count?: string; }
interface Member { id: number; user_id: number; role: string; joined_at: string; username: string; }

export async function create(userId: number, name: string, tag: string, description: string): Promise<Gang> {
  const existing = await pool.query("SELECT id FROM gang_members WHERE user_id = $1", [userId]);
  if (existing.rows.length > 0) throw new ConflictError("Already in a gang");
  const r = await pool.query(
    `INSERT INTO gangs (name, tag, description, leader_id) VALUES ($1, $2, $3, $4) RETURNING *`,
    [name.trim(), tag.trim().toUpperCase(), description.trim(), userId]
  );
  await pool.query("INSERT INTO gang_members (gang_id, user_id, role) VALUES ($1, $2, 'leader')", [r.rows[0].id, userId]);
  return r.rows[0];
}

export async function getMyGang(userId: number): Promise<{ gang: Gang; members: Member[] } | null> {
  const memberR = await pool.query(
    `SELECT g.*, gm.role FROM gang_members gm JOIN gangs g ON g.id = gm.gang_id WHERE gm.user_id = $1`, [userId]
  );
  if (memberR.rows.length === 0) return null;
  const gang = memberR.rows[0];
  const membersR = await pool.query(
    `SELECT gm.*, u.username FROM gang_members gm JOIN users u ON u.id = gm.user_id WHERE gm.gang_id = $1 ORDER BY gm.joined_at`, [gang.id]
  );
  return { gang, members: membersR.rows };
}

export async function getGangs(): Promise<Gang[]> {
  const r = await pool.query(`
    SELECT g.*, COUNT(gm.id)::text AS member_count FROM gangs g
    LEFT JOIN gang_members gm ON gm.gang_id = g.id GROUP BY g.id ORDER BY g.respect DESC
  `);
  return r.rows;
}

export async function join(gangId: number, userId: number): Promise<void> {
  const existing = await pool.query("SELECT id FROM gang_members WHERE user_id = $1", [userId]);
  if (existing.rows.length > 0) throw new ConflictError("Already in a gang");
  const gangR = await pool.query("SELECT id FROM gangs WHERE id = $1", [gangId]);
  if (gangR.rows.length === 0) throw new NotFoundError("Gang");
  await pool.query("INSERT INTO gang_members (gang_id, user_id) VALUES ($1, $2)", [gangId, userId]);
}

export async function leave(userId: number): Promise<void> {
  const r = await pool.query("DELETE FROM gang_members WHERE user_id = $1 RETURNING gang_id, role", [userId]);
  if (r.rows.length === 0) throw new NotFoundError("Membership");
  if (r.rows[0].role === "leader") {
    await pool.query("DELETE FROM gangs WHERE id = $1", [r.rows[0].gang_id]);
  }
}

export async function kick(leaderId: number, targetUserId: number): Promise<void> {
  const leaderR = await pool.query("SELECT gang_id FROM gang_members WHERE user_id = $1 AND role = 'leader'", [leaderId]);
  if (leaderR.rows.length === 0) throw new ValidationError("Not a leader");
  await pool.query("DELETE FROM gang_members WHERE user_id = $1 AND gang_id = $2", [targetUserId, leaderR.rows[0].gang_id]);
}
