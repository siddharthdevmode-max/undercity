import { useAuth } from '../hooks/useAuth';
import Shell from '../components/Shell';
import { Link } from 'react-router-dom';
import '../styles/Home.css';

// ============================================================
// HOME — Dashboard with real schema fields (camelCase)
// ============================================================

export default function Home() {
  const { user } = useAuth();

  const isInJail = user?.jailUntil
    ? new Date(user.jailUntil) > new Date()
    : false;

  const isInFederalJail = user?.federalJailUntil
    ? new Date(user.federalJailUntil) > new Date()
    : false;

  return (
    <Shell>
      <h1>
        Welcome back,{' '}
        <span className="highlight">{user?.username}</span>
      </h1>

      <div className="dashboard">

        {/* ── Character Stats ── */}
        <div className="card">
          <h3>📊 Character</h3>
          <table aria-label="Character statistics">
            <tbody>
              <tr>
                <td>Level</td>
                <td>{user?.level ?? 1}</td>
              </tr>
              <tr>
                <td>Money</td>
                <td>${(user?.money ?? 0).toLocaleString()}</td>
              </tr>
              <tr>
                <td>Points</td>
                <td>{user?.points ?? 0}</td>
              </tr>
              <tr>
                <td>Status</td>
                <td>
                  {isInFederalJail
                    ? <span className="text-error">🏛️ Federal Jail</span>
                    : isInJail
                    ? <span className="text-error">🔒 In Jail</span>
                    : <span className="text-success">✅ Free</span>
                  }
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Vitals ── */}
        <div className="card">
          <h3>❤️ Vitals</h3>
          <table aria-label="Player vitals">
            <tbody>
              <tr>
                <td>Life</td>
                <td>{user?.life ?? 0} / {user?.maxLife ?? 100}</td>
              </tr>
              <tr>
                <td>Nerve</td>
                <td>{user?.nerve ?? 0} / {user?.maxNerve ?? 30}</td>
              </tr>
              <tr>
                <td>Last Crime</td>
                <td>
                  {user?.lastCrimeAt
                    ? new Date(user.lastCrimeAt).toLocaleTimeString()
                    : 'Never'}
                </td>
              </tr>
              {isInJail && user?.jailUntil && (
                <tr>
                  <td>Released</td>
                  <td className="text-error">
                    {new Date(user.jailUntil).toLocaleTimeString()}
                  </td>
                </tr>
              )}
              {isInFederalJail && user?.federalJailUntil && (
                <tr>
                  <td>Fed Release</td>
                  <td className="text-error">
                    {new Date(user.federalJailUntil).toLocaleTimeString()}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Quick Actions ── */}
        <div className="card">
          <h3>🚀 Quick Actions</h3>
          <div className="quick-actions">
            <Link
              to="/crimes"
              className="action-btn"
              aria-label="Go to crimes page"
            >
              🔫 Commit Crime
            </Link>
            <Link
              to="/gym"
              className="action-btn"
              aria-label="Go to gym page"
            >
              💪 Train at Gym
            </Link>
            <Link
              to="/city"
              className="action-btn"
              aria-label="Go to city page"
            >
              🏙️ Explore City
            </Link>
            {(isInJail || isInFederalJail) && (
              <Link
                to="/jail"
                className="action-btn action-btn-danger"
                aria-label="Go to jail page"
              >
                🔒 View Jail Status
              </Link>
            )}
          </div>
        </div>

      </div>
    </Shell>
  );
}
