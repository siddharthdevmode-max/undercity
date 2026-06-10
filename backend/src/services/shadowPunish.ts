import { randomInt }    from "crypto";
import { CrimeSpecial } from "../models/crimeModels";

// ============================================================
// SHADOW PUNISHMENT SYSTEM
// Silently nerfs cheaters without telling them
//
// Tiers:
//   CLEAN       (70+)  — no punishment
//   WATCHED     (40-69) — light nerf (50% money, 50% points, 75% XP)
//   SUSPICIOUS  (20-39) — heavy nerf (10% money, 0 points, 20% XP)
//   SHADOW_BANNED (1-19) — 95% forced fail
//   HARD_BANNED (0)    — safety net zero (should never reach here)
// ============================================================

export interface CrimeOutcomeForPunish {
  outcome:       "success" | "fail" | "crit_fail" | "special";
  reward_money:  number;
  reward_points: number;
  xp_gained:     number;
  jail_seconds:  number;
  money_loss:    number;
  life_loss:     number;
  xp_lost:       number;
  message:       string;
  special:       CrimeSpecial | null;
  cpl_change:    number;
}

export function applyShadowPunishment(
  outcome:    CrimeOutcomeForPunish,
  trustScore: number,
  isImmune:   boolean = false
): CrimeOutcomeForPunish {

  // 🛡️ Devs/admins: NEVER get nerfed
  if (isImmune) return outcome;

  // ── CLEAN tier (70+): no punishment ──────────────────────
  // Explicitly return early — avoids falling through to fallback
  if (trustScore >= 70) return outcome;

  // ── WATCHED tier (40–69): light nerf ──
  // They notice nothing — just slightly less money
  if (trustScore >= 40) {
    return {
      ...outcome,
      reward_money:  Math.floor(outcome.reward_money * 0.5),
      reward_points: Math.floor(outcome.reward_points * 0.5),
      xp_gained:     Math.floor(outcome.xp_gained * 0.75),
    };
  }

  // ── SUSPICIOUS tier (20–39): heavy nerf ──
  // Money gutted, no points, reduced XP
  if (trustScore >= 20) {
    return {
      ...outcome,
      reward_money:  Math.floor(outcome.reward_money * 0.1),
      reward_points: 0,
      xp_gained:     Math.floor(outcome.xp_gained * 0.2),
      special:       null,
    };
  }

  // ── SHADOW_BANNED tier (1–19): 95% forced fail ──
  // They think they're playing normally
  if (trustScore >= 1) {
    // crypto.randomInt is cryptographically safe — Math.random() is NOT
    // Math.random() is predictable in V8; an attacker knowing the threshold
    // can statistically probe until they get through the 5% window
    const random = randomInt(0, 100);

    // 95% chance: forced fail (not crit_fail)
    if (random < 95 && outcome.outcome !== "crit_fail") {
      return {
        ...outcome,
        outcome:       "fail",
        reward_money:  0,
        reward_points: 0,
        xp_gained:     0,
        special:       null,
        message:       getRandomFailMessage(),
        cpl_change:    0,
      };
    }

    // Crit fail: double jail time
    if (outcome.outcome === "crit_fail") {
      return {
        ...outcome,
        jail_seconds:  outcome.jail_seconds * 2,
        reward_money:  0,
        reward_points: 0,
        xp_gained:     0,
      };
    }

    // Remaining 5%: tiny money, no points, no specials
    return {
      ...outcome,
      reward_money:  Math.floor(outcome.reward_money * 0.05),
      reward_points: 0,
      xp_gained:     Math.floor(outcome.xp_gained * 0.1),
      special:       null,
    };
  }

  // ── HARD_BANNED fallback (score = 0) ──
  // Should never reach here — banCheck blocks hard banned users.
  // Safety net: zero everything in case they slip through.
  return {
    ...outcome,
    outcome:       "fail",
    reward_money:  0,
    reward_points: 0,
    xp_gained:     0,
    special:       null,
    message:       getRandomFailMessage(),
    cpl_change:    0,
  };
}

function getRandomFailMessage(): string {
  const messages = [
    "You hesitated at the wrong moment.",
    "Bad luck — a witness noticed you.",
    "Your hands were shaking too much.",
    "The target moved at the last second.",
    "You lost your nerve halfway through.",
    "Someone shouted nearby — you bailed.",
    "Your timing was just slightly off.",
    "Almost had it, but luck wasn't on your side.",
    "A passerby looked your way at the wrong time.",
    "The opportunity slipped away.",
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}
