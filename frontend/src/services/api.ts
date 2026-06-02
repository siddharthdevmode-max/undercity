import { getAuth } from "firebase/auth";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// ============================================================
// TRANSFORM
// Converts raw DB snake_case user to camelCase for React
// ============================================================

function transformUser(raw: any): any {
  return {
    id:         raw.id,
    username:   raw.username,
    email:      raw.email,
    level:      raw.level,
    money:      raw.money,
    experience: raw.experience,
    points:     raw.points,
    strength:   raw.strength,
    defense:    raw.defense,
    speed:      raw.speed,
    dexterity:  raw.dexterity,
    energy:     raw.energy,
    maxEnergy:  raw.max_energy,
    nerve:      raw.nerve,
    maxNerve:   raw.max_nerve,
    life:       raw.life,
    maxLife:    raw.max_life,
    happiness:  raw.happiness,
    status:     raw.status,
  };
}

// ============================================================
// CHALLENGE TOKEN FETCHER
// Gets a one-time token from the SERVER
// No secret ever lives in the frontend
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

export async function apiCall(endpoint: string, options: any = {}) {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) throw new Error("Not authenticated");

  const firebaseToken = await user.getIdToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${firebaseToken}`,
    ...options.headers,
  };

  // For POST/PUT/DELETE: get a challenge token from server
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

export async function publicCall(endpoint: string, options: any = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
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

  me: async (): Promise<any> => {
    const raw = await apiCall("/auth/me");
    // raw.user if wrapped, or raw directly depending on backend response
    return transformUser(raw.user ?? raw);
  },
};

export async function checkUsernameAvailable(
  username: string
): Promise<{ available: boolean; reason?: string }> {
  return publicCall(`/auth/check-username/${encodeURIComponent(username)}`);
}
