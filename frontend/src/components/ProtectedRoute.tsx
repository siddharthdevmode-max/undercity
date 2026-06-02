import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';

interface Props {
  children: React.ReactNode;
}

// ============================================================
// PROTECTED ROUTE
// Reads from AuthContext — no own Firebase listener
// One listener for the whole app in AuthProvider
// ============================================================

export default function ProtectedRoute({ children }: Props) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-text">Entering Undercity...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
