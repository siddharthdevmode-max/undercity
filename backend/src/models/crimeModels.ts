import { toNumber } from "./userModels";

export interface CrimeDefinition {
  id: number;
  crime_key: string;
  name: string;
  tier: number;
  unlock_level: number;
  nerve_cost: number;
  min_reward: number;
  max_reward: number;
  jail_min_seconds: number;
  jail_max_seconds: number;
  is_federal: boolean;
}

export interface CrimeProgress {
  id: number | null;
  user_id: number;
  crime_id: number;
  crime_xp: number;
  crime_level: number;
  hidden_cpl: number;
  attempts: number;
  successes: number;
  failures: number;
  crit_failures: number;
  specials_found_count: number;
}

export interface CrimeSpecial {
  id: number;
  crime_id: number;
  title: string;
  description: string;
  reward_money: number;
  reward_points: number;
  unlock_crime_level: number;
}

type RawRow = Record<string, unknown>;

export function parseCrime(row: RawRow): CrimeDefinition {
  return {
    id:               toNumber(row.id),
    crime_key:        String(row.crime_key),
    name:             String(row.name),
    tier:             toNumber(row.tier),
    unlock_level:     toNumber(row.unlock_level),
    nerve_cost:       toNumber(row.nerve_cost),
    min_reward:       toNumber(row.min_reward),
    max_reward:       toNumber(row.max_reward),
    jail_min_seconds: toNumber(row.jail_min_seconds),
    jail_max_seconds: toNumber(row.jail_max_seconds),
    is_federal:       !!row.is_federal,
  };
}

export function parseProgress(row: RawRow): CrimeProgress {
  return {
    id:                   row?.id ? toNumber(row.id) : null,
    user_id:              toNumber(row.user_id),
    crime_id:             toNumber(row.crime_id),
    crime_xp:             toNumber(row.crime_xp),
    crime_level:          toNumber(row.crime_level),
    hidden_cpl:           Number(row.hidden_cpl ?? 0),
    attempts:             toNumber(row.attempts),
    successes:            toNumber(row.successes),
    failures:             toNumber(row.failures),
    crit_failures:        toNumber(row.crit_failures),
    specials_found_count: toNumber(row.specials_found_count),
  };
}

export function parseSpecial(row: RawRow): CrimeSpecial {
  return {
    id:                 toNumber(row.id),
    crime_id:           toNumber(row.crime_id),
    title:              String(row.title),
    description:        String(row.description),
    reward_money:       toNumber(row.reward_money),
    reward_points:      toNumber(row.reward_points),
    unlock_crime_level: toNumber(row.unlock_crime_level),
  };
}
