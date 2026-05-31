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
    { path: '/home',       label: '🏠 Home'        },
    { path: '/city',       label: '🏙️ City'        },
    { path: '/crimes',     label: '🔫 Crimes'      },
    { path: '/job',        label: '💼 Job'          },
    { path: '/gym',        label: '💪 Gym'          },
    { path: '/properties', label: '🏢 Properties'  },
    { path: '/missions',   label: '📋 Missions'    },
  ];

  return (
    <div className="game-shell">
      {/* Top Header */}
      <header className="game-header">
        <div className="logo">UNDERCITY</div>

        <div className="header-stats">
          <span className="header-stat">
            💰 ${Number(user?.money ?? 0).toLocaleString()}
          </span>
          <span className="header-stat">
            ⚡ {user?.energy}/{user?.max_energy}
          </span>
          <span className="header-stat">
            ❤️ {user?.life}/{user?.max_life}
          </span>
          <span className="header-stat">
            🧠 {user?.nerve}/{user?.max_nerve}
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
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="player-card">
            <div className="player-name">{user?.username}</div>
            <div className="player-level">Level {user?.level}</div>

            <div className="stat-bar">
              <div className="stat-bar-header">
                <label>Energy</label>
                <span>{user?.energy}/{user?.max_energy}</span>
              </div>
              <progress value={user?.energy} max={user?.max_energy} />
            </div>

            <div className="stat-bar">
              <div className="stat-bar-header">
                <label>Life</label>
                <span>{user?.life}/{user?.max_life}</span>
              </div>
              <progress value={user?.life} max={user?.max_life} />
            </div>

            <div className="stat-bar">
              <div className="stat-bar-header">
                <label>Nerve</label>
                <span>{user?.nerve}/{user?.max_nerve}</span>
              </div>
              <progress value={user?.nerve} max={user?.max_nerve} />
            </div>
          </div>

          {/* Nav */}
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

        {/* Main Content */}
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
