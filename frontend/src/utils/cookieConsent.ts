// ============================================================
// COOKIE CONSENT HELPERS
// Separated from CookieBanner so fast refresh works correctly
// ============================================================

export type ConsentState = {
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
    essential:  true,
    functional,
    analytics,
    decided:    true,
    timestamp:  new Date().toISOString(),
  };
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
  } catch { /* ignore */ }
}
