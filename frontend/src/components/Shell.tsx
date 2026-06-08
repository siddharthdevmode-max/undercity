import { useEffect, useRef, useState } from 'react';
import '../styles/Home.css';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { useAuth } from '../hooks/useAuth';
import { userEvents } from '../utils/userEvents';
import { toast } from '../utils/toast';
import Icon from './ui/Icon';
import { useSocket, useStatsUpdate } from '../hooks/useSocket';

interface Props { children: React.ReactNode; }

const NAV_SECTIONS = [
  {
    label: 'MAIN',
    items: [
      { path: '/home',      label: 'Home',      icon: 'home'      },
      { path: '/crimes',    label: 'Crimes',    icon: 'crime'     },
      { path: '/gym',       label: 'Gym',       icon: 'gym'       },
      { path: '/inventory', label: 'Inventory', icon: 'inventory' },
      { path: '/city',      label: 'City',      icon: 'city'      },
    ],
  },
  {
    label: 'ECONOMY',
    items: [
      { path: '/job',         label: 'Job',         icon: 'job'        },
      { path: '/company',     label: 'Company',     icon: 'company'    },
      { path: '/properties',  label: 'Properties',  icon: 'properties' },
      { path: '/black-market', label: 'Black Market', icon: 'market'     },
      { path: '/casino',      label: 'Casino',      icon: 'casino'     },
      { path: '/travel',      label: 'Travel',      icon: 'travel'     },
    ],
  },
  {
    label: 'CONTRACTS',
    items: [
      { path: '/missions', label: 'Missions', icon: 'missions' },
      { path: '/events',   label: 'Events',   icon: 'events'   },
    ],
  },
  {
    label: 'UNDERWORLD',
    items: [
      { path: '/gang',         label: 'Gang',         icon: 'gang'         },
      { path: '/linked-gangs', label: 'Linked Gangs', icon: 'linked-gangs' },
      { path: '/gang-wars',    label: 'Gang Wars',    icon: 'gang-wars'    },
    ],
  },
  {
    label: 'CITY',
    items: [
      { path: '/hospital',     label: 'Hospital',     icon: 'hospital'      },
      { path: '/jail',         label: 'Jail',         icon: 'jail'          },
      { path: '/federal-jail', label: 'Federal Jail', icon: 'federal-jail'  },
    ],
  },
  {
    label: 'COMMUNITY',
    items: [
      { path: '/forum',     label: 'Forum',     icon: 'forum'     },
      { path: '/newspaper', label: 'Newspaper', icon: 'newspaper' },
      { path: '/calendar',  label: 'Calendar',  icon: 'calendar'  },
    ],
  },
];

