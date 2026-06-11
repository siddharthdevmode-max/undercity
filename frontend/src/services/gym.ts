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

export const gymAPI = {
  getStats: (): Promise<GymStats> => apiCall("/gym"),
  train: (stat: string): Promise<TrainResult> => apiCall("/gym/train", {
    method: "POST", body: JSON.stringify({ stat }),
  }),
};
