import { useState, useEffect, useCallback, useRef } from "react";
import Shell from "../components/Shell";
import Icon from "../components/ui/Icon";
import { Skeleton } from "../components/ui/Skeleton";
import { gymAPI } from "../services/gym";
import type { GymStats, BattleStats } from "../services/gym";
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
  const [battleStats, setBattleStats] = useState<BattleStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [training, setTraining] = useState<string | null>(null);
  const [allocating, setAllocating] = useState<string | null>(null);

  const loadRef = useRef<() => void>(() => {});
  const load = useCallback(() => {
    setError(null); setLoading(true);
    Promise.all([
      gymAPI.getStats(),
      gymAPI.getBattleStats(),
    ])
      .then(([s, bs]) => { setStats(s); setBattleStats(bs); })
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

  const handleAllocate = async (stat: string) => {
    if (allocating) return;
    setAllocating(stat);
    try {
      const res = await gymAPI.allocateStat(stat, 1);
      setBattleStats(res.stats);
      toast.success(`${stat.charAt(0).toUpperCase() + stat.slice(1)} +1`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Allocation failed");
    } finally { setAllocating(null); }
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

        {/* Stat Point Allocation */}
        {battleStats && battleStats.unspent_stat_points > 0 && (
          <div className="gym-allocate-section">
            <div className="gym-allocate-header">
              <Icon name="upgrade" size={18} className="icon-accent" />
              <span>Stat Points Available: <strong>{battleStats.unspent_stat_points}</strong></span>
            </div>
            <p className="gym-allocate-desc">
              You earned stat points from leveling up. Allocate them to boost your battle stats instantly.
            </p>
            <div className="gym-allocate-grid">
              {STATS.map((s) => {
                const val = battleStats[s.key as keyof BattleStats] as number;
                return (
                  <div key={s.key} className="gym-allocate-card">
                    <Icon name={s.icon} size={18} className="icon-accent" />
                    <span className="gym-allocate-label">{s.label}</span>
                    <span className="gym-allocate-value">{val}</span>
                    <button
                      className="gym-allocate-btn"
                      disabled={!!allocating || battleStats.unspent_stat_points <= 0}
                      onClick={() => void handleAllocate(s.key)}
                    >
                      {allocating === s.key ? <span className="gym-spinner" /> : "+1"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
