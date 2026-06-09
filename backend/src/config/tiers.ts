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
// ENERGY REGEN (per tick — game tick runs every 60s):
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
  priceUsd:           number;       // 0 = free
  durationDays:       number;       // 0 = forever (free), 31 = Black Card
  isSubscription:     boolean;      // true = recurring (contributor)
  nerveRegenSec:      number;       // seconds between each +1 nerve
  nerveStart:         number;       // starting nerve for new accounts
  nerveMaxCap:        number;       // absolute nerve cap
  energyRegenSec:     number;       // seconds between each +5 energy
  energyRegenAmount:  number;       // energy added per regen tick
}

export const TIER_CONFIG: Record<UserTier, TierConfig> = {
  player: {
    label:             "Player",
    priceUsd:          0,
    durationDays:      0,           // never expires
    isSubscription:    false,
    nerveRegenSec:     300,         // 1 nerve / 5 min
    nerveStart:        30,
    nerveMaxCap:       130,
    energyRegenSec:    900,         // +5 energy / 15 min
    energyRegenAmount: 5,
  },
  citizen: {
    label:             "Black Card",
    priceUsd:          4.99,
    durationDays:      31,          // 31-day one-time purchase
    isSubscription:    false,
    nerveRegenSec:     300,         // 1 nerve / 5 min (same as player)
    nerveStart:        30,
    nerveMaxCap:       130,
    energyRegenSec:    720,         // +5 energy / 12 min
    energyRegenAmount: 5,
  },
  contributor: {
    label:             "Contributor",
    priceUsd:          7.99,
    durationDays:      31,          // renews monthly
    isSubscription:    true,
    nerveRegenSec:     180,         // 1 nerve / 3 min 🔥
    nerveStart:        30,
    nerveMaxCap:       130,
    energyRegenSec:    600,         // +5 energy / 10 min 🔥
    energyRegenAmount: 5,
  },
};

// ── Helpers ────────────────────────────────────────────────

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

/**
 * Check if a tier has expired.
 * Free players never expire.
 * NULL expiry = permanent (admin grant).
 */
export function isTierExpired(
  tier:      UserTier,
  expiresAt: Date | string | null
): boolean {
  if (tier === "player") return false;
  if (!expiresAt)        return false;
  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return expiry.getTime() <= Date.now();
}

/**
 * Calculate expiry date for Black Card (citizen) or Contributor.
 * For renewals: extends from current expiry if not yet expired.
 */
export function calcTierExpiry(
  tier:           UserTier,
  currentExpiry?: Date | string | null
): Date {
  const days = getTierConfig(tier).durationDays;
  if (days === 0) throw new Error(`Tier "${tier}" does not expire`);

  // If already active and not expired — extend from current expiry
  if (currentExpiry) {
    const existing = currentExpiry instanceof Date
      ? currentExpiry
      : new Date(currentExpiry);

    if (existing > new Date()) {
      const extended = new Date(existing);
      extended.setDate(extended.getDate() + days);
      return extended;
    }
  }

  // New purchase or expired — start from now
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  return expiry;
}
