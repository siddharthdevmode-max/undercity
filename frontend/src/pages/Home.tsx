import { useAuth } from '../hooks/useAuth';
import Shell from '../components/Shell';

export default function Home() {
  const { user } = useAuth();

  return (
    <Shell>
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
            <a href="/crimes" className="action-btn">Commit Crime</a>
            <a href="/gym" className="action-btn">Train</a>
            <a href="/city" className="action-btn">Explore City</a>
          </div>
        </div>
      </div>
    </Shell>
  );
}
