import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Shell from '../components/Shell';
import Icon  from '../components/ui/Icon';
import { useAuth } from '../hooks/useAuth';

// ── Timer formatter ────────────────────────────────────────
function formatTimer(seconds: number): string {
  if (seconds <= 0) return 'Released';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function getSecondsRemaining(until: string | null, currentTime: number): number {
  if (!until) return 0;
  return Math.max(0, Math.ceil((new Date(until).getTime() - currentTime) / 1000));
}

export default function Jail() {
  const { user } = useAuth();
  const [now, setNow] = useState(() => Date.now());

  // Only tick when actually locked — saves one interval when free
  const hasActiveTimer = !!(user?.jailUntil || user?.federalJailUntil);
  useEffect(() => {
    if (!hasActiveTimer) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasActiveTimer]);

  const jailSeconds    = getSecondsRemaining(user?.jailUntil        ?? null, now);
  const fedJailSeconds = getSecondsRemaining(user?.federalJailUntil ?? null, now);

  const isInFedJail = fedJailSeconds > 0;
  const isInJail    = jailSeconds    > 0;
  const isLocked    = isInJail || isInFedJail;
  const activeTimer = isInFedJail ? fedJailSeconds : jailSeconds;

  return (
    <Shell>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '2rem 1rem' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <Icon name={isInFedJail ? 'federal-jail' : 'jail'} size={28} className="icon-error" />
            {isInFedJail ? 'Federal Jail' : 'City Jail'}
          </h1>
          <p style={{ color: 'var(--color-muted)', marginTop: '0.5rem' }}>
            {isInFedJail
              ? 'You\'ve been detained by federal authorities.'
              : 'You\'re locked up in the city jail.'}
          </p>
        </div>

        {isLocked ? (
          /* ── Locked state ── */
          <div style={{
            background: 'var(--color-surface)',
            border:     '1px solid var(--color-error)',
            borderRadius: 8,
            padding:    '2rem',
            textAlign:  'center',
          }}>
            <div style={{
              fontSize:   '3rem',
              fontWeight: 700,
              color:      'var(--color-error)',
              fontFamily: 'monospace',
              marginBottom: '0.5rem',
            }}>
              {formatTimer(activeTimer)}
            </div>
            <p style={{ color: 'var(--color-muted)', marginBottom: '1.5rem' }}>
              Time remaining until release
            </p>

            {isInFedJail && isInJail && (
              <div style={{
                background:   'var(--color-bg)',
                borderRadius: 6,
                padding:      '0.75rem 1rem',
                marginBottom: '1rem',
                fontSize:     '0.85rem',
                color:        'var(--color-muted)',
              }}>
                <Icon name="jail" size={13} /> City jail: {formatTimer(jailSeconds)}
              </div>
            )}

            <div style={{
              background:   'var(--color-bg)',
              borderRadius: 6,
              padding:      '1rem',
              textAlign:    'left',
              fontSize:     '0.85rem',
              color:        'var(--color-muted)',
              lineHeight:   1.6,
            }}>
              <strong style={{ color: 'var(--color-text)' }}>While locked up:</strong>
              <ul style={{ margin: '0.5rem 0 0 1.25rem', padding: 0 }}>
                <li>You cannot commit crimes</li>
                <li>You cannot attack other players</li>
                <li>Your nerve regenerates normally</li>
                <li>You will be released automatically</li>
              </ul>
            </div>
          </div>
        ) : (
          /* ── Free state ── */
          <div style={{
            background:   'var(--color-surface)',
            border:       '1px solid var(--color-border)',
            borderRadius: 8,
            padding:      '2rem',
            textAlign:    'center',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🔓</div>
            <h2 style={{ margin: '0 0 0.5rem' }}>You\'re free</h2>
            <p style={{ color: 'var(--color-muted)', marginBottom: '1.5rem' }}>
              You\'re not currently in jail. Stay out of trouble.
            </p>
            <Link to="/crimes" className="cta-button" style={{ display: 'inline-flex' }}>
              <Icon name="crime" size={16} /> Commit a Crime
            </Link>
          </div>
        )}

        {/* Jail history placeholder */}
        <div style={{
          marginTop:    '2rem',
          background:   'var(--color-surface)',
          border:       '1px solid var(--color-border)',
          borderRadius: 8,
          padding:      '1.25rem',
        }}>
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'var(--color-muted)' }}>
            CRIMINAL RECORD
          </h3>
          <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: '0.85rem' }}>
            Full arrest history coming in a future update.
          </p>
        </div>

      </div>
    </Shell>
  );
}
