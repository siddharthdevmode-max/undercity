// ============================================================
// USER MODELS — UNDERCITY
// UserRow type, DB query helpers, and game formula functions.
// Single source of truth for all user-related types.
// ============================================================

import { PoolClient } from "pg";
import type { UserTier } from "../config/tiers";

export interface UserRow {
  id:                  number;
  firebase_uid:        string;
  email:               string;
  username:            string;
  level:               number | string;
  money:               number | string;
  points:              number | string;
  nerve:               number | string;
  max_nerve:           number | string;
  energy:              number | string;   // Added
  max_energy:          number | string;   // Added
  life:                number | string;
  max_life:            number | string;
  happiness:           number | string;   // Added
  hospital_until:      string | null;
  jail_until:          string | null;
  federal_jail_until:  string | null;
  last_crime_at:       string | null;
  is_shadow_banned:    boolean;
  is_hard_banned:      boolean;
  is_admin:            boolean;
  is_developer:        boolean;
  trust_score:         number | string;
  total_flags:         number | string;
  created_at:          string;
  user_tier:           UserTier;
  tier_expires_at:     string | null;
  tier_granted_at:     string | null;
  tier_granted_by:     string | null;
  last_nerve_update:   string | null;
}

export function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

export function isFutureDate(value: unknown): boolean {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(String(value));
  return date.getTime() > Date.now();
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? null : d;
}

export async function getUserByFirebaseUid(
  client:      PoolClient,
  firebaseUid: string
): Promise<UserRow | null> {
  const result = await client.query<UserRow>(
    `SELECT
       id, firebase_uid, email, username,
       level, money, points,
       nerve, max_nerve, energy, max_energy,
       life, max_life, happiness,
       hospital_until,
       jail_until, federal_jail_until, last_crime_at,
       is_shadow_banned, is_hard_banned,
       is_admin, is_developer,
       trust_score, total_flags,
       created_at,
       user_tier, tier_expires_at, tier_granted_at, tier_granted_by,
       last_nerve_update
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

const NERVE_BASE          = 30;
const NERVE_CAP           = 130;
const NERVE_RATE          = 3_500_000;
const NERVE_CAP_THRESHOLD = 127.5;

export function calcMaxNerve(totalCrimeXp: number): number {
  if (totalCrimeXp <= 0) return NERVE_BASE;
  const raw     = NERVE_BASE + (NERVE_CAP - NERVE_BASE) * (1 - Math.exp(-totalCrimeXp / NERVE_RATE));
  const floored = Math.floor(raw);
  if (raw >= NERVE_CAP_THRESHOLD) return NERVE_CAP;
  const stepped = Math.floor(floored / 5) * 5;
  return Math.min(NERVE_CAP, Math.max(NERVE_BASE, stepped));
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

export function isImmuneToAntiCheat(
  user: Pick<UserRow, "is_developer" | "is_admin">
): boolean {
  return user.is_developer === true || user.is_admin === true;
}

export function isContributor(user: Pick<UserRow, "user_tier">): boolean {
  return user.user_tier === "contributor";
}

export function isCitizen(user: Pick<UserRow, "user_tier">): boolean {
  return user.user_tier === "citizen";
}

export function isFreePlayer(user: Pick<UserRow, "user_tier">): boolean {
  return user.user_tier === "player";
}

export function hasPaidTier(user: Pick<UserRow, "user_tier">): boolean {
  return user.user_tier === "citizen" || user.user_tier === "contributor";
}
