import { Link } from 'react-router-dom';
import Icon from '../components/ui/Icon';
import '../styles/About.css';

export default function About() {
  return (
    <div className="about-page">
      <header className="about-header">
        <Link to="/" className="about-back">&larr; Back to Home</Link>
        <h1 className="about-title">About Undercity</h1>
        <p className="about-subtitle">A persistent browser-based crime MMO where every choice has consequences.</p>
      </header>

      <section className="about-section">
        <h2><Icon name="crime" size={22} /> What Is Undercity?</h2>
        <p>
          Undercity is a free-to-play, browser-based crime MMO. No download, no paywall — just a persistent
          world where you build your empire from nothing. Start as a nobody on the streets and work your way up
          to running the city.
        </p>
      </section>

      <section className="about-section">
        <h2><Icon name="gym" size={22} /> Core Gameplay</h2>
        <div className="about-grid">
          <div className="about-card">
            <Icon name="crime" size={28} className="icon-accent" />
            <h3>Crimes</h3>
            <p>Execute heists, robberies, and cons. Level up your skills, earn money, and build your reputation.</p>
          </div>
          <div className="about-card">
            <Icon name="gym" size={28} className="icon-accent" />
            <h3>Training</h3>
            <p>Build your strength, speed, defense, and dexterity. The streets respect power.</p>
          </div>
          <div className="about-card">
            <Icon name="attack" size={28} className="icon-accent" />
            <h3>Attacks</h3>
            <p>Take down rivals in PvP combat. Steal their money, send them to the hospital, or mug them in alleys.</p>
          </div>
          <div className="about-card">
            <Icon name="bank" size={28} className="icon-accent" />
            <h3>Economy</h3>
            <p>Work jobs, trade on the black market, buy properties, and gamble at the casino. Build your wealth.</p>
          </div>
          <div className="about-card">
            <Icon name="gang" size={28} className="icon-accent" />
            <h3>Gangs</h3>
            <p>Join or create a gang. Fight for territory, form alliances, and wage war against rival crews.</p>
          </div>
          <div className="about-card">
            <Icon name="travel" size={28} className="icon-accent" />
            <h3>Travel</h3>
            <p>Move between cities — London, Tokyo, Dubai, and more. Each city has its own opportunities.</p>
          </div>
        </div>
      </section>

      <section className="about-section">
        <h2><Icon name="free" size={22} /> Free to Play, Fair to Win</h2>
        <p>
          Undercity is 100% free to play. The only purchases are optional supporter passes (Citizen Black Card
          and Contributor) that remove ads and add convenience features — no pay-to-win, no stat boosts,
          no unfair advantages.
        </p>
      </section>

      <section className="about-section">
        <h2><Icon name="shield" size={22} /> Privacy & Security</h2>
        <p>
          We take privacy seriously. Your data is encrypted, we never sell your information, and you can
          delete your account and all associated data at any time through GDPR-compliant account deletion.
        </p>
      </section>

      <footer className="about-footer">
        <Link to="/" className="about-btn">Play Now</Link>
      </footer>
    </div>
  );
}
