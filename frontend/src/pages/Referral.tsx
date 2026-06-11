import { useState, useEffect, useCallback, useRef } from "react";
import Shell from "../components/Shell";
import Icon from "../components/ui/Icon";
import { Skeleton } from "../components/ui/Skeleton";
import { referralAPI } from "../services/referral";
import type { ReferralStats } from "../services/referral";
import { toast } from "../utils/toast";
import { userEvents } from "../utils/userEvents";
import "../styles/Referral.css";

export default function Referral() {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applyCode, setApplyCode] = useState("");
  const [applying, setApplying] = useState(false);

  const loadRef = useRef<() => void>(() => {});
  const load = useCallback(() => {
    setError(null); setLoading(true);
    Promise.all([
      referralAPI.getCode(),
      referralAPI.getStats(),
    ])
      .then(([codeR, statsR]) => { setCode(codeR.referralCode); setStats(statsR); })
      .catch((err: unknown) => { const m = err instanceof Error ? err.message : "Failed"; setError(m); toast.error(m); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { loadRef.current = load; }, [load]);
  useEffect(() => { loadRef.current(); }, []);

  const handleApply = async () => {
    if (!applyCode.trim() || applying) return;
    setApplying(true);
    try {
      const res = await referralAPI.applyCode(applyCode.trim());
      toast.success(`Bonus earned: $${res.bonusCash.toLocaleString()}`);
      userEvents.emit({ money: res.bonusCash });
      setApplyCode("");
      loadRef.current();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to apply code");
    } finally { setApplying(false); }
  };

  const handleCopyCode = () => {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => toast.success("Code copied!")).catch(() => toast.error("Failed to copy"));
  };

  if (loading) return <Shell><div className="ref-container"><h1 className="ref-title"><Icon name="handshake" size={26} /> Referrals</h1><Skeleton width={300} height={4} /></div></Shell>;
  if (error) return <Shell><div className="ref-error" role="alert"><p>{error}</p><button className="ref-retry-btn" onClick={() => loadRef.current()}>Retry</button></div></Shell>;

  const shareUrl = code ? `${window.location.origin}/register?ref=${code}` : "";

  return (
    <Shell>
      <div className="ref-container">
        <h1 className="ref-title"><Icon name="handshake" size={26} className="icon-accent" /> Referrals</h1>

        <div className="ref-code-section">
          <h3 className="ref-section-title">Your Referral Code</h3>
          {code ? (
            <div className="ref-code-box">
              <span className="ref-code-value">{code}</span>
              <button className="ref-copy-btn" onClick={handleCopyCode}>Copy</button>
            </div>
          ) : (
            <button className="ref-gen-btn" onClick={() => loadRef.current()}>Generate Code</button>
          )}
          {shareUrl && <p className="ref-share">Share: <span className="ref-share-url">{shareUrl}</span></p>}
        </div>

        {stats && (
          <div className="ref-stats-section">
            <h3 className="ref-section-title">Your Stats</h3>
            <div className="ref-stats-grid">
              <div className="ref-stat-card">
                <span className="ref-stat-value">{stats.totalReferrals}</span>
                <span className="ref-stat-label">Referrals</span>
              </div>
              <div className="ref-stat-card">
                <span className="ref-stat-value">${stats.totalEarned.toLocaleString()}</span>
                <span className="ref-stat-label">Total Earned</span>
              </div>
            </div>
          </div>
        )}

        <div className="ref-apply-section">
          <h3 className="ref-section-title">Apply a Referral Code</h3>
          <p className="ref-apply-desc">Enter someone's code to earn a $25,000 bonus for both of you!</p>
          <div className="ref-apply-row">
            <input
              className="ref-apply-input"
              placeholder="Enter referral code"
              value={applyCode}
              onChange={(e) => setApplyCode(e.target.value.toUpperCase())}
            />
            <button className="ref-apply-btn" disabled={applying || !applyCode.trim()} onClick={() => void handleApply()}>
              {applying ? "Applying..." : "Apply"}
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
}
