import { useState, useEffect, useCallback } from "react";
import Shell from "../components/Shell";
import { crimesAPI } from "../services/crimes";
import type {
  Crime,
  UserStats,
  CrimeAttemptResponse,
} from "../services/crimes";
import "../styles/Crimes.css";

// ════════════════════════════════════════
// TIER COLOR CONFIG
// ════════════════════════════════════════

const TIER_COLORS: Record<number, { glow: string; accent: string }> = {
  1: { glow: "rgba(46,204,113,0.15)", accent: "#2ecc71" },
  2: { glow: "rgba(241,196,15,0.15)", accent: "#f1c40f" },
  3: { glow: "rgba(230,126,34,0.15)", accent: "#e67e22" },
  4: { glow: "rgba(231,76,60,0.15)", accent: "#e74c3c" },
  5: { glow: "rgba(155,89,182,0.15)", accent: "#9b59b6" },
};

// ════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════

function formatTime(seconds: number): string {
  if (seconds <= 0) return "None";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

function getOutcomeStyle(outcome: string) {
  switch (outcome) {
    case "special":
      return { color: "#f39c12", icon: "🌟", label: "SPECIAL DISCOVERY" };
    case "success":
      return { color: "#2ecc71", icon: "✅", label: "SUCCESS" };
    case "fail":
      return { color: "#95a5a6", icon: "❌", label: "FAILED" };
    case "crit_fail":
      return { color: "#e74c3c", icon: "💀", label: "CRITICAL FAILURE" };
    default:
      return { color: "#95a5a6", icon: "❓", label: "UNKNOWN" };
  }
}

function getJailRemaining(jailUntil: string | null): number {
  if (!jailUntil) return 0;
  const remaining = new Date(jailUntil).getTime() - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

function getCrimeLevelLabel(level: number): string {
  if (level === 0) return "Untrained";
  return `Lv. ${level}`;
}

// ════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════

export default function Crimes() {
  const [crimes, setCrimes] = useState<Crime[]>([]);
  const [user, setUser] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attemptError, setAttemptError] = useState<string | null>(null);
  const [attempting, setAttempting] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<CrimeAttemptResponse | null>(null);
  const [jailTimer, setJailTimer] = useState(0);
  const [federalJailTimer, setFederalJailTimer] = useState(0);

  // ── Load crimes ──
  const loadCrimes = useCallback(async () => {
    try {
      setError(null);
      const data = await crimesAPI.getCrimes();
      setCrimes(data.crimes);
      setUser(data.user);
    } catch (err: any) {
      setError(err.message || "Failed to load crimes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCrimes();
  }, [loadCrimes]);

  // ── Jail timer countdown ──
  useEffect(() => {
    if (!user) return;
    const updateTimers = () => {
      setJailTimer(getJailRemaining(user.jailUntil));
      setFederalJailTimer(getJailRemaining(user.federalJailUntil));
    };
    updateTimers();
    const interval = setInterval(updateTimers, 1000);
    return () => clearInterval(interval);
  }, [user]);

  // ── Attempt crime ──
  const handleAttempt = async (crimeKey: string) => {
    if (attempting) return;
    setAttempting(crimeKey);
    setAttemptError(null);

    try {
      const result = await crimesAPI.attemptCrime(crimeKey);
      setOutcome(result);

      setUser((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          money: result.user.money,
          points: result.user.points,
          nerve: result.user.nerve,
          maxNerve: result.user.maxNerve,
          life: result.user.life,
          maxLife: result.user.maxLife,
          jailUntil: result.user.jailUntil,
          federalJailUntil: result.user.federalJailUntil,
          inJail:
            !!result.user.jailUntil &&
            new Date(result.user.jailUntil).getTime() > Date.now(),
          inFederalJail:
            !!result.user.federalJailUntil &&
            new Date(result.user.federalJailUntil).getTime() > Date.now(),
        };
      });

      setCrimes((prev) =>
        prev.map((c) =>
          c.key === crimeKey
            ? { ...c, progress: { ...c.progress, ...result.progress } }
            : c
        )
      );
    } catch (err: any) {
      setAttemptError(err.message || "Something went wrong");
    } finally {
      setAttempting(null);
    }
  };

  const closeOutcome = () => setOutcome(null);

  // ── Loading state ──
  if (loading) {
    return (
      <Shell>
        <div className="crimes-loading">Loading crimes...</div>
      </Shell>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <Shell>
        <div className="crimes-error">
          <p>❌ {error}</p>
          <button className="crimes-retry-btn" onClick={loadCrimes}>
            Retry
          </button>
        </div>
      </Shell>
    );
  }

  const isInJail = jailTimer > 0 || federalJailTimer > 0;

  const sortedCrimes = [...crimes].sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return a.id - b.id;
  });

  return (
    <Shell>
      <div className="crimes-container">
        {/* ── Header with Stats ── */}
        <div className="crimes-header">
          <h1 className="crimes-title">🔪 Crimes</h1>

          {user && (
            <div className="crimes-stats-bar">
              <div className="crimes-stat crimes-stat-nerve">
                <span className="crimes-stat-icon">⚡</span>
                <span className="crimes-stat-label">Nerve</span>
                <span className="crimes-stat-value">
                  {user.nerve}/{user.maxNerve}
                </span>
              </div>
              <div className="crimes-stat crimes-stat-life">
                <span className="crimes-stat-icon">❤️</span>
                <span className="crimes-stat-label">Life</span>
                <span className="crimes-stat-value">
                  {user.life}/{user.maxLife}
                </span>
              </div>
              <div className="crimes-stat crimes-stat-money">
                <span className="crimes-stat-icon">💰</span>
                <span className="crimes-stat-label">Cash</span>
                <span className="crimes-stat-value">
                  {formatMoney(user.money)}
                </span>
              </div>
              <div className="crimes-stat crimes-stat-level">
                <span className="crimes-stat-icon">🎯</span>
                <span className="crimes-stat-label">Level</span>
                <span className="crimes-stat-value">{user.level}</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Attempt Error Banner ── */}
        {attemptError && (
          <div className="crimes-error-banner">
            <span>⚠️ {attemptError}</span>
            <button onClick={() => setAttemptError(null)}>✕</button>
          </div>
        )}

        {/* ── Jail Banner ── */}
        {isInJail && (
          <div className="crimes-jail-banner">
            <div className="crimes-jail-title">
              {federalJailTimer > 0 ? "🏛️ FEDERAL JAIL" : "⛓️ IN JAIL"}
            </div>
            <div className="crimes-jail-time">
              Time remaining:{" "}
              {formatTime(federalJailTimer > 0 ? federalJailTimer : jailTimer)}
            </div>
          </div>
        )}

        {/* ── 5x5 Grid ── */}
        <div className="crimes-grid">
          {sortedCrimes.map((crime) => {
            const tierColor = TIER_COLORS[crime.tier];
            const canAttempt =
              crime.unlocked &&
              !isInJail &&
              user !== null &&
              user.nerve >= crime.nerveCost &&
              !attempting;

            // ── LOCKED CARD ──
            if (!crime.unlocked) {
              return (
                <div
                  key={crime.id}
                  className="crime-card crime-card-locked"
                  style={{ boxShadow: `inset 0 0 30px ${tierColor.glow}` }}
                >
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                    }}
                  >
                    <p className="crime-card-locked-name">???</p>
                    <p className="crime-card-locked-sub">
                      🔒 LEVEL {crime.unlockLevel}
                    </p>
                  </div>
                </div>
              );
            }

            // ── UNLOCKED CARD ──
            return (
              <div
                key={crime.id}
                className="crime-card"
                style={{
                  borderColor: `${tierColor.accent}33`,
                  boxShadow: `inset 0 0 20px ${tierColor.glow}`,
                }}
              >
                {crime.isFederal && (
                  <div className="crime-federal-tag">FED</div>
                )}

                <div>
                  <p className="crime-card-name">{crime.name}</p>
                  <div className="crime-card-meta">
                    <span className="crime-nerve-badge">
                      ⚡ {crime.nerveCost}
                    </span>
                  </div>
                </div>

                <div>
                  <div
                    className="crime-level-text"
                    style={{ color: tierColor.accent }}
                  >
                    {getCrimeLevelLabel(crime.progress.crimeLevel)}
                  </div>
                  <div className="crime-progress-bar">
                    <div
                      className="crime-progress-fill"
                      style={{
                        width: `${Math.min(100, crime.progress.crimeLevel)}%`,
                        background: tierColor.accent,
                      }}
                    />
                  </div>
                  <button
                    className="crime-commit-btn"
                    style={{
                      background: canAttempt ? tierColor.accent : undefined,
                    }}
                    disabled={!canAttempt}
                    onClick={() => handleAttempt(crime.key)}
                  >
                    {attempting === crime.key
                      ? "..."
                      : user && user.nerve < crime.nerveCost
                      ? "Low Nerve"
                      : isInJail
                      ? "In Jail"
                      : "Commit"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ════════════════════════════════════════ */}
      {/* OUTCOME MODAL                           */}
      {/* ════════════════════════════════════════ */}
      {outcome && (
        <div className="outcome-overlay" onClick={closeOutcome}>
          <div
            className="outcome-card"
            style={{
              borderColor: getOutcomeStyle(outcome.outcome).color,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="outcome-icon">
              {getOutcomeStyle(outcome.outcome).icon}
            </div>
            <div
              className="outcome-label"
              style={{ color: getOutcomeStyle(outcome.outcome).color }}
            >
              {getOutcomeStyle(outcome.outcome).label}
            </div>
            <div className="outcome-message">{outcome.message}</div>

            {/* ── Special Discovery ── */}
            {outcome.special && (
              <div className="outcome-special-box">
                <div className="outcome-special-title">
                  🌟 {outcome.special.title}
                </div>
                {outcome.special.wasNewlyDiscovered && (
                  <div className="outcome-special-new">
                    ✨ NEW DISCOVERY
                  </div>
                )}
              </div>
            )}

            {/* ── Details ── */}
            <div className="outcome-details">
              {outcome.rewards.money > 0 && (
                <div className="outcome-detail-item">
                  <span className="outcome-detail-value outcome-detail-value-gain">
                    +{formatMoney(outcome.rewards.money)}
                  </span>
                  <span className="outcome-detail-label">EARNED</span>
                </div>
              )}
              {outcome.penalties.moneyLost > 0 && (
                <div className="outcome-detail-item">
                  <span className="outcome-detail-value outcome-detail-value-loss">
                    -{formatMoney(outcome.penalties.moneyLost)}
                  </span>
                  <span className="outcome-detail-label">LOST</span>
                </div>
              )}
              {outcome.penalties.lifeLost > 0 && (
                <div className="outcome-detail-item">
                  <span className="outcome-detail-value outcome-detail-value-loss">
                    -{outcome.penalties.lifeLost} HP
                  </span>
                  <span className="outcome-detail-label">DAMAGE</span>
                </div>
              )}
              {outcome.rewards.xpGained > 0 && (
                <div className="outcome-detail-item">
                  <span className="outcome-detail-value outcome-detail-value-xp">
                    +{outcome.rewards.xpGained}
                  </span>
                  <span className="outcome-detail-label">CRIME XP</span>
                </div>
              )}
              {outcome.penalties.xpLost > 0 && (
                <div className="outcome-detail-item">
                  <span className="outcome-detail-value outcome-detail-value-xp-loss">
                    -{outcome.penalties.xpLost}
                  </span>
                  <span className="outcome-detail-label">XP LOST</span>
                </div>
              )}
              {outcome.penalties.jailSeconds > 0 && (
                <div className="outcome-detail-item">
                  <span className="outcome-detail-value outcome-detail-value-jail">
                    ⛓️ {formatTime(outcome.penalties.jailSeconds)}
                  </span>
                  <span className="outcome-detail-label">
                    {outcome.penalties.jailType === "federal"
                      ? "FEDERAL JAIL"
                      : "JAIL"}
                  </span>
                </div>
              )}
            </div>

            <button className="outcome-close-btn" onClick={closeOutcome}>
              Continue
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}
