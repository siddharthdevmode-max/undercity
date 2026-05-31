import { useState } from 'react';
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
import Header from '../components/Header';
import hero from '../assets/hero.png';
import '../styles/Landing.css';
import './RegisterModern.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    try {
      // Set persistence based on checkbox
      await setPersistence(
        auth,
        stayLoggedIn ? browserLocalPersistence : browserSessionPersistence
      );

      await signInWithEmailAndPassword(auth, email, password);
      await authAPI.sync();
      navigate('/home');
    } catch (err: any) {
      setError(err.message || 'Login failed.');
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
      setError(err.message || 'Failed to send reset email.');
    }
  };

  return (
    <div className="landing-page">
      <Header />
      <section className="about-section">
        <div className="about-content">
          <div className="about-text register-modern-wrapper">

            <h1 className="register-title">WELCOME BACK</h1>
            <span className="register-subtitle">The city missed you</span>
            <div className="register-divider" />

            <form onSubmit={handleSubmit} className="register-modern-form">

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
                  placeholder="Password"
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

              <div className="login-row">
                <label className="stay-logged">
                  <input
                    type="checkbox"
                    checked={stayLoggedIn}
                    onChange={(e) => setStayLoggedIn(e.target.checked)}
                  />
                  <span>Stay logged in</span>
                </label>

                <button
                  type="button"
                  className="forgot-link"
                  onClick={handleForgotPassword}
                >
                  Forgot password?
                </button>
              </div>

              <button type="submit" className="cta-button" disabled={loading}>
                {loading ? 'ACCESSING...' : 'ENTER THE CITY'}
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
