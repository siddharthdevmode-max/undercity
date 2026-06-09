import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from 'firebase/auth';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { auth } from '../firebase';
import { checkUsernameAvailable, authAPI } from '../services/api';
import { getFriendlyError } from '../utils/firebaseErrors';
import { useAuth } from '../hooks/useAuth';
import Header from '../components/Header';
import hero from '../assets/hero.webp';
import '../styles/Landing.css';
import '../styles/Register.css';

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';
type RegisterStage  = 'form' | 'verify-email' | 'google-username';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string;
const googleProvider     = new GoogleAuthProvider();

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getPasswordStrength(password: string) {
  if (password.length === 0) return { score: 0, label: '', color: '' };
  if (password.length < 6)   return { score: 1, label: 'Too short', color: '#ff4d4d' };
  let score = 0;
  if (password.length >= 6)  score++;
  if (password.length >= 10) score++;
  if (password.length >= 14) score++;
  if (password.length >= 18) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password))            score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  score = Math.min(score, 5);
  if (score <= 1)  return { score: 1, label: 'Weak',      color: '#ff4d4d' };
  if (score === 2) return { score: 2, label: 'Fair',      color: '#ff8c42' };
  if (score === 3) return { score: 3, label: 'Decent',    color: '#facc15' };
  if (score === 4) return { score: 4, label: 'Strong',    color: '#4ade80' };
  return             { score: 5, label: 'Excellent',  color: '#22c55e' };
}

