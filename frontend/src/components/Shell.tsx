import '../styles/Home.css';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { useAuth } from '../hooks/useAuth';

interface Props {
  children: React.ReactNode;
}

export default function Shell({ children }: Props) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const auth = getAuth();

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
            💰 ${Number(user?.money ?? 0).toLocaleString()}
          </span>
          <span className="header-stat">
            ❤️ {user?.life ?? 0}/{user?.max_life ?? 100}
          </span>
          <span className="header-stat">
            🧠 {user?.nerve ?? 0}/{user?.max_nerve ?? 30}
          </span>
        </div>

        <div className="user-info">
          <span className="username">{user?.username}</span>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </header>

      <div className="game-content">

        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <div className="player-card">
            <div className="player-name">{user?.username}</div>
            <div className="player-level">Level {user?.level ?? 1}</div>

            <div className="stat-bar">
              <div className="stat-bar-header">
                <label>Life</label>
                <span>{user?.life ?? 0}/{user?.max_life ?? 100}</span>
              </div>
              <progress value={user?.life ?? 0} max={user?.max_life ?? 100} />
            </div>

            <div className="stat-bar">
              <div className="stat-bar-header">
                <label>Nerve</label>
                <span>{user?.nerve ?? 0}/{user?.max_nerve ?? 30}</span>
              </div>
              <progress value={user?.nerve ?? 0} max={user?.max_nerve ?? 30} />
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
