import { useState, useEffect, useCallback, useRef } from "react";
import Shell from "../components/Shell";
import Icon from "../components/ui/Icon";
import { Skeleton } from "../components/ui/Skeleton";
import { gymAPI } from "../services/gym";
import type { GymStats } from "../services/gym";
import { toast } from "../utils/toast";
import { userEvents } from "../utils/userEvents";
import "../styles/Gym.css";

const STATS = [
  { key: "strength", icon: "strength", label: "Strength", desc: "Attack power in PvP" },
  { key: "speed", icon: "speed", label: "Speed", desc: "Attack speed in PvP" },
  { key: "defense", icon: "defense", label: "Defense", desc: "Damage reduction in PvP" },
  { key: "dexterity", icon: "dexterity", label: "Dexterity", desc: "Critical hit chance" },
];

export default function Gym() {
  const [stats, setStats] = useState<GymStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [training, setTraining] = useState<string | null>(null);

  const loadRef = useRef<() => void>(() => {});
  const load = useCallback(() => {
    setError(null); setLoading(true);
    gymAPI.getStats()
      .then(setStats)
      .catch((err: unknown) => { const m = err instanceof Error ? err.message : "Failed to load gym"; setError(m); toast.error(m); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { loadRef.current = load; }, [load]);
  useEffect(() => { loadRef.current(); }, []);

  const handleTrain = async (stat: string) => {
    if (training) return;
    setTraining(stat);
    try {
      const res = await gymAPI.train(stat);
      setStats((prev) => prev ? { ...prev, [stat]: res.newValue, energy: res.energy } : prev);
      toast.success(`${stat.charAt(0).toUpperCase() + stat.slice(1)} +${res.gained}`);
      userEvents.emit({});
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Training failed");
    } finally { setTraining(null); }
  };

  if (loading) return <Shell><div className="gym-container"><div className="gym-header"><h1 className="gym-title"><Icon name="gym" size={28} className="icon-accent" /> Gym</h1></div><Skeleton width={200} height={4} /></div></Shell>;
  if (error) return <Shell><div className="gym-error" role="alert"><p>{error}</p><button className="gym-retry-btn" onClick={load}>Retry</button></div></Shell>;

  return (
    <Shell>
      <div className="gym-container">
        <div className="gym-header">
          <h1 className="gym-title"><Icon name="gym" size={26} className="icon-accent" /> Gym</h1>
          {stats && <span className="gym-energy">Energy: {stats.energy}/{stats.max_energy}</span>}
        </div>

        <p className="gym-desc">Train your battle stats. Each session costs 10 energy.</p>

        <div className="gym-grid">
          {STATS.map((s) => {
            const current = stats ? stats[s.key as keyof GymStats] as number : 0;
            const isTraining = training === s.key;
            const canTrain = stats && stats.energy >= 10;
            return (
              <div key={s.key} className="gym-card">
                <div className="gym-stat-header">
                  <Icon name={s.icon} size={24} className="icon-accent" />
                  <div>
                    <span className="gym-stat-label">{s.label}</span>
                    <span className="gym-stat-desc">{s.desc}</span>
                  </div>
                </div>
                <span className="gym-stat-value">{current.toLocaleString()}</span>
                <button
                  className="gym-train-btn"
                  disabled={!canTrain || !!training}
                  onClick={() => void handleTrain(s.key)}
                >
                  {isTraining ? <span className="gym-spinner" /> : "Train"}
                </button>
                {!canTrain && <span className="gym-low">Low energy</span>}
              </div>
            );
          })}
        </div>
      </div>
    </Shell>
  );
}
