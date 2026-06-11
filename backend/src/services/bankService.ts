import { PoolClient } from "pg";
import { pool, withTransaction } from "../config/database";
import { ValidationError, NotFoundError, InsufficientFundsError } from "../utils/errors";

const BANK_TRANSFER_TAX_PCT = 5;

type TxType = "deposit" | "withdraw" | "transfer_in" | "transfer_out" | "crime_reward" | "crime_penalty" | "market_sale" | "market_purchase" | "referral_bonus" | "admin_adjust" | "item_use" | "tax";

export interface BankUser {
  id: number;
  username: string;
  money: number;
  points: number;
}

export interface BankTransaction {
  id: number;
  user_id: number;
  type: TxType;
  amount: number;
  balance_before: number;
  balance_after: number;
  reference_type: string | null;
  reference_id: string | null;
  description: string | null;
  created_at: string;
}

async function getUserMoney(client: PoolClient, userId: number): Promise<BankUser> {
  const result = await client.query<BankUser>(
    `SELECT id, username, money, points FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [userId]
  );
  if (result.rows.length === 0) throw new NotFoundError("User");
  return result.rows[0];
}

async function logTransaction(
  client: PoolClient,
  userId: number,
  type: TxType,
  amount: number,
  balanceBefore: number,
  balanceAfter: number,
  opts?: { referenceType?: string; referenceId?: string; description?: string }
): Promise<void> {
  await client.query(
    `INSERT INTO bank_transactions
       (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [userId, type, amount, balanceBefore, balanceAfter, opts?.referenceType ?? null, opts?.referenceId ?? null, opts?.description ?? null]
  );
}

export async function getBalance(userId: number): Promise<{ money: number; points: number }> {
  const result = await pool.query<{ money: number; points: number }>(
    `SELECT money, points FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [userId]
  );
  if (result.rows.length === 0) throw new NotFoundError("User");
  return result.rows[0];
}

export async function getTransactionHistory(
  userId: number,
  limit: number,
  offset: number
): Promise<{ transactions: BankTransaction[]; total: number }> {
  const [countR, rowsR] = await Promise.all([
    pool.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM bank_transactions WHERE user_id = $1`,
      [userId]
    ),
    pool.query<BankTransaction>(
      `SELECT * FROM bank_transactions WHERE user_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    ),
  ]);
  return { transactions: rowsR.rows, total: countR.rows[0]?.total ?? 0 };
}

export async function depositCash(userId: number, amount: number): Promise<BankUser> {
  if (amount <= 0) throw new ValidationError("Deposit amount must be positive");
  return withTransaction(async (client) => {
    const user = await getUserMoney(client, userId);
    const cashToDeposit = Math.min(amount, user.money);
    if (cashToDeposit <= 0) throw new ValidationError("You have no cash to deposit");
    const balanceBefore = user.money;
    const result = await client.query<BankUser>(
      `UPDATE users SET money = money - $2, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, username, money, points`,
      [userId, cashToDeposit]
    );
    const updated = result.rows[0];
    await logTransaction(client, userId, "deposit", cashToDeposit, balanceBefore, updated.money,
      { description: `Deposited $${cashToDeposit.toLocaleString()}` });
    return updated;
  });
}

export async function withdrawCash(userId: number, amount: number): Promise<BankUser> {
  return withTransaction(async (client) => {
    const user = await getUserMoney(client, userId);
    if (amount <= 0) throw new ValidationError("Withdraw amount must be positive");
    if (user.money < amount) throw new InsufficientFundsError(user.money, amount);
    const balanceBefore = user.money;
    const result = await client.query<BankUser>(
      `UPDATE users SET money = money + $2, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, username, money, points`,
      [userId, amount]
    );
    const updated = result.rows[0];
    await logTransaction(client, userId, "withdraw", amount, balanceBefore, updated.money,
      { description: `Withdrew $${amount.toLocaleString()}` });
    return updated;
  });
}

export async function transferCash(
  senderId: number,
  recipientUsername: string,
  amount: number
): Promise<{ sender: BankUser; recipient: BankUser; taxPaid: number }> {
  return withTransaction(async (client) => {
    const sender = await getUserMoney(client, senderId);
    if (sender.money < amount) throw new InsufficientFundsError(sender.money, amount);
    if (amount <= 0) throw new ValidationError("Transfer amount must be positive");

    const recipientR = await client.query<{ id: number; username: string; money: number; points: number }>(
      `SELECT id, username, money, points FROM users
       WHERE LOWER(username) = LOWER($1) AND deleted_at IS NULL LIMIT 1`,
      [recipientUsername]
    );
    if (recipientR.rows.length === 0) throw new NotFoundError("Recipient");
    const recipient = recipientR.rows[0];
    if (recipient.id === senderId) throw new ValidationError("Cannot transfer to yourself");

    const tax = Math.ceil(amount * BANK_TRANSFER_TAX_PCT / 100);
    const netAmount = amount - tax;

    const senderBefore = sender.money;
    const senderR = await client.query<BankUser>(
      `UPDATE users SET money = money - $2, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, username, money, points`,
      [senderId, amount]
    );
    const senderAfter = senderR.rows[0];

    const recipientBefore = recipient.money;
    await client.query(
      `UPDATE users SET money = money + $2, updated_at = NOW() WHERE id = $1`,
      [recipient.id, netAmount]
    );

    await logTransaction(client, senderId, "transfer_out", amount, senderBefore, senderAfter.money,
      { referenceType: "user", referenceId: String(recipient.id), description: `Transferred to ${recipient.username}` });
    await logTransaction(client, recipient.id, "transfer_in", netAmount, recipientBefore, recipientBefore + netAmount,
      { referenceType: "user", referenceId: String(senderId), description: `Received from ${sender.username}` });

    if (tax > 0) {
      await logTransaction(client, senderId, "tax", tax, senderAfter.money, senderAfter.money,
        { description: `Transfer tax (${BANK_TRANSFER_TAX_PCT}%)` });
    }

    return { sender: senderAfter, recipient: { ...recipient, money: recipientBefore + netAmount }, taxPaid: tax };
  });
}

export async function applyMoneyChange(
  userId: number,
  delta: number,
  type: TxType,
  opts?: { referenceType?: string; referenceId?: string; description?: string }
): Promise<BankUser> {
  return withTransaction(async (client) => {
    const user = await getUserMoney(client, userId);
    const balanceBefore = user.money;
    const newMoney = user.money + delta;
    if (type !== "crime_penalty" && newMoney < 0 && delta < 0) {
      throw new InsufficientFundsError(user.money, Math.abs(delta));
    }
    const result = await client.query<BankUser>(
      `UPDATE users SET money = GREATEST(money + $2, 0), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, username, money, points`,
      [userId, delta]
    );
    const updated = result.rows[0];
    await logTransaction(client, userId, type, delta, balanceBefore, updated.money,
      { referenceType: opts?.referenceType, referenceId: opts?.referenceId, description: opts?.description });
    return updated;
  });
}