export default function Register() {
  const [username, setUsername]               = useState('');
  const [email, setEmail]                     = useState('');
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword]       = useState(false);
  const [agreeTerms, setAgreeTerms]           = useState(false);
  const [error, setError]                     = useState('');
  const [loading, setLoading]                 = useState(false);
  const [googleLoading, setGoogleLoading]     = useState(false);
  const [stage, setStage]                     = useState<RegisterStage>('form');
  const [resendCooldown, setResendCooldown]   = useState(0);
  const [usernameStatus, setUsernameStatus]   = useState<UsernameStatus>('idle');
  const [usernameMessage, setUsernameMessage] = useState('');
  const [turnstileToken, setTurnstileToken]   = useState<string | null>(null);

  const usernameRef  = useRef<HTMLInputElement>(null);
  const googleUsernameRef = useRef<HTMLInputElement>(null);
  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const navigate     = useNavigate();

  const { user, refreshUser } = useAuth();

  const strength    = getPasswordStrength(password);
  const emailValid  = email.length > 0 && isValidEmail(email);
  const emailInvalid = email.length > 0 && !isValidEmail(email);

  useEffect(() => { if (user) navigate('/onboarding'); }, [user, navigate]);
  useEffect(() => { usernameRef.current?.focus(); }, []);
  useEffect(() => {
    if (stage === 'google-username') {
      setTimeout(() => googleUsernameRef.current?.focus(), 100);
    }
  }, [stage]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // ── Auto-poll for email verification every 3s ─────────────
  useEffect(() => {
    if (stage !== 'verify-email') return;
    let cancelled = false;

    const poll = async () => {
      try {
        await auth.currentUser?.reload();
        if (auth.currentUser?.emailVerified && !cancelled) {
          // Auto-proceed — no button click needed
          setLoading(true);
          try {
            await auth.currentUser.getIdToken(true);
            await authAPI.sync(username);
            await refreshUser();
            navigate('/onboarding');
          } catch (err: unknown) {
            if (!cancelled) {
              setError(getFriendlyError(err));
              setLoading(false);
            }
          }
        }
      } catch {
        // ignore reload errors
      }
    };

    const id = setInterval(() => { void poll(); }, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, [stage, username, navigate, refreshUser]);

  // Username availability check (debounced)
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!username) {
        setUsernameStatus('idle');
        setUsernameMessage('');
        return;
      }
      if (username.length < 3) {
        setUsernameStatus('invalid');
        setUsernameMessage('Min 3 characters');
        return;
      }
      setUsernameStatus('checking');
      try {
        const res = await checkUsernameAvailable(username);
        if (res.available) {
          setUsernameStatus('available');
          setUsernameMessage('Available');
        } else {
          setUsernameStatus(res.reason ? 'invalid' : 'taken');
          setUsernameMessage(res.reason ?? 'Already taken');
        }
      } catch {
        setUsernameStatus('idle');
      }
    }, username ? 500 : 0);
    return () => clearTimeout(timer);
  }, [username]);

  // ── Google Sign-Up ────────────────────────────────────────
  const handleGoogleSignUp = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      await fbUser.getIdToken(true);

      // Check if user already has a backend account
      try {
        await authAPI.me();
        // Already exists → just refresh and go home
        await refreshUser();
        navigate('/home');
        return;
      } catch {
        // New user → need username
        setStage('google-username');
      }
    } catch (err: unknown) {
      setError(getFriendlyError(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  // ── Google username completion ────────────────────────────
  const handleGoogleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (usernameStatus !== 'available') {
      setError('Please choose an available username.');
      return;
    }
    setLoading(true);
    try {
      await authAPI.sync(username);
      await refreshUser();
      navigate('/onboarding');
    } catch (err: unknown) {
      setError(getFriendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  // ── Email/password submit ─────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim())               return setError('Username is required.');
    if (usernameStatus !== 'available') return setError('Please choose an available username.');
    if (!isValidEmail(email))           return setError('Please enter a valid email address.');
    if (password !== confirmPassword)   return setError('Passwords do not match.');
    if (password.length < 6)            return setError('Password must be at least 6 characters.');
    if (!agreeTerms)                    return setError('You must agree to the terms.');
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      return setError('Please complete the security check.');
    }

    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser, {
          url: `${window.location.origin}/login`,
        });
      }
      setStage('verify-email');
      setResendCooldown(60);
    } catch (err: unknown) {
      setError(getFriendlyError(err));
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || !auth.currentUser) return;
    setError('');
    try {
      await sendEmailVerification(auth.currentUser, {
        url: `${window.location.origin}/login`,
      });
      setResendCooldown(60);
    } catch (err: unknown) {
      setError(getFriendlyError(err));
    }
  };

  const handleContinue = async () => {
    setError('');
    setLoading(true);
    try {
      await auth.currentUser?.reload();
      const refreshed = auth.currentUser;
      if (!refreshed?.emailVerified) {
        setError('Email not verified yet. Check your inbox and click the link.');
        setLoading(false);
        return;
      }
      await refreshed.getIdToken(true);
      await authAPI.sync(username);
      await refreshUser();
      navigate('/onboarding');
    } catch (err: unknown) {
      setError(getFriendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleBackToForm = async () => {
    try { await signOut(auth); } catch { /* ignore */ }
    setStage('form');
    setError('');
    setTurnstileToken(null);
    turnstileRef.current?.reset();
  };

  // ── Google username stage ─────────────────────────────────
  if (stage === 'google-username') {
    return (
      <div className="landing-page">
        <Header />
        <div className="auth-page-section">
          <div className="auth-form-col">
            <div className="register-modern-wrapper">
              <span className="hero-eyebrow">ONE LAST STEP</span>
              <h1 className="auth-title">
                CHOOSE YOUR<br />
                <span className="accent">STREET NAME</span>
              </h1>
              <div className="divider">
                <span className="line" />
                <span className="diamond">◆</span>
                <span className="line" />
              </div>
              <p className="auth-supporting">
                Your Google account is connected.<br />
                Now pick the name the streets will remember.
              </p>

              <form onSubmit={handleGoogleUsernameSubmit} className="register-modern-form" noValidate>
                <div className="input-with-status">
                  <input
                    ref={googleUsernameRef}
                    type="text"
                    placeholder="Street Name (3–20 chars)"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loading}
                    maxLength={20}
                    autoComplete="username"
                    required
                  />
                  {usernameMessage && (
                    <span className={`status-msg status-${usernameStatus}`}>
                      {usernameStatus === 'checking'  && '⏳ '}
                      {usernameStatus === 'available' && '✓ '}
                      {(usernameStatus === 'taken' || usernameStatus === 'invalid') && '✗ '}
                      {usernameMessage}
                    </span>
                  )}
                </div>

                <button type="submit" className="cta-button" disabled={loading}>
                  {loading
                    ? <><span className="spinner" />ENTERING...</>
                    : <>ENTER THE CITY <span className="arrow">→</span></>}
                </button>

                {error && (
                  <p role="alert" aria-live="polite" className="register-error">{error}</p>
                )}
              </form>
            </div>
          </div>
          <div className="auth-image-col">
            <img src={hero} alt="Undercity skyline" />
          </div>
        </div>
      </div>
    );
  }

  // ── Email verify stage ────────────────────────────────────
  if (stage === 'verify-email') {
    return (
      <div className="landing-page">
        <Header />
        <div className="verify-page-center">
          <div className="verify-card">
            {/* Icon */}
            <div className="verify-icon-wrap">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                <rect width="48" height="48" rx="12" fill="rgba(220,31,46,0.12)"/>
                <path d="M8 16l16 12 16-12" stroke="#dc1f2e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="8" y="14" width="32" height="22" rx="3" stroke="#dc1f2e" strokeWidth="2.5" fill="none"/>
              </svg>
            </div>

            {/* Heading */}
            <span className="hero-eyebrow" style={{ textAlign: 'center', display: 'block' }}>ALMOST THERE</span>
            <h1 className="verify-title">
              CHECK YOUR<br />
              <span className="accent">INBOX</span>
            </h1>

            {/* Email display */}
            <div className="verify-email-chip">
              <span className="verify-email-label">Sent to</span>
              <span className="verify-email-value">{email}</span>
            </div>

            {/* Auto status */}
            <div className="verify-auto-status">
              <span className="verify-pulse" />
              <span>
                {loading
                  ? 'Verifying your email...'
                  : 'Waiting — this page auto-advances when you click the link'}
              </span>
            </div>

            {/* Steps */}
            <div className="verify-steps">
              <div className="verify-step">
                <span className="verify-step-num">1</span>
                <span className="verify-step-text">Open the email from Undercity</span>
              </div>
              <div className="verify-step">
                <span className="verify-step-num">2</span>
                <span className="verify-step-text">Click the verification link</span>
              </div>
              <div className="verify-step">
                <span className="verify-step-num">3</span>
                <span className="verify-step-text">This page advances automatically</span>
              </div>
            </div>

            {/* Manual fallback button */}
            <button
              onClick={handleContinue}
              className="cta-button"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}
            >
              {loading
                ? <><span className="spinner" />VERIFYING...</>
                : <>ALREADY VERIFIED? CONTINUE <span className="arrow">→</span></>}
            </button>

            {/* Resend */}
            <button
              onClick={handleResend}
              className="verify-resend-btn"
              disabled={resendCooldown > 0}
            >
              {resendCooldown > 0
                ? `Resend available in ${resendCooldown}s`
                : 'Resend verification email'}
            </button>

            {/* Wrong email */}
            <button onClick={handleBackToForm} className="verify-back-link">
              ← Use a different email
            </button>

            {error && (
              <p role="alert" aria-live="polite" className="register-error" style={{ textAlign: 'center' }}>
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Main registration form ────────────────────────────────
  return (
    <div className="landing-page">
      <Header />
      <div className="auth-page-section">
        <div className="auth-form-col">
          <div className="register-modern-wrapper">

            <span className="hero-eyebrow">CREATE YOUR IDENTITY</span>
            <h1 className="auth-title">
              YOUR NAME IS<br />
              <span className="accent">YOUR REPUTATION</span>
            </h1>
            <div className="divider">
              <span className="line" />
              <span className="diamond">◆</span>
              <span className="line" />
            </div>
            <p className="auth-supporting">
              In Undercity, identity is everything.<br />
              Choose your name carefully — the streets remember.
            </p>

            <div className="register-value-strip">
              <span>🎯 25 crimes to master</span>
              <span>💰 Start with $750 cash</span>
              <span>⚡ Real-time world</span>
            </div>

            {/* ── Google Sign-Up ── */}
            <button
              type="button"
              className="google-signin-btn"
              onClick={handleGoogleSignUp}
              disabled={googleLoading || loading}
              aria-label="Sign up with Google"
              style={{ marginTop: '8px' }}
            >
              {googleLoading ? (
                <><span className="spinner" />CONNECTING...</>
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

            <form onSubmit={handleSubmit} className="register-modern-form" noValidate>
              <div className="input-with-status">
                <input
                  ref={usernameRef}
                  type="text"
                  placeholder="Street Name (3–20 chars)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  maxLength={20}
                  autoComplete="username"
                  required
                />
                {usernameMessage && (
                  <span className={`status-msg status-${usernameStatus}`}>
                    {usernameStatus === 'checking'  && '⏳ '}
                    {usernameStatus === 'available' && '✓ '}
                    {(usernameStatus === 'taken' || usernameStatus === 'invalid') && '✗ '}
                    {usernameMessage}
                  </span>
                )}
              </div>

              <div className="input-with-status">
                <input
                  type="email"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  autoComplete="email"
                  required
                />
                {emailInvalid && (
                  <span className="status-msg status-invalid">✗ Invalid email format</span>
                )}
                {emailValid && (
                  <span className="status-msg status-available">✓ Valid email</span>
                )}
              </div>

              <div className="password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password (6+ chars)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="new-password"
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

              {password && (
                <div className="strength-meter">
                  <div className="strength-bar">
                    <div
                      className="strength-fill"
                      style={{ width: `${(strength.score / 5) * 100}%`, background: strength.color }}
                    />
                  </div>
                  <span className="strength-label" style={{ color: strength.color }}>
                    {strength.label}
                  </span>
                </div>
              )}

              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                autoComplete="new-password"
                required
              />

              <label className="register-terms">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  disabled={loading}
                />
                <span>
                  I agree to the <Link to="/legal/terms">Terms</Link> and{' '}
                  <Link to="/legal/privacy">Privacy Policy</Link>
                </span>
              </label>

              {TURNSTILE_SITE_KEY && (
                <div style={{ marginTop: '0.5rem' }}>
                  <Turnstile
                    ref={turnstileRef}
                    siteKey={TURNSTILE_SITE_KEY}
                    onSuccess={setTurnstileToken}
                    onExpire={() => setTurnstileToken(null)}
                    onError={() => setTurnstileToken(null)}
                    options={{ theme: 'dark', size: 'normal' }}
                  />
                </div>
              )}

              <button type="submit" className="cta-button" disabled={loading}>
                {loading
                  ? <><span className="spinner" />ENTERING...</>
                  : <>START MY EMPIRE <span className="arrow">→</span></>}
              </button>

              {error && (
                <p role="alert" aria-live="polite" className="register-error">{error}</p>
              )}
            </form>

            <div className="auth-steps">
              <div className="auth-step">
                <span className="step-num">01</span>
                <span className="step-text">Choose your street name</span>
              </div>
              <div className="auth-step">
                <span className="step-num">02</span>
                <span className="step-text">Verify your email</span>
              </div>
              <div className="auth-step">
                <span className="step-num">03</span>
                <span className="step-text">Build your empire</span>
              </div>
            </div>

            <p className="register-login">
              Already part of the streets? <Link to="/login">Login</Link>
            </p>
          </div>

        </div>
        <div className="auth-image-col">
          <img src={hero} alt="Undercity skyline" />
        </div>
      </div>
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
