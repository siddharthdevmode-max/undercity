import { PoolClient } from "pg";
import { config } from "../config";

// ============================================================
// USER ROW — explicit return type, no implicit any
// ============================================================

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
  life:                number | string;
  max_life:            number | string;
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

export async function getUserByFirebaseUid(
  client: PoolClient,
  firebaseUid: string
): Promise<UserRow | null> {
  const result = await client.query<UserRow>(
    `SELECT
       id, firebase_uid, email, username,
       level, money, points,
       nerve, max_nerve, life, max_life,
       jail_until, federal_jail_until, last_crime_at,
       is_shadow_banned, is_hard_banned,
       is_admin, is_developer,
       trust_score, total_flags,
       created_at
     FROM users
     WHERE firebase_uid = $1
     LIMIT 1`,
    [firebaseUid]
  );
  return result.rows[0] ?? null;
}

/**
 * Developer immunity check.
 * Devs bypass: UAC violations, shadow punishments, fingerprint flagging,
 * behavior anomaly detection, trust score penalties, hard bans.
 * Use in: behaviorEngine, fingerprintEngine, shadowPunish, trustEngine.
 */
export function isImmuneToAntiCheat(user: Pick<UserRow, "is_developer" | "is_admin">): boolean {
  return user.is_developer === true || user.is_admin === true;
}
