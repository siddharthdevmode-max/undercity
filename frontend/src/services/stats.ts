export interface LiveStats {
  onlineNow: number;
  last3Hours: number;
  last24Hours: number;
  attacks24h: number;
  crimes24h: number;
  casino24h: number;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const FALLBACK: LiveStats = {
  onlineNow:   47,
  last3Hours:  312,
  last24Hours: 1847,
  attacks24h:  234,
  crimes24h:   1492,
  casino24h:   89,
};

export async function getLiveStats(): Promise<LiveStats> {
  try {
    const res = await fetch(`${API_BASE_URL}/stats/live`);
    if (res.ok) {
      const data = await res.json() as Partial<LiveStats>;
      return { ...FALLBACK, ...data };
    }
  } catch {
    // fallback on error
  }
  return FALLBACK;
}
