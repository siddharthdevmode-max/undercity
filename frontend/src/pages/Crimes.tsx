import { useState, useEffect, useCallback } from "react";
import Shell from "../components/Shell";
import { crimesAPI } from "../services/crimes";
import type { Crime, UserStats, CrimeAttemptResponse } from "../services/crimes";
import { toast } from "../utils/toast";
import { CrimesGridSkeleton } from "../components/ui/Skeleton";
import { Modal } from "../components/ui/Modal";
import { userEvents } from "../utils/userEvents";
import "../styles/Crimes.css";

const TIER_COLORS: Record<number, { glow: string; accent: string }> = {
  1: { glow: "rgba(46,204,113,0.15)",  accent: "#2ecc71" },
  2: { glow: "rgba(241,196,15,0.15)",  accent: "#f1c40f" },
  3: { glow: "rgba(230,126,34,0.15)",  accent: "#e67e22" },
  4: { glow: "rgba(231,76,60,0.15)",   accent: "#e74c3c" },
  5: { glow: "rgba(155,89,182,0.15)",  accent: "#9b59b6" },
};

const TIER_LABELS: Record<number, string> = {
  1: "STREET",
  2: "HUSTLE",
  3: "RACKET",
  4: "CARTEL",
  5: "SYNDICATE",
};

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
    case "special":   return { color: "#f39c12", icon: "🌟", label: "SPECIAL DISCOVERY" };
    case "success":   return { color: "#2ecc71", icon: "✅", label: "SUCCESS" };
    case "fail":      return { color: "#95a5a6", icon: "❌", label: "FAILED" };
    case "crit_fail": return { color: "#e74c3c", icon: "💀", label: "CRITICAL FAILURE" };
    default:          return { color: "#95a5a6", icon: "❓", label: "UNKNOWN" };
  }
}

