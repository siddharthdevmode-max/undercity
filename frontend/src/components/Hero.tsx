import { Link } from 'react-router-dom';
import Icon from './ui/Icon';
import '../styles/Hero.css';

const META_ITEMS = [
  { icon: 'check-circle', text: 'Free to play' },
  { icon: 'globe',        text: 'No download'  },
  { icon: 'infinite',     text: '24/7 persistent world' },
];

export default function Hero() {
  return (
    <section className="hero-section">
      {/* Subtle grid background texture */}
      <div className="hero-grid" aria-hidden="true" />
      {/* Accent glow behind title */}
      <div className="hero-glow" aria-hidden="true" />

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
            CLAIM YOUR NAME
            <Icon name="arrow-right" size={18} />
          </Link>
          <a href="#about" className="hero-btn ghost">
            LEARN MORE
          </a>
        </div>
        <div className="hero-meta">
          {META_ITEMS.map((item) => (
            <span key={item.text} className="hero-meta-item">
              <Icon name={item.icon} size={14} className="hero-meta-icon" />
              {item.text}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
