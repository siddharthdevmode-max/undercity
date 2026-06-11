import { useState, useEffect, useCallback, useRef } from "react";
import Shell from "../components/Shell";
import Icon from "../components/ui/Icon";
import { Skeleton } from "../components/ui/Skeleton";
import { missionsAPI } from "../services/missions";
import type { Mission } from "../services/missions";
import { toast } from "../utils/toast";
import "../styles/Missions.css";

export default function Missions() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef<() => void>(() => {});
  const load = useCallback(() => {
    setLoading(true);
    missionsAPI.getAvailable().then(r => setMissions(r.missions)).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { loadRef.current = load; }, [load]);
  useEffect(() => { loadRef.current(); }, []);
  const handleStart = async (id: number) => { try { await missionsAPI.start(id); toast.success("Mission started!"); loadRef.current(); } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); } };

  return (
    <Shell>
      <div className="ms-container">
        <h1 className="ms-title"><Icon name="missions" size={26} className="icon-accent" /> Missions</h1>
        {loading ? <Skeleton width={300} height={4} /> : <div className="ms-list">{missions.map(m => {
          const isActive = m.status === "active";
          const isDone = m.status === "completed";
          return <div key={m.id} className={`ms-card ${isActive ? "ms-active" : ""} ${isDone ? "ms-done" : ""}`}>
            <div className="ms-card-header"><h3 className="ms-name">{m.name}</h3><span className="ms-level">Lvl {m.min_level}</span></div>
            <p className="ms-desc">{m.description}</p>
            <div className="ms-footer"><span className="ms-reward">Reward: ${(m.rewards as Record<string, number> | null)?.money || 0}</span>
            {!isActive && !isDone && <button className="ms-start-btn" onClick={() => void handleStart(m.id)}>Start</button>}
            {isActive && <span className="ms-badge">In Progress</span>}
            {isDone && <span className="ms-badge ms-badge-done">Completed</span>}</div>
          </div>;
        })}</div>}
      </div>
    </Shell>
  );
}
