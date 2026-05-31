import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from '../firebase';
import { authAPI } from '../services/api';
import Header from '../components/Header';
import hero from '../assets/hero.png';
import '../styles/Landing.css';
import './RegisterModern.css';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!username.trim()) {
      setError('Username is required.');
      return;
    }

    setLoading(true);

    try {
      // Step 1 — Create Firebase user
      await createUserWithEmailAndPassword(auth, email, password);

      // Step 2 — Sync with backend (username passed here)
      await authAPI.sync(username);

      // Step 3 — Enter game
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

            <h1 className="register-title">REGISTER</h1>
            <div className="register-divider" />

            <form onSubmit={handleSubmit} className="register-modern-form">

              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />

              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <input
                type="password"
                placeholder="Create Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <input
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />

              <button type="submit" className="cta-button" disabled={loading}>
                {loading ? 'ENTERING...' : 'ENTER THE CITY'}
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
