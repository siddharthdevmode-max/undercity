import { useState } from 'react';
import '../styles/AgeGate.css';
import { setAgeVerified } from '../utils/ageVerification';

// ============================================================
// AGE GATE - 18+ verification
// Shown once on first visit. Stores decision in localStorage.
// ============================================================

interface AgeGateProps {
  children: React.ReactNode;
}

export default function AgeGate({ children }: AgeGateProps) {
  const [verified, setVerified] = useState<boolean>(() => {
    try { return localStorage.getItem('uc_age_verified') === 'true'; }
    catch { return false; }
  });
  const [declined, setDeclined] = useState(false);
  const [checked,  setChecked]  = useState(false);
  const [error,    setError]    = useState('');

  if (verified) return <>{children}</>;

  if (declined) {
    return (
      <div className="ag-page">
        <div className="ag-declined">
          <div className="ag-declined-icon">🚫</div>
          <h1 className="ag-declined-title">Access Restricted</h1>
          <p className="ag-declined-body">
            You must be 18 or older to access Undercity.
            This site contains mature content including simulated
            crime and gambling themes.
          </p>
          <p className="ag-declined-contact">
            If you believe this is an error, contact{' '}
            <a href="mailto:support@undercity.app">
              support@undercity.app
            </a>
          </p>
        </div>
      </div>
    );
  }

  const handleConfirm = () => {
    if (!checked) {
      setError('Please confirm you are 18 or older to continue.');
      return;
    }
    setAgeVerified();
    setVerified(true);
  };

  return (
    <div className="ag-page">
      <div className="ag-brand">
        <div className="ag-brand-name">UNDERCITY</div>
        <div className="ag-brand-sub">Text-Based Crime MMO</div>
      </div>

      <div
        className="ag-card"
        role="dialog"
        aria-modal="true"
        aria-label="Age verification"
      >
        <div className="ag-card-icon">🔞</div>
        <h1 className="ag-card-title">Age Verification Required</h1>
        <p className="ag-card-body">
          Undercity contains mature content including simulated crime,
          violence, and gambling themes. You must be{' '}
          <strong>18 years or older</strong> to enter.
        </p>

        <div className="ag-warnings">
          <div className="ag-warnings-label">This site contains:</div>
          <div className="ag-warning-item">Simulated criminal activity</div>
          <div className="ag-warning-item">Simulated violence</div>
          <div className="ag-warning-item">Simulated gambling</div>
          <div className="ag-warning-item">Mature themes</div>
        </div>

        <label className="ag-check-label">
          <input
            type="checkbox"
            className="ag-checkbox"
            checked={checked}
            onChange={(e) => {
              setChecked(e.target.checked);
              if (e.target.checked) setError('');
            }}
          />
          <span>
            I confirm I am <strong>18 years or older</strong> and agree to the{' '}
            <a href="/legal/terms">Terms of Service</a> and{' '}
            <a href="/legal/privacy">Privacy Policy</a>.
          </span>
        </label>

        {error && <p className="ag-error" role="alert">{error}</p>}

        <div className="ag-actions">
          <button
            className="ag-btn ag-btn-primary"
            onClick={handleConfirm}
          >
            I Am 18+ — Enter
          </button>
          <button
            className="ag-btn ag-btn-ghost"
            onClick={() => setDeclined(true)}
          >
            Exit
          </button>
        </div>
      </div>

      <p className="ag-footnote">
        By entering, you confirm compliance with your local laws
        regarding mature content.
      </p>
    </div>
  );
}
