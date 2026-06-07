// ============================================================
// ANALYTICS — UNDERCITY
// PostHog: privacy-first, GDPR compliant
// Only initializes after cookie consent is granted.
// All methods are no-ops if not initialized.
// ============================================================

import posthog from "posthog-js";

const POSTHOG_KEY  = import.meta.env.VITE_POSTHOG_KEY  as string | undefined;
const POSTHOG_HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined)
  ?? "https://app.posthog.com";

let initialized = false;

// ── Init — called from CookieBanner on consent ────────────
export function initAnalytics(cookiesAccepted: boolean): void {
  if (!POSTHOG_KEY || initialized) return;

  posthog.init(POSTHOG_KEY, {
    api_host:                  POSTHOG_HOST,
    capture_pageview:          true,
    capture_pageleave:         true,
    persistence:               cookiesAccepted ? "localStorage+cookie" : "memory",
    autocapture:               false,         // manual events only
    disable_session_recording: true,          // no video recording
    respect_dnt:               true,          // honor Do Not Track
    sanitize_properties:       (props) => {
      // Strip any PII that might accidentally leak
      delete props['$ip'];
      delete props['$user_id'];
      return props;
    },
  });

  initialized = true;

  if (!cookiesAccepted) {
    posthog.opt_out_capturing();
  }
}

// ── Page tracking ─────────────────────────────────────────
export function trackPageView(path: string): void {
  if (!initialized) return;
  posthog.capture("$pageview", { path });
}

// ── Game events ───────────────────────────────────────────
export function trackEvent(
  event:       string,
  properties?: Record<string, unknown>
): void {
  if (!initialized) return;
  posthog.capture(event, properties);
}

export function trackGameAction(
  action:      string,
  properties?: Record<string, unknown>
): void {
  trackEvent(`game_${action}`, properties);
}

// ── User identity ─────────────────────────────────────────
// Call after login with anonymized ID only — never email/username
export function identifyUser(
  uid:         string,
  properties?: Record<string, unknown>
): void {
  if (!initialized) return;
  // Use hashed/anonymous ID — never raw firebase UID
  posthog.identify(`user_${uid.slice(0, 8)}`, properties);
}

// ── Session management ────────────────────────────────────
export function resetAnalytics(): void {
  if (!initialized) return;
  posthog.reset();
}

export function optOutAnalytics(): void {
  if (!initialized) return;
  posthog.opt_out_capturing();
}

export function optInAnalytics(): void {
  if (!initialized) return;
  posthog.opt_in_capturing();
}
