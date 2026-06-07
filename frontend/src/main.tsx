// ============================================================
// MAIN ENTRY — UNDERCITY
// Provider order (outermost → innermost):
//   StrictMode → Sentry → QueryClient → Theme → AgeGate → App
//
// Sentry must wrap everything to catch all React errors.
// QueryClient and Theme are here — NOT duplicated in App.tsx.
// PostHog initialized after cookie consent via CookieBanner.
// ============================================================

import "./styles/global-polish.css";
import "./index.css";

import { StrictMode }              from "react";
import { createRoot }              from "react-dom/client";
import * as Sentry                 from "@sentry/react";
import { QueryClientProvider }     from "@tanstack/react-query";
import { ReactQueryDevtools }      from "@tanstack/react-query-devtools";
import { ThemeProvider }           from "./context/ThemeContext";
import { queryClient }             from "./lib/queryClient";
import AgeGate                     from "./components/AgeGate";
import CookieBanner                from "./components/CookieBanner";
import App                         from "./App.tsx";

// ── Sentry (frontend) ──────────────────────────────────────
// Initialize before React renders so all errors are captured.
// DSN is optional — missing = Sentry silently disabled.
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

if (SENTRY_DSN) {
  Sentry.init({
    dsn:         SENTRY_DSN,
    environment: import.meta.env.MODE,
    release:     import.meta.env.VITE_SENTRY_RELEASE as string | undefined,

    // Only trace 10% of transactions in production
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,

    // Don't send PII
    sendDefaultPii: false,

    // Ignore noise
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "Network request failed",
      "Load failed",
      "Failed to fetch",
      /^AbortError/,
    ],

    integrations: [
      Sentry.browserTracingIntegration(),
    ],
  });
}

// ── Root render ────────────────────────────────────────────
// QueryClientProvider and ThemeProvider live HERE only.
// App.tsx must NOT re-wrap them (would cause double context).

const container = document.getElementById("root");
if (!container) throw new Error("Root element #root not found in index.html");

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AgeGate>
          <App />
          <CookieBanner />
        </AgeGate>
      </ThemeProvider>
      {import.meta.env.DEV && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  </StrictMode>
);
