import { apiCall } from "./api";

// ============================================================
// ADMIN API SERVICE
// UAC 2.0 — Admin War Room
// ============================================================

export interface AdminStats {
  total_users: number;
  hard_banned: number;
  shadow_banned: number;
  suspicious: number;
  total_violations: number;
  violations_24h: number;
}

export interface CheaterUser {
  id: number;
  username: string;
  firebase_uid: string;
  trust_score: number;
  total_flags: number;
  is_shadow_banned: boolean;
  is_hard_banned: boolean;
  last_flag_reason: string | null;
  last_flag_at: string | null;
}

export interface Violation {
  violation_type: string;
  severity: number;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface MultiAccountGroup {
  fingerprint_hash: string;
  account_count: number;
  uids: string[];
  last_active: string;
}

export interface EarningsAnomaly {
  firebase_uid: string;
  username: string | null;
  severity: number;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface TrustRecoveryLogEntry {
  old_score: number;
  new_score: number;
  reason: string;
  created_at: string;
}

export interface Fingerprint {
  fingerprint_hash: string;
  ip_address: string;
  user_agent: string;
  hit_count: number;
  last_seen: string;
}

export interface CrimeProgress {
  crime_key: string;
  name: string;
  tier: number;
  crime_level: number;
  crime_xp: number;
  hidden_cpl: number;
  attempts: number;
  successes: number;
  failures: number;
  crit_failures: number;
  specials_found_count: number;
  updated_at: string;
}

export interface FullUserProfile {
  user: {
    id: number;
    username: string;
    email: string;
    firebase_uid: string;
    level: number;
    money: number;
    points: number;
    nerve: number;
    max_nerve: number;
    life: number;
    max_life: number;
    trust_score: number;
    total_flags: number;
    is_shadow_banned: boolean;
    is_hard_banned: boolean;
    last_flag_reason: string | null;
    last_flag_at: string | null;
    created_at: string;
  };
  violations: Violation[];
  trustRecoveryLog: TrustRecoveryLogEntry[];
  fingerprints: Fingerprint[];
  linkedAccounts: string[];
  crimeProgress: CrimeProgress[];
}

export const adminAPI = {
  getStats: (): Promise<AdminStats> =>
    apiCall("/admin/stats"),

  getCheaters: (): Promise<{ users: CheaterUser[] }> =>
    apiCall("/admin/cheaters"),

  getViolations: (uid: string): Promise<{ violations: Violation[] }> =>
    apiCall(`/admin/violations/${encodeURIComponent(uid)}`),

  getMultiAccounts: (): Promise<{ groups: MultiAccountGroup[] }> =>
    apiCall("/admin/multi-accounts"),

  getEarningsAnomalies: (): Promise<{ anomalies: EarningsAnomaly[] }> =>
    apiCall("/admin/earnings-anomalies"),

  getFullUserProfile: (uid: string): Promise<FullUserProfile> =>
    apiCall(`/admin/user/${encodeURIComponent(uid)}/full`),

  getTrustRecoveryLog: (uid: string): Promise<{ log: TrustRecoveryLogEntry[] }> =>
    apiCall(`/admin/trust-recovery/log/${encodeURIComponent(uid)}`),

  runTrustRecovery: (): Promise<{ message: string; processed: number; recovered: number; skipped: number }> =>
    apiCall("/admin/trust-recovery/run", { method: "POST" }),

  unbanUser: (uid: string): Promise<{ message: string; user: CheaterUser }> =>
    apiCall(`/admin/unban/${encodeURIComponent(uid)}`, { method: "POST" }),

  shadowBanUser: (uid: string): Promise<{ message: string; user: CheaterUser }> =>
    apiCall(`/admin/shadow-ban/${encodeURIComponent(uid)}`, { method: "POST" }),
};
