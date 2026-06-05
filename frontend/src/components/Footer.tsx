import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';
import '../styles/Footer.css';

const LEGAL_LINKS = [
  { label: 'Privacy Policy',    to: '/legal/privacy'    },
  { label: 'Terms of Service',  to: '/legal/terms'      },
  { label: 'Cookie Policy',     to: '/legal/cookies'    },
  { label: 'DMCA',              to: '/legal/dmca'       },
  { label: 'Gambling Notice',   to: '/legal/gambling'   },
];

const GAME_LINKS = [
  { label: 'About',    to: '/#about'    },
  { label: 'Features', to: '/#features' },
  { label: 'Register', to: '/register'  },
  { label: 'Login',    to: '/login'     },
];

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">

        {/* ── Brand Column ── */}
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
            <a
              href="https://discord.gg/undercity"
              aria-label="Join our Discord"
              className="social-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              💬
            </a>
            <a
              href="https://x.com/undercitygame"
              aria-label="Follow on X"
              className="social-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              𝕏
            </a>
            <a
              href="https://reddit.com/r/undercitygame"
              aria-label="Join our Reddit"
              className="social-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              👽
            </a>
          </div>
        </div>

        {/* ── Game Links ── */}
        <div className="footer-col">
          <h4 className="footer-col-heading">GAME</h4>
          <nav aria-label="Game links">
            {GAME_LINKS.map((l) => (
              <Link key={l.to} to={l.to} className="footer-link">
                {l.label}
              </Link>
            ))}
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
