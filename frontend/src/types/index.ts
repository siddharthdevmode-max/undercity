export interface User {
  id: number;
  firebaseUid: string;
  username: string;
  email: string;

  level: number;
  money: number;
  points: number;

  nerve: number;
  maxNerve: number;
  life: number;
  maxLife: number;

  jailUntil: string | null;
  federalJailUntil: string | null;
  lastCrimeAt: string | null;

  onboardingCompleted: boolean;

  // Roles (UAC immunity + admin panel access)
  isAdmin: boolean;
  isDeveloper: boolean;

  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  message: string;
}
