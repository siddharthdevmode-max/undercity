import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Shell from './Shell';
import '../styles/Admin.css';

interface Props {
  children: React.ReactNode;
}

/**
 * AdminRoute — wraps admin-only pages.
 *
 * Access granted if user is admin OR developer.
 * Non-admins are redirected to /home (no info leak about the route existing).
 *
 * Note: backend ALSO enforces this via requireAdmin middleware,
 * so this is just for clean UX. Never trust client-side checks for security.
 */
export default function AdminRoute({ children }: Props) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen" role="status" aria-live="polite">
        <div className="loading-text">Entering Undercity...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.onboardingCompleted) {
    return <Navigate to="/onboarding" replace />;
  }

  const hasAccess = user.isAdmin === true || user.isDeveloper === true;

  if (!hasAccess) {
    // Soft denial — show a styled 403 page inside the Shell
    return (
      <Shell>
        <div className="forbidden-page">
          <div className="forbidden-card">
            <div className="forbidden-code">403</div>
            <h1 className="forbidden-title">ACCESS DENIED</h1>
            <p className="forbidden-message">
              This area is restricted to administrators. If you believe this is
              an error, contact support.
            </p>
            <a href="/home" className="forbidden-link">← Back to Home</a>
          </div>
        </div>
      </Shell>
    );
  }

  return <>{children}</>;
}
