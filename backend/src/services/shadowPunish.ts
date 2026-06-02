// ============================================================
// SHADOW PUNISHMENT SYSTEM
// Silently nerfs cheaters without telling them
// ============================================================

export interface CrimeOutcomeForPunish {
  outcome: "success" | "fail" | "crit_fail" | "special";
  reward_money: number;
  reward_points: number;
  xp_gained: number;
  jail_seconds: number;
  money_loss: number;
  life_loss: number;
  xp_lost: number;
  message: string;
  special: any;
  cpl_change: number;
}

// ============================================================
// APPLY SHADOW PUNISHMENT
// Called for users with trust_score < 20
// ============================================================

export function applyShadowPunishment(
  outcome: CrimeOutcomeForPunish,
  _trustScore: number
): CrimeOutcomeForPunish {
  // Force fail for most attempts (95% fail rate)
  // Use deterministic random based on time so it feels natural
  const random = Math.random();
  
  if (random < 0.95 && outcome.outcome !== "crit_fail") {
    // Convert success to silent fail
    return {
      ...outcome,
      outcome: "fail",
      reward_money: 0,
      reward_points: 0,
      xp_gained: 0,
      special: null,
      message: getRandomFailMessage(),
      // Keep nerve cost (already deducted)
      cpl_change: 0,
    };
  }
  
  // If it's already a crit_fail, double the jail time
  if (outcome.outcome === "crit_fail") {
    return {
      ...outcome,
      jail_seconds: outcome.jail_seconds * 2,
      reward_money: 0,
      reward_points: 0,
      xp_gained: 0,
    };
  }
  
  // Tiny success - reduce rewards to almost nothing
  return {
    ...outcome,
    reward_money: Math.floor(outcome.reward_money * 0.05), // 5% of normal
    reward_points: 0,
    xp_gained: Math.floor(outcome.xp_gained * 0.1), // 10% XP
    special: null, // Never get specials
  };
}

// ============================================================
// REALISTIC-SOUNDING FAIL MESSAGES
// Make them think they're just unlucky
// ============================================================

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
