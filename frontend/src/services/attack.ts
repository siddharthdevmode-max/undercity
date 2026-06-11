import { apiCall } from "./api";

export interface AttackTarget {
  id: number;
  username: string;
  level: number;
}

export interface AttackResult {
  result: string;
  attackerHpLoss: number;
  targetHpLoss: number;
  moneyStolen: number;
  attacker: { money: number; nerve: number; life: number };
  target: { username: string; money: number; life: number };
}

export interface AttackLogEntry {
  id: number;
  attacker_id: number;
  target_id: number;
  result: string;
  attacker_hp: number;
  target_hp: number;
  money_stolen: number;
  attacker_nerve: number;
  created_at: string;
  target_name: string;
}

export const attackAPI = {
  search: (): Promise<AttackTarget> => apiCall("/attack/search"),
  attack: (targetId: number): Promise<AttackResult> => apiCall("/attack/attack", {
    method: "POST", body: JSON.stringify({ targetId }),
  }),
  getLog: (): Promise<{ log: AttackLogEntry[] }> => apiCall("/attack/log"),
};
