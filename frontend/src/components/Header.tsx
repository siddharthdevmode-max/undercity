import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import logo from '../assets/logo.png';
import '../styles/Header.css';

export default function Header() {
  const location  = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const prevPathRef = useRef(location.pathname);

  const isLanding  = location.pathname === '/';
  const isAuthPage =
    location.pathname === '/register' ||
    location.pathname === '/login';

  // Close menu on route change — use ref to avoid setState-in-effect lint error
  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      prevPathRef.current = location.pathname;
      setMenuOpen(false);
    }
  }, [location.pathname]);

  // Lock body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const navLinks = [
    { href: '#preview',  label: 'Game'      },
    { href: '#about',    label: 'About'     },
    { href: '#features', label: 'Features'  },
    { href: '#stats',    label: 'Community' },
  ];

  return (
    <header className="site-header">
      <div className="header-inner">
        {/* ── Brand ── */}
        <Link to="/" className="brand" onClick={() => setMenuOpen(false)}>
          <img src={logo} alt="Undercity" className="brand-logo" />
          <div className="brand-text">
            <span className="brand-name">UNDERCITY</span>
            <span className="brand-tagline">RISE. RULE. REIGN.</span>
          </div>
        </Link>

        {/* ── Desktop nav ── */}
        {isLanding && (
          <nav className="main-nav" aria-label="Main navigation">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className="nav-link">{l.label}</a>
            ))}
          </nav>
        )}

        {/* ── Desktop actions ── */}
        <div className="header-actions">
          <ThemeToggle />
          {!isAuthPage && (
            <>
              <Link to="/login"    className="btn btn-ghost">Login</Link>
              <Link to="/register" className="btn btn-primary">Sign Up</Link>
            </>
          )}

          {/* ── Mobile hamburger (landing only) ── */}
          {isLanding && (
            <button
              className={`hamburger ${menuOpen ? 'hamburger--open' : ''}`}
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
            >
              <span className="hamburger-bar" />
              <span className="hamburger-bar" />
              <span className="hamburger-bar" />
            </button>
          )}
        </div>
      </div>

      {/* ── Mobile drawer ── */}
      {isLanding && (
        <>
          <div
            className={`mobile-overlay ${menuOpen ? 'mobile-overlay--open' : ''}`}
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <nav
            className={`mobile-drawer ${menuOpen ? 'mobile-drawer--open' : ''}`}
            aria-label="Mobile navigation"
          >
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="mobile-nav-link"
                onClick={() => setMenuOpen(false)}
              >
                {l.label}
              </a>
            ))}
            <div className="mobile-nav-actions">
              <Link
                to="/login"
                className="btn btn-ghost w-full"
                onClick={() => setMenuOpen(false)}
              >
                Login
              </Link>
              <Link
                to="/register"
                className="btn btn-primary w-full"
                onClick={() => setMenuOpen(false)}
              >
                Sign Up Free
              </Link>
            </div>
          </nav>
        </>
      )}
    </header>
  );
}
