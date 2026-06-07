import { getAuth } from "firebase/auth";
import type { User, UserTier } from "../types";
import { ApiError } from "../utils/apiError";
import { getVisitorId } from "./fingerprint";

// ── API base URL ───────────────────────────────────────────
// In dev:  Vite proxy intercepts /api → localhost:80 → nginx → backend
//          Using "http://localhost:5000/api" BYPASSES the proxy = CORS error
//          Using "/api" goes through Vite proxy correctly
// In prod: VITE_API_URL is set to "https://api.undercity.online/api"
const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

interface RawUser {
  id: number;
  firebase_uid: string;
  username: string;
  email: string;
  level: number;
  money: number;
  points: number;

  nerve: number;
  max_nerve: number;
  life: number;
  max_life: number;
  energy: number;
  max_energy: number;
  happiness: number;

  jail_until: string | null;
  hospital_until: string | null;
  federal_jail_until: string | null;
  last_crime_at: string | null;
  last_seen_at: string | null;

  onboarding_completed: boolean;

  is_admin?: boolean;
  is_developer?: boolean;
  is_moderator?: boolean;

  user_tier?: UserTier;
  tier_expires_at?: string | null;

  created_at: string;
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

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getChallengeToken(firebaseToken: string): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const response = await fetch(`${API_BASE_URL}/challenge`, {
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

export async function apiCall(
  endpoint: string,
  options:  RequestInit = {}
): Promise<unknown> {
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
    cachedToken = null;
    const challengeToken = await getChallengeToken(firebaseToken);
    headers["x-uac-challenge"]    = challengeToken;
    headers["x-idempotency-key"]  = crypto.randomUUID();
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
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

  return response.json();
}

export async function publicCall(
  endpoint: string,
  options:  RequestInit = {}
): Promise<unknown> {
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

  return response.json();
}

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
  return publicCall(
    `/auth/check-username/${encodeURIComponent(username)}`
  ) as Promise<{ available: boolean; reason?: string }>;
}
