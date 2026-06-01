import { useState, useEffect, useCallback } from "react";
import Shell from "../components/Shell";
import { crimesAPI } from "../services/crimes";
import type {
  Crime,
  UserStats,
  CrimeAttemptResponse,
} from "../services/crimes";

// ════════════════════════════════════════
// TIER COLOR CONFIG (subtle row hint)
// ════════════════════════════════════════

const TIER_COLORS: Record<number, { glow: string; accent: string }> = {
  1: { glow: "rgba(46,204,113,0.15)",  accent: "#2ecc71" },
  2: { glow: "rgba(241,196,15,0.15)",  accent: "#f1c40f" },
  3: { glow: "rgba(230,126,34,0.15)",  accent: "#e67e22" },
  4: { glow: "rgba(231,76,60,0.15)",   accent: "#e74c3c" },
  5: { glow: "rgba(155,89,182,0.15)",  accent: "#9b59b6" },
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
// STYLES
// ════════════════════════════════════════

const styles = {
  container: {
    maxWidth: "1100px",
    margin: "0 auto",
    padding: "24px",
    fontFamily: "'Segoe UI', sans-serif",
  } as React.CSSProperties,

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "32px",
    flexWrap: "wrap" as const,
    gap: "16px",
  } as React.CSSProperties,

  title: {
    fontSize: "32px",
    fontWeight: "bold",
    color: "#e94560",
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: "10px",
  } as React.CSSProperties,

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: "14px",
  } as React.CSSProperties,

  card: {
    position: "relative" as const,
    aspectRatio: "1 / 1",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: "14px",
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "space-between",
    transition: "all 0.25s ease",
    cursor: "pointer",
    overflow: "hidden",
  } as React.CSSProperties,

  cardLocked: {
    background: "rgba(0,0,0,0.4)",
    border: "1px dashed rgba(255,255,255,0.1)",
    cursor: "not-allowed",
  } as React.CSSProperties,

  cardName: {
    fontSize: "14px",
    fontWeight: "700",
    color: "#ecf0f1",
    margin: 0,
    lineHeight: "1.2",
    minHeight: "34px",
  } as React.CSSProperties,

  cardLockedName: {
    fontSize: "28px",
    fontWeight: "900",
    color: "#444",
    textAlign: "center" as const,
    letterSpacing: "4px",
    margin: 0,
  } as React.CSSProperties,

  cardLockedSub: {
    fontSize: "11px",
    color: "#666",
    textAlign: "center" as const,
    marginTop: "8px",
    letterSpacing: "1px",
  } as React.CSSProperties,

  cardMeta: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "6px",
  } as React.CSSProperties,

  nerveBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "11px",
    fontWeight: "600",
    color: "#f39c12",
    padding: "3px 8px",
    borderRadius: "12px",
    background: "rgba(243,156,18,0.1)",
    border: "1px solid rgba(243,156,18,0.2)",
    alignSelf: "flex-start",
  } as React.CSSProperties,

  levelText: {
    fontSize: "11px",
    fontWeight: "500",
    margin: "4px 0",
  } as React.CSSProperties,

  progressBar: {
    width: "100%",
    height: "3px",
    background: "rgba(255,255,255,0.08)",
    borderRadius: "2px",
    overflow: "hidden",
    marginBottom: "6px",
  } as React.CSSProperties,

  commitBtn: {
    width: "100%",
    padding: "7px",
    borderRadius: "6px",
    border: "none",
    fontWeight: "bold",
    fontSize: "11px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    color: "#fff",
    letterSpacing: "1px",
    textTransform: "uppercase" as const,
  } as React.CSSProperties,

  commitBtnDisabled: {
    background: "#333",
    color: "#666",
    cursor: "not-allowed",
  } as React.CSSProperties,

  federalTag: {
    position: "absolute" as const,
    top: "8px",
    right: "8px",
    fontSize: "8px",
    fontWeight: "900",
    color: "#e74c3c",
    background: "rgba(231,76,60,0.15)",
    padding: "2px 5px",
    borderRadius: "3px",
    letterSpacing: "1px",
  } as React.CSSProperties,

  outcomeOverlay: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.75)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    animation: "fadeIn 0.2s ease",
  } as React.CSSProperties,

  outcomeCard: {
    background: "#16213e",
    border: "2px solid",
    borderRadius: "16px",
    padding: "36px",
    maxWidth: "500px",
    width: "90%",
    textAlign: "center" as const,
    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
  } as React.CSSProperties,

  outcomeIcon: {
    fontSize: "56px",
    marginBottom: "12px",
  } as React.CSSProperties,

  outcomeLabel: {
    fontSize: "20px",
    fontWeight: "900",
    marginBottom: "16px",
    letterSpacing: "2px",
  } as React.CSSProperties,

  outcomeMessage: {
    fontSize: "14px",
    color: "#bdc3c7",
    lineHeight: "1.6",
    marginBottom: "20px",
  } as React.CSSProperties,

  outcomeDetails: {
    display: "flex",
    justifyContent: "center",
    gap: "24px",
    flexWrap: "wrap" as const,
    marginBottom: "24px",
    fontSize: "13px",
    padding: "16px",
    background: "rgba(0,0,0,0.3)",
    borderRadius: "10px",
  } as React.CSSProperties,

  outcomeDetailItem: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "2px",
  } as React.CSSProperties,

  closeBtn: {
    padding: "10px 32px",
    borderRadius: "8px",
    border: "none",
    background: "#e94560",
    color: "#fff",
    fontWeight: "bold",
    fontSize: "14px",
    cursor: "pointer",
    letterSpacing: "1px",
  } as React.CSSProperties,

  jailBanner: {
    padding: "20px",
    borderRadius: "12px",
    background: "rgba(231,76,60,0.15)",
    border: "2px solid #e74c3c",
    textAlign: "center" as const,
    marginBottom: "24px",
  } as React.CSSProperties,

  jailTitle: {
    fontSize: "22px",
    fontWeight: "bold",
    color: "#e74c3c",
    marginBottom: "8px",
  } as React.CSSProperties,

  jailTime: {
    fontSize: "16px",
    color: "#ecf0f1",
  } as React.CSSProperties,

  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "60vh",
    color: "#95a5a6",
    fontSize: "18px",
  } as React.CSSProperties,

  error: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    height: "60vh",
    color: "#e74c3c",
    gap: "12px",
  } as React.CSSProperties,
};

