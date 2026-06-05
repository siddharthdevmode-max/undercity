import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import '../styles/NotFound.css';

export default function NotFound() {
  const navigate      = useNavigate();
  const [count, setCount] = useState(10);

  useEffect(() => {
    if (count <= 0) { navigate('/', { replace: true }); return; }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count, navigate]);

  return (
    <div className="nf-page">
      <div className="nf-glow" aria-hidden="true" />

      <div className="nf-content">
        <div className="nf-icon">🕵️</div>

        <div className="nf-code-row">
          <span className="nf-code">4</span>
          <span className="nf-code nf-code-accent">0</span>
          <span className="nf-code">4</span>
        </div>

        <div className="nf-divider">
          <span className="nf-line" />
          <span className="nf-diamond">◆</span>
          <span className="nf-line" />
        </div>

        <h2 className="nf-title">Wrong alley, stranger</h2>
        <p className="nf-desc">
          This page doesn't exist in the Undercity.{' '}
          Redirecting you back in{' '}
          <span className="nf-countdown">{count}s</span>
        </p>

        <div className="nf-actions">
          <button className="nf-btn nf-btn-ghost" onClick={() => navigate(-1)}>
            ← Go Back
          </button>
          <button className="nf-btn nf-btn-primary" onClick={() => navigate('/', { replace: true })}>
            Go Home
          </button>
        </div>

        <div className="nf-badge">UNDERCITY · PAGE NOT FOUND</div>
      </div>
    </div>
  );
}
