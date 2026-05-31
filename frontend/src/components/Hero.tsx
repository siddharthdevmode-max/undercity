import { Link } from 'react-router-dom';
import '../styles/Hero.css';

export default function Hero() {
  return (
    <section className="hero-section">
      <div className="hero-content">
        <span className="hero-eyebrow">A TEXT-BASED CRIME MMO</span>
        <h1 className="hero-title">
          RISE. <span className="accent">RULE.</span> REIGN.
        </h1>
        <p className="hero-subtitle">
          Start as a nobody. Hustle, fight, and steal your way to the top.
          Build your empire in a city that never sleeps.
        </p>
        <div className="hero-actions">
          <Link to="/register" className="hero-btn primary">
            CLAIM YOUR NAME <span className="arrow">→</span>
          </Link>
          <a href="#about" className="hero-btn ghost">
            LEARN MORE
          </a>
        </div>
        <div className="hero-meta">
          <span>✓ Free to play</span>
          <span>✓ No download</span>
          <span>✓ 24/7 persistent world</span>
        </div>
      </div>
    </section>
  );
}
