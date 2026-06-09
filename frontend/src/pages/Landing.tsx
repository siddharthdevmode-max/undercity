import { Link } from 'react-router-dom';
import Header           from '../components/Header';
import Hero             from '../components/Hero';
import Footer           from '../components/Footer';
import StatsSection     from '../components/StatsSection';
import FeaturesSection  from '../components/FeaturesSection';
import Icon             from '../components/ui/Icon';
import hero             from '../assets/hero.webp';
import '../styles/Landing.css';

// ── Why Undercity cards ────────────────────────────────────
const WHY_CARDS = [
  {
    icon: 'realtime',
    title: 'REAL-TIME WORLD',
    body:  'WebSocket-powered live updates. Your stats change the moment you act. No page refresh. No waiting.',
  },
  {
    icon: 'fair',
    title: 'BUILT FAIR',
    body:  '9-layer anti-cheat before a single player logged in. No bots. No pay-to-win. Pure skill.',
  },
  {
    icon: 'freeplay',
    title: 'FREE FOREVER',
    body:  'No download. No subscription. Play from any browser on any device in any country.',
  },
  {
    icon: 'growing',
    title: 'ALWAYS GROWING',
    body:  'New systems ship every wave. Gangs, casino, properties, PvP — all coming. Your progress carries forward.',
  },
  {
    icon: 'privacy',
    title: 'YOUR DATA, YOUR RIGHTS',
    body:  'Full GDPR compliance. Export or delete your data anytime. We store only what we need.',
  },
  {
    icon: 'mobile',
    title: 'PLAY ANYWHERE',
    body:  'Mobile-responsive from day one. Commit crimes on the bus. Run your empire from anywhere.',
  },
  {
    icon: 'strategy',
    title: 'DEEP STRATEGY',
    body:  'Weighted crime outcomes, hidden mastery stats, tier progression. Every crime teaches you something.',
  },
  {
    icon: 'timer',
    title: 'RESPECT YOUR TIME',
    body:  'No 8-hour wait timers. Nerve regenerates in minutes. Short sessions, real progress, every day.',
  },
  {
    icon: 'fire',
    title: 'CONSEQUENCES MATTER',
    body:  'Go negative on cash. Get shadow banned for cheating. Your choices have real, lasting impact.',
  },
];

// ── How it works steps ─────────────────────────────────────
const HOW_STEPS = [
  {
    num:  '01',
    title: 'REGISTER FREE',
    body:  'Pick your street name. Verify your email. Done in 30 seconds.',
  },
  {
    num:  '02',
    title: 'START SMALL',
    body:  'Begin with $750 and 30 nerve. Run your first crimes. Build experience.',
  },
  {
    num:  '03',
    title: 'CLIMB THE TIERS',
    body:  'Unlock harder crimes. Earn more. Master each one for critical special outcomes.',
  },
  {
    num:  '04',
    title: 'BUILD YOUR EMPIRE',
    body:  'Join gangs. Control territory. Become the most feared name in Undercity.',
  },
];

export default function Landing() {
  return (
    <div className="landing-page">
      <Header />

      {/* ── 1. Hero ── */}
      <Hero />

      {/* ── 2. Game Preview ── */}
      <section id="preview" className="preview-section">
        <div className="preview-inner">
          <span className="section-eyebrow">THE GAME</span>
          <h2 className="section-heading">SEE IT IN ACTION</h2>
          <div className="section-divider">
            <span className="line" /><span className="diamond">◆</span><span className="line" />
          </div>
          <p className="section-subtitle">
            Real UI. Real game. No fake screenshots.
          </p>

          <div className="preview-frame">
            <div className="preview-browser-bar">
              <span className="preview-dot red" />
              <span className="preview-dot yellow" />
              <span className="preview-dot green" />
              <span className="preview-url">undercity.online/crimes</span>
            </div>
            <div className="preview-img-wrap">
              <img
                src={hero}
                alt="Undercity crimes interface"
                className="preview-img"
              />
              <div className="preview-img-overlay">
                <Link to="/register" className="cta-button preview-cta">
                  PLAY FREE NOW <span className="arrow">→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Why Undercity ── */}
      <section id="about" className="why-section">
        <div className="why-inner">
          <span className="section-eyebrow">WHY UNDERCITY</span>
          <h2 className="section-heading">BUILT DIFFERENT</h2>
          <div className="section-divider">
            <span className="line" /><span className="diamond">◆</span><span className="line" />
          </div>
          <p className="section-subtitle">
            Not another idle clicker. A real persistent world with consequences.
          </p>
          <div className="why-grid">
            {WHY_CARDS.map((c) => (
              <div key={c.title} className="why-card">
                <span className="why-icon"><Icon name={c.icon} size={28} /></span>
                <h3 className="why-card-title">{c.title}</h3>
                <p className="why-card-body">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. How it works ── */}
      <section className="how-section">
        <div className="how-inner">
          <span className="section-eyebrow">HOW IT WORKS</span>
          <h2 className="section-heading">YOUR RISE TO POWER</h2>
          <div className="section-divider">
            <span className="line" /><span className="diamond">◆</span><span className="line" />
          </div>
          <div className="how-steps">
            {HOW_STEPS.map((step, i) => (
              <div key={step.num} className="how-step">
                <div className="how-step-num">{step.num}</div>
                {i < HOW_STEPS.length - 1 && (
                  <div className="how-step-connector" aria-hidden="true" />
                )}
                <div className="how-step-content">
                  <h3 className="how-step-title">{step.title}</h3>
                  <p className="how-step-body">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. Stats ── */}
      <StatsSection />

      {/* ── 6. Features ── */}
      <FeaturesSection />

      {/* ── 7. Final CTA ── */}
      <section className="final-cta-section">
        <div className="final-cta-bg" aria-hidden="true">
          <div className="final-cta-glow" />
        </div>
        <div className="final-cta-inner">
          <span className="section-eyebrow">READY?</span>
          <h2 className="final-cta-heading">
            THE CITY IS<br />
            <span className="accent">WAITING FOR YOU.</span>
          </h2>
          <p className="final-cta-sub">
            December 15, 2026. Register now to secure your name before launch.
          </p>
          <div className="final-cta-actions">
            <Link to="/register" className="cta-button final-cta-btn">
              CLAIM YOUR NAME FREE
              <span className="arrow">→</span>
            </Link>
            <Link to="/login" className="final-cta-login">
              Already registered? <strong>Login →</strong>
            </Link>
          </div>
          <div className="final-cta-trust">
            <Icon name="check-circle" size={13} />
            <span>No credit card · Free forever · Takes 30 seconds</span>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
