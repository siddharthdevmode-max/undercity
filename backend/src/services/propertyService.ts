import { pool, withTransaction } from "../config/database";
import { ValidationError, NotFoundError } from "../utils/errors";

export async function listProperties(userId: number): Promise<{ properties: unknown[]; owned: number[] }> {
  const userR = await pool.query<{ id: number; level: number; money: number }>(
    `SELECT id, level, money FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`, [userId]
  );
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const user = userR.rows[0];

  const propsR = await pool.query(
    `SELECT * FROM properties WHERE is_active = TRUE ORDER BY price ASC`
  );

  const ownedR = await pool.query(
    `SELECT property_id FROM user_properties WHERE user_id = $1 AND foreclosed = FALSE`,
    [userId]
  );

  const owned = ownedR.rows.map((r: { property_id: number }) => r.property_id);

  const properties = propsR.rows.map((p: Record<string, unknown>) => ({
    ...p,
    canAfford: user.money >= (p.price as number),
    unlocked: user.level >= (p.min_level as number),
    owned: owned.includes(p.id as number),
  }));

  return { properties, owned };
}

export async function buyProperty(userId: number, propertyId: number): Promise<{ message: string; property: unknown; money: number }> {
  return withTransaction(async (client) => {
    const userR = await client.query(
      `SELECT id, level, money FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`, [userId]
    );
    if (userR.rows.length === 0) throw new NotFoundError("User");
    const user = userR.rows[0];

    const propR = await client.query(
      `SELECT * FROM properties WHERE id = $1 AND is_active = TRUE LIMIT 1`, [propertyId]
    );
    if (propR.rows.length === 0) throw new NotFoundError("Property");
    const prop = propR.rows[0] as Record<string, unknown>;

    if (user.level < (prop.min_level as number)) {
      throw new ValidationError(`Need level ${prop.min_level} to buy this property`);
    }
    if (user.money < (prop.price as number)) {
      throw new ValidationError(`Need $${(prop.price as number).toLocaleString()} to buy this`);
    }

    const ownedR = await client.query(
      `SELECT id FROM user_properties WHERE user_id = $1 AND property_id = $2 AND foreclosed = FALSE LIMIT 1`,
      [userId, propertyId]
    );
    if (ownedR.rows.length > 0) throw new ValidationError("You already own this property");

    await client.query(
      `UPDATE users SET money = money - $2, updated_at = NOW() WHERE id = $1`,
      [userId, prop.price]
    );

    await client.query(
      `INSERT INTO user_properties (user_id, property_id) VALUES ($1, $2)`,
      [userId, propertyId]
    );

    return {
      message: `You bought ${prop.name}`,
      property: prop,
      money: user.money - (prop.price as number),
    };
  });
}

export async function collectIncome(userId: number): Promise<{ message: string; totalIncome: number; money: number }> {
  const propsR = await pool.query(
    `SELECT p.id, p.name, p.daily_income FROM user_properties up
     JOIN properties p ON p.id = up.property_id
     WHERE up.user_id = $1 AND up.foreclosed = FALSE`,
    [userId]
  );

  if (propsR.rows.length === 0) throw new ValidationError("You don't own any properties");

  let totalIncome = 0;
  for (const row of propsR.rows) {
    const prop = row as { id: number; name: string; daily_income: number };
    totalIncome += prop.daily_income;
  }

  await pool.query(
    `UPDATE users SET money = money + $2, updated_at = NOW() WHERE id = $1`,
    [userId, totalIncome]
  );

  const userR = await pool.query(`SELECT money FROM users WHERE id = $1 LIMIT 1`, [userId]);

  return {
    message: `Collected $${totalIncome.toLocaleString()} from your properties`,
    totalIncome,
    money: userR.rows[0].money,
  };
}
