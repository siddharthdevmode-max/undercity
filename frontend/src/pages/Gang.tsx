import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Shell from "../components/Shell";
import Icon from "../components/ui/Icon";
import { Modal } from "../components/ui/Modal";
import { Skeleton } from "../components/ui/Skeleton";
import { gangsAPI } from "../services/gangs";
import type { Gang as GangT, Member } from "../services/gangs";
import { toast } from "../utils/toast";
import "../styles/Gang.css";

export default function GangPage() {
  const navigate = useNavigate();
  const [myGang, setMyGang] = useState<{ gang: GangT | null; members?: Member[] } | null>(null);
  const [gangs, setGangs] = useState<GangT[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [cName, setCName] = useState(""); const [cTag, setCTag] = useState(""); const [cDesc, setCDesc] = useState("");

  const loadRef = useRef<() => void>(() => {});
  const load = useCallback(() => {
    setLoading(true);
    Promise.all([gangsAPI.my(), gangsAPI.list()]).then(([m, g]) => { setMyGang(m); setGangs(g); }).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { loadRef.current = load; }, [load]);
  useEffect(() => { loadRef.current(); }, []);

  const handleCreate = async () => {
    try { await gangsAPI.create(cName, cTag, cDesc); toast.success("Gang created!"); setCreateOpen(false); loadRef.current(); }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };
  const handleJoin = async (id: number) => { try { await gangsAPI.join(id); toast.success("Joined!"); loadRef.current(); } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); } };
  const handleLeave = async () => { try { await gangsAPI.leave(); toast.success("Left gang"); loadRef.current(); } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); } };
  const handleKick = async (uid: number) => { try { await gangsAPI.kick(uid); toast.success("Kicked"); loadRef.current(); } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); } };

  if (loading) return <Shell><div className="gang-container"><h1 className="gang-title"><Icon name="gang" size={26} /> Gangs</h1><Skeleton width={300} height={4} /></div></Shell>;

  return (
    <Shell>
      <div className="gang-container">
        <div className="gang-header"><h1 className="gang-title"><Icon name="gang" size={26} className="icon-accent" /> Gangs</h1>{!myGang?.gang && <button className="gang-create-btn" onClick={() => setCreateOpen(true)}>Create Gang</button>}</div>

        {myGang?.gang ? (
          <div className="gang-my">
            <div className="gang-info"><h2>{myGang.gang.name} [{myGang.gang.tag}]</h2><p>{myGang.gang.description}</p><p>Respect: {myGang.gang.respect} | Bank: ${myGang.gang.bank.toLocaleString()}</p></div>
            <div className="gang-members"><h3>Members ({myGang.members?.length || 0})</h3>{myGang.members?.map(m => <div key={m.id} className="gang-member"><span>{m.username} <em>({m.role})</em></span>{m.role !== "leader" && <button className="gang-kick-btn" onClick={() => void handleKick(m.user_id)}>Kick</button>}</div>)}</div>
            <div className="gang-links"><button onClick={() => navigate("/linked-gangs")}>Alliances</button><button onClick={() => navigate("/gang-wars")}>Wars</button><button className="gang-leave-btn" onClick={() => void handleLeave()}>Leave Gang</button></div>
          </div>
        ) : (
          <div className="gang-list">{gangs.map(g => <div key={g.id} className="gang-card"><div className="gang-card-header"><span className="gang-card-name">{g.name} [{g.tag}]</span><span className="gang-card-respect">{g.respect} respect</span></div><p className="gang-card-desc">{g.description}</p><div className="gang-card-footer"><span>{g.member_count || "?"} members</span><button className="gang-join-btn" onClick={() => void handleJoin(g.id)}>Join</button></div></div>)}</div>
        )}
      </div>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create Gang">
        <div className="gang-create-form">
          <input placeholder="Name" maxLength={50} value={cName} onChange={e => setCName(e.target.value)} />
          <input placeholder="Tag (3-5 chars)" maxLength={5} value={cTag} onChange={e => setCTag(e.target.value.toUpperCase())} />
          <textarea placeholder="Description" rows={3} value={cDesc} onChange={e => setCDesc(e.target.value)} />
          <button disabled={!cName || cTag.length < 3} onClick={() => void handleCreate()}>Create</button>
        </div>
      </Modal>
    </Shell>
  );
}
