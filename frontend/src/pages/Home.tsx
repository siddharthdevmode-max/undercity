import { useAuth } from '../hooks/useAuth';
import Shell from '../components/Shell';
import { Link } from 'react-router-dom';
import '../styles/Home.css';

export default function Home() {
  const { user } = useAuth();

  const isInJail = user?.jailUntil
    ? new Date(user.jailUntil) > new Date()
    : false;

  const isInFederalJail = user?.federalJailUntil
    ? new Date(user.federalJailUntil) > new Date()
    : false;

  const lifePercent  = Math.round(((user?.life  ?? 0) / (user?.maxLife  ?? 100)) * 100);
  const nervePercent = Math.round(((user?.nerve ?? 0) / (user?.maxNerve ?? 30))  * 100);

  const statusLabel = isInFederalJail
    ? { text: '🏛️ FEDERAL LOCKUP', cls: 'status-federal' }
    : isInJail
    ? { text: '🔒 IN JAIL',         cls: 'status-jail'    }
    : { text: '✅ FREE',             cls: 'status-free'    };

  const actions = [
    { path: '/crimes',     icon: '🔫', label: 'CRIMES',     sub: 'Earn & level up',      live: true  },
    { path: '/gym',        icon: '💪', label: 'GYM',        sub: 'Train your stats',      live: false },
    { path: '/city',       icon: '🏙️', label: 'CITY',       sub: 'Explore & hustle',      live: false },
    { path: '/job',        icon: '💼', label: 'JOB',        sub: 'Earn steady income',    live: false },
    { path: '/properties', icon: '🏢', label: 'PROPERTIES', sub: 'Own the city',          live: false },
    { path: '/missions',   icon: '📋', label: 'MISSIONS',   sub: 'Take contracts',        live: false },
  ];

  return (
    <Shell>
      {/* ══════════════════════════════════════════
          WELCOME HERO PANEL
      ══════════════════════════════════════════ */}
      <div className="hq-hero">
        <div className="hq-hero-left">
          <span className="hq-eyebrow">CRIMINAL HQ</span>
          <h1 className="hq-title">
            WELCOME BACK,{' '}
            <span className="hq-name">{user?.username?.toUpperCase()}</span>
          </h1>
          <span className={`hq-status-chip ${statusLabel.cls}`}>
            {statusLabel.text}
          </span>
        </div>
        <div className="hq-hero-right">
          <Link to="/crimes" className="hq-primary-cta">
            🔫 COMMIT CRIME <span className="arrow">→</span>
          </Link>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          RESOURCE STRIP
      ══════════════════════════════════════════ */}
      <div className="hq-resource-strip">
        <div className="resource-card">
          <span className="resource-label">💰 MONEY</span>
          <span className="resource-value">${(user?.money ?? 0).toLocaleString()}</span>
        </div>
        <div className="resource-card">
          <span className="resource-label">⭐ POINTS</span>
          <span className="resource-value">{(user?.points ?? 0).toLocaleString()}</span>
        </div>
        <div className="resource-card">
          <span className="resource-label">🎖️ LEVEL</span>
          <span className="resource-value">{user?.level ?? 1}</span>
        </div>
        <div className="resource-card resource-bar-card">
          <div className="resource-bar-header">
            <span className="resource-label">❤️ LIFE</span>
            <span className="resource-fraction">
              {user?.life ?? 0} / {user?.maxLife ?? 100}
            </span>
          </div>
          <div className="resource-bar-track">
            <div
              className="resource-bar-fill fill-life"
              style={{ width: `${lifePercent}%` }}
            />
          </div>
        </div>
        <div className="resource-card resource-bar-card">
          <div className="resource-bar-header">
            <span className="resource-label">⚡ NERVE</span>
            <span className="resource-fraction">
              {user?.nerve ?? 0} / {user?.maxNerve ?? 30}
            </span>
          </div>
          <div className="resource-bar-track">
            <div
              className="resource-bar-fill fill-nerve"
              style={{ width: `${nervePercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          MAIN GRID
      ══════════════════════════════════════════ */}
      <div className="hq-main-grid">

        {/* ── Empire Status ── */}
        <div className="hq-panel">
          <div className="hq-panel-header">
            <span className="hq-panel-accent" />
            <h3 className="hq-panel-title">EMPIRE STATUS</h3>
          </div>
          <div className="hq-stat-rows">
            <div className="hq-stat-row">
              <span className="hq-stat-label">Level</span>
              <span className="hq-stat-value accent">{user?.level ?? 1}</span>
            </div>
            <div className="hq-stat-row">
              <span className="hq-stat-label">Money</span>
              <span className="hq-stat-value">${(user?.money ?? 0).toLocaleString()}</span>
            </div>
            <div className="hq-stat-row">
              <span className="hq-stat-label">Points</span>
              <span className="hq-stat-value">{(user?.points ?? 0).toLocaleString()}</span>
            </div>
            <div className="hq-stat-row">
              <span className="hq-stat-label">Last Crime</span>
              <span className="hq-stat-value">
                {user?.lastCrimeAt
                  ? new Date(user.lastCrimeAt).toLocaleTimeString()
                  : 'Never'}
              </span>
            </div>
            {isInJail && user?.jailUntil && (
              <div className="hq-stat-row">
                <span className="hq-stat-label">Released</span>
                <span className="hq-stat-value danger">
                  {new Date(user.jailUntil).toLocaleTimeString()}
                </span>
              </div>
            )}
            {isInFederalJail && user?.federalJailUntil && (
              <div className="hq-stat-row">
                <span className="hq-stat-label">Fed Release</span>
                <span className="hq-stat-value danger">
                  {new Date(user.federalJailUntil).toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>

          <div className="hq-intel">
            <span className="hq-intel-label">◆ STREET INTEL</span>
            <p className="hq-intel-body">
              {isInFederalJail
                ? 'The feds have you locked down. Sit tight — your crew is waiting.'
                : isInJail
                ? "You're locked up. Use the time to plan your next move."
                : 'The city is yours tonight. Every street is an opportunity.'}
            </p>
          </div>
        </div>

        {/* ── Operations Grid ── */}
        <div className="hq-panel">
          <div className="hq-panel-header">
            <span className="hq-panel-accent" />
            <h3 className="hq-panel-title">OPERATIONS</h3>
          </div>
          <div className="hq-action-grid">
            {actions.map((a) => (
              <Link
                key={a.path}
                to={a.path}
                className={`hq-action-card ${!a.live ? 'hq-action-locked' : ''}`}
              >
                <span className="hq-action-icon">{a.icon}</span>
                <span className="hq-action-label">{a.label}</span>
                <span className="hq-action-sub">{a.sub}</span>
                {!a.live && <span className="hq-action-soon">SOON</span>}
              </Link>
            ))}
          </div>
        </div>

      </div>
    </Shell>
  );
}
