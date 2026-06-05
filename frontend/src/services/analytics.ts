import posthog from "posthog-js";

// ============================================================
// POSTHOG ANALYTICS — UNDERCITY
// Tracks: page views, game actions, conversions, funnels
// Privacy: GDPR compliant, respects cookie consent
// ============================================================

const POSTHOG_KEY  = import.meta.env.VITE_POSTHOG_KEY  || "";
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || "https://app.posthog.com"\;

let initialized = false;

export function initAnalytics(cookiesAccepted: boolean): void {
  if (!POSTHOG_KEY || initialized) return;

  posthog.init(POSTHOG_KEY, {
    api_host:              POSTHOG_HOST,
    capture_pageview:      true,
    capture_pageleave:     true,
    autocapture:           false, // manual control
    persistence:           cookiesAccepted ? "localStorage+cookie" : "memory",
    opt_out_capturing_by_default: !cookiesAccepted,
    loaded: (ph) => {
      if (import.meta.env.DEV) {
        ph.opt_out_capturing(); // no analytics in dev
      }
    },
  });

  initialized = true;
}

export function identifyUser(uid: string, props?: {
  username?: string;
  level?:    number;
  createdAt?: string;
}): void {
  if (!initialized) return;
  posthog.identify(uid, props);
}

export function resetUser(): void {
  if (!initialized) return;
  posthog.reset();
}

// ── Game Events ────────────────────────────────────────────

export const Analytics = {
  // Auth funnel
  registrationStarted:   () => track("registration_started"),
  registrationCompleted: (username: string) =>
    track("registration_completed", { username }),
  loginCompleted:        (method: string) =>
    track("login_completed", { method }),

  // Onboarding funnel
  onboardingStep: (step: number, name: string) =>
    track("onboarding_step", { step, name }),
  onboardingCompleted: () =>
    track("onboarding_completed"),

  // Game actions
  crimeAttempted: (crimeId: string, crimeName: string) =>
    track("crime_attempted", { crimeId, crimeName }),
  crimeSuccess: (crimeId: string, reward: number) =>
    track("crime_success", { crimeId, reward }),
  crimeFailed: (crimeId: string) =>
    track("crime_failed", { crimeId }),

  // Monetization funnel
  storeViewed:     () => track("store_viewed"),
  packClicked:     (packId: string, priceUsd: number) =>
    track("pack_clicked", { packId, priceUsd }),
  checkoutStarted: (packId: string, priceUsd: number) =>
    track("checkout_started", { packId, priceUsd }),
  purchaseCompleted: (packId: string, points: number, revenue: number) =>
    track("purchase_completed", { packId, points, revenue }),

  // Landing page
  heroCtaClicked:    () => track("hero_cta_clicked"),
  featureViewed:     (feature: string) => track("feature_viewed", { feature }),
};

function track(event: string, props?: Record<string, unknown>): void {
  if (!initialized) return;
  try {
    posthog.capture(event, props);
  } catch {
    // silently fail — never break game for analytics
  }
}
