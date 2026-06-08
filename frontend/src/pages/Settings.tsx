import { useState } from 'react';
import Shell from '../components/Shell';
import Icon from '../components/ui/Icon';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { toast } from '../utils/toast';

export default function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const auth = getAuth();
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch {
      toast.error('Logout failed. Please try again.');
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmText !== 'DELETE MY ACCOUNT') {
      toast.error('Type exactly: DELETE MY ACCOUNT');
      return;
    }
    setDeleting(true);
    try {
      // Call GDPR delete endpoint
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/v1/gdpr/delete-account', {
        method:  'DELETE',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token ?? ''}`,
        },
        body: JSON.stringify({ confirmPhrase: 'DELETE MY ACCOUNT' }),
      });
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        throw new Error(err.message ?? 'Delete failed');
      }
      await signOut(auth);
      toast.success('Account deleted. Your data will be purged within 30 days.');
      navigate('/');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Shell>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '2rem 1rem' }}>

        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
          <Icon name="admin" size={24} className="icon-accent" />
          Settings
        </h1>

        {/* Account Info */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1.5rem', marginBottom: '1rem' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--color-muted)', letterSpacing: '0.1em' }}>
            ACCOUNT INFO
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Username</span>
              <span style={{ fontWeight: 600 }}>{user?.username}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Email</span>
              <span>{user?.email}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Level</span>
              <span>{user?.level}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Tier</span>
              <span style={{ textTransform: 'capitalize' }}>{user?.userTier ?? 'player'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Member since</span>
              <span>{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</span>
            </div>
          </div>
        </div>

        {/* GDPR */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1.5rem', marginBottom: '1rem' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--color-muted)', letterSpacing: '0.1em' }}>
            YOUR DATA
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <a
              href="/api/v1/gdpr/export"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--color-accent)', fontSize: '0.9rem', textDecoration: 'none' }}
            >
              <Icon name="download" size={14} /> Download my data (GDPR Art. 20)
            </a>
            <a
              href="/api/v1/gdpr/my-data"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--color-accent)', fontSize: '0.9rem', textDecoration: 'none' }}
            >
              <Icon name="info" size={14} /> View data we hold (GDPR Art. 15)
            </a>
          </div>
        </div>

        {/* Session */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1.5rem', marginBottom: '1rem' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--color-muted)', letterSpacing: '0.1em' }}>
            SESSION
          </h3>
          <button
            onClick={handleLogout}
            style={{
              background:   'transparent',
              border:       '1px solid var(--color-border)',
              borderRadius: 6,
              padding:      '0.6rem 1.25rem',
              color:        'var(--color-text)',
              cursor:       'pointer',
              fontSize:     '0.9rem',
              display:      'flex',
              alignItems:   'center',
              gap:          '0.5rem',
            }}
          >
            <Icon name="logout" size={16} /> Log Out
          </button>
        </div>

        {/* Danger zone */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-error)', borderRadius: 8, padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--color-error)', letterSpacing: '0.1em' }}>
            DANGER ZONE
          </h3>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Permanently delete your account and all associated data. This cannot be undone.
          </p>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              style={{
                background:   'transparent',
                border:       '1px solid var(--color-error)',
                borderRadius: 6,
                padding:      '0.6rem 1.25rem',
                color:        'var(--color-error)',
                cursor:       'pointer',
                fontSize:     '0.9rem',
              }}
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
                style={{
                  background:   'var(--color-bg)',
                  border:       '1px solid var(--color-error)',
                  borderRadius: 6,
                  padding:      '0.6rem 1rem',
                  color:        'var(--color-text)',
                  fontSize:     '0.9rem',
                }}
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
                  style={{
                    background:   'transparent',
                    border:       '1px solid var(--color-border)',
                    borderRadius: 6,
                    padding:      '0.6rem 1.25rem',
                    color:        'var(--color-muted)',
                    cursor:       'pointer',
                    fontSize:     '0.9rem',
                  }}
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
