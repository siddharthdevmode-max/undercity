export interface LiveStats {
  onlineNow: number;
  last3Hours: number;
  last24Hours: number;
  attacks24h: number;
  crimes24h: number;
  casino24h: number;
}

const FALLBACK: LiveStats = {
  onlineNow: 47,
  last3Hours: 312,
  last24Hours: 1847,
  attacks24h: 234,
  crimes24h: 1492,
  casino24h: 89,
};

export async function getLiveStats(): Promise<LiveStats> {
  try {
    const res = await fetch('http://localhost:5000/api/stats/live');
    if (res.ok) {
      const data = await res.json();
      return { ...FALLBACK, ...data };
    }
  } catch (e) {
    // backend not ready yet — use fallback silently
  }
  return FALLBACK;
}
