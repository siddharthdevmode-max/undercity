import { pool } from "../config/database";
import { ValidationError } from "../utils/errors";

export async function getWars(gangId: number): Promise<unknown[]> {
  const r = await pool.query(`
    SELECT gw.*, a.name AS attacker_name, d.name AS defender_name
    FROM gang_wars gw JOIN gangs a ON a.id = gw.attacker_id JOIN gangs d ON d.id = gw.defender_id
    WHERE gw.attacker_id = $1 OR gw.defender_id = $1 ORDER BY gw.started_at DESC
  `, [gangId]);
  return r.rows;
}

export async function declareWar(leaderId: number, targetGangId: number): Promise<void> {
  const gangR = await pool.query("SELECT gang_id FROM gang_members WHERE user_id = $1 AND role = 'leader'", [leaderId]);
  if (gangR.rows.length === 0) throw new ValidationError("Not a gang leader");
  const gid = gangR.rows[0].gang_id;
  if (gid === targetGangId) throw new ValidationError("Cannot war yourself");
  await pool.query(
    `INSERT INTO gang_wars (attacker_id, defender_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [gid, targetGangId]
  );
}
