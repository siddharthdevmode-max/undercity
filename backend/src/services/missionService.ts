import { pool } from "../config/database";
import { NotFoundError } from "../utils/errors";

interface Mission { id: number; name: string; description: string; objectives: unknown; rewards: unknown; min_level: number; repeatable: boolean; cooldown_h: number; }
interface UserMission { id: number; mission_id: number; progress: unknown; status: string; started_at: string; completed_at: string | null; }

export async function getAvailable(userId: number): Promise<(Mission & { status: string | null; progress: unknown })[]> {
  const r = await pool.query(`
    SELECT m.*, um.status, um.progress FROM missions m
    LEFT JOIN user_missions um ON um.mission_id = m.id AND um.user_id = $1
    ORDER BY m.min_level, m.id
  `, [userId]);
  return r.rows.map((row) => ({
    ...row, status: row.status || (row.repeatable ? null : "new"), progress: row.progress || null,
  }));
}

export async function startMission(userId: number, missionId: number): Promise<UserMission> {
  const missR = await pool.query("SELECT * FROM missions WHERE id = $1", [missionId]);
  if (missR.rows.length === 0) throw new NotFoundError("Mission");
  const userR = await pool.query("SELECT level FROM users WHERE id = $1", [userId]);
  if (userR.rows[0].level < missR.rows[0].min_level) throw new Error("Level too low");
  const r = await pool.query(
    `INSERT INTO user_missions (user_id, mission_id, progress, status)
     VALUES ($1, $2, '{}', 'active') ON CONFLICT (user_id, mission_id) DO UPDATE SET status = 'active' RETURNING *`,
    [userId, missionId]
  );
  return r.rows[0];
}
