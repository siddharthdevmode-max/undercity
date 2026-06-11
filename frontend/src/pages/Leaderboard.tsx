import { useState, useEffect, useCallback, useRef, startTransition } from "react";
import Shell from "../components/Shell";
import Icon from "../components/ui/Icon";
import { Skeleton } from "../components/ui/Skeleton";
import { leaderboardAPI } from "../services/leaderboard";
import type { LeaderboardEntry } from "../services/leaderboard";
import { toast } from "../utils/toast";
import "../styles/Leaderboard.css";

const TABS = [
  { key: "level", label: "Level", icon: "level" },
  { key: "money", label: "Wealth", icon: "money" },
  { key: "crimes", label: "Crimes", icon: "crime" },
  { key: "points", label: "Honor", icon: "points" },
] as const;

type LbType = "level" | "money" | "crimes" | "points";

function formatValue(type: LbType, value: number): string {
  if (type === "money") return `$${value.toLocaleString()}`;
  return value.toLocaleString();
}

function getRankStyle(rank: number): string {
  if (rank === 1) return "lb-rank-gold";
  if (rank === 2) return "lb-rank-silver";
  if (rank === 3) return "lb-rank-bronze";
  return "";
}

export default function Leaderboard() {
  const [tab, setTab] = useState<LbType>("level");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRef = useRef<() => void>(() => {});
  const load = useCallback(() => {
    setError(null);
    setLoading(true);
    leaderboardAPI.get(tab, page)
      .then((res) => { setEntries(res.data); setTotal(res.total); })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Failed to load leaderboard";
        setError(msg); toast.error(msg);
      })
      .finally(() => setLoading(false));
  }, [tab, page]);
  useEffect(() => { loadRef.current = load; }, [load]);
  useEffect(() => { loadRef.current(); }, []);
  useEffect(() => { startTransition(() => { setPage(1); }); }, [tab]);

  const totalPages = Math.ceil(total / 20);

  return (
    <Shell>
      <div className="lb-container">
        <div className="lb-header">
          <h1 className="lb-title"><Icon name="leaderboard" size={26} className="icon-accent" /> Leaderboard</h1>
        </div>

        <div className="lb-tabs">
          {TABS.map((t) => (
            <button key={t.key} className={`lb-tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key as LbType)}>
              <Icon name={t.icon} size={14} /> {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="lb-skeleton"><Skeleton width={300} height={4} /></div>
        ) : error ? (
          <div className="lb-error" role="alert"><p>{error}</p><button className="lb-retry-btn" onClick={load}>Retry</button></div>
        ) : (
          <>
            <div className="lb-list">
              <div className="lb-list-header">
                <span className="lb-col-rank">#</span>
                <span className="lb-col-user">Player</span>
                <span className="lb-col-level">{tab === "level" ? "Level" : tab === "money" ? "Wealth" : tab === "points" ? "Honor" : "Total"}</span>
                <span className="lb-col-value">Value</span>
              </div>
              {entries.map((entry) => (
                <div key={entry.id} className={`lb-row ${getRankStyle(entry.rank)}`}>
                  <span className="lb-col-rank lb-rank-num">{entry.rank}</span>
                  <span className="lb-col-user">
                    <span className="lb-username">{entry.username}</span>
                  </span>
                  <span className="lb-col-level">{entry.level}</span>
                  <span className="lb-col-value lb-value">{formatValue(tab, entry.value)}</span>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="lb-pagination">
                <button className="lb-page-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
                <span className="lb-page-info">Page {page} of {totalPages}</span>
                <button className="lb-page-btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}
