import { useEffect, useRef, useState } from 'react';
import '../styles/Home.css';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { useAuth } from '../hooks/useAuth';
import { userEvents } from '../utils/userEvents';
import { toast } from '../utils/toast';

interface Props {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { path: '/home',         label: 'Home'          },
  { path: '/crimes',       label: 'Crimes'        },
  { path: '/gym',          label: 'Gym'            },
  { path: '/inventory',    label: 'Inventory'      },
  { path: '/city',         label: 'City'           },
  { path: '/job',          label: 'Job'            },
  { path: '/company',      label: 'Company'        },
  { path: '/properties',   label: 'Properties'     },
  { path: '/travel',       label: 'Travel'         },
  { path: '/missions',     label: 'Missions'       },
  { path: '/casino',       label: 'Casino'         },
  { path: '/item-market',  label: 'Item Market'    },
  { path: '/hospital',     label: 'Hospital'       },
  { path: '/jail',         label: 'Jail'           },
  { path: '/federal-jail', label: 'Federal Jail'   },
  { path: '/gang',         label: 'Gang'           },
  { path: '/linked-gangs', label: 'Linked Gangs'   },
  { path: '/gang-wars',    label: 'Gang Wars'      },
  { path: '/forum',        label: 'Forum'          },
  { path: '/events',       label: 'Events'         },
  { path: '/newspaper',    label: 'Newspaper'      },
  { path: '/calendar',     label: 'Calendar'       },
];

export default function Shell({ children }: Props) {
  const { user: authUser, loading } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const auth      = getAuth();

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
    try {
      await signOut(auth);
      navigate('/login');
    } catch {
      toast.error('Logout failed. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="loading-screen" role="status" aria-live="polite">
        <div className="loading-text">Entering Undercity...</div>
      </div>
    );
  }

  // Jail timer
  const jailRemaining = authUser?.jailUntil
    ? Math.max(0, Math.ceil((new Date(authUser.jailUntil).getTime() - Date.now()) / 1000))
    : 0;
  const fedJailRemaining = authUser?.federalJailUntil
    ? Math.max(0, Math.ceil((new Date(authUser.federalJailUntil).getTime() - Date.now()) / 1000))
    : 0;

  return (
    <div className="game-shell">

      {/* ── Top Header ── */}
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
          <span className="header-stat">💰 ${stats.money.toLocaleString()}</span>
          <span className="header-stat">❤️ {stats.life}/{stats.maxLife}</span>
          <span className="header-stat">⚡ {stats.nerve}/{stats.maxNerve}</span>
        </div>

        <div className="user-info">
          <button onClick={handleLogout} className="logout-btn" aria-label="Log out">
            Logout
          </button>
        </div>
      </header>

      <div className="game-content">

        {/* ── Sidebar Overlay ── */}
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
          {/* ── Player Info Block ── */}
          <div className="sb-player-block">
            <div className="sb-player-name">{authUser?.username}</div>
            <div className="sb-player-level">Level {stats.level}</div>
          </div>

          {/* ── Stats Block ── */}
          <div className="sb-stats-block">
            <div className="sb-stat-row">
              <span className="sb-stat-label">Money</span>
              <span className="sb-stat-value">${stats.money.toLocaleString()}</span>
            </div>
            <div className="sb-stat-row">
              <span className="sb-stat-label">Points</span>
              <span className="sb-stat-value">{stats.points.toLocaleString()}</span>
            </div>
            <div className="sb-stat-row">
              <span className="sb-stat-label">Energy</span>
              <span className="sb-stat-value sb-stat-dim">0 / 0</span>
            </div>
            <div className="sb-stat-row">
              <span className="sb-stat-label">Nerve</span>
              <span className="sb-stat-value">{stats.nerve} / {stats.maxNerve}</span>
            </div>
            <div className="sb-stat-row">
              <span className="sb-stat-label">Health</span>
              <span className="sb-stat-value">{stats.life} / {stats.maxLife}</span>
            </div>
            <div className="sb-stat-row">
              <span className="sb-stat-label">Chain</span>
              <span className="sb-stat-value sb-stat-dim">0</span>
            </div>
          </div>

          {/* ── Timers Block ── */}
          <div className="sb-timers-block">
            <div className="sb-timers-label">COOLDOWNS</div>
            <div className="sb-timer-row">
              <span className="sb-timer-name">Drug</span>
              <span className="sb-timer-value">Ready</span>
            </div>
            <div className="sb-timer-row">
              <span className="sb-timer-name">Alcohol</span>
              <span className="sb-timer-value">Ready</span>
            </div>
            <div className="sb-timer-row">
              <span className="sb-timer-name">Chain</span>
              <span className="sb-timer-value">Ready</span>
            </div>
            {jailRemaining > 0 && (
              <div className="sb-timer-row sb-timer-danger">
                <span className="sb-timer-name">Jail</span>
                <span className="sb-timer-value">{formatTimer(jailRemaining)}</span>
              </div>
            )}
            {fedJailRemaining > 0 && (
              <div className="sb-timer-row sb-timer-danger">
                <span className="sb-timer-name">Fed Jail</span>
                <span className="sb-timer-value">{formatTimer(fedJailRemaining)}</span>
              </div>
            )}
          </div>

          {/* ── Navigation ── */}
          <nav className="sidebar-nav" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                aria-current={location.pathname === item.path ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* ── Main Content ── */}
        <main className="main-content" id="main-content" tabIndex={-1}>
          {children}
        </main>

      </div>
    </div>
  );
}

function formatTimer(seconds: number): string {
  if (seconds <= 0) return "Ready";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }
  return `${m}m ${s}s`;
}
