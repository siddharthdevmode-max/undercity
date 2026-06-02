// ============================================================
// USER TYPE
// CamelCase (transformed from snake_case in api.ts)
// Matches actual DB schema — no placeholder fields
// ============================================================

export interface User {
  id: number;
  firebaseUid: string;
  username: string;
  email: string;

  // Progression
  level: number;
  money: number;
  points: number;

  // Vitals
  nerve: number;
  maxNerve: number;
  life: number;
  maxLife: number;

  // Status timestamps (ISO strings, nullable)
  jailUntil: string | null;
  federalJailUntil: string | null;
  lastCrimeAt: string | null;

  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  message: string;
}
