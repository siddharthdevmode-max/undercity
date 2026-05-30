import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import StatsSection from '../components/StatsSection';
import FeaturesSection from '../components/FeaturesSection';
import AboutGamesSection from '../components/AboutGamesSection';
import hero from '../assets/hero.png';
import '../styles/Landing.css';

export default function Landing() {
  return (
    <div className="landing-page">
      <Header />

      <section className="about-section">
        <div className="about-content">
          <div className="about-text">
            <h1 className="about-heading">
              ABOUT <span className="accent">UNDERCITY</span>
            </h1>
            <div className="divider">
              <span className="line" />
              <span className="diamond">◆</span>
              <span className="line" />
            </div>
            <p className="about-body">
              Undercity is a text-based crime MMO where every choice matters.
              Start as a nobody. Train, hustle, steal, fight. Climb the ranks.
              Build your empire. Leave your legacy.
            </p>
            <Link to="/register" className="cta-button">
              CREATE FREE ACCOUNT <span className="arrow">→</span>
            </Link>
          </div>

          <div className="about-image">
            <img src={hero} alt="Undercity skyline" />
          </div>
        </div>
      </section>

      <StatsSection />

      <FeaturesSection />

      <AboutGamesSection />

      <Footer />
    </div>
  );
}