export default function Shell({ children }: Props) {
  const { user: authUser, loading } = useAuth();
  useSocket();

  const navigate = useNavigate();
  const location = useLocation();
  const auth     = getAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState({
    money:    authUser?.money    ?? 0,
    life:     authUser?.life     ?? 0,
    maxLife:  authUser?.maxLife  ?? 100,
    nerve:    authUser?.nerve    ?? 0,
    maxNerve: authUser?.maxNerve ?? 30,
    level:    authUser?.level    ?? 1,
    points:   authUser?.points   ?? 0,
  });

  const [now, setNow] = useState(() => Date.now());

  // Consume WebSocket stat pushes from server
  // Fires after crime attempts, game tick events, etc.
  useStatsUpdate((serverStats) => {
    setStats((prev) => ({
      money:    serverStats['money']    ?? prev.money,
      life:     serverStats['life']     ?? prev.life,
      maxLife:  serverStats['maxLife']  ?? prev.maxLife,
      nerve:    serverStats['nerve']    ?? prev.nerve,
      maxNerve: serverStats['maxNerve'] ?? prev.maxNerve,
      level:    serverStats['level']    ?? prev.level,
      points:   serverStats['points']   ?? prev.points,
    }));
  });
  useEffect(() => {
    const inJail = authUser?.jailUntil || authUser?.federalJailUntil;
    if (!inJail) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [authUser?.jailUntil, authUser?.federalJailUntil]);

  const prevAuthUser = useRef(authUser);
  useEffect(() => {
    if (authUser && authUser !== prevAuthUser.current) {
      prevAuthUser.current = authUser;
      setStats({
        money:    authUser.money,
        life:     authUser.life,
        maxLife:  authUser.maxLife,
        nerve:    authUser.nerve,
        maxNerve: authUser.maxNerve,
        level:    authUser.level,
        points:   authUser.points,
      });
    }
  }, [authUser]);

  useEffect(() => {
    return userEvents.subscribe((update) => {
      setStats((prev) => ({
        money:    update.money    ?? prev.money,
        life:     update.life     ?? prev.life,
        maxLife:  update.maxLife  ?? prev.maxLife,
        nerve:    update.nerve    ?? prev.nerve,
        maxNerve: update.maxNerve ?? prev.maxNerve,
        level:    update.level    ?? prev.level,
        points:   update.points   ?? prev.points,
      }));
    });
  }, []);

  const prevPath = useRef(location.pathname);
  useEffect(() => {
    if (prevPath.current !== location.pathname) {
      prevPath.current = location.pathname;
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const handleLogout = async () => {
    try { await signOut(auth); navigate('/login'); }
    catch { toast.error('Logout failed. Please try again.'); }
  };

  if (loading) {
    return (
      <div className="loading-screen" role="status" aria-live="polite">
        <div className="loading-text">Entering Undercity...</div>
      </div>
    );
  }

  const jailRemaining = authUser?.jailUntil
    ? Math.max(0, Math.ceil((new Date(authUser.jailUntil).getTime() - now) / 1000))
    : 0;
  const fedJailRemaining = authUser?.federalJailUntil
    ? Math.max(0, Math.ceil((new Date(authUser.federalJailUntil).getTime() - now) / 1000))
    : 0;

  const isDeveloper  = authUser?.isDeveloper === true;
  const isAdmin      = authUser?.isAdmin === true;
  const lifePercent  = Math.round((stats.life  / Math.max(stats.maxLife,  1)) * 100);
  const nervePercent = Math.round((stats.nerve / Math.max(stats.maxNerve, 1)) * 100);

  return (
    <div className="game-shell">

      {/* ── Header ── */}
      <header className="game-header" role="banner">
        <button
          className="hamburger-btn"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={sidebarOpen}
          aria-controls="main-sidebar"
        >
          {sidebarOpen ? '✕' : '☰'}
        </button>

        <div className="logo">UNDERCITY</div>

        <div className="header-stats" role="group" aria-label="Player stats">
          <span className="header-stat">
            <Icon name="money" size={14} className="icon-accent" />
            ${stats.money.toLocaleString()}
          </span>
          <span className="header-stat">
            <Icon name="life" size={14} className="icon-error" />
            {stats.life}/{stats.maxLife}
          </span>
          <span className="header-stat">
            <Icon name="nerve" size={14} className="icon-accent" />
            {stats.nerve}/{stats.maxNerve}
          </span>
        </div>

        <div className="user-info">
          <button onClick={handleLogout} className="logout-btn" aria-label="Log out">
            <Icon name="logout" size={16} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      <div className="game-content">

        <div
          className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />

        {/* ── Sidebar ── */}
        <aside
          id="main-sidebar"
          className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}
          aria-label="Navigation"
        >
          {/* Player block */}
          <div className="sb-player-block">
            <div className="sb-player-name-row">
              <span className="sb-player-name">{authUser?.username}</span>
              {isDeveloper && (
                <span className="role-badge role-dev" title="Developer">DEV</span>
              )}
              {isAdmin && !isDeveloper && (
                <span className="role-badge role-admin" title="Administrator">ADMIN</span>
              )}
            </div>
            <div className="sb-player-level">Level {stats.level}</div>
          </div>

          {/* Stats block */}
          <div className="sb-stats-block">
            <div className="sb-stat-row">
              <span className="sb-stat-label">
                <Icon name="money" size={12} className="icon-accent" /> Money
              </span>
              <span className="sb-stat-value">${stats.money.toLocaleString()}</span>
            </div>
            <div className="sb-stat-row">
              <span className="sb-stat-label">
                <Icon name="points" size={12} className="icon-accent" /> Points
              </span>
              <span className="sb-stat-value">{stats.points.toLocaleString()}</span>
            </div>
            <div className="sb-stat-row">
              <span className="sb-stat-label">
                <Icon name="nerve" size={12} className="icon-accent" /> Nerve
              </span>
              <span className="sb-stat-value">{stats.nerve}/{stats.maxNerve}</span>
            </div>
            <div className="sb-stat-row">
              <span className="sb-stat-label">
                <Icon name="life" size={12} className="icon-error" /> Health
              </span>
              <span className="sb-stat-value">{stats.life}/{stats.maxLife}</span>
            </div>
          </div>

          {/* Mini bars */}
          <div className="sb-bars-block">
            <div className="sb-bar-row">
              <div className="sb-bar-header">
                <span className="sb-bar-label">
                  <Icon name="life" size={11} className="icon-error" /> Life
                </span>
                <span className="sb-bar-pct">{lifePercent}%</span>
              </div>
              <div className="sb-bar-track">
                <div className="sb-bar-fill sb-bar-life" style={{ width: `${lifePercent}%` }} />
              </div>
            </div>
            <div className="sb-bar-row">
              <div className="sb-bar-header">
                <span className="sb-bar-label">
                  <Icon name="nerve" size={11} className="icon-accent" /> Nerve
                </span>
                <span className="sb-bar-pct">{nervePercent}%</span>
              </div>
              <div className="sb-bar-track">
                <div className="sb-bar-fill sb-bar-nerve" style={{ width: `${nervePercent}%` }} />
              </div>
            </div>
          </div>

          {/* Jail timers */}
          {(jailRemaining > 0 || fedJailRemaining > 0) && (
            <div className="sb-timers-block">
              <div className="sb-timers-label">ACTIVE TIMERS</div>
              {jailRemaining > 0 && (
                <div className="sb-timer-row sb-timer-danger">
                  <span className="sb-timer-name">
                    <Icon name="jail" size={12} /> Jail
                  </span>
                  <span className="sb-timer-value">{formatTimer(jailRemaining)}</span>
                </div>
              )}
              {fedJailRemaining > 0 && (
                <div className="sb-timer-row sb-timer-danger">
                  <span className="sb-timer-name">
                    <Icon name="federal-jail" size={12} /> Fed Jail
                  </span>
                  <span className="sb-timer-value">{formatTimer(fedJailRemaining)}</span>
                </div>
              )}
            </div>
          )}

          {/* Nav */}
          <nav className="sidebar-nav" aria-label="Main navigation">
            {NAV_SECTIONS.map((section) => (
              <div key={section.label} className="nav-section">
                <div className="nav-section-label">{section.label}</div>
                {section.items.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                    aria-current={location.pathname === item.path ? 'page' : undefined}
                  >
                    <Icon name={item.icon} size={15} />
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>

          {/* Settings */}
          <div className="sb-admin-block" style={{ marginTop: '0.5rem' }}>
            <Link
              to="/settings"
              className={`nav-item ${location.pathname === '/settings' ? 'active' : ''}`}
            >
              <Icon name="admin" size={15} />
              Settings
            </Link>
          </div>

          {/* Admin */}
          {(isAdmin || isDeveloper) && (
            <div className="sb-admin-block">
              <Link
                to="/admin"
                className={`nav-item nav-item-admin ${location.pathname === '/admin' ? 'active' : ''}`}
              >
                <Icon name="admin" size={15} />
                Admin Panel
              </Link>
            </div>
          )}
        </aside>

        <main className="main-content" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}

function formatTimer(seconds: number): string {
  if (seconds <= 0) return 'Ready';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 60) { const h = Math.floor(m / 60); return `${h}h ${m % 60}m`; }
  return `${m}m ${s}s`;
}
