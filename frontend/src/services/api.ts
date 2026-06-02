import { getAuth } from "firebase/auth";
import type { User } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// ============================================================
// TRANSFORM
// Converts raw DB snake_case user to camelCase for React
// ============================================================

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
  created_at: string;
}

function transformUser(raw: RawUser): User {
  return {
    id:               raw.id,
    firebaseUid:      raw.firebase_uid,
    username:         raw.username,
    email:            raw.email,
    level:            raw.level,
    money:            raw.money,
    points:           raw.points,
    nerve:            raw.nerve,
    maxNerve:         raw.max_nerve,
    life:             raw.life,
    maxLife:          raw.max_life,
    jailUntil:        raw.jail_until,
    federalJailUntil: raw.federal_jail_until,
    lastCrimeAt:      raw.last_crime_at,
    createdAt:        raw.created_at,
  };
}

// ============================================================
// CHALLENGE TOKEN FETCHER
// ============================================================

async function getChallengeToken(firebaseToken: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/challenge`, {
    headers: {
      Authorization: `Bearer ${firebaseToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to get security token");
  }

  const data = await response.json();
  return data.token;
}

// ============================================================
// CORE API CALL
// ============================================================

export async function apiCall(endpoint: string, options: RequestInit = {}) {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) throw new Error("Not authenticated");

  const firebaseToken = await user.getIdToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${firebaseToken}`,
    ...(options.headers as Record<string, string>),
  };

  if (
    options.method === "POST" ||
    options.method === "PUT" ||
    options.method === "DELETE"
  ) {
    const challengeToken = await getChallengeToken(firebaseToken);
    headers["x-uac-challenge"] = challengeToken;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "API request failed");
  }

  return response.json();
}

// ============================================================
// PUBLIC API CALL
// ============================================================

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
    throw new Error(errorData.message || "API request failed");
  }

  return response.json();
}

// ============================================================
// AUTH API
// ============================================================

export const authAPI = {
  sync: (username?: string) =>
    apiCall("/auth/sync", {
      method: "POST",
      body: JSON.stringify({ username }),
    }),

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
