import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import { auth } from '../firebase';
import { authAPI } from '../services/api';
import { getFriendlyError } from '../utils/firebaseErrors';
import { useAuth } from '../hooks/useAuth';
import Header from '../components/Header';
import hero from '../assets/hero.webp';
import '../styles/Landing.css';
import '../styles/Register.css';

const MAX_ATTEMPTS        = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000;
const googleProvider      = new GoogleAuthProvider();

function loadLockout(): number | null {
  const stored = localStorage.getItem('login_lockout');
  if (!stored) return null;
  const until = parseInt(stored, 10);
  if (until > Date.now()) return until;
  localStorage.removeItem('login_lockout');
  return null;
}

export default function Login() {
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(true);
  const [error, setError]               = useState('');
  const [info, setInfo]                 = useState('');
  const [loading, setLoading]           = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [attempts, setAttempts]         = useState(0);
  const [lockedUntil, setLockedUntil]   = useState<number | null>(loadLockout);
  const [now, setNow]                   = useState(() => Date.now());

  const emailRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  useEffect(() => { if (user) navigate('/home'); }, [user, navigate]);
  useEffect(() => { emailRef.current?.focus(); }, []);

  useEffect(() => {
    if (!lockedUntil) return;
    const id = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= lockedUntil) {
        setLockedUntil(null);
        setAttempts(0);
        localStorage.removeItem('login_lockout');
        clearInterval(id);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const isLocked    = lockedUntil !== null && now < lockedUntil;
  const minutesLeft = lockedUntil ? Math.ceil((lockedUntil - now) / 60000) : 0;

  // ── Email/password login ──────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (isLocked) {
      setError(`Too many failed attempts. Try again in ${minutesLeft} min.`);
      return;
    }
    setLoading(true);
    try {
      await setPersistence(
        auth,
        stayLoggedIn ? browserLocalPersistence : browserSessionPersistence
      );
      await signInWithEmailAndPassword(auth, email, password);
      setAttempts(0);
      localStorage.removeItem('login_lockout');
      // AuthContext onAuthStateChanged fires → refreshUser → navigate
    } catch (err: unknown) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= MAX_ATTEMPTS) {
        const until = Date.now() + LOCKOUT_DURATION_MS;
        setLockedUntil(until);
        setNow(Date.now());
        localStorage.setItem('login_lockout', until.toString());
        setError('Too many failed attempts. Locked for 5 minutes.');
      } else {
        const remaining = MAX_ATTEMPTS - newAttempts;
        setError(`${getFriendlyError(err)} (${remaining} attempts left)`);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Google Sign-In ────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;

      // Force fresh token
      await fbUser.getIdToken(true);

      // Sync with backend — creates DB record if first time
      // Username defaults to display name or null (backend handles it)
      await authAPI.sync();
      await refreshUser();

      navigate('/home');
    } catch (err: unknown) {
      setError(getFriendlyError(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    setInfo('');
    if (!email) {
      setError('Enter your email above first, then click forgot password.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setInfo(`Reset email sent to ${email}. Check your inbox.`);
    } catch (err: unknown) {
      setError(getFriendlyError(err));
    }
  };

  const anyLoading = loading || googleLoading;

  return (
    <div className="landing-page">
      <Header />
      <section className="about-section">
        <div className="about-content">
          <div className="about-text register-modern-wrapper">

            <span className="hero-eyebrow">UNDERCITY AWAITS</span>
            <h1 className="auth-title">
              RETURN TO<br />
              <span className="accent">THE CITY</span>
            </h1>
            <div className="divider">
              <span className="line" />
              <span className="diamond">◆</span>
              <span className="line" />
            </div>
            <p className="auth-supporting">
              Your empire is still breathing.<br />
              The streets never stopped moving.
            </p>

            {/* ── Google Sign-In ── */}
            <button
              type="button"
              className="google-signin-btn"
              onClick={handleGoogleSignIn}
              disabled={anyLoading || isLocked}
              aria-label="Sign in with Google"
            >
              {googleLoading ? (
                <><span className="spinner" />SIGNING IN...</>
              ) : (
                <>
                  <GoogleIcon />
                  CONTINUE WITH GOOGLE
                </>
              )}
            </button>

            {/* ── Divider ── */}
            <div className="auth-or-divider">
              <span className="auth-or-line" />
              <span className="auth-or-text">OR</span>
              <span className="auth-or-line" />
            </div>

            {/* ── Email/password form ── */}
            <form onSubmit={handleSubmit} className="register-modern-form" noValidate>
              <input
                ref={emailRef}
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={anyLoading || isLocked}
                autoComplete="email"
                required
              />

              <div className="password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={anyLoading || isLocked}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'HIDE' : 'SHOW'}
                </button>
              </div>

              <div className="login-row">
                <label className="stay-logged">
                  <input
                    type="checkbox"
                    checked={stayLoggedIn}
                    onChange={(e) => setStayLoggedIn(e.target.checked)}
                    disabled={anyLoading || isLocked}
                  />
                  <span>Stay logged in</span>
                </label>
                <button
                  type="button"
                  className="forgot-link"
                  onClick={handleForgotPassword}
                  disabled={anyLoading}
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                className="cta-button"
                disabled={anyLoading || isLocked}
              >
                {loading ? (
                  <><span className="spinner" />ACCESSING...</>
                ) : isLocked ? (
                  `LOCKED — ${minutesLeft} MIN`
                ) : (
                  <>ENTER THE CITY <span className="arrow">→</span></>
                )}
              </button>

              {error && (
                <p role="alert" aria-live="polite" className="register-error">{error}</p>
              )}
              {info && (
                <p className="register-info" role="status" aria-live="polite">{info}</p>
              )}
            </form>

            <div className="auth-intel-strip">
              <span>⚡ Persistent world</span>
              <span>🔒 Secure login</span>
              <span>🏙️ Your city waits</span>
            </div>

            <p className="register-login">
              New to the streets? <Link to="/register">Create an account</Link>
            </p>
          </div>

          <div className="about-image">
            <img src={hero} alt="Undercity skyline" />
          </div>
        </div>
      </section>
    </div>
  );
}

// ── Google SVG Icon ───────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
      <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
      <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
      <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
    </svg>
  );
}
