import { pool } from "../config/database";
import { ValidationError } from "../utils/errors";

export async function getAlliances(gangId: number): Promise<unknown[]> {
  const r = await pool.query(`
    SELECT ga.*, g.name AS gang_name, g.tag AS gang_tag FROM gang_alliances ga
    JOIN gangs g ON g.id = CASE WHEN ga.gang_a_id = $1 THEN ga.gang_b_id ELSE ga.gang_a_id END
    WHERE ga.gang_a_id = $1 OR ga.gang_b_id = $1
  `, [gangId]);
  return r.rows;
}

export async function requestAlliance(leaderId: number, targetGangId: number): Promise<void> {
  const gangR = await pool.query("SELECT gang_id FROM gang_members WHERE user_id = $1 AND role = 'leader'", [leaderId]);
  if (gangR.rows.length === 0) throw new ValidationError("Not a gang leader");
  const gid = gangR.rows[0].gang_id;
  if (gid === targetGangId) throw new ValidationError("Cannot ally with yourself");
  await pool.query(
    `INSERT INTO gang_alliances (gang_a_id, gang_b_id, status) VALUES ($1, $2, 'pending')
     ON CONFLICT DO NOTHING`,
    [gid, targetGangId]
  );
}

export async function respondAlliance(leaderId: number, allianceId: number, accept: boolean): Promise<void> {
  const gangR = await pool.query("SELECT gang_id FROM gang_members WHERE user_id = $1 AND role = 'leader'", [leaderId]);
  if (gangR.rows.length === 0) throw new ValidationError("Not a gang leader");
  const status = accept ? "allied" : "rejected";
  await pool.query("UPDATE gang_alliances SET status = $1 WHERE id = $2 AND (gang_a_id = $3 OR gang_b_id = $3)", [status, allianceId, gangR.rows[0].gang_id]);
}
