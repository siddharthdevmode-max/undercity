import { Link, useLocation } from 'react-router-dom';
import Icon from './ui/Icon';
import logo from '../assets/logo.png';
import '../styles/Footer.css';

const LEGAL_LINKS = [
  { label: 'Privacy Policy',   to: '/legal/privacy'  },
  { label: 'Terms of Service', to: '/legal/terms'    },
  { label: 'Cookie Policy',    to: '/legal/cookies'  },
  { label: 'DMCA',             to: '/legal/dmca'     },
  { label: 'Gambling Notice',  to: '/legal/gambling' },
];

const GAME_LINKS = [
  { label: 'About',    to: '/',          hash: 'about'    },
  { label: 'Features', to: '/',          hash: 'features' },
  { label: 'Register', to: '/register',  hash: undefined  },
  { label: 'Login',    to: '/login',     hash: undefined  },
];

const SOCIAL_LINKS = [
  {
    href:  'https://discord.gg/undercity',
    label: 'Join our Discord',
    icon:  'discord',
  },
  {
    href:  'https://x.com/undercityonline',
    label: 'Follow on X',
    icon:  'twitter-x',
  },
  {
    href:  'https://reddit.com/r/undercitygame',
    label: 'Join our Reddit',
    icon:  'reddit',
  },
];

export default function Footer() {
  const location = useLocation();

  // For hash links: if already on /, scroll. Otherwise navigate then scroll.
  const handleHashLink = (hash: string) => {
    if (location.pathname === '/') {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="site-footer">
      <div className="footer-inner">

        {/* ── Brand ── */}
        <div className="footer-brand">
          <Link to="/" className="footer-brand-link">
            <img src={logo} alt="Undercity" className="footer-logo" />
            <div className="footer-brand-text">
              <span className="footer-brand-name">UNDERCITY</span>
              <span className="footer-brand-tag">RISE. RULE. REIGN.</span>
            </div>
          </Link>
          <p className="footer-bio">
            A browser-based crime MMO. No download required.
            Play free, build your empire, rule the streets.
          </p>
          <div className="footer-social">
            {SOCIAL_LINKS.map((s) => (
              <a
                key={s.href}
                href={s.href}
                aria-label={s.label}
                className="social-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name={s.icon} size={18} />
              </a>
            ))}
          </div>
        </div>

        {/* ── Game Links ── */}
        <div className="footer-col">
          <h4 className="footer-col-heading">GAME</h4>
          <nav aria-label="Game links">
            {GAME_LINKS.map((l) =>
              l.hash ? (
                <Link
                  key={l.label}
                  to={l.to}
                  className="footer-link"
                  onClick={() => l.hash && handleHashLink(l.hash)}
                >
                  {l.label}
                </Link>
              ) : (
                <Link key={l.label} to={l.to} className="footer-link">
                  {l.label}
                </Link>
              )
            )}
          </nav>
        </div>

        {/* ── Legal Links ── */}
        <div className="footer-col">
          <h4 className="footer-col-heading">LEGAL</h4>
          <nav aria-label="Legal links">
            {LEGAL_LINKS.map((l) => (
              <Link key={l.to} to={l.to} className="footer-link">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

      </div>

      {/* ── Bottom Bar ── */}
      <div className="footer-bottom">
        <span className="copyright">
          © {new Date().getFullYear()} Undercity. All rights reserved.
        </span>
        <span className="footer-disclaimer">
          Undercity is a fictional game. All in-game currency and assets
          have no real-world value.
        </span>
      </div>
    </footer>
  );
}
