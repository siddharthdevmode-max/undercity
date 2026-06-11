import { useState, useEffect, useCallback, useRef } from "react";
import Shell from "../components/Shell";
import Icon from "../components/ui/Icon";
import { Skeleton } from "../components/ui/Skeleton";
import { gangsAPI } from "../services/gangs";
import type { War } from "../services/gangs";
import "../styles/Gang.css";

export default function GangWars() {
  const [wars, setWars] = useState<War[]>([]);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef<() => void>(() => {});
  const load = useCallback(() => {
    setLoading(true);
    gangsAPI.getWars().then(r => setWars(r.wars)).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { loadRef.current = load; }, [load]);
  useEffect(() => { loadRef.current(); }, []);

  return (
    <Shell>
      <div className="gang-container">
        <h1 className="gang-title"><Icon name="gang-wars" size={26} className="icon-error" /> Gang Wars</h1>
        {loading ? <Skeleton width={300} height={4} /> : <div className="gang-list">{wars.length === 0 ? <p className="gang-empty">No wars.</p> : wars.map(w => <div key={w.id} className="gang-card"><div className="gang-card-header"><span className="gang-card-name">{w.attacker_name} vs {w.defender_name}</span><span className="gang-card-respect">{w.status}</span></div><div className="gang-card-footer"><span>{w.attacker_score} - {w.defender_score}</span></div></div>)}</div>}
      </div>
    </Shell>
  );
}
