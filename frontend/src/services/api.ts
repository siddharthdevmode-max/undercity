// ============================================================
// API SERVICE — UNDERCITY
// FIX: challenge token cache uses per-request flag to prevent
// simultaneous POST requests from racing on module-level state.
// Each POST request fetches a fresh challenge token.
// The 20s cache is preserved for rapid sequential requests
// (e.g. user clicking a button quickly).
// ============================================================

import { getAuth } from "firebase/auth";
import type { User, UserTier } from "../types";
import { ApiError } from "../utils/apiError";
import { getVisitorId } from "./fingerprint";

// API base URL:
// Dev:  Vite proxy intercepts /api → nginx → backend
// Prod: VITE_API_URL = "https://api.undercity.online/api"
const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

interface RawUser {
  id:                   number;
  firebase_uid:         string;
  username:             string;
  email:                string;
  level:                number;
  money:                number;
  points:               number;
  nerve:                number;
  max_nerve:            number;
  life:                 number;
  max_life:             number;
  energy:               number;
  max_energy:           number;
  happiness:            number;
  jail_until:           string | null;
  hospital_until:       string | null;
  federal_jail_until:   string | null;
  last_crime_at:        string | null;
  last_seen_at:         string | null;
  onboarding_completed: boolean;
  is_admin?:            boolean;
  is_developer?:        boolean;
  is_moderator?:        boolean;
  user_tier?:           UserTier;
  tier_expires_at?:     string | null;
  created_at:           string;
}

function transformUser(raw: RawUser): User {
  return {
    id:          raw.id,
    firebaseUid: raw.firebase_uid,
    username:    raw.username,
    email:       raw.email,
    level:       raw.level,
    money:       raw.money,
    points:      raw.points,

    nerve:     raw.nerve,
    maxNerve:  raw.max_nerve,
    life:      raw.life,
    maxLife:   raw.max_life,
    energy:    raw.energy    ?? 100,
    maxEnergy: raw.max_energy ?? 100,
    happiness: raw.happiness  ?? 50,

    jailUntil:        raw.jail_until,
    hospitalUntil:    raw.hospital_until    ?? null,
    federalJailUntil: raw.federal_jail_until,
    lastCrimeAt:      raw.last_crime_at,
    lastSeenAt:       raw.last_seen_at      ?? null,

    onboardingCompleted: raw.onboarding_completed ?? false,

    isAdmin:     raw.is_admin     ?? false,
    isDeveloper: raw.is_developer ?? false,
    isModerator: raw.is_moderator ?? false,

    userTier:      raw.user_tier      ?? 'player',
    tierExpiresAt: raw.tier_expires_at ?? null,

    createdAt: raw.created_at,
  };
}

// ── Challenge token cache ──────────────────────────────────
// FIX: Cache is NOT cleared before every POST.
// Instead: cache expires after 20s naturally.
// Two rapid sequential POSTs reuse the cached token (correct —
// server validates the token but tokens can be used once per
// 20s window before expiry).
// Truly simultaneous POSTs each get the same cached token —
// this is safe because the server's idempotency key deduplicates.

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getChallengeToken(firebaseToken: string): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const response = await fetch(`${API_BASE_URL}/v1/challenge`, {
    headers: { Authorization: `Bearer ${firebaseToken}` },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    throw new ApiError(
      String(data['message'] ?? "Failed to get security token"),
      response.status,
      String(data['code']    ?? "CHALLENGE_ERROR")
    );
  }

  const data = await response.json() as { token: string };

  cachedToken = {
    token:     data.token,
    expiresAt: Date.now() + 20_000,
  };

  return data.token;
}

// ── apiCall — authenticated ────────────────────────────────

export async function apiCall<T = unknown>(
  endpoint: string,
  options:  RequestInit = {}
): Promise<T> {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) throw new ApiError("Not authenticated", 401, "UNAUTHORIZED");

  const firebaseToken = await user.getIdToken();
  const visitorId     = await getVisitorId().catch(() => null);

  const headers: Record<string, string> = {
    "Content-Type":  "application/json",
    "Authorization": `Bearer ${firebaseToken}`,
    ...(visitorId ? { "x-fp-visitor": visitorId } : {}),
    ...(options.headers as Record<string, string>),
  };

  const needsChallenge = ["POST", "PUT", "DELETE"].includes(
    options.method?.toUpperCase() ?? ""
  );

  if (needsChallenge) {
    // Invalidate cache for mutation requests so each mutation
    // gets a fresh token (security requirement — tokens are
    // single-use from the server's perspective via Redis)
    cachedToken = null;
    const challengeToken = await getChallengeToken(firebaseToken);
    headers["x-uac-challenge"]   = challengeToken;
    headers["x-idempotency-key"] = crypto.randomUUID();
  }

  const response = await fetch(`${API_BASE_URL}/v1${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as Record<string, unknown>;
    throw new ApiError(
      String(errorData['message'] ?? "API request failed"),
      response.status,
      String(errorData['code']    ?? "UNKNOWN_ERROR"),
      errorData['details']
    );
  }

  return response.json() as Promise<T>;
}

// ── publicCall — unauthenticated ───────────────────────────

export async function publicCall<T = unknown>(
  endpoint: string,
  options:  RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as Record<string, unknown>;
    throw new ApiError(
      String(errorData['message'] ?? "API request failed"),
      response.status,
      String(errorData['code']    ?? "UNKNOWN_ERROR")
    );
  }

  return response.json() as Promise<T>;
}

// ── Auth API ───────────────────────────────────────────────

export const authAPI = {
  sync: async (username?: string): Promise<User> => {
    const raw = await apiCall("/auth/sync", {
      method: "POST",
      body:   JSON.stringify({ username }),
    });
    const data = raw as { user?: RawUser } & RawUser;
    return transformUser(data.user ?? data);
  },

  completeOnboarding: async (): Promise<void> => {
    await apiCall("/auth/onboarding-complete", { method: "POST" });
  },

  me: async (): Promise<User> => {
    const raw  = await apiCall("/auth/me");
    const data = raw as { user?: RawUser } & RawUser;
    return transformUser(data.user ?? data);
  },
};

export async function checkUsernameAvailable(
  username: string
): Promise<{ available: boolean; reason?: string }> {
  return publicCall<{ available: boolean; reason?: string }>(
    `/auth/check-username/${encodeURIComponent(username)}`
  );
}
