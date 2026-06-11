import { useState, useEffect, useCallback, useRef } from "react";
import Shell from "../components/Shell";
import Icon from "../components/ui/Icon";
import { Skeleton } from "../components/ui/Skeleton";
import { attackAPI } from "../services/attack";
import type { AttackTarget, AttackResult, AttackLogEntry } from "../services/attack";
import { toast } from "../utils/toast";
import { userEvents } from "../utils/userEvents";
import "../styles/Attack.css";

function formatMoney(n: number): string { return `$${n.toLocaleString()}`; }
function formatDate(s: string): string { return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }

type Tab = "search" | "log";

export default function Attack() {
  const [tab, setTab] = useState<Tab>("search");
  const [target, setTarget] = useState<AttackTarget | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AttackResult | null>(null);
  const [attacking, setAttacking] = useState(false);
  const [log, setLog] = useState<AttackLogEntry[]>([]);
  const [logLoading, setLogLoading] = useState(false);

  const handleSearch = async () => {
    setSearching(true); setError(null);
    try {
      const t = await attackAPI.search();
      setTarget(t);
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : "Search failed";
      setError(m); toast.error(m);
    } finally { setSearching(false); }
  };

  const handleAttack = async () => {
    if (!target || attacking) return;
    setAttacking(true);
    try {
      const r = await attackAPI.attack(target.id);
      setResult(r);
      userEvents.emit({ money: r.attacker.money, nerve: r.attacker.nerve, life: r.attacker.life });
      if (r.moneyStolen > 0) toast.success(`Stole ${formatMoney(r.moneyStolen)} from ${r.target.username}`);
      else if (r.result === "hospitalized") toast.success(`${r.target.username} hospitalized!`);
      else toast.error(`You lost to ${r.target.username}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Attack failed");
    } finally { setAttacking(false); }
  };

  const loadLogRef = useRef<() => void>(() => {});
  const loadLog = useCallback(() => {
    setLogLoading(true);
    attackAPI.getLog().then((r) => setLog(r.log)).catch(() => {}).finally(() => setLogLoading(false));
  }, []);
  useEffect(() => { loadLogRef.current = loadLog; }, [loadLog]);
  useEffect(() => { if (tab === "log") loadLogRef.current(); }, [tab]);

  const getResultColor = (r: string) => {
    if (r === "mugged" || r === "attacker_win" || r === "hospitalized") return "var(--success)";
    return "var(--error)";
  };

  return (
    <Shell>
      <div className="attack-container">
        <div className="attack-header">
          <h1 className="attack-title"><Icon name="attack" size={26} className="icon-error" /> Attacks</h1>
        </div>

        <div className="attack-tabs">
          <button className={`attack-tab ${tab === "search" ? "active" : ""}`} onClick={() => setTab("search")}>Search & Fight</button>
          <button className={`attack-tab ${tab === "log" ? "active" : ""}`} onClick={() => setTab("log")}>Attack Log</button>
        </div>

        {tab === "search" && (
          <div className="attack-search-area">
            <button className="attack-search-btn" disabled={searching} onClick={() => void handleSearch()}>
              {searching ? "Searching..." : "Find Target"}
            </button>

            {error && <p className="attack-error-msg">{error}</p>}

            {target && (
              <div className="attack-target-card">
                <div className="attack-target-info">
                  <Icon name="player" size={32} className="icon-accent" />
                  <div>
                    <span className="attack-target-name">{target.username}</span>
                    <span className="attack-target-level">Level {target.level}</span>
                  </div>
                </div>
                <button className="attack-fight-btn" disabled={attacking} onClick={() => void handleAttack()}>
                  {attacking ? "Fighting..." : "Attack!"}
                </button>
              </div>
            )}

            {result && (
              <div className="attack-result" style={{ borderColor: getResultColor(result.result) }}>
                <h3 className="attack-result-title" style={{ color: getResultColor(result.result) }}>
                  {result.result === "mugged" ? "MUGGED" : result.result === "hospitalized" ? "HOSPITALIZED" : result.result === "attacker_win" ? "VICTORY" : "DEFEAT"}
                </h3>
                <div className="attack-result-stats">
                  <div><span>You lost</span><span>{result.attackerHpLoss} HP</span></div>
                  <div><span>{result.target.username} lost</span><span>{result.targetHpLoss} HP</span></div>
                  {result.moneyStolen > 0 && <div><span>Stolen</span><span className="attack-money">{formatMoney(result.moneyStolen)}</span></div>}
                </div>
                <button className="attack-close-btn" onClick={() => { setResult(null); setTarget(null); }}>Done</button>
              </div>
            )}
          </div>
        )}

        {tab === "log" && (
          <div className="attack-log">
            {logLoading ? <Skeleton width={300} height={4} /> : log.length === 0 ? <p className="attack-empty">No attacks yet.</p> : (
              <div className="attack-log-list">
                {log.map((entry) => (
                  <div key={entry.id} className="attack-log-row">
                    <span className={`attack-log-result attack-log-${entry.result}`}>{entry.result.toUpperCase()}</span>
                    <span className="attack-log-target">vs {entry.target_name}</span>
                    <span className="attack-log-money">{entry.money_stolen > 0 ? formatMoney(entry.money_stolen) : "-"}</span>
                    <span className="attack-log-date">{formatDate(entry.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}
