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
import Header from '../components/Header';
import hero from '../assets/hero.png';
import '../styles/Landing.css';
import '../styles/Register.css';

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Auto-focus email on mount
  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  // Load lockout state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('login_lockout');
    if (stored) {
      const until = parseInt(stored, 10);
      if (until > Date.now()) {
        setLockedUntil(until);
      } else {
        localStorage.removeItem('login_lockout');
      }
    }
  }, []);

  // Countdown for lockout
  useEffect(() => {
    if (!lockedUntil) return;
    const id = setInterval(() => {
      if (Date.now() >= lockedUntil) {
        setLockedUntil(null);
        setAttempts(0);
        localStorage.removeItem('login_lockout');
        clearInterval(id);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const minutesLeft = lockedUntil
    ? Math.ceil((lockedUntil - Date.now()) / 60000)
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');

    if (lockedUntil && Date.now() < lockedUntil) {
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
      await authAPI.sync();
      // Reset attempts on success
      setAttempts(0);
      localStorage.removeItem('login_lockout');
      navigate('/home');
    } catch (err: any) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      if (newAttempts >= MAX_ATTEMPTS) {
        const until = Date.now() + LOCKOUT_DURATION_MS;
        setLockedUntil(until);
        localStorage.setItem('login_lockout', until.toString());
        setError(`Too many failed attempts. Locked for 5 minutes.`);
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
    } catch (err: any) {
      setError(getFriendlyError(err));
    }
  };

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;

  return (
    <div className="landing-page">
      <Header />
      <section className="about-section">
        <div className="about-content">
          <div className="about-text register-modern-wrapper">

            <h1 className="register-title">WELCOME BACK</h1>
            <span className="register-subtitle">The city missed you</span>
            <div className="register-divider" />

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

              <button type="submit" className="cta-button" disabled={loading || isLocked}>
                {loading ? (
                  <>
                    <span className="spinner" />
                    ACCESSING...
                  </>
                ) : isLocked ? (
                  `LOCKED — ${minutesLeft} MIN`
                ) : (
                  'ENTER THE CITY'
                )}
              </button>

              {error && <p className="register-error">{error}</p>}
              {info && <p className="register-info">{info}</p>}

              <p className="register-login">
                Don't have an account? <Link to="/register">Register</Link>
              </p>

            </form>

          </div>

          <div className="about-image">
            <img src={hero} alt="Undercity skyline" />
          </div>

        </div>
      </section>
    </div>
  );
}
