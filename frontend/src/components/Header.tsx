import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import logo from '../assets/logo.png';
import '../styles/Header.css';

export default function Header() {
  const location   = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const prevPathRef = useRef(location.pathname);
  const drawerRef   = useRef<HTMLElement>(null);

  const isLanding  = location.pathname === '/';
  const isAuthPage =
    location.pathname === '/register' ||
    location.pathname === '/login';

  // Close on route change
  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      prevPathRef.current = location.pathname;
      setMenuOpen(false);
    }
  }, [location.pathname]);

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && menuOpen) setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const navLinks = [
    { href: '#preview',  label: 'Game',      emoji: '🎮' },
    { href: '#about',    label: 'About',     emoji: '⚡' },
    { href: '#features', label: 'Features',  emoji: '🔥' },
    { href: '#stats',    label: 'Community', emoji: '👥' },
  ];

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="site-header">
      <div className="header-inner">

        {/* ── Brand ── */}
        <Link to="/" className="brand" onClick={closeMenu}>
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

          {/* ── Hamburger — shows on mobile ── */}
          <button
            className={`hamburger ${menuOpen ? 'hamburger--open' : ''}`}
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-drawer"
          >
            <span className="hamburger-bar" />
            <span className="hamburger-bar" />
            <span className="hamburger-bar" />
          </button>
        </div>
      </div>

      {/* ── Backdrop overlay ── */}
      <div
        className={`mobile-overlay ${menuOpen ? 'mobile-overlay--open' : ''}`}
        onClick={closeMenu}
        aria-hidden="true"
      />

      {/* ── Side drawer ── */}
      <nav
        id="mobile-drawer"
        ref={drawerRef}
        className={`mobile-drawer ${menuOpen ? 'mobile-drawer--open' : ''}`}
        aria-label="Mobile navigation"
        aria-hidden={!menuOpen}
      >
        {/* Drawer header with close button */}
        <div className="mobile-drawer-header">
          <Link to="/" className="mobile-drawer-brand" onClick={closeMenu}>
            <img src={logo} alt="Undercity" className="mobile-drawer-logo" />
            <span className="mobile-drawer-name">UNDERCITY</span>
          </Link>
          <button
            className="mobile-drawer-close"
            onClick={closeMenu}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        {/* Nav links */}
        <div className="mobile-drawer-nav">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="mobile-nav-link"
              onClick={closeMenu}
            >
              <span style={{ marginRight: 10 }}>{l.emoji}</span>
              {l.label}
            </a>
          ))}
        </div>

        {/* Action buttons at bottom */}
        <div className="mobile-nav-actions">
          <Link
            to="/login"
            className="btn btn-ghost w-full"
            onClick={closeMenu}
          >
            Login
          </Link>
          <Link
            to="/register"
            className="btn btn-primary w-full"
            onClick={closeMenu}
          >
            Sign Up Free →
          </Link>
        </div>
      </nav>
    </header>
  );
}
