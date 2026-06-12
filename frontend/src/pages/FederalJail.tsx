import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Shell from '../components/Shell';
import Icon from '../components/ui/Icon';
import { useAuth } from '../hooks/useAuth';
import '../styles/Jail.css';

export default function FederalJail() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [countdown, setCountdown] = useState('');

  const fedUntil = useMemo(() => user?.federalJailUntil ? new Date(user.federalJailUntil) : null, [user]);
  const isFed = fedUntil && fedUntil > new Date();

  useEffect(() => {
    if (!isFed) {
      navigate('/jail', { replace: true });
      return;
    }
    const id = setInterval(() => {
      const now = Date.now();
      const remaining = fedUntil!.getTime() - now;
      if (remaining <= 0) {
        navigate('/home', { replace: true });
        return;
      }
      const m = Math.floor(remaining / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setCountdown(`${m}m ${s}s`);
    }, 1000);
    return () => clearInterval(id);
  }, [fedUntil, isFed, navigate]);

  return (
    <Shell>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '50vh', gap: '1.5rem', padding: '2rem', textAlign: 'center',
      }}>
        <Icon name="federal-jail" size={64} className="icon-error" />
        <h1 style={{ margin: 0, color: 'var(--color-error)', fontSize: '1.5rem' }}>
          FEDERAL DETENTION CENTER
        </h1>
        <p style={{ color: 'var(--color-muted)', maxWidth: 400, margin: 0 }}>
          You've been remanded to federal custody. This is a high-security facility — no bail, no early release.
        </p>
        <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>
          {countdown || 'Calculating...'}
        </div>
        <div style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>
          All game actions are disabled while in federal custody.
        </div>
      </div>
    </Shell>
  );
}