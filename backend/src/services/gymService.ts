import { pool } from "../config/database";
import { ValidationError } from "../utils/errors";

const STATS = ["strength", "speed", "defense", "dexterity"] as const;
const ENERGY_COST = 10;
const MIN_GAIN = 1;
const MAX_GAIN = 3;

function rollGain(): number {
  return Math.floor(Math.random() * (MAX_GAIN - MIN_GAIN + 1)) + MIN_GAIN;
}

export async function train(userId: number, stat: string): Promise<{ stat: string; gained: number; newValue: number; energy: number }> {
  if (!STATS.includes(stat as typeof STATS[number])) {
    throw new ValidationError(`Invalid stat. Choose: ${STATS.join(", ")}`);
  }

  const userR = await pool.query<{ energy: number; max_energy: number; [key: string]: unknown }>(
    `SELECT energy, max_energy, ${STATS.join(", ")} FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [userId]
  );
  if (userR.rows.length === 0) throw new ValidationError("User not found");
  const user = userR.rows[0];

  if (user.energy < ENERGY_COST) {
    throw new ValidationError(`Need ${ENERGY_COST} energy to train. You have ${user.energy}.`);
  }

  const gained = rollGain();
  const currentVal = user[stat] as number;

  await pool.query(
    `UPDATE users SET ${stat} = $2, energy = energy - $3, updated_at = NOW() WHERE id = $1`,
    [userId, currentVal + gained, ENERGY_COST]
  );

  return {
    stat,
    gained,
    newValue: currentVal + gained,
    energy: user.energy - ENERGY_COST,
  };
}

export async function getStats(userId: number): Promise<Record<string, number>> {
  const result = await pool.query(
    `SELECT strength, speed, defense, dexterity, energy, max_energy FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [userId]
  );
  if (result.rows.length === 0) throw new ValidationError("User not found");
  return result.rows[0];
}
