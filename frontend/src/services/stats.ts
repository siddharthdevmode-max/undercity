export interface LiveStats {
  onlineNow:   number;
  last3Hours:  number;
  last24Hours: number;
  attacks24h:  number;
  crimes24h:   number;
  casino24h:   number;
}

// ── API base ───────────────────────────────────────────────
// Uses same relative path convention as api.ts
// Vite proxy handles /api in dev, VITE_API_URL in prod
const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

// ── Zero fallback ──────────────────────────────────────────
// Show real zeros rather than fake numbers.
// Landing page shows "0 online" before server warms up.
// Honest > inflated.
const ZERO_STATS: LiveStats = {
  onlineNow:   0,
  last3Hours:  0,
  last24Hours: 0,
  attacks24h:  0,
  crimes24h:   0,
  casino24h:   0,
};

export async function getLiveStats(): Promise<LiveStats> {
  try {
    const res = await fetch(`${API_BASE_URL}/stats/live`, {
      signal: AbortSignal.timeout(5_000), // 5s timeout
    });
    if (res.ok) {
      const data = await res.json() as Partial<LiveStats>;
      return {
        onlineNow:   data.onlineNow   ?? 0,
        last3Hours:  data.last3Hours  ?? 0,
        last24Hours: data.last24Hours ?? 0,
        attacks24h:  data.attacks24h  ?? 0,
        crimes24h:   data.crimes24h   ?? 0,
        casino24h:   data.casino24h   ?? 0,
      };
    }
  } catch {
    // Network error or timeout — return zeros
  }
  return ZERO_STATS;
}
