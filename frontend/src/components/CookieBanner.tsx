import { useState, useEffect } from 'react';
import '../styles/CookieBanner.css';

// ============================================================
// COOKIE CONSENT BANNER — GDPR/ePrivacy compliant
// ============================================================

type ConsentState = {
  essential:  true;
  functional: boolean;
  analytics:  boolean;
  decided:    boolean;
  timestamp:  string;
};

const CONSENT_KEY = 'uc_cookie_consent';

export function getCookieConsent(): ConsentState | null {
  try {
    const s = localStorage.getItem(CONSENT_KEY);
    return s ? (JSON.parse(s) as ConsentState) : null;
  } catch { return null; }
}

export function setCookieConsent(functional: boolean, analytics: boolean): void {
  const consent: ConsentState = {
    essential: true,
    functional,
    analytics,
    decided:   true,
    timestamp: new Date().toISOString(),
  };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
}

export default function CookieBanner() {
  const [visible,     setVisible]     = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [functional,  setFunctional]  = useState(true);
  const [analytics,   setAnalytics]   = useState(false);

  useEffect(() => {
    const consent = getCookieConsent();
    if (!consent?.decided) {
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  if (!visible) return null;

  const handleAcceptAll = () => {
    setCookieConsent(true, true);
    setVisible(false);
  };

  const handleEssentialOnly = () => {
    setCookieConsent(false, false);
    setVisible(false);
  };

  const handleSavePrefs = () => {
    setCookieConsent(functional, analytics);
    setVisible(false);
  };

  return (
    <div
      className="cb-banner"
      role="dialog"
      aria-modal="true"
      aria-label="Cookie consent"
    >
      {/* Header */}
      <div className="cb-header">
        <span className="cb-icon" aria-hidden="true">🍪</span>
        <h2 className="cb-title">Cookie Preferences</h2>
      </div>

      {/* Description */}
      <p className="cb-desc">
        We use essential cookies to run the game and functional cookies
        to remember your preferences. No advertising cookies — ever.{' '}
        <a href="/legal/cookies" className="cb-link">Learn more</a>
      </p>

      {/* Detail panel */}
      {showDetails && (
        <div className="cb-details">
          <div className="cb-detail-row">
            <div className="cb-detail-info">
              <span className="cb-detail-name">Essential</span>
              <span className="cb-detail-sub">Required for login and security</span>
            </div>
            <span className="cb-always-on">Always On</span>
          </div>

          <div className="cb-detail-row">
            <div className="cb-detail-info">
              <span className="cb-detail-name">Functional</span>
              <span className="cb-detail-sub">Theme, preferences</span>
            </div>
            <label className="cb-toggle">
              <input
                type="checkbox"
                checked={functional}
                onChange={(e) => setFunctional(e.target.checked)}
              />
            </label>
          </div>

          <div className="cb-detail-row">
            <div className="cb-detail-info">
              <span className="cb-detail-name">Analytics</span>
              <span className="cb-detail-sub">Usage statistics (not active yet)</span>
            </div>
            <label className="cb-toggle">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
              />
            </label>
          </div>
        </div>
      )}

      {/* Primary actions */}
      <div className="cb-actions">
        <button className="cb-btn cb-btn-primary" onClick={handleAcceptAll}>
          Accept All
        </button>
        <button className="cb-btn cb-btn-ghost" onClick={handleEssentialOnly}>
          Essential Only
        </button>
      </div>

      {/* Secondary actions */}
      <div className="cb-secondary">
        <button
          className="cb-text-btn"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? 'Hide details' : 'Manage preferences'}
        </button>
        {showDetails && (
          <button
            className="cb-text-btn cb-text-btn-accent"
            onClick={handleSavePrefs}
          >
            Save preferences
          </button>
        )}
      </div>
    </div>
  );
}
