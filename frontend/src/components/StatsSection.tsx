import { useEffect, useRef, useState } from 'react';
import StatCard from './StatCard';
import { getLiveStats } from '../services/stats';
import type { LiveStats } from '../services/stats';
import '../styles/StatsSection.css';

const REFRESH_MS = 5 * 60 * 1000;

// Pre-launch placeholder — replaced by live data after launch
const PLACEHOLDER: LiveStats = {
  onlineNow:   142,
  last3Hours:  389,
  last24Hours: 1204,
  attacks24h:  3871,
  crimes24h:   18432,
  casino24h:   956,
};

export default function StatsSection() {
  const [stats,   setStats]   = useState<LiveStats | null>(null);
  const [visible, setVisible] = useState(false);
  const [isLive,  setIsLive]  = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await getLiveStats();
        if (!cancelled) { setStats(data); setIsLive(true); }
      } catch {
        // API not up yet — show placeholder silently
        if (!cancelled) setStats(PLACEHOLDER);
      }
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
        });
      },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const s = stats ?? PLACEHOLDER;

  return (
    <section className="stats-section" ref={sectionRef}>
      <div className="stats-inner">
        <span className="stats-eyebrow">
          {isLive ? '🟢 LIVE ACTIVITY · UPDATES EVERY 5 MIN' : '⏳ LAUNCHING SOON · PREVIEW STATS'}
        </span>
        <h2 className="stats-heading">THE UNDERCITY NEVER SLEEPS</h2>
        <div className="stats-divider">
          <span className="line" />
          <span className="diamond">◆</span>
          <span className="line" />
        </div>

        <div className="stats-grid">
          <StatCard value={s.onlineNow}   label="ONLINE NOW"    sublabel="Players currently active" start={visible} delay={0}   />
          <StatCard value={s.last3Hours}  label="LAST 3 HOURS"  sublabel="Active recently"          start={visible} delay={100} />
          <StatCard value={s.last24Hours} label="LAST 24 HOURS" sublabel="Logins today"             start={visible} delay={200} />
        </div>
        <div className="stats-grid" style={{ marginTop: '1rem' }}>
          <StatCard value={s.attacks24h} label="ATTACKS" sublabel="Player vs player"    start={visible} delay={300} />
          <StatCard value={s.crimes24h}  label="CRIMES"  sublabel="Heists, mugs, scams" start={visible} delay={400} />
          <StatCard value={s.casino24h}  label="CASINO"  sublabel="PvP card matches"    start={visible} delay={500} />
        </div>
      </div>
    </section>
  );
}
