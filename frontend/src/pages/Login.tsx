import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { auth } from '../firebase';
import { authAPI } from '../services/api';
import { getFriendlyError } from '../utils/firebaseErrors';
import { useAuth } from '../hooks/useAuth';
import Header from '../components/Header';
import hero from '../assets/hero.png';
import '../styles/Landing.css';
import '../styles/Register.css';

const MAX_ATTEMPTS        = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000;

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
  const [attempts, setAttempts]         = useState(0);
  const [lockedUntil, setLockedUntil]   = useState<number | null>(loadLockout);
  const [now, setNow]                   = useState(() => Date.now());

  const emailRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { user, setUser } = useAuth();

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
      // Returning user — use me() not sync()
      // sync() is for registration only
      // AuthContext onAuthStateChanged will also call me() but we
      // setUser here directly to avoid the loading flash
      const loggedInUser = await authAPI.me();
      setUser(loggedInUser);
      setAttempts(0);
      // Client-side UX only — not a security control.
      // Real brute force protection is in backend bruteForceProtection middleware.
      localStorage.removeItem('login_lockout');
      navigate('/home');
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

  return (
    <div className="landing-page">
      <Header />
      <section className="about-section">
        <div className="about-content">

          {/* ── Left: Login Form ── */}
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

            <form onSubmit={handleSubmit} className="register-modern-form" noValidate>
              <input
                ref={emailRef}
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || isLocked}
                required
              />

              <div className="password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading || isLocked}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
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
                    disabled={loading || isLocked}
                  />
                  <span>Stay logged in</span>
                </label>
                <button
                  type="button"
                  className="forgot-link"
                  onClick={handleForgotPassword}
                  disabled={loading}
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                className="cta-button"
                disabled={loading || isLocked}
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

            {/* ── Session Intel Strip ── */}
            <div className="auth-intel-strip">
              <span>⚡ Persistent world</span>
              <span>🔒 Secure login</span>
              <span>🏙️ Your city waits</span>
            </div>

            <p className="register-login">
              New to the streets? <Link to="/register">Create an account</Link>
            </p>
          </div>

          {/* ── Right: Hero Image ── */}
          <div className="about-image">
            <img src={hero} alt="Undercity skyline" />
          </div>

        </div>
      </section>
    </div>
  );
}
