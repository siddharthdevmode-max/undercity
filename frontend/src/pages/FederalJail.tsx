// ============================================================
// FEDERAL JAIL — redirects to unified Jail page
// The Jail page handles both normal and federal jail timers.
// A separate route exists for direct linking but renders
// the same component — federal status is derived from user data.
// ============================================================

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Shell from '../components/Shell';

export default function FederalJail() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/jail', { replace: true });
  }, [navigate]);

  return (
    <Shell>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
        <div style={{ color: 'var(--color-muted)' }}>Redirecting...</div>
      </div>
    </Shell>
  );
}
