import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from '../firebase';
import { authAPI, checkUsernameAvailable } from '../services/api';
import { getFriendlyError } from '../utils/firebaseErrors';
import { useAuth } from '../hooks/useAuth';
import Header from '../components/Header';
import hero from '../assets/hero.png';
import '../styles/Landing.css';
import '../styles/Register.css';

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

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
  const [usernameStatus, setUsernameStatus]   = useState<UsernameStatus>('idle');
  const [usernameMessage, setUsernameMessage] = useState('');
  const usernameRef                           = useRef<HTMLInputElement>(null);
  const navigate                              = useNavigate();
  const { user, setUser }                     = useAuth();
  const strength                              = getPasswordStrength(password);
  const emailValid                            = email.length > 0 && isValidEmail(email);
  const emailInvalid                          = email.length > 0 && !isValidEmail(email);

  useEffect(() => { if (user) navigate('/onboarding'); }, [user, navigate]);
  useEffect(() => { usernameRef.current?.focus(); }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!username) {
        setUsernameStatus('idle');
        setUsernameMessage('');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim())               return setError('Username is required.');
    if (usernameStatus !== 'available') return setError('Please choose an available username.');
    if (!isValidEmail(email))           return setError('Please enter a valid email address.');
    if (password !== confirmPassword)   return setError('Passwords do not match.');
    if (password.length < 6)           return setError('Password must be at least 6 characters.');
    if (!agreeTerms)                    return setError('You must agree to the terms.');
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      const newUser = await authAPI.sync(username);
      setUser(newUser);
      navigate('/onboarding');
    } catch (err: unknown) {
      setError(getFriendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing-page">
      <Header />
      <section className="about-section">
        <div className="about-content">

          {/* ── Left: Register Form ── */}
          <div className="about-text register-modern-wrapper">

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

              {password && (
                <div className="strength-meter">
                  <div className="strength-bar">
                    <div
                      className="strength-fill"
                      style={{
                        width:      `${(strength.score / 5) * 100}%`,
                        background: strength.color,
                      }}
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
                  I agree to the <a href="#terms">Terms</a> and{' '}
                  <a href="#privacy">Privacy Policy</a>
                </span>
              </label>

              <button type="submit" className="cta-button" disabled={loading}>
                {loading
                  ? <><span className="spinner" />ENTERING...</>
                  : <>START MY EMPIRE <span className="arrow">→</span></>}
              </button>

              {error && (
                <p role="alert" aria-live="polite" className="register-error">{error}</p>
              )}
            </form>

            {/* ── Onboarding Steps ── */}
            <div className="auth-steps">
              <div className="auth-step">
                <span className="step-num">01</span>
                <span className="step-text">Choose your street name</span>
              </div>
              <div className="auth-step">
                <span className="step-num">02</span>
                <span className="step-text">Enter the city</span>
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

          {/* ── Right: Hero Image ── */}
          <div className="about-image">
            <img src={hero} alt="Undercity skyline" />
          </div>

        </div>
      </section>
    </div>
  );
}
