import { apiCall } from "./api";

export interface GymStats {
  strength: number;
  speed: number;
  defense: number;
  dexterity: number;
  energy: number;
  max_energy: number;
}

export interface TrainResult {
  stat: string;
  gained: number;
  newValue: number;
  energy: number;
}

export interface BattleStats {
  strength: number;
  speed: number;
  defense: number;
  dexterity: number;
  unspent_stat_points: number;
}

export interface AllocateResult {
  stats: BattleStats;
  allocated: number;
  stat: string;
}

export const gymAPI = {
  getStats: (): Promise<GymStats> => apiCall("/gym"),
  train: (stat: string): Promise<TrainResult> => apiCall("/gym/train", {
    method: "POST", body: JSON.stringify({ stat }),
  }),
  getBattleStats: (): Promise<BattleStats> => apiCall("/battle-stats"),
  allocateStat: (stat: string, amount: number): Promise<AllocateResult> => apiCall("/battle-stats/allocate", {
    method: "POST", body: JSON.stringify({ stat, amount }),
  }),
};
