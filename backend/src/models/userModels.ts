import { PoolClient } from "pg";

export function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

export function isFutureDate(value: unknown): boolean {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(String(value));
  return date.getTime() > Date.now();
}

export async function getUserByFirebaseUid(
  client: PoolClient,
  firebaseUid: string
) {
  const result = await client.query(
    `SELECT
       id, firebase_uid, email, username,
       level, money, points,
       nerve, max_nerve, life, max_life,
       jail_until, federal_jail_until, last_crime_at,
       is_shadow_banned, is_hard_banned,
       trust_score, total_flags,
       created_at
     FROM users
     WHERE firebase_uid = $1
     LIMIT 1`,
    [firebaseUid]
  );
  return result.rows[0] ?? null;
}

export function calcMaxLife(playerLevel: number): number {
  return 100 + (playerLevel - 1) * 25;
}

export function calcMaxNerve(totalCrimeXp: number): number {
  const base   = 30;
  const cap    = 130;
  const growth = cap - base;
  const rate   = 800000;
  const nerve  = base + growth * (1 - Math.exp(-totalCrimeXp / rate));
  return Math.floor(Math.min(cap, Math.max(base, nerve)));
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? null : d;
}

export function canAttemptCrime(lastCrimeAt: unknown): boolean {
  const date = toDate(lastCrimeAt);
  if (!date) return true;
  return Date.now() - date.getTime() >= 1000;
}

export function getCooldownRemaining(lastCrimeAt: unknown): number {
  const date = toDate(lastCrimeAt);
  if (!date) return 0;
  const remaining = 1000 - (Date.now() - date.getTime());
  return remaining > 0 ? Math.ceil(remaining) : 0;
}
