import { pool, withTransaction } from "../config/database";
import { ValidationError, NotFoundError } from "../utils/errors";

const NERVE_COST = 5;
const NEWBIE_PROTECTION_LEVEL = 5;
const MUG_PCT = 0.15;

function calcOutcome(attStr: number, attSpd: number, attDex: number, tgtStr: number, tgtSpd: number, tgtDef: number): { win: boolean; attackerHpLoss: number; targetHpLoss: number } {
  const atkPower = attStr * 0.5 + attDex * 0.3 + attSpd * 0.2;
  const defPower = tgtStr * 0.3 + tgtSpd * 0.2 + tgtDef * 0.5;

  const baseDmg = Math.max(5, Math.floor(Math.random() * 20 + 10));
  const atkDmg = Math.max(1, Math.floor(baseDmg * (atkPower / Math.max(1, defPower)) * 0.8));
  const defDmg = Math.max(1, Math.floor(baseDmg * (defPower / Math.max(1, atkPower)) * 0.6));

  const atkHp = 100 + attStr;
  const defHp = 100 + tgtStr;

  const win = atkDmg > defDmg * 1.2;

  return {
    win,
    attackerHpLoss: Math.min(defHp, defDmg),
    targetHpLoss: Math.min(atkHp, atkDmg),
  };
}

export async function searchTarget(userId: number): Promise<{ id: number; username: string; level: number }> {
  const userR = await pool.query<{ id: number; level: number }>(
    `SELECT id, level FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`, [userId]
  );
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const user = userR.rows[0];

  const minLevel = Math.max(1, user.level - 5);
  const maxLevel = user.level + 5;

  const result = await pool.query<{ id: number; username: string; level: number }>(
    `SELECT id, username, level FROM users
     WHERE id != $1 AND deleted_at IS NULL
       AND level BETWEEN $2 AND $3
       AND is_hard_banned = FALSE
     ORDER BY RANDOM() LIMIT 1`,
    [userId, minLevel, maxLevel]
  );

  if (result.rows.length === 0) throw new ValidationError("No targets found in your range");
  return result.rows[0];
}

export async function attack(
  attackerId: number,
  targetId: number
): Promise<{
  result: string;
  attackerHpLoss: number;
  targetHpLoss: number;
  moneyStolen: number;
  attacker: { money: number; nerve: number; life: number };
  target: { username: string; money: number; life: number };
}> {
  if (attackerId === targetId) throw new ValidationError("You cannot attack yourself");

  return withTransaction(async (client) => {
    const [attR, tgtR] = await Promise.all([
      client.query(`SELECT id, username, level, money, nerve, life, max_life, strength, speed, defense, dexterity
        FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`, [attackerId]),
      client.query(`SELECT id, username, level, money, life, max_life, strength, speed, defense, dexterity
        FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`, [targetId]),
    ]);

    if (attR.rows.length === 0) throw new NotFoundError("Attacker");
    if (tgtR.rows.length === 0) throw new NotFoundError("Target");

    const att = attR.rows[0];
    const tgt = tgtR.rows[0];

    if (att.level <= NEWBIE_PROTECTION_LEVEL || tgt.level <= NEWBIE_PROTECTION_LEVEL) {
      throw new ValidationError("New players (level 5 and below) are protected from attacks");
    }

    if (att.nerve < NERVE_COST) {
      throw new ValidationError(`Need ${NERVE_COST} nerve to attack. You have ${att.nerve}.`);
    }

    const { win, attackerHpLoss, targetHpLoss } = calcOutcome(
      att.strength, att.speed, att.dexterity,
      tgt.strength, tgt.speed, tgt.defense
    );

    let result: string;
    let moneyStolen = 0;

    if (win) {
      moneyStolen = Math.min(Math.floor(tgt.money * MUG_PCT), tgt.money);
      result = moneyStolen > 0 ? "mugged" : "attacker_win";
    } else {
      result = "target_win";
    }

    const attNewLife = Math.max(0, att.life - attackerHpLoss);
    const tgtNewLife = Math.max(0, tgt.life - targetHpLoss);

    await client.query(
      `UPDATE users SET money = money - $2, life = $3, nerve = nerve - $4, updated_at = NOW() WHERE id = $1`,
      [targetId, moneyStolen, tgtNewLife, 0]
    );

    await client.query(
      `UPDATE users SET money = money + $2, life = $3, nerve = nerve - $4, updated_at = NOW() WHERE id = $1`,
      [attackerId, moneyStolen, attNewLife, NERVE_COST]
    );

    if (tgtNewLife <= 0) {
      const hospitalSeconds = Math.floor(Math.random() * 600 + 300);
      await client.query(
        `UPDATE users SET hospital_until = NOW() + $2::interval, life = $3 WHERE id = $1`,
        [targetId, `${hospitalSeconds} seconds`, 1]
      );
      result = "hospitalized";
    }

    await void client.query(
      `INSERT INTO pvp_attacks (attacker_id, target_id, result, attacker_hp, target_hp, money_stolen, attacker_nerve)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [attackerId, targetId, result, attackerHpLoss, targetHpLoss, moneyStolen, NERVE_COST]
    );

    const [attFinal, tgtFinal] = await Promise.all([
      client.query(`SELECT money, nerve, life FROM users WHERE id = $1 LIMIT 1`, [attackerId]),
      client.query(`SELECT username, money, life FROM users WHERE id = $1 LIMIT 1`, [targetId]),
    ]);

    return {
      result,
      attackerHpLoss,
      targetHpLoss,
      moneyStolen,
      attacker: attFinal.rows[0],
      target: tgtFinal.rows[0],
    };
  });
}

export async function getAttackLog(userId: number, limit = 20): Promise<unknown[]> {
  const result = await pool.query(
    `SELECT pa.*, u.username AS target_name
     FROM pvp_attacks pa
     JOIN users u ON u.id = pa.target_id
     WHERE pa.attacker_id = $1
     ORDER BY pa.created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}