// ════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════

export default function Crimes() {
  const [crimes, setCrimes] = useState<Crime[]>([]);
  const [user, setUser] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
          inJail: !!result.user.jailUntil && new Date(result.user.jailUntil).getTime() > Date.now(),
          inFederalJail: !!result.user.federalJailUntil && new Date(result.user.federalJailUntil).getTime() > Date.now(),
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
      alert(err.message || "Something went wrong");
    } finally {
      setAttempting(null);
    }
  };

  const closeOutcome = () => setOutcome(null);

  if (loading) {
    return (
      <Shell>
        <div style={styles.loading}>Loading crimes...</div>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <div style={styles.error}>
          <p>❌ {error}</p>
          <button style={styles.closeBtn} onClick={loadCrimes}>
            Retry
          </button>
        </div>
      </Shell>
    );
  }

  const isInJail = jailTimer > 0 || federalJailTimer > 0;

  // Sort crimes by tier then id (so they form clean rows)
  const sortedCrimes = [...crimes].sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return a.id - b.id;
  });

  return (
    <Shell>
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>🔪 Crimes</h1>
        </div>

        {/* ── Jail Banner ── */}
        {isInJail && (
          <div style={styles.jailBanner}>
            <div style={styles.jailTitle}>
              {federalJailTimer > 0 ? "🏛️ FEDERAL JAIL" : "⛓️ IN JAIL"}
            </div>
            <div style={styles.jailTime}>
              Time remaining:{" "}
              {formatTime(federalJailTimer > 0 ? federalJailTimer : jailTimer)}
            </div>
          </div>
        )}

        {/* ── 5x5 Grid ── */}
        <div style={styles.grid}>
          {sortedCrimes.map((crime) => {
            const tierColor = TIER_COLORS[crime.tier];
            const canAttempt =
              crime.unlocked &&
              !isInJail &&
              user !== null &&
              user.nerve >= crime.nerveCost &&
              !attempting;

            // LOCKED CARD
            if (!crime.unlocked) {
              return (
                <div
                  key={crime.id}
                  style={{
                    ...styles.card,
                    ...styles.cardLocked,
                    boxShadow: `inset 0 0 30px ${tierColor.glow}`,
                  }}
                >
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <p style={styles.cardLockedName}>???</p>
                    <p style={styles.cardLockedSub}>
                      🔒 LEVEL {crime.unlockLevel}
                    </p>
                  </div>
                </div>
              );
            }

            // UNLOCKED CARD
            return (
              <div
                key={crime.id}
                style={{
                  ...styles.card,
                  borderColor: `${tierColor.accent}33`,
                  boxShadow: `inset 0 0 20px ${tierColor.glow}`,
                }}
              >
                {crime.isFederal && (
                  <div style={styles.federalTag}>FED</div>
                )}

                {/* Crime name */}
                <div>
                  <p style={styles.cardName}>{crime.name}</p>
                  <div style={{ marginTop: "8px" }}>
                    <span style={styles.nerveBadge}>
                      ⚡ {crime.nerveCost}
                    </span>
                  </div>
                </div>

                {/* Bottom: level + button */}
                <div>
                  <div
                    style={{
                      ...styles.levelText,
                      color: tierColor.accent,
                    }}
                  >
                    {getCrimeLevelLabel(crime.progress.crimeLevel)}
                  </div>
                  <div style={styles.progressBar}>
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, crime.progress.crimeLevel)}%`,
                        background: tierColor.accent,
                        borderRadius: "2px",
                        transition: "width 0.5s ease",
                      }}
                    />
                  </div>
                  <button
                    style={{
                      ...styles.commitBtn,
                      ...(canAttempt ? {} : styles.commitBtnDisabled),
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

      {/* ── Outcome Modal ── */}
      {outcome && (
        <div style={styles.outcomeOverlay} onClick={closeOutcome}>
          <div
            style={{
              ...styles.outcomeCard,
              borderColor: getOutcomeStyle(outcome.outcome).color,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.outcomeIcon}>
              {getOutcomeStyle(outcome.outcome).icon}
            </div>
            <div
              style={{
                ...styles.outcomeLabel,
                color: getOutcomeStyle(outcome.outcome).color,
              }}
            >
              {getOutcomeStyle(outcome.outcome).label}
            </div>
            <div style={styles.outcomeMessage}>{outcome.message}</div>

            {/* Special title */}
            {outcome.special && (
              <div
                style={{
                  marginBottom: "16px",
                  padding: "12px",
                  borderRadius: "8px",
                  background: "rgba(243,156,18,0.12)",
                  border: "1px solid rgba(243,156,18,0.3)",
                }}
              >
                <div style={{ fontWeight: "bold", color: "#f39c12", marginBottom: "4px" }}>
                  🌟 {outcome.special.title}
                </div>
                {outcome.special.wasNewlyDiscovered && (
                  <div style={{ fontSize: "11px", color: "#95a5a6", letterSpacing: "1px" }}>
                    ✨ NEW DISCOVERY
                  </div>
                )}
              </div>
            )}

            {/* Details */}
            <div style={styles.outcomeDetails}>
              {outcome.rewards.money > 0 && (
                <div style={styles.outcomeDetailItem}>
                  <span style={{ color: "#2ecc71", fontWeight: "bold", fontSize: "16px" }}>
                    +{formatMoney(outcome.rewards.money)}
                  </span>
                  <span style={{ color: "#7f8c8d", fontSize: "10px" }}>EARNED</span>
                </div>
              )}
              {outcome.penalties.moneyLost > 0 && (
                <div style={styles.outcomeDetailItem}>
                  <span style={{ color: "#e74c3c", fontWeight: "bold", fontSize: "16px" }}>
                    -{formatMoney(outcome.penalties.moneyLost)}
                  </span>
                  <span style={{ color: "#7f8c8d", fontSize: "10px" }}>LOST</span>
                </div>
              )}
              {outcome.penalties.lifeLost > 0 && (
                <div style={styles.outcomeDetailItem}>
                  <span style={{ color: "#e74c3c", fontWeight: "bold", fontSize: "16px" }}>
                    -{outcome.penalties.lifeLost} HP
                  </span>
                  <span style={{ color: "#7f8c8d", fontSize: "10px" }}>DAMAGE</span>
                </div>
              )}
              {outcome.rewards.xpGained > 0 && (
                <div style={styles.outcomeDetailItem}>
                  <span style={{ color: "#3498db", fontWeight: "bold", fontSize: "16px" }}>
                    +{outcome.rewards.xpGained}
                  </span>
                  <span style={{ color: "#7f8c8d", fontSize: "10px" }}>CRIME XP</span>
                </div>
              )}
              {outcome.penalties.jailSeconds > 0 && (
                <div style={styles.outcomeDetailItem}>
                  <span style={{ color: "#e74c3c", fontWeight: "bold", fontSize: "16px" }}>
                    ⛓️ {formatTime(outcome.penalties.jailSeconds)}
                  </span>
                  <span style={{ color: "#7f8c8d", fontSize: "10px" }}>
                    {outcome.penalties.jailType === "federal" ? "FEDERAL JAIL" : "JAIL"}
                  </span>
                </div>
              )}
            </div>

            <button style={styles.closeBtn} onClick={closeOutcome}>
              Continue
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}