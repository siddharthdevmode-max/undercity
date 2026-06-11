import { pool } from "../config/database";
import { ValidationError } from "../utils/errors";

function now(): number { return Date.now(); }
function parsePgTs(str: string): number { return new Date(str).getTime(); }

export async function listCities(userId: number): Promise<{ cities: unknown[]; currentCity: string }> {
  const userR = await pool.query<{ level: number }>(
    `SELECT level FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`, [userId]
  );
  if (userR.rows.length === 0) throw new ValidationError("User not found");
  const level = userR.rows[0].level;

  const citiesR = await pool.query(
    `SELECT id, name, description, country, flight_cost, flight_time, min_level
     FROM cities WHERE is_active = TRUE ORDER BY flight_cost ASC`
  );

  const activeR = await pool.query(
    `SELECT c.*, th.departed_at, th.arrived_at
     FROM travel_history th
     JOIN cities c ON c.id = th.city_id
     WHERE th.user_id = $1 AND th.returned = FALSE
     ORDER BY th.departed_at DESC LIMIT 1`,
    [userId]
  );

  const cities = citiesR.rows.map((c: Record<string, unknown>) => ({
    ...c,
    unlocked: level >= (c.min_level as number),
  }));

  let currentCity = "Undercity";
  if (activeR.rows.length > 0) {
    const t = activeR.rows[0] as Record<string, unknown>;
    const arrivedAt = parsePgTs(t.arrived_at as string);
    if (now() >= arrivedAt) {
      currentCity = t.name as string;
    }
  }

  return { cities, currentCity };
}

export async function startFlight(userId: number, cityId: number): Promise<{ message: string; arrivesAt: string; flightTime: number; cost: number }> {
  const userR = await pool.query<{ id: number; level: number; money: number }>(
    `SELECT id, level, money FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`, [userId]
  );
  if (userR.rows.length === 0) throw new ValidationError("User not found");
  const user = userR.rows[0];

  const cityR = await pool.query(
    `SELECT * FROM cities WHERE id = $1 AND is_active = TRUE LIMIT 1`, [cityId]
  );
  if (cityR.rows.length === 0) throw new ValidationError("City not found");
  const city = cityR.rows[0] as Record<string, unknown>;

  if (user.level < (city.min_level as number)) {
    throw new ValidationError(`Need level ${city.min_level} to travel here`);
  }

  if (user.money < (city.flight_cost as number)) {
    throw new ValidationError(`Need $${(city.flight_cost as number).toLocaleString()} for the flight`);
  }

  // Check if already traveling
  const activeR = await pool.query(
    `SELECT id FROM travel_history WHERE user_id = $1 AND returned = FALSE AND arrived_at > NOW() LIMIT 1`,
    [userId]
  );
  if (activeR.rows.length > 0) {
    throw new ValidationError("You are already traveling");
  }

  const flightTime = city.flight_time as number;
  const cost = city.flight_cost as number;
  const arrivesAt = new Date(now() + flightTime * 1000).toISOString();

  await pool.query(
    `UPDATE users SET money = money - $2, updated_at = NOW() WHERE id = $1`,
    [userId, cost]
  );

  await pool.query(
    `INSERT INTO travel_history (user_id, city_id, departed_at, arrived_at)
     VALUES ($1, $2, NOW(), $3::timestamptz)`,
    [userId, cityId, arrivesAt]
  );

  return { message: `Flight to ${city.name} departing...`, arrivesAt, flightTime, cost };
}

export async function getTravelStatus(userId: number): Promise<{ traveling: boolean; city: string | null; arrivesAt: string | null; remainingSeconds: number }> {
  const result = await pool.query(
    `SELECT c.name AS city, th.arrived_at
     FROM travel_history th
     JOIN cities c ON c.id = th.city_id
     WHERE th.user_id = $1 AND th.returned = FALSE
     ORDER BY th.departed_at DESC LIMIT 1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return { traveling: false, city: null, arrivesAt: null, remainingSeconds: 0 };
  }

  const row = result.rows[0] as { city: string; arrived_at: string };
  const remaining = Math.max(0, Math.ceil((parsePgTs(row.arrived_at) - now()) / 1000));

  return {
    traveling: remaining > 0,
    city: row.city,
    arrivesAt: row.arrived_at,
    remainingSeconds: remaining,
  };
}

export async function returnHome(userId: number): Promise<{ message: string }> {
  const activeR = await pool.query(
    `SELECT th.id, th.arrived_at FROM travel_history th
     WHERE th.user_id = $1 AND th.returned = FALSE
     ORDER BY th.departed_at DESC LIMIT 1`,
    [userId]
  );

  if (activeR.rows.length === 0) throw new ValidationError("You are not traveling");

  const t = activeR.rows[0] as { id: number; arrived_at: string };
  const remaining = Math.max(0, Math.ceil((parsePgTs(t.arrived_at) - now()) / 1000));

  if (remaining > 0) {
    throw new ValidationError(`Your flight hasn't arrived yet. ${remaining}s remaining.`);
  }

  await pool.query(`UPDATE travel_history SET returned = TRUE WHERE id = $1`, [t.id]);

  return { message: "You have returned to Undercity" };
}
