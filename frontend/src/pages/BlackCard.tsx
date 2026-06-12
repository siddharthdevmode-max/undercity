import { Link } from 'react-router-dom';
import Icon from '../components/ui/Icon';
import '../styles/About.css';

export default function BlackCard() {
  return (
    <div className="about-page">
      <header className="about-header">
        <Link to="/" className="about-back">&larr; Back to Home</Link>
        <h1 className="about-title">Black Card</h1>
        <p className="about-subtitle">The Citizen pass. One-time purchase, lifetime benefits.</p>
      </header>

      <section className="about-section">
        <h2><Icon name="black-card" size={22} /> What Is the Black Card?</h2>
        <p>
          The Black Card is a one-time purchase that grants Citizen status permanently for 31 days.
          It's the most affordable way to support Undercity and unlock quality-of-life features.
          No recurring payments — buy it once and enjoy the benefits for a full month.
        </p>
      </section>

      <section className="about-section">
        <h2>Citizen Benefits</h2>
        <div className="about-grid">
          <div className="about-card">
            <Icon name="check" size={28} className="icon-success" />
            <h3>Ad-Free</h3>
            <p>Remove all advertisements for the duration of your Citizen status.</p>
          </div>
          <div className="about-card">
            <Icon name="shield" size={28} className="icon-accent" />
            <h3>Citizen Badge</h3>
            <p>A Citizen badge on your profile shows the city you're a card holder.</p>
          </div>
          <div className="about-card">
            <Icon name="bank" size={28} className="icon-accent" />
            <h3>Higher Bank Interest</h3>
            <p>Earn increased interest on your bank deposits.</p>
          </div>
          <div className="about-card">
            <Icon name="money" size={28} className="icon-accent" />
            <h3>Reduced Fees</h3>
            <p>Pay lower fees on market listings and bank transactions.</p>
          </div>
        </div>
      </section>

      <section className="about-section">
        <h2><Icon name="no-paywall" size={22} /> Not Pay-to-Win</h2>
        <p>
          The Black Card provides convenience features only — no stat boosts, no extra nerve, no gameplay
          advantages. Undercity is designed to be fair for every player, regardless of purchase status.
        </p>
      </section>

      <section className="about-section">
        <h2>Pricing</h2>
        <p>
          The Black Card is a one-time purchase at $4.99 (or equivalent in your currency) that grants
          Citizen status for 31 days. No auto-renewal — you choose whether to extend.
        </p>
      </section>

      <footer className="about-footer">
        <Link to="/settings" className="about-btn">View in Settings</Link>
      </footer>
    </div>
  );
}
