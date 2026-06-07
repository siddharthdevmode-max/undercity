import { useState, useEffect } from 'react';
import '../styles/CookieBanner.css';
import {
  getCookieConsent,
  setCookieConsent,
} from '../utils/cookieConsent';
import { initAnalytics, optInAnalytics, optOutAnalytics } from '../services/analytics';

// ============================================================
// COOKIE CONSENT BANNER — GDPR/ePrivacy compliant
// PostHog initialized here — after user makes consent decision.
// Never initializes before consent is given.
// ============================================================

export default function CookieBanner() {
  const [visible,     setVisible]     = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [functional,  setFunctional]  = useState(true);
  const [analytics,   setAnalytics]   = useState(false);

  useEffect(() => {
    const consent = getCookieConsent();
    if (!consent?.decided) {
      // Show banner after short delay so page loads first
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
    // Already decided — init analytics with stored preference
    initAnalytics(consent.analytics ?? false);
  }, []);

  if (!visible) return null;

  const handleAcceptAll = () => {
    setCookieConsent(true, true);
    initAnalytics(true);
    optInAnalytics();
    setVisible(false);
  };

  const handleEssentialOnly = () => {
    setCookieConsent(false, false);
    initAnalytics(false);
    optOutAnalytics();
    setVisible(false);
  };

  const handleSavePrefs = () => {
    setCookieConsent(functional, analytics);
    initAnalytics(analytics);
    if (analytics) {
      optInAnalytics();
    } else {
      optOutAnalytics();
    }
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
              <span className="cb-detail-sub">Anonymous usage statistics via PostHog</span>
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
