import posthog from "posthog-js";

// POSTHOG ANALYTICS - UNDERCITY
// Privacy: GDPR compliant, respects cookie consent

const POSTHOG_KEY  = import.meta.env.VITE_POSTHOG_KEY  || "";
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || "https://app.posthog.com";

let initialized = false;

export function initAnalytics(cookiesAccepted: boolean): void {
  if (!POSTHOG_KEY || initialized) return;

  posthog.init(POSTHOG_KEY, {
    api_host:          POSTHOG_HOST,
    capture_pageview:  true,
    capture_pageleave: true,
    persistence:       cookiesAccepted ? "localStorage+cookie" : "memory",
    autocapture:       false,
    disable_session_recording: true,
  });

  initialized = true;
}

export function trackPageView(path: string): void {
  if (!initialized) return;
  posthog.capture("$pageview", { path });
}

export function trackEvent(
  event: string,
  properties?: Record<string, unknown>
): void {
  if (!initialized) return;
  posthog.capture(event, properties);
}

export function trackGameAction(
  action: string,
  properties?: Record<string, unknown>
): void {
  trackEvent(`game_${action}`, properties);
}

export function identifyUser(uid: string, properties?: Record<string, unknown>): void {
  if (!initialized) return;
  posthog.identify(uid, properties);
}

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
