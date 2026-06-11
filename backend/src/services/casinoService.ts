import { pool } from "../config/database";
import { ValidationError } from "../utils/errors";

const ROULETTE_NUMBERS = Array.from({ length: 37 }, (_, i) => i);
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const GAMES: Record<string, (bet: number) => { payout: number; result: string; message: string }> = {
  coinflip: (bet: number) => {
    const win = Math.random() < 0.45;
    const payout = win ? bet * 2 : 0;
    return {
      payout,
      result: win ? "win" : "lose",
      message: win ? "Heads! You win!" : "Tails... You lose.",
    };
  },

  roulette: (bet: number) => {
    const num = ROULETTE_NUMBERS[randInt(0, ROULETTE_NUMBERS.length - 1)];
    const isRed = RED_NUMBERS.includes(num);
    const isBlack = num !== 0 && !isRed;

    const choice = Math.random();
    let win = false;
    let multiplier = 0;

    if (choice < 0.33) {
      // Bet on red
      win = isRed;
      multiplier = 2;
    } else if (choice < 0.66) {
      // Bet on black
      win = isBlack;
      multiplier = 2;
    } else {
      // Bet on exact number
      win = choice < 0.34; // ~1% chance
      multiplier = 36;
    }

    const payout = win ? bet * multiplier : 0;
    return {
      payout,
      result: win ? "win" : "lose",
      message: win
        ? `Number ${num}! You win ${multiplier}x your bet!`
        : `Number ${num}. Better luck next time.`,
    };
  },

  slots: (bet: number) => {
    const r1 = randInt(0, 9);
    const r2 = randInt(0, 9);
    const r3 = randInt(0, 9);

    let payout = 0;
    let result = "lose";
    let message = `[${r1}] [${r2}] [${r3}] — No match.`;

    if (r1 === r2 && r2 === r3) {
      payout = bet * 50;
      result = "win";
      message = `[${r1}] [${r2}] [${r3}] — JACKPOT! 50x payout!`;
    } else if (r1 === r2 || r2 === r3 || r1 === r3) {
      payout = Math.floor(bet * 2.5);
      result = "win";
      message = `[${r1}] [${r2}] [${r3}] — Two match! 2.5x payout.`;
    }

    return { payout, result, message };
  },
};

export async function play(userId: number, game: string, bet: number): Promise<{
  game: string; bet: number; payout: number; result: string; message: string; money: number;
}> {
  if (!GAMES[game]) throw new ValidationError(`Unknown game: ${game}. Choose: ${Object.keys(GAMES).join(", ")}`);
  if (bet <= 0) throw new ValidationError("Bet must be positive");

  const userR = await pool.query<{ id: number; money: number }>(
    `SELECT id, money FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`, [userId]
  );
  if (userR.rows.length === 0) throw new ValidationError("User not found");

  if (userR.rows[0].money < bet) throw new ValidationError("You don't have enough money");

  const { payout, result, message } = GAMES[game](bet);
  const netChange = payout - bet;

  const newMoney = userR.rows[0].money + netChange;

  await pool.query(
    `UPDATE users SET money = money + $2 WHERE id = $1`,
    [userId, netChange]
  );

  await pool.query(
    `INSERT INTO casino_log (user_id, game, bet, payout, result) VALUES ($1, $2, $3, $4, $5)`,
    [userId, game, bet, payout, result]
  );

  return { game, bet, payout, result, message, money: newMoney };
}
