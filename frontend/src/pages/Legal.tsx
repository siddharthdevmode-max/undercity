import { useParams, Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import '../styles/Landing.css';

const LEGAL_CONTENT: Record<string, { title: string; body: string }> = {
  privacy: {
    title: 'Privacy Policy',
    body: `Your data is protected. We collect only what is necessary to run the game:
email, username, IP address, and device fingerprint for anti-cheat purposes.
We never sell your data. You may request deletion at any time via support.
Full GDPR compliance is in effect.`,
  },
  terms: {
    title: 'Terms of Service',
    body: `By playing Undercity you agree to our rules. One account per person.
No botting, scripting, or exploiting bugs. All in-game currency is virtual
and has no real-world monetary value. We reserve the right to ban any account
that violates these terms.`,
  },
  cookies: {
    title: 'Cookie Policy',
    body: `We use essential cookies for authentication only. No tracking cookies,
no advertising cookies, no third-party cookies. You may disable cookies in your
browser but this will prevent login from working.`,
  },
  dmca: {
    title: 'DMCA & Copyright',
    body: `All game content is © Undercity. If you believe your copyrighted work
has been used without permission, contact us with details and we will respond
within 72 hours. Repeat infringers will have their accounts terminated.`,
  },
  gambling: {
    title: 'Gambling Notice',
    body: `Undercity contains casino features using in-game virtual currency only.
No real money is involved. Virtual currency cannot be exchanged for real money.
This game is intended for players aged 18+. If you have concerns about gambling
behaviour, visit begambleaware.org.`,
  },
};

export default function Legal() {
  const { page } = useParams<{ page: string }>();
  const content = page ? LEGAL_CONTENT[page] : null;

  if (!content) {
    return (
      <div className="landing-page">
        <Header />
        <section className="about-section">
          <div className="about-content">
            <div className="about-text">
              <h1 className="auth-title">PAGE NOT FOUND</h1>
              <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>
                That legal page doesn't exist.{' '}
                <Link to="/" style={{ color: 'var(--accent)' }}>Go home</Link>
              </p>
            </div>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  return (
    <div className="landing-page">
      <Header />
      <section className="about-section">
        <div className="about-content" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="about-text" style={{ maxWidth: '100%' }}>
            <span className="hero-eyebrow">LEGAL</span>
            <h1 className="auth-title" style={{ fontSize: '2.5rem' }}>
              {content.title.toUpperCase()}
            </h1>
            <div className="divider">
              <span className="line" />
              <span className="diamond">◆</span>
              <span className="line" />
            </div>
            <div style={{
              whiteSpace: 'pre-line',
              color: 'var(--text-secondary)',
              lineHeight: 1.8,
              fontSize: 'var(--text-md)',
              marginTop: '1.5rem',
            }}>
              {content.body}
            </div>
            <Link
              to="/"
              style={{
                display:       'inline-flex',
                alignItems:    'center',
                gap:           '8px',
                marginTop:     '2rem',
                color:         'var(--accent)',
                fontWeight:    700,
                fontSize:      'var(--text-sm)',
                letterSpacing: '1px',
              }}
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
