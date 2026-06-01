import { Link, useLocation } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import logo from '../assets/logo.png';
import '../styles/Header.css';

export default function Header() {
  const location = useLocation();
  const isAuthPage =
    location.pathname === '/register' ||
    location.pathname === '/login';

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link to="/" className="brand">
          <img src={logo} alt="Undercity" className="brand-logo" />
          <div className="brand-text">
            <span className="brand-name">UNDERCITY</span>
            <span className="brand-tagline">RISE. RULE. REIGN.</span>
          </div>
        </Link>

        <div className="header-actions">
          <ThemeToggle />
          {!isAuthPage && (
            <>
              <Link to="/login" className="btn btn-ghost">Login</Link>
              <Link to="/register" className="btn btn-primary">Sign Up</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
