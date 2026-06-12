import { Link } from 'react-router-dom';
import Icon from '../components/ui/Icon';
import '../styles/About.css';

export default function Contributor() {
  return (
    <div className="about-page">
      <header className="about-header">
        <Link to="/" className="about-back">&larr; Back to Home</Link>
        <h1 className="about-title">Contributor</h1>
        <p className="about-subtitle">Support the game and unlock premium features.</p>
      </header>

      <section className="about-section">
        <h2><Icon name="contributor" size={22} /> What Is Contributor?</h2>
        <p>
          Contributor is a monthly subscription that supports Undercity's development. In return, you get
          quality-of-life features, exclusive customization, and our gratitude. This is <strong>not</strong>
          pay-to-win — no stat boosts, no gameplay advantages, just a cleaner experience.
        </p>
      </section>

      <section className="about-section">
        <h2>Benefits</h2>
        <div className="about-grid">
          <div className="about-card">
            <Icon name="check" size={28} className="icon-success" />
            <h3>Ad-Free</h3>
            <p>Remove all advertisements from the game. A clean, immersive experience.</p>
          </div>
          <div className="about-card">
            <Icon name="brain" size={28} className="icon-accent" />
            <h3>Priority Support</h3>
            <p>Your support tickets and questions are prioritized. Get help faster.</p>
          </div>
          <div className="about-card">
            <Icon name="player" size={28} className="icon-accent" />
            <h3>Exclusive Badge</h3>
            <p>A Contributor badge on your profile so the city knows you're a supporter.</p>
          </div>
          <div className="about-card">
            <Icon name="chart" size={28} className="icon-accent" />
            <h3>Extended Stats</h3>
            <p>View extended personal statistics and detailed crime history.</p>
          </div>
        </div>
      </section>

      <section className="about-section">
        <h2>Pricing</h2>
        <p>Contributor is available as a monthly subscription. Prices are displayed at checkout.</p>
      </section>

      <footer className="about-footer">
        <Link to="/settings" className="about-btn">View in Settings</Link>
      </footer>
    </div>
  );
}
