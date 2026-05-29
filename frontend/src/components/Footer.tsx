import logo from '../assets/logo.png';
import '../styles/Footer.css';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-left">
          <img src={logo} alt="Undercity" className="footer-logo" />
          <span className="copyright">© {new Date().getFullYear()} Undercity</span>
        </div>

        <nav className="footer-nav">
          <a href="#privacy">Privacy</a>
          <span className="sep">|</span>
          <a href="#terms">Terms</a>
          <span className="sep">|</span>
          <a href="#contact">Contact</a>
        </nav>

        <div className="footer-social">
          <a href="#discord" aria-label="Discord" className="social-link">💬</a>
          <a href="#x" aria-label="X" className="social-link">𝕏</a>
          <a href="#reddit" aria-label="Reddit" className="social-link">👽</a>
        </div>
      </div>
    </footer>
  );
}
