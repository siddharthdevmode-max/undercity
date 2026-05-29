import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from '../types';
import { authAPI } from '../services/api';
import '../styles/Home.css';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await authAPI.getMe();
        setUser(res);
      } catch (err) {
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  if (loading) return <div className="container">Loading...</div>;

  return (
    <div className="game-shell">
      <header className="game-header">
        <div className="logo">UNDERCITY</div>
        <div className="user-info">
          <span>{user?.username}</span>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </header>

      <div className="game-content">
        <aside className="sidebar">
          <div className="player-card">
            <div className="player-stat">
              <label>Level</label>
              <span>{user?.level}</span>
            </div>
            <div className="player-stat">
              <label>Money</label>
              <span>${user?.money}</span>
            </div>
            <div className="stat-bar">
              <label>Energy</label>
              <progress value={user?.energy} max={user?.max_energy} />
              <span>{user?.energy}/{user?.max_energy}</span>
            </div>
            <div className="stat-bar">
              <label>Life</label>
              <progress value={user?.life} max={user?.max_life} />
              <span>{user?.life}/{user?.max_life}</span>
            </div>
            <div className="stat-bar">
              <label>Nerve</label>
              <progress value={user?.nerve} max={user?.max_nerve} />
              <span>{user?.nerve}/{user?.max_nerve}</span>
            </div>
          </div>

          <nav className="sidebar-nav">
            <a href="/home" className="nav-item active">
              Home
            </a>
            <a href="/city" className="nav-item">
              City
            </a>
            <a href="/crimes" className="nav-item">
              Crimes
            </a>
            <a href="/job" className="nav-item">
              Job
            </a>
            <a href="/gym" className="nav-item">
              Gym
            </a>
            <a href="/properties" className="nav-item">
              Properties
            </a>
            <a href="/missions" className="nav-item">
              Missions
            </a>
          </nav>
        </aside>

        <main className="main-content">
          <h1>Welcome, {user?.username}!</h1>
          <div className="dashboard">
            <div className="card">
              <h3>Battle Stats</h3>
              <table>
                <tbody>
                  <tr>
                    <td>Strength</td>
                    <td>{user?.strength}</td>
                  </tr>
                  <tr>
                    <td>Defense</td>
                    <td>{user?.defense}</td>
                  </tr>
                  <tr>
                    <td>Speed</td>
                    <td>{user?.speed}</td>
                  </tr>
                  <tr>
                    <td>Dexterity</td>
                    <td>{user?.dexterity}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="card">
              <h3>Quick Stats</h3>
              <table>
                <tbody>
                  <tr>
                    <td>Experience</td>
                    <td>{user?.experience}</td>
                  </tr>
                  <tr>
                    <td>Points</td>
                    <td>{user?.points}</td>
                  </tr>
                  <tr>
                    <td>Status</td>
                    <td>{user?.status}</td>
                  </tr>
                  <tr>
                    <td>Happiness</td>
                    <td>{user?.happiness}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
