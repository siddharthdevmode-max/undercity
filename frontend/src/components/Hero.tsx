import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from './ui/Icon';
import '../styles/Hero.css';

const ROTATING_WORDS = ['STEAL.', 'FIGHT.', 'HUSTLE.', 'GRIND.', 'REIGN.'];

export default function Hero() {
  const [wordIndex, setWordIndex] = useState(0);
  const [fading, setFading]       = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setWordIndex((i) => (i + 1) % ROTATING_WORDS.length);
        setFading(false);
      }, 300);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="hero-section">

      {/* ── Animated background layers ── */}
      <div className="hero-bg" aria-hidden="true">
        <div className="hero-grid" />
        <div className="hero-vignette" />
        <div className="hero-glow-left" />
        <div className="hero-glow-right" />
        <div className="hero-scanlines" />
      </div>

      {/* ── Content ── */}
      <div className="hero-content">

        {/* Eyebrow */}
        <div className="hero-eyebrow-wrap">
          <span className="hero-eyebrow-dot" />
          <span className="hero-eyebrow">BROWSER-BASED CRIME MMO · FREE TO PLAY · NO DOWNLOAD</span>
          <span className="hero-eyebrow-dot" />
        </div>

        {/* Title */}
        <h1 className="hero-title">
          <span className="hero-title-line1">START AS A</span>
          <span className="hero-title-line2">
            NOBODY<span className="hero-title-period">.</span>
          </span>
          <span className="hero-title-line3">
            <span className={`hero-word-rotate ${fading ? 'fading' : ''}`}>
              {ROTATING_WORDS[wordIndex]}
            </span>
            {' '}YOUR WAY UP.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="hero-subtitle">
          Undercity is a persistent crime MMO where every choice leaves a mark.
          Build your empire. Control the streets. Make your name feared.
        </p>

        {/* CTAs */}
        <div className="hero-actions">
          <Link to="/register" className="hero-btn-primary">
            <span className="hero-btn-bg" />
            <span className="hero-btn-text">
              CLAIM YOUR NAME
              <Icon name="arrow-right" size={18} />
            </span>
          </Link>
          <a href="#preview" className="hero-btn-ghost">
            SEE THE GAME
          </a>
        </div>

        {/* Trust */}
        <div className="hero-trust">
          <span><Icon name="check-circle" size={13} /> Free forever</span>
          <span className="hero-trust-dot" />
          <span><Icon name="check-circle" size={13} /> Takes 30 seconds</span>
          <span className="hero-trust-dot" />
          <span><Icon name="check-circle" size={13} /> No credit card</span>
          <span className="hero-trust-dot" />
          <span><Icon name="check-circle" size={13} /> Play from any browser</span>
        </div>

        {/* Meta strip */}
        <div className="hero-meta">
          <div className="hero-meta-item">
            <span className="hero-meta-number">25</span>
            <span className="hero-meta-label">Crimes</span>
          </div>
          <div className="hero-meta-divider" />
          <div className="hero-meta-item">
            <span className="hero-meta-number">5</span>
            <span className="hero-meta-label">Crime Tiers</span>
          </div>
          <div className="hero-meta-divider" />
          <div className="hero-meta-item">
            <span className="hero-meta-number">24/7</span>
            <span className="hero-meta-label">Persistent World</span>
          </div>
          <div className="hero-meta-divider" />
          <div className="hero-meta-item">
            <span className="hero-meta-number">∞</span>
            <span className="hero-meta-label">Replayability</span>
          </div>
        </div>

      </div>

      {/* ── Scroll indicator ── */}
      <a href="#preview" className="hero-scroll" aria-label="Scroll down">
        <span className="hero-scroll-line" />
        <span className="hero-scroll-arrow">↓</span>
      </a>

    </section>
  );
}
