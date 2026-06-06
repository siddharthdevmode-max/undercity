// ============================================================
// TIER CONFIGURATION — UNDERCITY
//
// Defines regen rates, caps, and benefits per user tier.
// Single source of truth — used by gameTick, nerveService,
// and any future tier-aware systems.
//
// TIERS:
//   player       = free (default)
//   citizen      = bought a Citizen Pack (31-day status)
//   contributor  = monthly Stripe subscription
//
// NERVE:
//   All tiers start at 30, cap at 130.
//   Only regen SPEED differs.
//   player/citizen  = 1 nerve / 5 min
//   contributor     = 1 nerve / 3 min
//
// ENERGY:
//   citizen/contributor get energy benefits (future)
// ============================================================

export type UserTier = "player" | "citizen" | "contributor";

export interface TierConfig {
  label:            string;
  nerveRegenSec:    number;   // seconds between each +1 nerve
  nerveStart:       number;   // starting nerve for new accounts
  nerveMaxCap:      number;   // absolute max nerve (from calcMaxNerve)
  energyRegenSec:   number;   // seconds between each +1 energy
  citizenPackDays:  number;   // only relevant for citizen tier
}

export const TIER_CONFIG: Record<UserTier, TierConfig> = {
  player: {
    label:           "Player",
    nerveRegenSec:   300,      // 5 minutes
    nerveStart:      30,
    nerveMaxCap:     130,
    energyRegenSec:  300,      // 5 minutes (base)
    citizenPackDays: 0,
  },
  citizen: {
    label:           "Citizen",
    nerveRegenSec:   300,      // 5 minutes (same as player)
    nerveStart:      30,
    nerveMaxCap:     130,
    energyRegenSec:  240,      // 4 minutes (citizen energy benefit — future)
    citizenPackDays: 31,       // Citizen Pack lasts 31 days
  },
  contributor: {
    label:           "Contributor",
    nerveRegenSec:   180,      // 3 minutes 🔥
    nerveStart:      30,
    nerveMaxCap:     130,
    energyRegenSec:  240,      // 4 minutes (same as citizen — future)
    citizenPackDays: 0,
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

/**
 * Check if a tier has expired.
 * Players never expire. Citizen/Contributor expire based on tier_expires_at.
 */
export function isTierExpired(tier: UserTier, expiresAt: Date | string | null): boolean {
  if (tier === "player") return false; // free tier never expires
  if (!expiresAt) return false;        // no expiry set = permanent (admin grant)
  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return expiry.getTime() <= Date.now();
}

/**
 * Citizen Pack: calculate expiry date from now.
 */
export function calcCitizenPackExpiry(): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + TIER_CONFIG.citizen.citizenPackDays);
  return expiry;
}
