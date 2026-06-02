import { useEffect, useState } from 'react';
import '../styles/Home.css';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { useAuth } from '../hooks/useAuth';
import { userEvents } from '../utils/userEvents';

interface Props {
  children: React.ReactNode;
}

// ============================================================
// SHELL
// Layout wrapper with sidebar + header
// Gets initial user from AuthContext
// Subscribes to userEvents for live stat updates after crimes
// ============================================================

export default function Shell({ children }: Props) {
  const { user: authUser, loading } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const auth      = getAuth();

  // Local stat state — starts from auth user, patches via event bus
  const [stats, setStats] = useState({
    money:    authUser?.money    ?? 0,
    life:     authUser?.life     ?? 0,
    maxLife:  authUser?.maxLife  ?? 100,
    nerve:    authUser?.nerve    ?? 0,
    maxNerve: authUser?.maxNerve ?? 30,
    level:    authUser?.level    ?? 1,
  });

  // Sync stats when auth user first loads or changes
  useEffect(() => {
    if (authUser) {
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

  // Subscribe to live updates from crimes/other game actions
  useEffect(() => {
    const unsub = userEvents.subscribe((update) => {
      setStats((prev) => ({
        money:    update.money    ?? prev.money,
        life:     update.life     ?? prev.life,
        maxLife:  update.maxLife  ?? prev.maxLife,
        nerve:    update.nerve    ?? prev.nerve,
        maxNerve: update.maxNerve ?? prev.maxNerve,
        level:    update.level    ?? prev.level,
      }));
    });
    return unsub;
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
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
      <header className="game-header">
        <div className="logo">UNDERCITY</div>

        <div className="header-stats">
          <span className="header-stat">
            💰 ${stats.money.toLocaleString()}
          </span>
          <span className="header-stat">
            ❤️ {stats.life}/{stats.maxLife}
          </span>
          <span className="header-stat">
            🧠 {stats.nerve}/{stats.maxNerve}
          </span>
        </div>

        <div className="user-info">
          <span className="username">{authUser?.username}</span>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </header>

      <div className="game-content">

        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <div className="player-card">
            <div className="player-name">{authUser?.username}</div>
            <div className="player-level">Level {stats.level}</div>

            <div className="stat-bar">
              <div className="stat-bar-header">
                <label>Life</label>
                <span>{stats.life}/{stats.maxLife}</span>
              </div>
              <progress value={stats.life} max={stats.maxLife} />
            </div>

            <div className="stat-bar">
              <div className="stat-bar-header">
                <label>Nerve</label>
                <span>{stats.nerve}/{stats.maxNerve}</span>
              </div>
              <progress value={stats.nerve} max={stats.maxNerve} />
            </div>
          </div>

          {/* ── Nav ── */}
          <nav className="sidebar-nav">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* ── Main Content ── */}
        <main className="main-content">
          {children}
        </main>

      </div>
    </div>
  );
}
