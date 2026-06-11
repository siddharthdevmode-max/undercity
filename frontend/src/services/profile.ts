import { apiCall } from "./api";

export interface ProfileUser {
  id: number;
  username: string;
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
  created_at: string;
  last_seen_at: string;
  last_crime_at: string | null;
}

export interface ProfileCrimeStats {
  total_crimes: number;
  total_attempts: number;
  total_successes: number;
  total_failures: number;
}

export interface ProfileTopCrime {
  crime_key: string;
  name: string;
  attempts: number;
  successes: number;
}

export interface ProfileResponse {
  user: ProfileUser;
  crimeStats: ProfileCrimeStats;
  topCrime: ProfileTopCrime | null;
}

export const profileAPI = {
  get: (username: string): Promise<ProfileResponse> =>
    apiCall(`/profile/${encodeURIComponent(username)}`),
};
