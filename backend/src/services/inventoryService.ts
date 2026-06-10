import { pool } from "../config/database";
import { ValidationError, NotFoundError } from "../utils/errors";

interface InventoryItem {
  id: number;
  user_id: number;
  item_id: number;
  quantity: number;
  acquired_at: string;
  item_name: string;
  item_description: string;
  item_category: string;
  item_usable: boolean;
  item_base_price: number;
}

export async function getInventory(
  userId: number,
  category?: string,
  limit = 50,
  offset = 0
): Promise<{ items: InventoryItem[]; total: number }> {
  const conditions = ["ui.user_id = $1"];
  const params: unknown[] = [userId];
  let paramIdx = 2;

  if (category) {
    conditions.push(`i.category = $${paramIdx}`);
    params.push(category);
    paramIdx++;
  }

  const where = conditions.join(" AND ");

  const [countR, rowsR] = await Promise.all([
    pool.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM user_inventory ui
       JOIN items i ON i.id = ui.item_id WHERE ${where}`,
      params
    ),
    pool.query(
      `SELECT ui.*, i.name AS item_name, i.description AS item_description,
              i.category AS item_category, i.usable AS item_usable, i.base_price AS item_base_price
       FROM user_inventory ui
       JOIN items i ON i.id = ui.item_id
       WHERE ${where}
       ORDER BY i.category, i.name
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    ),
  ]);

  return { items: rowsR.rows as InventoryItem[], total: countR.rows[0]?.total ?? 0 };
}

export async function useItem(userId: number, itemId: number, quantity = 1): Promise<{ effects: Record<string, number>; remaining: number }> {
  const invR = await pool.query<{ quantity: number }>(
    `SELECT quantity FROM user_inventory WHERE user_id = $1 AND item_id = $2 LIMIT 1`,
    [userId, itemId]
  );
  if (invR.rows.length === 0 || invR.rows[0].quantity < quantity) {
    throw new ValidationError("You don't have enough of this item");
  }

  const itemR = await pool.query<{ id: number; name: string; category: string; usable: boolean; base_price: number }>(
    `SELECT id, name, category, usable, base_price FROM items WHERE id = $1 AND is_active = TRUE LIMIT 1`,
    [itemId]
  );
  if (itemR.rows.length === 0) throw new NotFoundError("Item");
  const item = itemR.rows[0];
  if (!item.usable) throw new ValidationError("This item cannot be used");

  const effects: Record<string, number> = {};

  switch (item.category) {
    case "medical": {
      const healAmount = quantity * 25;
      const userR = await pool.query<{ life: number; max_life: number }>(
        `SELECT life, max_life FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
        [userId]
      );
      if (userR.rows.length === 0) throw new NotFoundError("User");
      const user = userR.rows[0];
      const actualHeal = Math.min(healAmount, user.max_life - user.life);
      if (actualHeal <= 0) throw new ValidationError("You are already at full health");
      await pool.query(
        `UPDATE users SET life = life + $2, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
        [userId, actualHeal]
      );
      effects.life = actualHeal;
      break;
    }
    case "drug": {
      const userR = await pool.query<{ energy: number; max_energy: number; nerve: number; max_nerve: number }>(
        `SELECT energy, max_energy, nerve, max_nerve FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
        [userId]
      );
      if (userR.rows.length === 0) throw new NotFoundError("User");
      const user = userR.rows[0];

      if (item.name === "Energy Drink") {
        const restore = Math.min(20 * quantity, user.max_energy - user.energy);
        if (restore <= 0) throw new ValidationError("Energy is already full");
        await pool.query(`UPDATE users SET energy = energy + $2, updated_at = NOW() WHERE id = $1`, [userId, restore]);
        effects.energy = restore;
      } else if (item.name === "Nerve Tonic") {
        const restore = Math.min(10 * quantity, user.max_nerve - user.nerve);
        if (restore <= 0) throw new ValidationError("Nerve is already full");
        await pool.query(`UPDATE users SET nerve = nerve + $2, updated_at = NOW() WHERE id = $1`, [userId, restore]);
        effects.nerve = restore;
      }
      break;
    }
    default: {
      const userR = await pool.query<{ life: number; max_life: number }>(
        `SELECT life, max_life FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
        [userId]
      );
      if (userR.rows.length === 0) throw new NotFoundError("User");
      const user = userR.rows[0];
      const actualHeal = Math.min(Math.ceil(quantity * 15), user.max_life - user.life);
      if (actualHeal > 0) {
        await pool.query(`UPDATE users SET life = life + $2, updated_at = NOW() WHERE id = $1`, [userId, actualHeal]);
        effects.life = actualHeal;
      }
      break;
    }
  }

  await pool.query(
    `UPDATE user_inventory SET quantity = quantity - $3
     WHERE user_id = $1 AND item_id = $2`,
    [userId, itemId, quantity]
  );

  await pool.query(
    `INSERT INTO bank_transactions
       (user_id, type, amount, balance_before, balance_after, description)
     VALUES ($1, 'item_use', 0, 0, 0, $2)`,
    [userId, `Used ${quantity}x ${item.name}`]
  );

  const remainingR = await pool.query<{ quantity: number }>(
    `SELECT quantity FROM user_inventory WHERE user_id = $1 AND item_id = $2 LIMIT 1`,
    [userId, itemId]
  );

  return { effects, remaining: remainingR.rows[0]?.quantity ?? 0 };
}

export async function dropItem(userId: number, itemId: number, quantity = 1): Promise<void> {
  const invR = await pool.query<{ quantity: number }>(
    `SELECT quantity FROM user_inventory WHERE user_id = $1 AND item_id = $2 LIMIT 1`,
    [userId, itemId]
  );
  if (invR.rows.length === 0 || invR.rows[0].quantity < quantity) {
    throw new ValidationError("You don't have enough of this item");
  }

  await pool.query(
    `UPDATE user_inventory SET quantity = quantity - $3
     WHERE user_id = $1 AND item_id = $2`,
    [userId, itemId, quantity]
  );
}
