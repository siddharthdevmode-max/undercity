import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Header from '../components/Header';
import hero from '../assets/hero.png';
import { authAPI } from '../services/api';
import '../styles/Landing.css';
import './RegisterModern.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await authAPI.login(email, password);
      localStorage.setItem('token', res.token);
      localStorage.setItem('user', JSON.stringify(res.user));
      navigate('/home');
    } catch (err: any) {
      setError(err.message || 'Login failed.');
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

            <h1 className="register-title">LOGIN</h1>
            <div className="register-divider" />

            <form onSubmit={handleSubmit} className="register-modern-form">

              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <button type="submit" className="cta-button" disabled={loading}>
                {loading ? 'ACCESSING...' : 'ACCESS UNDERCITY'}
              </button>

              {error && <p className="register-error">{error}</p>}

              <p className="register-login">
                Don’t have an account? <Link to="/register">Register</Link>
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
