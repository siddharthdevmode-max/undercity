import { pool, withTransaction } from "../config/database";
import { ValidationError, NotFoundError, InsufficientFundsError } from "../utils/errors";

interface MarketListing {
  id: number;
  seller_id: number;
  item_id: number;
  quantity: number;
  quantity_left: number;
  price_per_unit: number;
  sold: boolean;
  listed_at: string;
  expires_at: string;
}

interface Item {
  id: number;
  name: string;
  description: string;
  category: string;
  base_price: number;
  usable: boolean;
  sellable: boolean;
  tradeable: boolean;
}

const MARKET_TAX_PCT = 5;
const LISTING_DURATION_DAYS = 7;

export async function listItem(
  userId: number,
  itemId: number,
  quantity: number,
  pricePerUnit: number
): Promise<MarketListing> {
  return withTransaction(async (client) => {
    const itemR = await client.query<Item>(
      `SELECT id, name, sellable, tradeable FROM items WHERE id = $1 AND is_active = TRUE LIMIT 1`,
      [itemId]
    );
    if (itemR.rows.length === 0) throw new NotFoundError("Item");
    const item = itemR.rows[0];
    if (!item.sellable || !item.tradeable) throw new ValidationError("This item cannot be listed on the market");

    const invR = await client.query<{ quantity: number }>(
      `SELECT quantity FROM user_inventory WHERE user_id = $1 AND item_id = $2 LIMIT 1`,
      [userId, itemId]
    );
    if (invR.rows.length === 0 || invR.rows[0].quantity < quantity) {
      throw new ValidationError("You don't have enough of this item");
    }

    await client.query(
      `UPDATE user_inventory SET quantity = quantity - $3 WHERE user_id = $1 AND item_id = $2`,
      [userId, itemId, quantity]
    );

    const result = await client.query<MarketListing>(
      `INSERT INTO market_listings
         (seller_id, item_id, quantity, quantity_left, price_per_unit, expires_at)
       VALUES ($1, $2, $3, $3, $4, NOW() + $5::interval)
       RETURNING *`,
      [userId, itemId, quantity, pricePerUnit, `${LISTING_DURATION_DAYS} days`]
    );

    return result.rows[0];
  });
}

export async function buyItem(userId: number, listingId: number): Promise<{ listing: MarketListing; totalCost: number }> {
  return withTransaction(async (client) => {
    const listingR = await client.query<MarketListing>(
      `SELECT * FROM market_listings WHERE id = $1 AND sold = FALSE AND quantity_left > 0 FOR UPDATE`,
      [listingId]
    );
    if (listingR.rows.length === 0) throw new NotFoundError("Listing");
    const listing = listingR.rows[0];
    if (listing.seller_id === userId) throw new ValidationError("Cannot buy your own listing");

    const buyerR = await client.query<{ id: number; money: number }>(
      `SELECT id, money FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [userId]
    );
    if (buyerR.rows.length === 0) throw new NotFoundError("User");
    const buyer = buyerR.rows[0];

    const buyQty = 1;
    const cost = listing.price_per_unit * buyQty;
    if (buyer.money < cost) throw new InsufficientFundsError(buyer.money, cost);

    const sellerTax = Math.ceil(cost * MARKET_TAX_PCT / 100);
    const sellerPayout = cost - sellerTax;

    await client.query(`UPDATE users SET money = money - $2, updated_at = NOW() WHERE id = $1`, [userId, cost]);
    await client.query(`UPDATE users SET money = money + $2, updated_at = NOW() WHERE id = $1`, [listing.seller_id, sellerPayout]);

    const newQuantityLeft = listing.quantity_left - buyQty;
    if (newQuantityLeft <= 0) {
      await client.query(`UPDATE market_listings SET quantity_left = 0, sold = TRUE WHERE id = $1`, [listingId]);
    } else {
      await client.query(`UPDATE market_listings SET quantity_left = $2 WHERE id = $1`, [listingId, newQuantityLeft]);
    }

    const existingInv = await client.query<{ quantity: number }>(
      `SELECT quantity FROM user_inventory WHERE user_id = $1 AND item_id = $2 LIMIT 1`,
      [userId, listing.item_id]
    );

    if (existingInv.rows.length > 0) {
      await client.query(
        `UPDATE user_inventory SET quantity = quantity + $3 WHERE user_id = $1 AND item_id = $2`,
        [userId, listing.item_id, buyQty]
      );
    } else {
      await client.query(
        `INSERT INTO user_inventory (user_id, item_id, quantity) VALUES ($1, $2, $3)`,
        [userId, listing.item_id, buyQty]
      );
    }

    return { listing, totalCost: cost };
  });
}

export async function cancelListing(userId: number, listingId: number): Promise<void> {
  return withTransaction(async (client) => {
    const listingR = await client.query<MarketListing>(
      `SELECT * FROM market_listings WHERE id = $1 AND sold = FALSE LIMIT 1`,
      [listingId]
    );
    if (listingR.rows.length === 0) throw new NotFoundError("Listing");
    const listing = listingR.rows[0];
    if (listing.seller_id !== userId) throw new ValidationError("You can only cancel your own listings");

    await client.query(
      `UPDATE user_inventory SET quantity = quantity + $3
       WHERE user_id = $1 AND item_id = $2`,
      [userId, listing.item_id, listing.quantity_left]
    );

    await client.query(`UPDATE market_listings SET sold = TRUE, quantity_left = 0 WHERE id = $1`, [listingId]);
  });
}

export async function getListings(
  filters?: { itemName?: string; category?: string; sort?: string; order?: string },
  limit = 20,
  offset = 0
): Promise<{ listings: Array<MarketListing & { item_name: string; category: string; seller_username: string }>; total: number }> {
  const conditions = ["ml.sold = FALSE", "ml.quantity_left > 0", "ml.expires_at > NOW()"];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (filters?.itemName) {
    conditions.push(`LOWER(i.name) LIKE LOWER($${paramIdx})`);
    params.push(`%${filters.itemName}%`);
    paramIdx++;
  }
  if (filters?.category) {
    conditions.push(`i.category = $${paramIdx}`);
    params.push(filters.category);
    paramIdx++;
  }

  const where = conditions.join(" AND ");
  const orderCol = filters?.sort === "price" ? "ml.price_per_unit" : "ml.listed_at";
  const orderDir = filters?.order === "asc" ? "ASC" : "DESC";

  const [countR, rowsR] = await Promise.all([
    pool.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM market_listings ml
       JOIN items i ON i.id = ml.item_id WHERE ${where}`,
      params
    ),
    pool.query(
      `SELECT ml.*, i.name AS item_name, i.category, u.username AS seller_username
       FROM market_listings ml
       JOIN items i ON i.id = ml.item_id
       JOIN users u ON u.id = ml.seller_id
       WHERE ${where}
       ORDER BY ${orderCol} ${orderDir}
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    ),
  ]);

  return { listings: rowsR.rows as never, total: countR.rows[0]?.total ?? 0 };
}

export async function getMyListings(userId: number): Promise<MarketListing[]> {
  const result = await pool.query<MarketListing>(
    `SELECT ml.*, i.name AS item_name
     FROM market_listings ml
     JOIN items i ON i.id = ml.item_id
     WHERE ml.seller_id = $1 AND ml.sold = FALSE
     ORDER BY ml.listed_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function expireListings(): Promise<number> {
  const result = await pool.query(
    `UPDATE market_listings SET sold = TRUE, quantity_left = 0
     WHERE sold = FALSE AND expires_at <= NOW()
     RETURNING id`
  );
  return result.rows.length;
}
