import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import '../styles/ErrorBoundary.css';

// ============================================================
// ERROR BOUNDARY
// Catches React rendering errors and shows fallback UI.
// Reports to Sentry in production automatically.
// ============================================================

interface Props {
  children:  ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError:  boolean;
  error:     Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    if (import.meta.env.DEV) {
      console.error('💥 ErrorBoundary caught:', error, errorInfo);
    }

    // Report to Sentry — Sentry.init() is a no-op if DSN not set
    Sentry.captureException(error, {
      extra: {
        componentStack: errorInfo.componentStack,
      },
    });
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="eb-page">
          <div className="eb-glow" aria-hidden="true" />

          <div className="eb-content">
            <div className="eb-icon">💥</div>

            <div className="eb-divider">
              <span className="eb-line" />
              <span className="eb-diamond">◆</span>
              <span className="eb-line" />
            </div>

            <h1 className="eb-title">Something went wrong</h1>
            <p className="eb-desc">
              An unexpected error occurred. The team has been notified.
              Try refreshing or go back to home.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <details className="eb-details">
                <summary className="eb-details-summary">
                  🔍 Error Details (dev only)
                </summary>
                <pre className="eb-stack">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="eb-actions">
              <button className="eb-btn eb-btn-primary" onClick={this.handleReset}>
                Try Again
              </button>
              <button
                className="eb-btn eb-btn-ghost"
                onClick={() => { window.location.href = '/'; }}
              >
                Go Home
              </button>
            </div>

            <div className="eb-badge">UNDERCITY · CRITICAL ERROR</div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
