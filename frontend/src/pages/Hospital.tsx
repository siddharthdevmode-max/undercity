import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Shell from '../components/Shell';
import Icon  from '../components/ui/Icon';
import { useAuth } from '../hooks/useAuth';

function formatTimer(seconds: number): string {
  if (seconds <= 0) return 'Discharged';
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

export default function Hospital() {
  const { user, refreshUser } = useAuth();
  const [now, setNow]         = useState(() => Date.now());
  const wasHospitalizedRef    = useRef(false);

  useEffect(() => {
    if (!user?.hospitalUntil) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [user?.hospitalUntil]);

  const hospitalSeconds = getSecondsRemaining(user?.hospitalUntil ?? null, now);
  const isHospitalized  = hospitalSeconds > 0;

  // ── Auto-refresh when discharged ─────────────────────────
  useEffect(() => {
    if (isHospitalized) {
      wasHospitalizedRef.current = true;
    } else if (wasHospitalizedRef.current) {
      wasHospitalizedRef.current = false;
      void refreshUser();
    }
  }, [isHospitalized, refreshUser]);

  const lifePercent = Math.round(
    ((user?.life ?? 0) / Math.max(user?.maxLife ?? 100, 1)) * 100
  );

  return (
    <Shell>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '2rem 1rem' }}>

        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <Icon name="hospital" size={28} className="icon-error" />
            Hospital
          </h1>
          <p style={{ color: 'var(--color-muted)', marginTop: '0.5rem' }}>
            {isHospitalized
              ? "You're recovering from your injuries."
              : "You're in good health. Keep it that way."}
          </p>
        </div>

        {isHospitalized ? (
          <div style={{
            background:   'var(--color-surface)',
            border:       '1px solid var(--color-error)',
            borderRadius: 8,
            padding:      '2rem',
            textAlign:    'center',
          }}>
            <div style={{
              fontSize:     '3rem',
              fontWeight:   700,
              color:        'var(--color-error)',
              fontFamily:   'monospace',
              marginBottom: '0.5rem',
            }}>
              {formatTimer(hospitalSeconds)}
            </div>
            <p style={{ color: 'var(--color-muted)', marginBottom: '1.5rem' }}>
              Estimated recovery time
            </p>

            <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
              <div style={{
                display:        'flex',
                justifyContent: 'space-between',
                marginBottom:   '0.4rem',
                fontSize:       '0.85rem',
              }}>
                <span style={{ color: 'var(--color-muted)' }}>
                  <Icon name="life" size={12} className="icon-error" /> Life
                </span>
                <span>{user?.life ?? 0} / {user?.maxLife ?? 100}</span>
              </div>
              <div style={{ height: 8, background: 'var(--color-bg)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height:     '100%',
                  width:      `${lifePercent}%`,
                  background: 'var(--color-error)',
                  borderRadius: 4,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>

            <div style={{
              background:   'var(--color-bg)',
              borderRadius: 6,
              padding:      '1rem',
              textAlign:    'left',
              fontSize:     '0.85rem',
              color:        'var(--color-muted)',
              lineHeight:   1.6,
            }}>
              <strong style={{ color: 'var(--color-text)' }}>While hospitalized:</strong>
              <ul style={{ margin: '0.5rem 0 0 1.25rem', padding: 0 }}>
                <li>You cannot commit crimes</li>
                <li>You cannot attack other players</li>
                <li>Life regenerates faster while recovering</li>
                <li>You will be discharged automatically</li>
              </ul>
            </div>
          </div>
        ) : (
          <div style={{
            background:   'var(--color-surface)',
            border:       '1px solid var(--color-border)',
            borderRadius: 8,
            padding:      '2rem',
            textAlign:    'center',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>💊</div>
            <h2 style={{ margin: '0 0 0.5rem' }}>You&apos;re healthy</h2>
            <p style={{ color: 'var(--color-muted)', marginBottom: '1.5rem' }}>
              Life: {user?.life ?? 0} / {user?.maxLife ?? 100}
            </p>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ height: 8, background: 'var(--color-bg)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height:       '100%',
                  width:        `${lifePercent}%`,
                  background:   lifePercent > 50 ? 'var(--color-success)' : lifePercent > 25 ? 'var(--color-warning)' : 'var(--color-error)',
                  borderRadius: 4,
                  transition:   'width 0.3s ease',
                }} />
              </div>
            </div>
            <Link to="/crimes" className="cta-button" style={{ display: 'inline-flex' }}>
              <Icon name="crime" size={16} /> Commit a Crime
            </Link>
          </div>
        )}

      </div>
    </Shell>
  );
}
