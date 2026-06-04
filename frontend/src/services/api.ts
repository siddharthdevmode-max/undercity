import { getAuth } from "firebase/auth";
import type { User } from "../types";
import { ApiError } from "../utils/apiError";
import { getVisitorId } from "./fingerprint";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

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
  jail_until: string | null;
  federal_jail_until: string | null;
  last_crime_at: string | null;
  onboarding_completed: boolean;
  is_admin?: boolean;
  is_developer?: boolean;
  created_at: string;
}

function transformUser(raw: RawUser): User {
  return {
    id: raw.id,
    firebaseUid: raw.firebase_uid,
    username: raw.username,
    email: raw.email,
    level: raw.level,
    money: raw.money,
    points: raw.points,
    nerve: raw.nerve,
    maxNerve: raw.max_nerve,
    life: raw.life,
    maxLife: raw.max_life,
    jailUntil: raw.jail_until,
    federalJailUntil: raw.federal_jail_until,
    lastCrimeAt: raw.last_crime_at,
    onboardingCompleted: raw.onboarding_completed ?? false,
    isAdmin:     raw.is_admin     ?? false,
    isDeveloper: raw.is_developer ?? false,
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
    const data = await response.json().catch(() => ({}));
    throw new ApiError(
      data.message || "Failed to get security token",
      response.status,
      data.code || "CHALLENGE_ERROR"
    );
  }

  const data = await response.json();

  cachedToken = {
    token: data.token,
    expiresAt: Date.now() + 20000,
  };

  return data.token;
}

export async function apiCall(endpoint: string, options: RequestInit = {}) {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) throw new ApiError("Not authenticated", 401, "UNAUTHORIZED");

  const firebaseToken = await user.getIdToken();

  const visitorId = await getVisitorId().catch(() => null);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${firebaseToken}`,
    ...(visitorId ? { "x-fp-visitor": visitorId } : {}),
    ...(options.headers as Record<string, string>),
  };

  const needsChallenge = ["POST", "PUT", "DELETE"].includes(
    options.method?.toUpperCase() || ""
  );

  if (needsChallenge) {
    cachedToken = null;
    const challengeToken = await getChallengeToken(firebaseToken);
    headers["x-uac-challenge"] = challengeToken;
    headers["x-idempotency-key"] = crypto.randomUUID();
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      errorData.message || "API request failed",
      response.status,
      errorData.code || "UNKNOWN_ERROR",
      errorData.details
    );
  }

  return response.json();
}

export async function publicCall(endpoint: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      errorData.message || "API request failed",
      response.status,
      errorData.code || "UNKNOWN_ERROR"
    );
  }

  return response.json();
}

export const authAPI = {
  sync: async (username?: string): Promise<User> => {
    const raw = await apiCall("/auth/sync", {
      method: "POST",
      body: JSON.stringify({ username }),
    });
    return transformUser(raw.user ?? raw);
  },

  completeOnboarding: async (): Promise<void> => {
    await apiCall("/auth/onboarding-complete", { method: "POST" });
  },

  me: async (): Promise<User> => {
    const raw = await apiCall("/auth/me");
    return transformUser(raw.user ?? raw);
  },
};

export async function checkUsernameAvailable(
  username: string
): Promise<{ available: boolean; reason?: string }> {
  return publicCall(`/auth/check-username/${encodeURIComponent(username)}`);
}
