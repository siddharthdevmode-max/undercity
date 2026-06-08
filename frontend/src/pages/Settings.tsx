import { useState } from 'react';
import Shell from '../components/Shell';
import Icon from '../components/ui/Icon';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { toast } from '../utils/toast';
import { apiCall } from '../services/api';

export default function Settings() {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const auth      = getAuth();
  const [deleting,           setDeleting]           = useState(false);
  const [showDeleteConfirm,  setShowDeleteConfirm]  = useState(false);
  const [confirmText,        setConfirmText]        = useState('');
  const [exportingData,      setExportingData]      = useState(false);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch {
      toast.error('Logout failed. Please try again.');
    }
  };

  // FIX: GDPR export needs auth token — cannot use plain <a> href
  // apiCall() injects the Firebase Bearer token automatically
  const handleExportData = async () => {
    setExportingData(true);
    try {
      const blob = await apiCall<Blob>('/v1/gdpr/export', {
        headers: { Accept: 'application/json' },
      });
      const url      = URL.createObjectURL(new Blob([JSON.stringify(blob, null, 2)], { type: 'application/json' }));
      const anchor   = document.createElement('a');
      anchor.href    = url;
      anchor.download = `undercity-data-${user?.username ?? 'export'}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success('Data export downloaded.');
    } catch {
      toast.error('Export failed. Please try again.');
    } finally {
      setExportingData(false);
    }
  };

  const handleViewData = async () => {
    try {
      const data = await apiCall('/v1/gdpr/my-data');
      const url  = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      );
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      toast.error('Failed to fetch your data. Please try again.');
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmText !== 'DELETE MY ACCOUNT') {
      toast.error('Type exactly: DELETE MY ACCOUNT');
      return;
    }
    setDeleting(true);
    try {
      await apiCall('/v1/gdpr/delete-account', {
        method: 'DELETE',
        body:   JSON.stringify({ confirmPhrase: 'DELETE MY ACCOUNT' }),
      });
      await signOut(auth);
      toast.success('Account deleted. Your data will be purged within 30 days.');
      navigate('/');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const S = {
    page:   { maxWidth: 560, margin: '0 auto', padding: '2rem 1rem' },
    card:   { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1.5rem', marginBottom: '1rem' },
    danger: { background: 'var(--color-surface)', border: '1px solid var(--color-error)', borderRadius: 8, padding: '1.5rem' },
    label:  { fontSize: '0.85rem', color: 'var(--color-muted)', letterSpacing: '0.1em', margin: '0 0 1rem' as const },
    row:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } as const,
    muted:  { color: 'var(--color-muted)', fontSize: '0.9rem' },
    btn:    { background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 6, padding: '0.6rem 1.25rem', color: 'var(--color-text)', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' } as const,
    link:   { background: 'none', border: 'none', color: 'var(--color-accent)', fontSize: '0.9rem', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' } as const,
  };

  return (
    <Shell>
      <div style={S.page}>

        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
          <Icon name="admin" size={24} className="icon-accent" />
          Settings
        </h1>

        {/* Account Info */}
        <div style={S.card}>
          <h3 style={S.label}>ACCOUNT INFO</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {([
              ['Username',     user?.username],
              ['Email',        user?.email],
              ['Level',        user?.level],
              ['Tier',         user?.userTier ?? 'player'],
              ['Member since', user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'],
            ] as [string, string | number | undefined][]).map(([k, v]) => (
              <div key={k} style={S.row}>
                <span style={S.muted}>{k}</span>
                <span style={{ fontWeight: 600, textTransform: k === 'Tier' ? 'capitalize' : 'none' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* GDPR */}
        <div style={S.card}>
          <h3 style={S.label}>YOUR DATA</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* FIX: Use buttons + apiCall instead of raw <a> tags */}
            <button
              onClick={handleExportData}
              disabled={exportingData}
              style={S.link}
            >
              <Icon name="download" size={14} />
              {exportingData ? 'Preparing export...' : 'Download my data (GDPR Art. 20)'}
            </button>
            <button
              onClick={handleViewData}
              style={S.link}
            >
              <Icon name="info" size={14} />
              View data we hold (GDPR Art. 15)
            </button>
          </div>
        </div>

        {/* Session */}
        <div style={S.card}>
          <h3 style={S.label}>SESSION</h3>
          <button onClick={handleLogout} style={S.btn}>
            <Icon name="logout" size={16} /> Log Out
          </button>
        </div>

        {/* Danger zone */}
        <div style={S.danger}>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--color-error)', letterSpacing: '0.1em' }}>
            DANGER ZONE
          </h3>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Permanently delete your account and all associated data. This cannot be undone.
          </p>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              style={{ ...S.btn, border: '1px solid var(--color-error)', color: 'var(--color-error)' }}
            >
              Delete Account
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{ color: 'var(--color-error)', fontSize: '0.85rem', margin: 0 }}>
                Type <strong>DELETE MY ACCOUNT</strong> to confirm:
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE MY ACCOUNT"
                style={{ background: 'var(--color-bg)', border: '1px solid var(--color-error)', borderRadius: 6, padding: '0.6rem 1rem', color: 'var(--color-text)', fontSize: '0.9rem' }}
              />
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting || confirmText !== 'DELETE MY ACCOUNT'}
                  style={{
                    background:   confirmText === 'DELETE MY ACCOUNT' ? 'var(--color-error)' : 'transparent',
                    border:       '1px solid var(--color-error)',
                    borderRadius: 6,
                    padding:      '0.6rem 1.25rem',
                    color:        confirmText === 'DELETE MY ACCOUNT' ? '#fff' : 'var(--color-error)',
                    cursor:       deleting ? 'not-allowed' : 'pointer',
                    fontSize:     '0.9rem',
                    opacity:      deleting ? 0.7 : 1,
                  }}
                >
                  {deleting ? 'Deleting...' : 'Confirm Delete'}
                </button>
                <button
                  onClick={() => { setShowDeleteConfirm(false); setConfirmText(''); }}
                  style={{ ...S.btn, color: 'var(--color-muted)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </Shell>
  );
}
