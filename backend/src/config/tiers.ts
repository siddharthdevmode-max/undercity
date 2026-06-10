// ============================================================
// TIER CONFIGURATION — UNDERCITY
//
// TIERS:
//   player      = free (default)
//   citizen     = Black Card — one-time $4.99 (31 days)
//   contributor = monthly subscription $7.99/month
//
// NERVE REGEN:
//   player/citizen:  1 nerve every 5 minutes (300s)
//   contributor:     1 nerve every 3 minutes (180s)
//
// ENERGY REGEN:
//   player:      +5 energy every 15 minutes (900s)
//   citizen:     +5 energy every 12 minutes (720s)
//   contributor: +5 energy every 10 minutes (600s)
//
// Single source of truth — used by:
//   gameTick.ts, nerveService.ts, paymentService.ts
// ============================================================

export type UserTier = "player" | "citizen" | "contributor";

export interface TierConfig {
  label:              string;
  priceUsd:           number;
  durationDays:       number;
  isSubscription:     boolean;
  nerveRegenSec:      number;
  nerveStart:         number;
  nerveMaxCap:        number;
  energyRegenSec:     number;
  energyRegenAmount:  number;
  xpMultiplier?:      number;
  crimeRewardBonus?:  number;
}

export const TIER_CONFIG: Record<UserTier, TierConfig> = {
  player: {
    label:             "Player",
    priceUsd:          0,
    durationDays:      0,
    isSubscription:    false,
    nerveRegenSec:     300,
    nerveStart:        30,
    nerveMaxCap:       130,
    energyRegenSec:    900,   // +5 energy / 15 min
    energyRegenAmount: 5,
    xpMultiplier:      1.0,
    crimeRewardBonus:  0.0,
  },
  citizen: {
    label:             "Black Card",
    priceUsd:          4.99,
    durationDays:      31,
    isSubscription:    false,
    nerveRegenSec:     300,   // same as player
    nerveStart:        30,
    nerveMaxCap:       130,
    energyRegenSec:    720,   // +5 energy / 12 min
    energyRegenAmount: 5,
    xpMultiplier:      1.0,
    crimeRewardBonus:  0.0,
  },
  contributor: {
    label:             "Contributor",
    priceUsd:          7.99,
    durationDays:      31,
    isSubscription:    true,
    nerveRegenSec:     180,   // 1 nerve / 3 min
    nerveStart:        30,
    nerveMaxCap:       130,
    energyRegenSec:    600,   // +5 energy / 10 min
    energyRegenAmount: 5,
    xpMultiplier:      1.0,
    crimeRewardBonus:  0.0,
  },
};

export function getTierConfig(tier: UserTier): TierConfig {
  return TIER_CONFIG[tier] ?? TIER_CONFIG.player;
}

export function isValidTier(tier: string): tier is UserTier {
  return tier === "player" || tier === "citizen" || tier === "contributor";
}

export function getNerveRegenMs(tier: UserTier): number {
  return getTierConfig(tier).nerveRegenSec * 1_000;
}

export function getEnergyRegenMs(tier: UserTier): number {
  return getTierConfig(tier).energyRegenSec * 1_000;
}

export function getEnergyRegenAmount(tier: UserTier): number {
  return getTierConfig(tier).energyRegenAmount;
}

export function isTierExpired(
  tier:      UserTier,
  expiresAt: Date | string | null | undefined
): boolean {
  if (tier === "player") return false;
  if (!expiresAt) return false;
  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return expiry.getTime() <= Date.now();
}

export function calcTierExpiry(
  tier:           UserTier,
  currentExpiry?: Date | string | null
): Date {
  const { durationDays } = getTierConfig(tier);
  if (durationDays === 0) {
    throw new Error(`Tier "${tier}" does not expire — calcTierExpiry not applicable`);
  }

  const durationMs = durationDays * 24 * 60 * 60 * 1_000;

  if (currentExpiry) {
    const existing = currentExpiry instanceof Date
      ? currentExpiry
      : new Date(currentExpiry);

    if (existing.getTime() > Date.now()) {
      return new Date(existing.getTime() + durationMs);
    }
  }

  return new Date(Date.now() + durationMs);
}

export function getNerveRegenMultiplier(tier: UserTier): number {
  const baseSec = TIER_CONFIG.player.nerveRegenSec;
  const tierSec = getTierConfig(tier).nerveRegenSec;
  return Math.round((baseSec / tierSec) * 100) / 100;
}
