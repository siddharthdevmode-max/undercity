import { useState, useEffect, useCallback, useRef } from "react";
import Shell from "../components/Shell";
import Icon from "../components/ui/Icon";
import { Skeleton } from "../components/ui/Skeleton";
import { gangsAPI } from "../services/gangs";
import type { Alliance } from "../services/gangs";
import { toast } from "../utils/toast";
import "../styles/Gang.css";

export default function LinkedGangs() {
  const [alliances, setAlliances] = useState<Alliance[]>([]);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef<() => void>(() => {});
  const load = useCallback(() => {
    setLoading(true);
    gangsAPI.getAlliances().then(r => setAlliances(r.alliances)).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { loadRef.current = load; }, [load]);
  useEffect(() => { loadRef.current(); }, []);
  const handleRespond = async (id: number, accept: boolean) => { try { await gangsAPI.respondAlliance(id, accept); toast.success(accept ? "Accepted" : "Rejected"); loadRef.current(); } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); } };

  return (
    <Shell>
      <div className="gang-container">
        <h1 className="gang-title"><Icon name="linked-gangs" size={26} className="icon-accent" /> Linked Gangs</h1>
        {loading ? <Skeleton width={300} height={4} /> : <div className="gang-list">{alliances.map(a => <div key={a.id} className="gang-card"><div className="gang-card-header"><span className="gang-card-name">{a.gang_name} [{a.gang_tag}]</span><span className={`gang-card-respect`}>{a.status}</span></div><div className="gang-card-footer">{a.status === "pending" && <><button className="gang-join-btn" onClick={() => void handleRespond(a.id, true)}>Accept</button><button className="gang-join-btn" style={{background: "var(--error)"}} onClick={() => void handleRespond(a.id, false)}>Reject</button></>}</div></div>)}</div>}
      </div>
    </Shell>
  );
}
