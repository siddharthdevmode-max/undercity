import { useState, useEffect, useCallback, useRef } from "react";
import Shell from "../components/Shell";
import { Modal } from "../components/ui/Modal";
import { toast } from "../utils/toast";
import type {
  AdminStats,
  CheaterUser,
  MultiAccountGroup,
  EarningsAnomaly,
  FullUserProfile,
} from "../services/admin";
import { adminAPI } from "../services/admin";
import { announcementsAPI, type Announcement } from "../services/announcements";
import { gameConfigAPI, type GameConfigEntry } from "../services/gameConfig";
import "../styles/Admin.css";

type TabType = "cheaters" | "multi" | "earnings" | "announcements" | "config";

function getTrustBadgeClass(score: number, isShadow: boolean, isHard: boolean): string {
  if (isHard) return "banned";
  if (isShadow) return "shadow";
  if (score < 20) return "shadow";
  if (score < 40) return "suspicious";
  if (score < 70) return "watched";
  return "clean";
}

function getTrustLabel(score: number, isShadow: boolean, isHard: boolean): string {
  if (isHard) return "BANNED";
  if (isShadow) return "SHADOW";
  if (score < 20) return "SHADOW";
  if (score < 40) return "SUSPICIOUS";
  if (score < 70) return "WATCHED";
  return "CLEAN";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function truncateUid(uid: string): string {
  return uid.substring(0, 8) + "...";
}

export default function Admin() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [cheaters, setCheaters] = useState<CheaterUser[]>([]);
  const [multiGroups, setMultiGroups] = useState<MultiAccountGroup[]>([]);
  const [earnings, setEarnings] = useState<EarningsAnomaly[]>([]);
  const [announcementList, setAnnouncementList] = useState<Announcement[]>([]);
  const [configEntries, setConfigEntries] = useState<GameConfigEntry[]>([]);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("cheaters");

  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<FullUserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsData, cheatersData, multiData, earningsData, annData, configData] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getCheaters(),
        adminAPI.getMultiAccounts(),
        adminAPI.getEarningsAnomalies(),
        announcementsAPI.getAll(),
        gameConfigAPI.getAll(),
      ]);
      setStats(statsData);
      setCheaters(cheatersData.users);
      setMultiGroups(multiData.groups);
      setEarnings(earningsData.anomalies);
      setAnnouncementList(annData.announcements);
      setConfigEntries(configData.config);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }, []);

  // Use ref to call loadData from effect without lint violation
  const loadDataRef = useRef(loadData);
  useEffect(() => {
    loadDataRef.current = loadData;
  }, [loadData]);

  useEffect(() => {
    void loadDataRef.current();
  }, []);

  const openUserProfile = async (uid: string) => {
    setSelectedUid(uid);
    setProfileLoading(true);
    setUserProfile(null);
    try {
      const profile = await adminAPI.getFullUserProfile(uid);
      setUserProfile(profile);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load user");
      setSelectedUid(null);
    } finally {
      setProfileLoading(false);
    }
  };

  const closeProfile = () => {
    setSelectedUid(null);
    setUserProfile(null);
  };

  const handleUnban = async (uid: string) => {
    setActionLoading(uid);
    try {
      await adminAPI.unbanUser(uid);
      toast.success("User unbanned");
      await loadData();
      if (selectedUid === uid) {
        const profile = await adminAPI.getFullUserProfile(uid);
        setUserProfile(profile);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unban failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleShadowBan = async (uid: string) => {
    setActionLoading(uid);
    try {
      await adminAPI.shadowBanUser(uid);
      toast.success("User shadow-banned");
      await loadData();
      if (selectedUid === uid) {
        const profile = await adminAPI.getFullUserProfile(uid);
        setUserProfile(profile);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Shadow ban failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRunRecovery = async () => {
    setActionLoading("recovery");
    try {
      const result = await adminAPI.runTrustRecovery();
      toast.success(`Recovery: ${result.recovered} users restored`);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Recovery failed");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <Shell>
        <div className="admin-container">
          <div className="admin-loading">
            <div className="admin-spinner" />
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="admin-container">
        {/* Header */}
        <div className="admin-header">
          <h1 className="admin-title">🛡️ UAC War Room</h1>
          <div className="admin-actions">
            <button
              className="admin-btn admin-btn-primary"
              onClick={() => void loadData()}
              disabled={!!actionLoading}
            >
              🔄 Refresh
            </button>
            <button
              className="admin-btn admin-btn-success"
              onClick={() => void handleRunRecovery()}
              disabled={!!actionLoading}
            >
              {actionLoading === "recovery" ? "..." : "🩹 Run Trust Recovery"}
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="admin-stats-grid">
            <div className="admin-stat-card">
              <div className="admin-stat-value">{stats.total_users}</div>
              <div className="admin-stat-label">Total Users</div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-value danger">{stats.hard_banned}</div>
              <div className="admin-stat-label">Hard Banned</div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-value warning">{stats.shadow_banned}</div>
              <div className="admin-stat-label">Shadow Banned</div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-value warning">{stats.suspicious}</div>
              <div className="admin-stat-label">Suspicious</div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-value">{stats.total_violations}</div>
              <div className="admin-stat-label">Total Violations</div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-value danger">{stats.violations_24h}</div>
              <div className="admin-stat-label">Last 24h</div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="admin-tabs">
          <button
            className={`admin-tab ${activeTab === "cheaters" ? "active" : ""}`}
            onClick={() => setActiveTab("cheaters")}
          >
            🚨 Flagged Users ({cheaters.length})
          </button>
          <button
            className={`admin-tab ${activeTab === "multi" ? "active" : ""}`}
            onClick={() => setActiveTab("multi")}
          >
            👥 Multi-Accounts ({multiGroups.length})
          </button>
          <button
            className={`admin-tab ${activeTab === "earnings" ? "active" : ""}`}
            onClick={() => setActiveTab("earnings")}
          >
            💰 Earnings Anomalies ({earnings.length})
          </button>
          <button
            className={`admin-tab ${activeTab === "announcements" ? "active" : ""}`}
            onClick={() => setActiveTab("announcements")}
          >
            📢 Announcements ({announcementList.length})
          </button>
          <button
            className={`admin-tab ${activeTab === "config" ? "active" : ""}`}
            onClick={() => setActiveTab("config")}
          >
            ⚙️ Game Config ({configEntries.length})
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "cheaters" && (
          <div className="admin-table-wrapper">
            {cheaters.length === 0 ? (
              <div className="admin-empty">
                <div className="admin-empty-icon">✨</div>
                <p>No flagged users — all clean!</p>
              </div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>UID</th>
                    <th>Trust</th>
                    <th>Flags</th>
                    <th>Status</th>
                    <th>Last Flag</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cheaters.map((u) => (
                    <tr key={u.firebase_uid}>
                      <td>
                        <button
                          className="admin-btn"
                          style={{ background: "none", padding: 0, color: "var(--accent-primary)" }}
                          onClick={() => void openUserProfile(u.firebase_uid)}
                        >
                          {u.username}
                        </button>
                      </td>
                      <td style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
                        {truncateUid(u.firebase_uid)}
                      </td>
                      <td>
                        <span className={`trust-badge ${getTrustBadgeClass(u.trust_score, u.is_shadow_banned, u.is_hard_banned)}`}>
                          {u.trust_score} — {getTrustLabel(u.trust_score, u.is_shadow_banned, u.is_hard_banned)}
                        </span>
                      </td>
                      <td>{u.total_flags}</td>
                      <td>{u.last_flag_reason ?? "—"}</td>
                      <td style={{ fontSize: "0.75rem" }}>{formatDate(u.last_flag_at)}</td>
                      <td>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          {(u.is_shadow_banned || u.is_hard_banned || u.trust_score < 100) && (
                            <button
                              className="admin-btn admin-btn-success"
                              onClick={() => void handleUnban(u.firebase_uid)}
                              disabled={actionLoading === u.firebase_uid}
                            >
                              {actionLoading === u.firebase_uid ? "..." : "✓ Unban"}
                            </button>
                          )}
                          {!u.is_shadow_banned && !u.is_hard_banned && (
                            <button
                              className="admin-btn admin-btn-warning"
                              onClick={() => void handleShadowBan(u.firebase_uid)}
                              disabled={actionLoading === u.firebase_uid}
                            >
                              {actionLoading === u.firebase_uid ? "..." : "👻 Shadow"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "multi" && (
          <div className="admin-table-wrapper">
            {multiGroups.length === 0 ? (
              <div className="admin-empty">
                <div className="admin-empty-icon">👤</div>
                <p>No multi-account clusters detected</p>
              </div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Fingerprint</th>
                    <th>Accounts</th>
                    <th>UIDs</th>
                    <th>Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {multiGroups.map((g) => (
                    <tr key={g.fingerprint_hash}>
                      <td style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
                        {g.fingerprint_hash.substring(0, 16)}...
                      </td>
                      <td>
                        <span className="trust-badge suspicious">{g.account_count}</span>
                      </td>
                      <td>
                        <div className="linked-accounts-list">
                          {g.uids.slice(0, 5).map((uid) => (
                            <button
                              key={uid}
                              className="linked-account-tag"
                              onClick={() => void openUserProfile(uid)}
                              style={{ cursor: "pointer", border: "none" }}
                            >
                              {truncateUid(uid)}
                            </button>
                          ))}
                          {g.uids.length > 5 && (
                            <span className="linked-account-tag">+{g.uids.length - 5} more</span>
                          )}
                        </div>
                      </td>
                      <td style={{ fontSize: "0.75rem" }}>{formatDate(g.last_active)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "earnings" && (
          <div className="admin-table-wrapper">
            {earnings.length === 0 ? (
              <div className="admin-empty">
                <div className="admin-empty-icon">💸</div>
                <p>No earnings anomalies detected</p>
              </div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>UID</th>
                    <th>Severity</th>
                    <th>Details</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {earnings.map((e, i) => (
                    <tr key={`${e.firebase_uid}-${i}`}>
                      <td>
                        <button
                          className="admin-btn"
                          style={{ background: "none", padding: 0, color: "var(--accent-primary)" }}
                          onClick={() => void openUserProfile(e.firebase_uid)}
                        >
                          {e.username ?? "Unknown"}
                        </button>
                      </td>
                      <td style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
                        {truncateUid(e.firebase_uid)}
                      </td>
                      <td>
                        <span className="trust-badge suspicious">{e.severity}</span>
                      </td>
                      <td style={{ fontSize: "0.75rem" }}>
                        {typeof e.details.multiplier === "number" && `${e.details.multiplier}x avg`}
                        {typeof e.details.current_hour_earnings === "number" &&
                          ` ($${e.details.current_hour_earnings.toLocaleString()}/hr)`}
                      </td>
                      <td style={{ fontSize: "0.75rem" }}>{formatDate(e.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "announcements" && (
          <div className="admin-table-wrapper">
            <div style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem" }}>
              <button className="admin-btn admin-btn-primary" onClick={async () => {
                const title = prompt("Announcement title:");
                if (!title) return;
                const body = prompt("Announcement body:");
                if (!body) return;
                const priority = prompt("Priority (low/normal/high/critical):", "normal");
                if (priority && !["low","normal","high","critical"].includes(priority)) return;
                try {
                  await announcementsAPI.create({ title, body, priority: priority || "normal" });
                  toast.success("Announcement created");
                  const data = await announcementsAPI.getAll();
                  setAnnouncementList(data.announcements);
                } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
              }}>
                + New Announcement
              </button>
            </div>
            {announcementList.length === 0 ? (
              <div className="admin-empty">
                <div className="admin-empty-icon">📢</div>
                <p>No announcements yet</p>
              </div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {announcementList.map((a) => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600 }}>{a.title}</td>
                      <td><span className={`trust-badge ${a.priority === "critical" ? "banned" : a.priority === "high" ? "suspicious" : ""}`}>{a.priority}</span></td>
                      <td>{a.active ? "✅ Active" : "⛔ Hidden"}</td>
                      <td style={{ fontSize: "0.75rem" }}>{formatDate(a.created_at)}</td>
                      <td>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button className="admin-btn admin-btn-primary" onClick={async () => {
                            try {
                              await announcementsAPI.update(a.id, { active: !a.active });
                              toast.success(a.active ? "Hidden" : "Activated");
                              const data = await announcementsAPI.getAll();
                              setAnnouncementList(data.announcements);
                            } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
                          }}>
                            {a.active ? "Hide" : "Show"}
                          </button>
                          <button className="admin-btn admin-btn-danger" onClick={async () => {
                            if (!confirm(`Delete "${a.title}"?`)) return;
                            try {
                              await announcementsAPI.delete(a.id);
                              toast.success("Deleted");
                              const data = await announcementsAPI.getAll();
                              setAnnouncementList(data.announcements);
                            } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
                          }}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "config" && (
          <div className="admin-table-wrapper">
            {configEntries.length === 0 ? (
              <div className="admin-empty">
                <div className="admin-empty-icon">⚙️</div>
                <p>No config entries</p>
              </div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Value</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {configEntries.map((entry) => (
                    <tr key={entry.key}>
                      <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{entry.key}</td>
                      <td style={{ fontFamily: "monospace", fontSize: "0.8rem", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{entry.value}</td>
                      <td><span className="trust-badge clean">{entry.type}</span></td>
                      <td style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>{entry.description}</td>
                      <td>
                        <button className="admin-btn admin-btn-primary" onClick={async () => {
                          const raw = prompt(`New value for "${entry.key}":`, entry.value);
                          if (raw === null) return;
                          let parsed: unknown = raw;
                          if (entry.type === "number") parsed = parseFloat(raw);
                          else if (entry.type === "boolean") parsed = raw === "true";
                          try {
                            await gameConfigAPI.update(entry.key, parsed);
                            toast.success("Config updated");
                            const data = await gameConfigAPI.getAll();
                            setConfigEntries(data.config);
                          } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
                        }}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      <Modal
        isOpen={!!selectedUid}
        onClose={closeProfile}
        title={userProfile?.user.username ?? "Loading..."}
        titleId="user-profile-modal"
        className="user-profile-modal"
      >
        {profileLoading ? (
          <div className="admin-loading">
            <div className="admin-spinner" />
          </div>
        ) : userProfile ? (
          <div>
            {/* Basic Info */}
            <div className="user-detail-section">
              <h3>👤 Basic Info</h3>
              <div className="user-detail-grid">
                <div className="user-detail-item">
                  <label>Level</label>
                  <span>{userProfile.user.level}</span>
                </div>
                <div className="user-detail-item">
                  <label>Money</label>
                  <span>${userProfile.user.money.toLocaleString()}</span>
                </div>
                <div className="user-detail-item">
                  <label>Points</label>
                  <span>{userProfile.user.points}</span>
                </div>
                <div className="user-detail-item">
                  <label>Trust Score</label>
                  <span className={`trust-badge ${getTrustBadgeClass(userProfile.user.trust_score, userProfile.user.is_shadow_banned, userProfile.user.is_hard_banned)}`}>
                    {userProfile.user.trust_score}
                  </span>
                </div>
                <div className="user-detail-item">
                  <label>Total Flags</label>
                  <span>{userProfile.user.total_flags}</span>
                </div>
                <div className="user-detail-item">
                  <label>Joined</label>
                  <span style={{ fontSize: "0.75rem" }}>{formatDate(userProfile.user.created_at)}</span>
                </div>
              </div>
            </div>

            {/* Linked Accounts */}
            {userProfile.linkedAccounts.length > 0 && (
              <div className="user-detail-section">
                <h3>🔗 Linked Accounts ({userProfile.linkedAccounts.length})</h3>
                <div className="linked-accounts-list">
                  {userProfile.linkedAccounts.map((uid) => (
                    <button
                      key={uid}
                      className="linked-account-tag"
                      onClick={() => void openUserProfile(uid)}
                      style={{ cursor: "pointer", border: "none" }}
                    >
                      {truncateUid(uid)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Violations */}
            <div className="user-detail-section">
              <h3>🚨 Recent Violations ({userProfile.violations.length})</h3>
              {userProfile.violations.length === 0 ? (
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>No violations</p>
              ) : (
                <div className="admin-table-wrapper violations-mini">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Severity</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userProfile.violations.slice(0, 10).map((v, i) => (
                        <tr key={i}>
                          <td>{v.violation_type}</td>
                          <td><span className="trust-badge suspicious">{v.severity}</span></td>
                          <td style={{ fontSize: "0.75rem" }}>{formatDate(v.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="user-detail-section">
              <h3>⚡ Actions</h3>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                {(userProfile.user.is_shadow_banned ||
                  userProfile.user.is_hard_banned ||
                  userProfile.user.trust_score < 100) && (
                  <button
                    className="admin-btn admin-btn-success"
                    onClick={() => void handleUnban(userProfile.user.firebase_uid)}
                    disabled={!!actionLoading}
                  >
                    {actionLoading === userProfile.user.firebase_uid
                      ? "..."
                      : "✓ Unban & Restore Trust"}
                  </button>
                )}
                {!userProfile.user.is_shadow_banned && !userProfile.user.is_hard_banned && (
                  <button
                    className="admin-btn admin-btn-warning"
                    onClick={() => void handleShadowBan(userProfile.user.firebase_uid)}
                    disabled={!!actionLoading}
                  >
                    {actionLoading === userProfile.user.firebase_uid ? "..." : "👻 Shadow Ban"}
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </Shell>
  );
}
