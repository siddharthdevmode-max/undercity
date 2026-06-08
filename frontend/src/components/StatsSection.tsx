import { useEffect, useRef, useState } from 'react';
import StatCard   from './StatCard';
import Countdown  from './Countdown';
import Icon       from './ui/Icon';
import { getLiveStats }  from '../services/stats';
import type { LiveStats } from '../services/stats';
import '../styles/StatsSection.css';

const REFRESH_MS = 5 * 60 * 1000;

// Zero stats — honest before launch
const ZERO_STATS: LiveStats = {
  onlineNow:   0,
  last3Hours:  0,
  last24Hours: 0,
  attacks24h:  0,
  crimes24h:   0,
  casino24h:   0,
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
        if (!cancelled) setStats(ZERO_STATS);
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

  const s = stats ?? ZERO_STATS;

  return (
    <section id="stats" className="stats-section" ref={sectionRef}>
      <div className="stats-inner">

        {/* Eyebrow with SVG icon instead of emoji */}
        <div className="stats-eyebrow-row">
          {isLive ? (
            <>
              <Icon name="live" size={12} className="stats-live-icon" />
              <span className="stats-eyebrow">LIVE ACTIVITY · UPDATES EVERY 5 MIN</span>
            </>
          ) : (
            <>
              <Icon name="soon" size={12} className="stats-soon-icon" />
              <span className="stats-eyebrow">LAUNCHING DEC 15, 2026 · REGISTER NOW</span>
            </>
          )}
        </div>

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
        <div className="stats-grid">
          <StatCard value={s.attacks24h} label="ATTACKS" sublabel="Player vs player"    start={visible} delay={300} />
          <StatCard value={s.crimes24h}  label="CRIMES"  sublabel="Heists, mugs, scams" start={visible} delay={400} />
          <StatCard value={s.casino24h}  label="CASINO"  sublabel="High stakes games"   start={visible} delay={500} />
        </div>

        {!isLive && (
          <>
            <Countdown targetDate="2026-12-15T00:00:00Z" />
            <p className="stats-prelaunch">
              Live stats go live on launch day.{' '}
              <a href="/register" className="stats-prelaunch-link">
                Register early to secure your name.
              </a>
            </p>
          </>
        )}
      </div>
    </section>
  );
}