function getJailRemaining(jailUntil: string | null): number {
  if (!jailUntil) return 0;
  const remaining = new Date(jailUntil).getTime() - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

function getCrimeLevelLabel(level: number): string {
  return level === 0 ? "Untrained" : `Lv. ${level}`;
}

async function fetchCrimes(
  onSuccess: (crimes: Crime[], user: UserStats) => void,
  onError: (msg: string) => void,
  onDone: () => void
) {
  try {
    const data = await crimesAPI.getCrimes();
    onSuccess(data.crimes, data.user);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load crimes";
    onError(msg);
    toast.error(msg);
  } finally {
    onDone();
  }
}

export default function Crimes() {
  const [crimes, setCrimes]                     = useState<Crime[]>([]);
  const [user, setUser]                         = useState<UserStats | null>(null);
  const [loading, setLoading]                   = useState(true);
  const [error, setError]                       = useState<string | null>(null);
  const [attempting, setAttempting]             = useState<string | null>(null);
  const [outcome, setOutcome]                   = useState<CrimeAttemptResponse | null>(null);
  const [jailTimer, setJailTimer]               = useState(0);
  const [federalJailTimer, setFederalJailTimer] = useState(0);
  const [activeTab, setActiveTab]               = useState<number | "all">("all");

  const loadCrimes = useCallback(() => {
    setError(null);
    setLoading(true);
    void fetchCrimes(
      (c, u) => { setCrimes(c); setUser(u); },
      (msg)  => setError(msg),
      ()     => setLoading(false)
    );
  }, []);

  useEffect(() => {
    void fetchCrimes(
      (c, u) => { setCrimes(c); setUser(u); },
      (msg)  => setError(msg),
      ()     => setLoading(false)
    );
  }, []);

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

  const handleAttempt = async (crimeKey: string) => {
    if (attempting) return;
    setAttempting(crimeKey);
    try {
      const result = await crimesAPI.attemptCrime(crimeKey);
      setOutcome(result);

      if (result.outcome === "special") {
        toast.success(`🌟 ${result.special?.title ?? "Special discovered!"}`, 5000);
      } else if (result.outcome === "crit_fail") {
        toast.error(`💀 ${result.message}`, 5000);
      }

      setUser((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          money:            result.user.money,
          points:           result.user.points,
          nerve:            result.user.nerve,
          maxNerve:         result.user.maxNerve,
          life:             result.user.life,
          maxLife:          result.user.maxLife,
          jailUntil:        result.user.jailUntil,
          federalJailUntil: result.user.federalJailUntil,
          inJail:
            !!result.user.jailUntil &&
            new Date(result.user.jailUntil).getTime() > Date.now(),
          inFederalJail:
            !!result.user.federalJailUntil &&
            new Date(result.user.federalJailUntil).getTime() > Date.now(),
        };
      });

      userEvents.emit({
        money:    result.user.money,
        nerve:    result.user.nerve,
        maxNerve: result.user.maxNerve,
        life:     result.user.life,
        maxLife:  result.user.maxLife,
        points:   result.user.points,
      });

      setCrimes((prev) =>
        prev.map((c) =>
          c.key === crimeKey
            ? { ...c, progress: { ...c.progress, ...result.progress } }
            : c
        )
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAttempting(null);
    }
  };

  const closeOutcome = () => setOutcome(null);

  if (loading) {
    return (
      <Shell>
        <div className="crimes-container">
          <div className="crimes-header">
            <h1 className="crimes-title">🔫 Crimes</h1>
          </div>
          <CrimesGridSkeleton count={10} />
        </div>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <div className="crimes-error" role="alert">
          <p>{error}</p>
          <button className="crimes-retry-btn" onClick={loadCrimes}>Retry</button>
        </div>
      </Shell>
    );
  }

  const isInJail     = jailTimer > 0 || federalJailTimer > 0;
  const sortedCrimes = [...crimes].sort((a, b) =>
    a.tier !== b.tier ? a.tier - b.tier : a.id - b.id
  );

  const tiers = [...new Set(sortedCrimes.filter(c => c.unlocked).map(c => c.tier))].sort();

  const filteredCrimes = activeTab === "all"
    ? sortedCrimes
    : sortedCrimes.filter(c => c.tier === activeTab);

  const outcomeStyle = outcome ? getOutcomeStyle(outcome.outcome) : null;

  return (
    <Shell>
      <div className="crimes-container">

        {/* Header */}
        <div className="crimes-header">
          <div className="crimes-header-left">
            <h1 className="crimes-title">🔫 Crimes</h1>
            {user && (
              <div className="crimes-stats-bar" role="group" aria-label="Player stats">
                <div className="crimes-stat crimes-stat-nerve">
                  <span className="crimes-stat-label">Nerve</span>
                  <span className="crimes-stat-value">{user.nerve}/{user.maxNerve}</span>
                </div>
                <div className="crimes-stat-divider" />
                <div className="crimes-stat crimes-stat-life">
                  <span className="crimes-stat-label">Life</span>
                  <span className="crimes-stat-value">{user.life}/{user.maxLife}</span>
                </div>
                <div className="crimes-stat-divider" />
                <div className="crimes-stat crimes-stat-money">
                  <span className="crimes-stat-label">Cash</span>
                  <span className="crimes-stat-value">{formatMoney(user.money)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Jail Banner */}
        {isInJail && (
          <div className="crimes-jail-banner" role="alert">
            <div className="crimes-jail-title">
              {federalJailTimer > 0 ? "🏛️ FEDERAL JAIL" : "🔒 IN JAIL"}
            </div>
            <div className="crimes-jail-time">
              Released in: <strong>{formatTime(federalJailTimer > 0 ? federalJailTimer : jailTimer)}</strong>
            </div>
          </div>
        )}

        {/* Tier Tabs */}
        {tiers.length > 1 && (
          <div className="crimes-tabs">
            <button
              className={`crimes-tab ${activeTab === "all" ? "active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              All
            </button>
            {tiers.map(tier => (
              <button
                key={tier}
                className={`crimes-tab ${activeTab === tier ? "active" : ""}`}
                style={activeTab === tier ? { borderBottomColor: TIER_COLORS[tier]?.accent } : {}}
                onClick={() => setActiveTab(tier)}
              >
                {TIER_LABELS[tier] ?? `Tier ${tier}`}
              </button>
            ))}
          </div>
        )}

        {/* Grid */}
        <div className="crimes-grid" role="grid" aria-label="Available crimes">
          {filteredCrimes.map((crime) => {
            const tierColor  = TIER_COLORS[crime.tier];
            const canAttempt =
              crime.unlocked &&
              !isInJail &&
              user !== null &&
              user.nerve >= crime.nerveCost &&
              !attempting;

            const isAttempting = attempting === crime.key;
            const lowNerve = user !== null && user.nerve < crime.nerveCost;

            if (!crime.unlocked) {
              return (
                <div
                  key={crime.id}
                  className="crime-card crime-card-locked"
                  aria-label={`Locked crime, unlocks at level ${crime.unlockLevel}`}
                >
                  <div className="crime-locked-content">
                    <span className="crime-locked-icon">🔒</span>
                    <p className="crime-card-locked-name">???</p>
                    <p className="crime-card-locked-sub">LEVEL {crime.unlockLevel}</p>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={crime.id}
                className={`crime-card ${isAttempting ? "crime-card-attempting" : ""}`}
                style={{
                  borderColor: `${tierColor.accent}44`,
                  boxShadow:   `inset 0 0 20px ${tierColor.glow}`,
                }}
              >
                {crime.isFederal && (
                  <div className="crime-federal-tag" aria-label="Federal crime">FED</div>
                )}

                <div className="crime-card-top">
                  <div className="crime-tier-dot" style={{ background: tierColor.accent }} />
                  <p className="crime-card-name">{crime.name}</p>
                  <div className="crime-card-meta">
                    <span className="crime-nerve-badge">
                      ⚡ {crime.nerveCost}
                    </span>
                    <span className="crime-reward-badge">
                      {formatMoney(crime.minReward)}–{formatMoney(crime.maxReward)}
                    </span>
                  </div>
                </div>

                <div className="crime-card-bottom">
                  <div className="crime-level-row">
                    <span className="crime-level-text" style={{ color: tierColor.accent }}>
                      {getCrimeLevelLabel(crime.progress.crimeLevel)}
                    </span>
                    <span className="crime-attempts-text">
                      {crime.progress.attempts} runs
                    </span>
                  </div>
                  <div
                    className="crime-progress-bar"
                    role="progressbar"
                    aria-valuenow={crime.progress.crimeLevel}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="crime-progress-fill"
                      style={{
                        width:      `${Math.min(100, crime.progress.crimeLevel)}%`,
                        background: tierColor.accent,
                      }}
                    />
                  </div>
                  <button
                    className="crime-commit-btn"
                    style={canAttempt ? { background: tierColor.accent } : {}}
                    disabled={!canAttempt}
                    onClick={() => void handleAttempt(crime.key)}
                    aria-label={`Attempt ${crime.name}`}
                  >
                    {isAttempting
                      ? <span className="crime-btn-spinner" />
                      : lowNerve
                      ? "LOW NERVE"
                      : isInJail
                      ? "JAILED"
                      : "COMMIT"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Outcome Modal */}
      {outcome && outcomeStyle && (
        <Modal
          isOpen={!!outcome}
          onClose={closeOutcome}
          title={outcomeStyle.label}
          titleId="outcome-modal-title"
          className="outcome-card"
        >
          <div style={{ borderTop: `3px solid ${outcomeStyle.color}`, paddingTop: "1rem" }}>
            <div className="outcome-icon">{outcomeStyle.icon}</div>
            <div className="outcome-message">{outcome.message}</div>

            {outcome.special && (
              <div className="outcome-special-box">
                <div className="outcome-special-title">{outcome.special.title}</div>
                {outcome.special.wasNewlyDiscovered && (
                  <div className="outcome-special-new">✨ NEW DISCOVERY</div>
                )}
              </div>
            )}

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
                    +{outcome.rewards.xpGained} XP
                  </span>
                  <span className="outcome-detail-label">CRIME XP</span>
                </div>
              )}
              {outcome.penalties.xpLost > 0 && (
                <div className="outcome-detail-item">
                  <span className="outcome-detail-value outcome-detail-value-xp-loss">
                    -{outcome.penalties.xpLost} XP
                  </span>
                  <span className="outcome-detail-label">XP LOST</span>
                </div>
              )}
              {outcome.penalties.jailSeconds > 0 && (
                <div className="outcome-detail-item">
                  <span className="outcome-detail-value outcome-detail-value-jail">
                    {formatTime(outcome.penalties.jailSeconds)}
                  </span>
                  <span className="outcome-detail-label">
                    {outcome.penalties.jailType === "federal" ? "FED JAIL" : "JAIL"}
                  </span>
                </div>
              )}
            </div>

            <button className="outcome-close-btn" onClick={closeOutcome} autoFocus>
              Continue
            </button>
          </div>
        </Modal>
      )}
    </Shell>
  );
}
