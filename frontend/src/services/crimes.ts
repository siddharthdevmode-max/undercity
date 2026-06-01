import { apiCall } from "./api";

export interface CrimeProgress {
  crimeXp: number;
  crimeLevel: number;
  attempts: number;
  successes: number;
  failures: number;
  critFailures: number;
  specialsFoundCount: number;
  availableSpecialsCount: number;
}

export interface Crime {
  id: number;
  key: string;
  name: string;
  tier: number;
  unlockLevel: number;
  nerveCost: number;
  minReward: number;
  maxReward: number;
  isFederal: boolean;
  unlocked: boolean;
  progress: CrimeProgress;
  jailRange: {
    minSeconds: number;
    maxSeconds: number;
  };
}

export interface UserStats {
  id: number;
  username: string;
  level: number;
  money: number;
  points: number;
  nerve: number;
  maxNerve: number;
  life: number;
  maxLife: number;
  jailUntil: string | null;
  federalJailUntil: string | null;
  inJail: boolean;
  inFederalJail: boolean;
}

export interface CrimesResponse {
  user: UserStats;
  crimes: Crime[];
}

export interface SpecialResult {
  id: number;
  title: string;
  description: string;
  rewardMoney: number;
  rewardPoints: number;
  wasNewlyDiscovered: boolean;
}

export interface CrimeAttemptResponse {
  outcome: "special" | "success" | "fail" | "crit_fail";
  message: string;
  crime: {
    id: number;
    key: string;
    name: string;
    tier: number;
    nerveCost: number;
    isFederal: boolean;
  };
  rewards: {
    money: number;
    points: number;
    xpGained: number;
  };
  penalties: {
    moneyLost: number;
    lifeLost: number;
    xpLost: number;
    jailSeconds: number;
    jailType: "normal" | "federal" | null;
  };
  special: SpecialResult | null;
  progress: {
    crimeXp: number;
    crimeLevel: number;
    attempts: number;
    successes: number;
    failures: number;
    critFailures: number;
    specialsFoundCount: number;
  };
  user: {
    money: number;
    points: number;
    nerve: number;
    maxNerve: number;
    life: number;
    maxLife: number;
    jailUntil: string | null;
    federalJailUntil: string | null;
  };
}

export const crimesAPI = {
  getCrimes: (): Promise<CrimesResponse> => apiCall("/crimes"),

  attemptCrime: (crimeKey: string): Promise<CrimeAttemptResponse> =>
    apiCall("/crimes/attempt", {
      method: "POST",
      body: JSON.stringify({ crimeKey }),
    }),
};
