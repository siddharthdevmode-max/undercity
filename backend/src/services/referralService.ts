import crypto from "crypto";
import { pool, withTransaction } from "../config/database";
import { ValidationError, ConflictError } from "../utils/errors";

const REFERRAL_BONUS_CASH = 25000;

export async function generateReferralCode(userId: number): Promise<string> {
  const existingR = await pool.query<{ referral_code: string }>(
    `SELECT referral_code FROM referrals WHERE referrer_id = $1 AND reward_given = TRUE LIMIT 1`,
    [userId]
  );
  if (existingR.rows.length > 0) {
    return existingR.rows[0].referral_code;
  }

  const code = crypto.randomBytes(4).toString("hex").toUpperCase();
  return code;
}

export async function applyReferralCode(newUserId: number, code: string): Promise<{ bonusCash: number; bonusXp: number }> {
  return withTransaction(async (client) => {
    const normalizedCode = code.trim().toUpperCase();
    if (normalizedCode.length < 4 || normalizedCode.length > 20) {
      throw new ValidationError("Invalid referral code");
    }

    const referrerR = await client.query<{ id: number; username: string }>(
      `SELECT DISTINCT r.referrer_id AS id, u.username
       FROM referrals r
       JOIN users u ON u.id = r.referrer_id
       WHERE r.referral_code = $1 AND r.reward_given = TRUE
       LIMIT 1`,
      [normalizedCode]
    );

    let referrerId: number | null = null;
    let referrerUsername = "a player";

    if (referrerR.rows.length > 0) {
      referrerId = referrerR.rows[0].id;
      referrerUsername = referrerR.rows[0].username;
    }

    if (referrerId) {
      if (referrerId === newUserId) throw new ValidationError("You cannot refer yourself");

      const existingRef = await client.query<{ id: number }>(
        `SELECT id FROM referrals WHERE referred_id = $1 LIMIT 1`,
        [newUserId]
      );
      if (existingRef.rows.length > 0) throw new ConflictError("Referral code already applied");

      await client.query(
        `INSERT INTO referrals (referrer_id, referred_id, referral_code, reward_given)
         VALUES ($1, $2, $3, FALSE)`,
        [referrerId, newUserId, normalizedCode]
      );

      await client.query(
        `UPDATE users SET money = money + $2, updated_at = NOW() WHERE id = $1`,
        [referrerId, REFERRAL_BONUS_CASH]
      );

      await client.query(
        `UPDATE referrals SET reward_given = TRUE WHERE referrer_id = $1 AND referred_id = $2`,
        [referrerId, newUserId]
      );

      await client.query(
        `INSERT INTO bank_transactions
           (user_id, type, amount, balance_before, balance_after, description)
         VALUES ($1, 'referral_bonus', $2, 0, $2, $3)`,
        [referrerId, REFERRAL_BONUS_CASH, `Referral bonus for ${referrerUsername}`]
      );
    }

    await client.query(
      `UPDATE users SET money = money + $2, updated_at = NOW() WHERE id = $1`,
      [newUserId, REFERRAL_BONUS_CASH]
    );

    await client.query(
      `INSERT INTO bank_transactions
         (user_id, type, amount, balance_before, balance_after, description)
       VALUES ($1, 'referral_bonus', $2, 0, $2, $3)`,
      [newUserId, REFERRAL_BONUS_CASH, "Welcome bonus for using a referral code"]
    );

    return { bonusCash: REFERRAL_BONUS_CASH, bonusXp: 0 };
  });
}

export async function getReferralStats(userId: number): Promise<{
  totalReferrals: number;
  totalEarned: number;
  referralCode: string | null;
}> {
  const [refsR, codeR] = await Promise.all([
    pool.query<{ total: number; earned: number }>(
      `SELECT COUNT(*)::int AS total, COALESCE(SUM(CASE WHEN reward_given THEN $2 ELSE 0 END), 0)::int AS earned
       FROM referrals WHERE referrer_id = $1`,
      [userId, REFERRAL_BONUS_CASH]
    ),
    pool.query<{ referral_code: string }>(
      `SELECT referral_code FROM referrals WHERE referrer_id = $1 AND reward_given = TRUE LIMIT 1`,
      [userId]
    ),
  ]);

  return {
    totalReferrals: refsR.rows[0]?.total ?? 0,
    totalEarned: refsR.rows[0]?.earned ?? 0,
    referralCode: codeR.rows[0]?.referral_code ?? null,
  };
}
