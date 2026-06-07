export type UserTier = 'player' | 'citizen' | 'contributor';

export interface User {
  id: number;
  firebaseUid: string;
  username: string;
  email: string;

  level: number;
  money: number;
  points: number;

  // Stats
  nerve: number;
  maxNerve: number;
  life: number;
  maxLife: number;
  energy: number;
  maxEnergy: number;
  happiness: number;

  // Status timers
  jailUntil: string | null;
  hospitalUntil: string | null;
  federalJailUntil: string | null;
  lastCrimeAt: string | null;
  lastSeenAt: string | null;

  // Progression
  onboardingCompleted: boolean;

  // Roles
  isAdmin: boolean;
  isDeveloper: boolean;
  isModerator: boolean;

  // Tier
  userTier: UserTier;
  tierExpiresAt: string | null;

  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  message: string;
}
