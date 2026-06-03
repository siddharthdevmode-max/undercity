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

const NAV_SECTIONS = [
  {
    label: "CORE",
    items: [
      { path: '/home',       label: '🏠 Home'         },
      { path: '/crimes',     label: '🔫 Crimes'       },
      { path: '/inventory',  label: '🎒 Inventory'    },
    ],
  },
  {
    label: "CITY",
    items: [
      { path: '/city',       label: '🏙️ City'         },
      { path: '/gym',        label: '💪 Gym'           },
      { path: '/hospital',   label: '🏥 Hospital'     },
      { path: '/travel',     label: '✈️ Travel'        },
    ],
  },
  {
    label: "WORK",
    items: [
      { path: '/job',        label: '💼 Job'           },
      { path: '/company',    label: '🏭 Company'      },
      { path: '/properties', label: '🏢 Properties'   },
    ],
  },
  {
    label: "ECONOMY",
    items: [
      { path: '/casino',       label: '🎰 Casino'       },
      { path: '/black-market', label: '🕶️ Black Market' },
    ],
  },
  {
    label: "SOCIAL",
    items: [
      { path: '/faction',      label: '⚔️ Faction'      },
      { path: '/faction-link', label: '🔗 Faction Link' },
      { path: '/forum',        label: '💬 Forum'        },
    ],
  },
  {
    label: "INFO",
    items: [
      { path: '/events',     label: '📅 Events'       },
      { path: '/newspaper',  label: '📰 Newspaper'    },
      { path: '/calendar',   label: '🗓️ Calendar'     },
    ],
  },
  {
    label: "STATUS",
    items: [
      { path: '/jail',         label: '🔒 Jail'         },
      { path: '/federal-jail', label: '🏛️ Federal Jail' },
    ],
  },
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
          <span className="username">{authUser?.username}</span>
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
          {/* Player Card */}
          <div className="player-card">
            <div className="player-name">{authUser?.username}</div>
            <div className="player-level">Level {stats.level}</div>
            <div className="stat-bar">
              <div className="stat-bar-header">
                <label htmlFor="life-progress">Life</label>
                <span>{stats.life}/{stats.maxLife}</span>
              </div>
              <progress id="life-progress" value={stats.life} max={stats.maxLife} />
            </div>
            <div className="stat-bar">
              <div className="stat-bar-header">
                <label htmlFor="nerve-progress">Nerve</label>
                <span>{stats.nerve}/{stats.maxNerve}</span>
              </div>
              <progress id="nerve-progress" value={stats.nerve} max={stats.maxNerve} />
            </div>
          </div>

          {/* Sectioned Nav */}
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
                    {item.label}
                  </Link>
                ))}
              </div>
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
