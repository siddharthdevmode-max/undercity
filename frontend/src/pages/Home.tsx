import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getAuth, signOut, onAuthStateChanged } from 'firebase/auth';
import type { User } from '../types';
import { authAPI } from '../services/api';
import '../styles/Home.css';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const auth = getAuth();

  useEffect(() => {
    // Wait for Firebase to initialize before checking auth state
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        // No Firebase session — go to login
        navigate('/login');
        return;
      }

      try {
        // Firebase session exists — get player data from our DB
        const data = await authAPI.getMe();
        setUser(data);
      } catch (err) {
        navigate('/login');
      } finally {
        setLoading(false);
      }
    });

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [navigate]);

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

  return (
    <div className="game-shell">
      {/* Top Header Bar */}
      <header className="game-header">
        <div className="logo">UNDERCITY</div>
        <div className="header-stats">
          <span className="header-stat">
            💰 ${Number(user?.money).toLocaleString()}
          </span>
          <span className="header-stat">
            ⚡ {user?.energy}/{user?.max_energy}
          </span>
          <span className="header-stat">
            ❤️ {user?.life}/{user?.max_life}
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

          {/* Nav Links — React Router Link (no page reload) */}
          <nav className="sidebar-nav">
            <Link to="/home" className="nav-item active">🏠 Home</Link>
            <Link to="/city" className="nav-item">🏙️ City</Link>
            <Link to="/crimes" className="nav-item">🔫 Crimes</Link>
            <Link to="/job" className="nav-item">💼 Job</Link>
            <Link to="/gym" className="nav-item">💪 Gym</Link>
            <Link to="/properties" className="nav-item">🏢 Properties</Link>
            <Link to="/missions" className="nav-item">📋 Missions</Link>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          <h1>Welcome back, <span className="highlight">{user?.username}</span></h1>

          <div className="dashboard">
            <div className="card">
              <h3>⚔️ Battle Stats</h3>
              <table>
                <tbody>
                  <tr><td>Strength</td><td>{user?.strength}</td></tr>
                  <tr><td>Defense</td><td>{user?.defense}</td></tr>
                  <tr><td>Speed</td><td>{user?.speed}</td></tr>
                  <tr><td>Dexterity</td><td>{user?.dexterity}</td></tr>
                </tbody>
              </table>
            </div>

            <div className="card">
              <h3>📊 Quick Stats</h3>
              <table>
                <tbody>
                  <tr><td>Experience</td><td>{user?.experience}</td></tr>
                  <tr><td>Points</td><td>{user?.points}</td></tr>
                  <tr><td>Happiness</td><td>{user?.happiness}%</td></tr>
                  <tr>
                    <td>Status</td>
                    <td className={`status-${user?.status}`}>{user?.status}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="card">
              <h3>🚀 Quick Actions</h3>
              <div className="quick-actions">
                <Link to="/crimes" className="action-btn">Commit Crime</Link>
                <Link to="/gym" className="action-btn">Train</Link>
                <Link to="/city" className="action-btn">Explore City</Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
