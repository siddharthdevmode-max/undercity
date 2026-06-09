// ============================================================
// ANALYTICS — UNDERCITY
// PostHog: privacy-first, GDPR compliant
// Lazy-loaded only after cookie consent is granted.
// All methods are safe no-ops if analytics is not initialized.
// ============================================================

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST =
  (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ||
  "https://app.posthog.com";

let initialized = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let posthogInstance: any = null;

// ── Lazy import PostHog only when needed ───────────────────
async function getPostHog() {
  if (posthogInstance) return posthogInstance;
  const mod = await import("posthog-js");
  posthogInstance = mod.default;
  return posthogInstance;
}

// ── Init — called from CookieBanner on consent ─────────────
export async function initAnalytics(cookiesAccepted: boolean): Promise<void> {
  if (!POSTHOG_KEY || initialized) return;

  const posthog = await getPostHog();

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: "identified_only",
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: true,
    persistence: cookiesAccepted ? "localStorage+cookie" : "memory",
    disable_session_recording: true,
    secure_cookie: true,
    cross_subdomain_cookie: false,
    opt_out_capturing_by_default: !cookiesAccepted,
    loaded: (instance: unknown) => {
      if (
        !cookiesAccepted &&
        instance &&
        typeof instance === "object" &&
        "opt_out_capturing" in instance
      ) {
        (instance as { opt_out_capturing: () => void }).opt_out_capturing();
      }
    },
  });

  initialized = true;
}

// ── Page view ──────────────────────────────────────────────
export async function trackPageView(path: string): Promise<void> {
  if (!initialized) return;
  const posthog = await getPostHog();
  posthog.capture("$pageview", { path });
}

// ── Generic event ──────────────────────────────────────────
export async function trackEvent(
  event: string,
  properties?: Record<string, unknown>
): Promise<void> {
  if (!initialized) return;
  const posthog = await getPostHog();
  posthog.capture(event, properties);
}

// ── Game-specific helper ───────────────────────────────────
export async function trackGameAction(
  action: string,
  properties?: Record<string, unknown>
): Promise<void> {
  if (!initialized) return;
  const posthog = await getPostHog();
  posthog.capture(action, properties);
}

// ── Identify user ──────────────────────────────────────────
export async function identifyUser(
  uid: string,
  properties?: Record<string, unknown>
): Promise<void> {
  if (!initialized) return;
  const posthog = await getPostHog();
  posthog.identify(`user_${uid.slice(0, 8)}`, properties);
}

// ── Reset ──────────────────────────────────────────────────
export async function resetAnalytics(): Promise<void> {
  if (!initialized) return;
  const posthog = await getPostHog();
  posthog.reset();
}

// ── Consent controls ───────────────────────────────────────
export async function optOutAnalytics(): Promise<void> {
  if (!initialized) return;
  const posthog = await getPostHog();
  posthog.opt_out_capturing();
}

export async function optInAnalytics(): Promise<void> {
  if (!initialized) return;
  const posthog = await getPostHog();
  posthog.opt_in_capturing();
}
