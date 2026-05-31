import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from '../firebase';
import { authAPI, checkUsernameAvailable } from '../services/api';
import Header from '../components/Header';
import hero from '../assets/hero.png';
import '../styles/Landing.css';
import './RegisterModern.css';

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (password.length === 0) return { score: 0, label: '', color: '' };
  if (password.length < 6) return { score: 1, label: 'Too short', color: '#ff4d4d' };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 2) return { score: 2, label: 'Weak', color: '#ff8c42' };
  if (score === 3) return { score: 3, label: 'Decent', color: '#facc15' };
  if (score === 4) return { score: 4, label: 'Strong', color: '#4ade80' };
  return { score: 5, label: 'Excellent', color: '#22c55e' };
}

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [usernameMessage, setUsernameMessage] = useState('');
  const navigate = useNavigate();

  const strength = getPasswordStrength(password);

  // Debounced username check
  useEffect(() => {
    if (!username) {
      setUsernameStatus('idle');
      setUsernameMessage('');
      return;
    }

    setUsernameStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const res = await checkUsernameAvailable(username);
        if (res.available) {
          setUsernameStatus('available');
          setUsernameMessage('Available');
        } else {
          setUsernameStatus(res.reason ? 'invalid' : 'taken');
          setUsernameMessage(res.reason || 'Already taken');
        }
      } catch {
        setUsernameStatus('idle');
        setUsernameMessage('');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) return setError('Username is required.');
    if (usernameStatus !== 'available') return setError('Please choose an available username.');
    if (password !== confirmPassword) return setError('Passwords do not match.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (!agreeTerms) return setError('You must agree to the terms.');

    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      await authAPI.sync(username);
      navigate('/home');
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing-page">
      <Header />
      <section className="about-section">
        <div className="about-content">
          <div className="about-text register-modern-wrapper">

            <h1 className="register-title">CLAIM YOUR NAME</h1>
            <span className="register-subtitle">Step into the Undercity</span>
            <div className="register-divider" />

            <form onSubmit={handleSubmit} className="register-modern-form">

              <div className="input-with-status">
                <input
                  type="text"
                  placeholder="Username (3-20 chars, letters/numbers/_)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
                {usernameMessage && (
                  <span className={`status-msg status-${usernameStatus}`}>
                    {usernameStatus === 'checking' && '⏳ '}
                    {usernameStatus === 'available' && '✓ '}
                    {(usernameStatus === 'taken' || usernameStatus === 'invalid') && '✗ '}
                    {usernameMessage}
                  </span>
                )}
              </div>

              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <div className="password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
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
                        width: `${(strength.score / 5) * 100}%`,
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
                required
              />

              <label className="register-terms">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                />
                <span>I agree to the <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a></span>
              </label>

              <button type="submit" className="cta-button" disabled={loading}>
                {loading ? 'ENTERING...' : 'START MY EMPIRE'}
              </button>

              {error && <p className="register-error">{error}</p>}

              <p className="register-login">
                Already part of the streets? <Link to="/login">Login</Link>
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
