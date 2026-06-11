import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import Shell from "../components/Shell";
import Icon from "../components/ui/Icon";
import { Skeleton } from "../components/ui/Skeleton";
import { profileAPI } from "../services/profile";
import type { ProfileResponse } from "../services/profile";
import { toast } from "../utils/toast";
import "../styles/Profile.css";

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  const mins = Math.floor(diff / 60000);
  return `${mins}m ago`;
}

function successRate(attempts: number, successes: number): string {
  if (attempts === 0) return "0%";
  return `${Math.round((successes / attempts) * 100)}%`;
}

export default function Profile() {
  const { username } = useParams<{ username: string }>();
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRef = useRef<() => void>(() => {});
  const load = useCallback(() => {
    if (!username) return;
    setError(null);
    setLoading(true);
    profileAPI.get(username)
      .then(setData)
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Failed to load profile";
        setError(msg); toast.error(msg);
      })
      .finally(() => setLoading(false));
  }, [username]);
  useEffect(() => { loadRef.current = load; }, [load]);
  useEffect(() => { loadRef.current(); }, [username]);

  if (loading) {
    return (
      <Shell>
        <div className="profile-container">
          <div className="profile-header"><h1 className="profile-title"><Icon name="profile" size={28} className="icon-accent" /> Profile</h1></div>
          <div className="profile-skeleton"><Skeleton width={300} height={4} /></div>
        </div>
      </Shell>
    );
  }

  if (error || !data) {
    return (
      <Shell>
        <div className="profile-error" role="alert">
          <p>{error ?? "Player not found"}</p>
          <button className="profile-retry-btn" onClick={load}>Retry</button>
        </div>
      </Shell>
    );
  }

  const { user, crimeStats, topCrime } = data;

  return (
    <Shell>
      <div className="profile-container">
        <div className="profile-card">
          <div className="profile-avatar">
            <Icon name="player" size={48} className="icon-accent" />
          </div>
          <div className="profile-info">
            <h1 className="profile-username">{user.username}</h1>
            <span className="profile-level">Level {user.level}</span>
            <span className="profile-joined">Joined {formatDate(user.created_at)}</span>
          </div>
        </div>

        <div className="profile-stats-grid">
          <div className="profile-stat-card">
            <Icon name="money" size={20} className="icon-accent" />
            <span className="profile-stat-label">Cash</span>
            <span className="profile-stat-value">{formatMoney(user.money)}</span>
          </div>
          <div className="profile-stat-card">
            <Icon name="points" size={20} className="icon-accent" />
            <span className="profile-stat-label">Honor</span>
            <span className="profile-stat-value">{user.points.toLocaleString()}</span>
          </div>
          <div className="profile-stat-card">
            <Icon name="nerve" size={20} className="icon-accent" />
            <span className="profile-stat-label">Nerve</span>
            <span className="profile-stat-value">{user.nerve}/{user.max_nerve}</span>
          </div>
          <div className="profile-stat-card">
            <Icon name="life" size={20} className="icon-error" />
            <span className="profile-stat-label">Life</span>
            <span className="profile-stat-value">{user.life}/{user.max_life}</span>
          </div>
        </div>

        <div className="profile-section">
          <h2 className="profile-section-title">Crime Statistics</h2>
          <div className="profile-crime-stats">
            <div className="profile-crime-row">
              <span className="profile-crime-label">Total Attempts</span>
              <span className="profile-crime-value">{crimeStats.total_attempts.toLocaleString()}</span>
            </div>
            <div className="profile-crime-row">
              <span className="profile-crime-label">Successes</span>
              <span className="profile-crime-value profile-crime-success">{crimeStats.total_successes.toLocaleString()}</span>
            </div>
            <div className="profile-crime-row">
              <span className="profile-crime-label">Failures</span>
              <span className="profile-crime-value profile-crime-fail">{crimeStats.total_failures.toLocaleString()}</span>
            </div>
            <div className="profile-crime-row">
              <span className="profile-crime-label">Success Rate</span>
              <span className="profile-crime-value">{successRate(crimeStats.total_attempts, crimeStats.total_successes)}</span>
            </div>
            {topCrime && (
              <div className="profile-crime-row">
                <span className="profile-crime-label">Favorite Crime</span>
                <span className="profile-crime-value">{topCrime.name} ({topCrime.attempts}x)</span>
              </div>
            )}
          </div>
        </div>

        <div className="profile-section">
          <h2 className="profile-section-title">Activity</h2>
          <div className="profile-activity">
            <div className="profile-crime-row">
              <span className="profile-crime-label">Last Seen</span>
              <span className="profile-crime-value">{formatDate(user.last_seen_at)}</span>
            </div>
            {user.last_crime_at && (
              <div className="profile-crime-row">
                <span className="profile-crime-label">Last Crime</span>
                <span className="profile-crime-value">{formatDate(user.last_crime_at)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}
