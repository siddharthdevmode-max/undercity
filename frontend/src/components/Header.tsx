import { Link, NavLink } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import logo from '../assets/logo.png';
import '../styles/Header.css';

export default function Header() {
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

        <nav className="main-nav">
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Home
          </NavLink>
          <NavLink to="/about" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            About
          </NavLink>
          <NavLink to="/rules" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Rules
          </NavLink>
        </nav>

        <div className="header-actions">
          <ThemeToggle />
          <Link to="/login" className="btn btn-ghost">Login</Link>
          <Link to="/register" className="btn btn-primary">Sign Up</Link>
        </div>
      </div>
    </header>
  );
}
