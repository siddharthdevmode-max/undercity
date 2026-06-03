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

// ============================================================
// SHELL
// Layout wrapper with sidebar + header
// Mobile: hamburger menu opens slide-out drawer
// Desktop: sidebar always visible
// Stats synced via userEvents bus (no prop drilling)
// ============================================================

export default function Shell({ children }: Props) {
  const { user: authUser, loading } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const auth      = getAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Derive initial stats from authUser — no useEffect needed
  const [stats, setStats] = useState({
    money:    authUser?.money    ?? 0,
    life:     authUser?.life     ?? 0,
    maxLife:  authUser?.maxLife  ?? 100,
    nerve:    authUser?.nerve    ?? 0,
    maxNerve: authUser?.maxNerve ?? 30,
    level:    authUser?.level    ?? 1,
  });

  // Sync stats when authUser changes — use ref to avoid
  // calling setState synchronously in effect body
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
      });
    }
  }, [authUser]);

  // Subscribe to live stat updates from crime attempts
  useEffect(() => {
    return userEvents.subscribe((update) => {
      setStats((prev) => ({
        money:    update.money    ?? prev.money,
        life:     update.life     ?? prev.life,
        maxLife:  update.maxLife  ?? prev.maxLife,
        nerve:    update.nerve    ?? prev.nerve,
        maxNerve: update.maxNerve ?? prev.maxNerve,
        level:    update.level    ?? prev.level,
      }));
    });
  }, []);

  // Close sidebar when route changes — use ref to avoid
  // calling setState synchronously in effect body
  const prevPath = useRef(location.pathname);
  useEffect(() => {
    if (prevPath.current !== location.pathname) {
      prevPath.current = location.pathname;
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  // Lock body scroll when sidebar open on mobile
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

  const navItems = [
    { path: '/home',       label: '🏠 Home'       },
    { path: '/city',       label: '🏙️ City'       },
    { path: '/crimes',     label: '🔫 Crimes'     },
    { path: '/job',        label: '💼 Job'         },
    { path: '/gym',        label: '💪 Gym'         },
    { path: '/properties', label: '🏢 Properties' },
    { path: '/missions',   label: '📋 Missions'   },
  ];

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
          <span className="header-stat" aria-label={`Money: ${stats.money} dollars`}>
            💰 ${stats.money.toLocaleString()}
          </span>
          <span className="header-stat" aria-label={`Life: ${stats.life} out of ${stats.maxLife}`}>
            ❤️ {stats.life}/{stats.maxLife}
          </span>
          <span className="header-stat" aria-label={`Nerve: ${stats.nerve} out of ${stats.maxNerve}`}>
            🧠 {stats.nerve}/{stats.maxNerve}
          </span>
        </div>

        <div className="user-info">
          <span className="username">{authUser?.username}</span>
          <button onClick={handleLogout} className="logout-btn" aria-label="Log out">
            Logout
          </button>
        </div>
      </header>

      <div className="game-content">

        {/* ── Sidebar Overlay (mobile only) ── */}
        <div
          className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />

        {/* ── Sidebar ── */}
        <aside
          id="main-sidebar"
          className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}
          aria-label="Player information and navigation"
        >
          <div className="player-card">
            <div className="player-name">{authUser?.username}</div>
            <div className="player-level">Level {stats.level}</div>

            <div className="stat-bar">
              <div className="stat-bar-header">
                <label htmlFor="life-progress">Life</label>
                <span>{stats.life}/{stats.maxLife}</span>
              </div>
              <progress
                id="life-progress"
                value={stats.life}
                max={stats.maxLife}
                aria-label={`Life: ${stats.life} of ${stats.maxLife}`}
              />
            </div>

            <div className="stat-bar">
              <div className="stat-bar-header">
                <label htmlFor="nerve-progress">Nerve</label>
                <span>{stats.nerve}/{stats.maxNerve}</span>
              </div>
              <progress
                id="nerve-progress"
                value={stats.nerve}
                max={stats.maxNerve}
                aria-label={`Nerve: ${stats.nerve} of ${stats.maxNerve}`}
              />
            </div>
          </div>

          <nav className="sidebar-nav" aria-label="Main navigation">
            {navItems.map((item) => (
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
