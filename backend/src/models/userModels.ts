import { PoolClient } from "pg";

// ============================================================
// TYPE HELPERS
// ============================================================

export function toNumber(value: any): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

export function isFutureDate(value: any): boolean {
  if (!value) return false;
  const date = new Date(value);
  return date.getTime() > Date.now();
}

// ============================================================
// USER QUERIES
// ============================================================

export async function getUserByFirebaseUid(
  client: PoolClient,
  firebaseUid: string
) {
  const result = await client.query(
    `SELECT * FROM users WHERE firebase_uid = $1 LIMIT 1`,
    [firebaseUid]
  );
  return result.rows[0] || null;
}

// ============================================================
// MAX LIFE CALCULATION
// Based on player level (in-game level, not crime level)
// Formula: 100 + ((level - 1) × 25)
// ============================================================

export function calcMaxLife(playerLevel: number): number {
  return 100 + (playerLevel - 1) * 25;
}

// ============================================================
// MAX NERVE CALCULATION
// Based on total crime XP across all crimes
// Exponential curve with diminishing returns
// Starts at 30, hard cap at 130
// ============================================================

export function calcMaxNerve(totalCrimeXp: number): number {
  const base = 30;
  const cap = 130;
  const growth = cap - base; // 100
  const rate = 800000; // XP needed to approach cap

  const nerve = base + growth * (1 - Math.exp(-totalCrimeXp / rate));
  return Math.floor(Math.min(cap, Math.max(base, nerve)));
}

// ============================================================
// COOLDOWN CHECK
// Returns true if user can attempt crime (1 second passed)
// ============================================================

export function canAttemptCrime(lastCrimeAt: any): boolean {
  if (!lastCrimeAt) return true;
  const lastTime = new Date(lastCrimeAt).getTime();
  const now = Date.now();
  return now - lastTime >= 1000; // 1 second cooldown
}

export function getCooldownRemaining(lastCrimeAt: any): number {
  if (!lastCrimeAt) return 0;
  const lastTime = new Date(lastCrimeAt).getTime();
  const now = Date.now();
  const remaining = 1000 - (now - lastTime);
  return remaining > 0 ? Math.ceil(remaining) : 0;
}
