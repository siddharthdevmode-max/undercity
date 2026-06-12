import { useState } from "react";
import Shell from "../components/Shell";
import Icon from "../components/ui/Icon";
import { useAuth } from "../hooks/useAuth";
import "../styles/PublicRecords.css";

interface RecordEntry {
  label: string;
  value: string | number;
  icon: string;
  color: string;
}

export default function PublicRecords() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<string>("personal");

  const personalRecords: RecordEntry[] = [
    { label: "Crimes Committed", value: 0, icon: "crime", color: "var(--accent)" },
    { label: "Attacks Won", value: 0, icon: "attack", color: "var(--color-success)" },
    { label: "Attacks Lost", value: 0, icon: "attack", color: "var(--color-error)" },
    { label: "Times Hospitalized", value: 0, icon: "hospital", color: "var(--color-error)" },
    { label: "Times Jailed", value: 0, icon: "jail", color: "var(--color-warning)" },
    { label: "Missions Completed", value: 0, icon: "missions", color: "var(--accent)" },
    { label: "Properties Owned", value: 0, icon: "properties", color: "var(--color-success)" },
    { label: "Forum Posts", value: 0, icon: "forum", color: "var(--text-secondary)" },
    { label: "Referrals", value: 0, icon: "handshake", color: "var(--color-success)" },
    { label: "Total Money Earned", value: "$0", icon: "money", color: "var(--color-success)" },
  ];

  const hallOfFame = Array.from({ length: 100 }, (_, i) => ({
    rank: i + 1,
    name: "---",
    level: 0,
    respect: 0,
  }));

  return (
    <Shell>
      <div className="pr-container">
        <div className="pr-header">
          <h1 className="pr-title"><Icon name="public-records" size={26} className="icon-accent" /> Public Records</h1>
          <p className="pr-desc">Background checks, arrest records, and city statistics.</p>
        </div>

        <div className="pr-tabs">
          {(["personal", "hall-of-fame", "city-stats", "search"]).map((t) => (
            <button key={t} className={`pr-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
              {t === "personal" && <Icon name="player" size={14} />}
              {t === "hall-of-fame" && <Icon name="contributor" size={14} />}
              {t === "city-stats" && <Icon name="chart" size={14} />}
              {t === "search" && <Icon name="shield" size={14} />}
              <span>{t.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}</span>
            </button>
          ))}
        </div>

        <div className="pr-content">
          {tab === "personal" && (
            <div className="pr-personal">
              <h2 className="pr-section-title">
                <Icon name="player" size={18} className="icon-accent" />
                {user?.username ?? "Player"}&apos;s Record
              </h2>
              <div className="pr-grid">
                {personalRecords.map((rec) => (
                  <div key={rec.label} className="pr-card">
                    <Icon name={rec.icon} size={22} style={{ color: rec.color }} />
                    <span className="pr-card-label">{rec.label}</span>
                    <span className="pr-card-value">{rec.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "hall-of-fame" && (
            <div className="pr-hof">
              <h2 className="pr-section-title">
                <Icon name="contributor" size={18} className="icon-accent" />
                Hall of Fame
              </h2>
              <p className="pr-section-desc">The most feared and respected players in Undercity.</p>
              <div className="pr-hof-list">
                <div className="pr-hof-header">
                  <span className="pr-hof-col pr-hof-rank">Rank</span>
                  <span className="pr-hof-col pr-hof-name">Name</span>
                  <span className="pr-hof-col pr-hof-level">Level</span>
                  <span className="pr-hof-col pr-hof-respect">Respect</span>
                </div>
                {hallOfFame.map((entry) => (
                  <div key={entry.rank} className="pr-hof-row">
                    <span className="pr-hof-col pr-hof-rank">#{entry.rank}</span>
                    <span className="pr-hof-col pr-hof-name">{entry.name}</span>
                    <span className="pr-hof-col pr-hof-level">{entry.level}</span>
                    <span className="pr-hof-col pr-hof-respect">{entry.respect.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "city-stats" && (
            <div className="pr-stats">
              <h2 className="pr-section-title">
                <Icon name="chart" size={18} className="icon-accent" />
                City Statistics
              </h2>
              <p className="pr-section-desc">Live overview of Undercity activity.</p>
              <div className="pr-grid">
                <div className="pr-card"><Icon name="player" size={22} className="icon-accent" /><span className="pr-card-label">Registered Players</span><span className="pr-card-value">0</span></div>
                <div className="pr-card"><Icon name="crime" size={22} className="icon-accent" /><span className="pr-card-label">Crimes Today</span><span className="pr-card-value">0</span></div>
                <div className="pr-card"><Icon name="attack" size={22} className="icon-accent" /><span className="pr-card-label">Attacks Today</span><span className="pr-card-value">0</span></div>
                <div className="pr-card"><Icon name="money" size={22} className="icon-accent" /><span className="pr-card-label">Total Money</span><span className="pr-card-value">$0</span></div>
                <div className="pr-card"><Icon name="casino" size={22} className="icon-accent" /><span className="pr-card-label">Casino Bets Today</span><span className="pr-card-value">0</span></div>
                <div className="pr-card"><Icon name="gang" size={22} className="icon-accent" /><span className="pr-card-label">Active Gangs</span><span className="pr-card-value">0</span></div>
              </div>
            </div>
          )}

          {tab === "search" && (
            <div className="pr-search">
              <h2 className="pr-section-title">
                <Icon name="shield" size={18} className="icon-accent" />
                Player Lookup
              </h2>
              <p className="pr-section-desc">Search for a player's public record.</p>
              <div className="pr-search-row">
                <input
                  className="pr-search-input"
                  type="text"
                  placeholder="Enter username..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") setSearch(search.trim()); }}
                />
                <button className="pr-search-btn" disabled={!search.trim()}>Search</button>
              </div>
              {search && (
                <div className="pr-search-empty">
                  <Icon name="construction" size={40} className="icon-accent" />
                  <p>Player records will be available once the database is populated.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
