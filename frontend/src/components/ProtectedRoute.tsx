import { useAuth } from '../hooks/useAuth';
import { Navigate, useLocation } from 'react-router-dom';

interface Props {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: Props) {
  const { user, loading, error } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-text">Entering Undercity...</div>
      </div>
    );
  }

  // FIX: Network error ≠ logged out.
  // If we have an error but no user, show retry instead of
  // bouncing the player to /login (which clears their session).
  if (error && !user) {
    return (
      <div className="loading-screen">
        <div style={{ textAlign: 'center' }}>
          <div className="loading-text" style={{ color: 'var(--color-error)' }}>
            Connection failed
          </div>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Could not load your profile. Check your connection.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop:    '1rem',
              background:   'var(--color-accent)',
              border:       'none',
              borderRadius: 6,
              padding:      '0.6rem 1.5rem',
              color:        '#000',
              cursor:       'pointer',
              fontWeight:   600,
              fontSize:     '0.9rem',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Redirect to onboarding if not completed
  if (!user.onboardingCompleted && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
