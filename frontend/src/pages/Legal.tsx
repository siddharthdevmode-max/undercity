import { useParams, Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Icon from '../components/ui/Icon';
import '../styles/Landing.css';

interface LegalPage {
  title:       string;
  subtitle:    string;
  icon:        string;
  image:       string;
  lastUpdated: string;
  sections:    { heading: string; body: string }[];
}

const LEGAL_PAGES: Record<string, LegalPage> = {
  privacy: {
    title:       'Privacy Policy',
    subtitle:    'Your data, your rights. Always.',
    icon:        'shield',
    image:       '/legal-privacy.jpg',
    lastUpdated: 'June 2026',
    sections: [
      {
        heading: 'What We Collect',
        body: `We collect only what is necessary to run the game:

• Email address — for account authentication
• Username — your in-game identity
• IP address — for security and anti-cheat
• Device fingerprint — for multi-account detection
• Game activity — crimes, stats, progress

We do NOT collect your real name, location, payment details (handled by Lemon Squeezy), or any data from your device beyond what is listed above.`,
      },
      {
        heading: 'How We Use It',
        body: `Your data is used exclusively for:

• Running and maintaining the game
• Preventing cheating and multi-accounting
• Sending transactional emails (verification, security alerts)
• Improving game balance and detecting bugs

We never sell, rent, or share your data with third parties for advertising purposes.`,
      },
      {
        heading: 'Your Rights',
        body: `Under GDPR and global privacy laws, you have the right to:

• Export all your data at any time
• Request complete deletion of your account and data
• Opt out of analytics tracking
• Know exactly what data we hold about you

Contact support or use the in-game settings to exercise these rights.`,
      },
      {
        heading: 'Data Retention',
        body: `Active accounts: data retained while account exists.
Deleted accounts: personal data purged within 30 days.
Anonymized gameplay statistics may be retained for game balance purposes.`,
      },
    ],
  },
  terms: {
    title:       'Terms of Service',
    subtitle:    'The rules of the underground.',
    icon:        'news-crime',
    image:       '/legal-terms.jpg',
    lastUpdated: 'June 2026',
    sections: [
      {
        heading: 'Account Rules',
        body: `• One account per person — no exceptions
• You must be 18 years or older to play
• You are responsible for your account security
• Sharing accounts is prohibited
• Usernames must not be offensive or impersonate others`,
      },
      {
        heading: 'Prohibited Conduct',
        body: `• No botting, scripting, or automation of any kind
• No exploiting bugs (report them instead — we reward it)
• No harassment, hate speech, or threats toward other players
• No real-money trading of in-game items or currency
• No attempting to hack, DDoS, or compromise the game`,
      },
      {
        heading: 'Virtual Currency',
        body: `All in-game currency (money, points) is virtual and has no real-world monetary value. You cannot exchange, sell, or transfer virtual currency for real money. Purchases of premium items are final — see our Refund Policy for details.`,
      },
      {
        heading: 'Enforcement',
        body: `Violations result in penalties ranging from warnings to permanent bans. We reserve the right to suspend or terminate any account at our discretion. Shadow bans may be applied to suspected cheaters without notification.`,
      },
    ],
  },
  cookies: {
    title:       'Cookie Policy',
    subtitle:    'Minimal cookies. Maximum transparency.',
    icon:        'shield',
    image:       '/legal-cookies.jpg',
    lastUpdated: 'June 2026',
    sections: [
      {
        heading: 'Essential Cookies',
        body: `We use essential cookies for authentication only. These are required for the game to function — without them, you cannot log in.`,
      },
      {
        heading: 'Analytics Cookies',
        body: `If you accept analytics cookies, we use PostHog (privacy-focused analytics) to understand how players use the game. These cookies are optional and can be disabled at any time.

PostHog is configured with:
• No session recording
• No IP tracking
• Do Not Track respected
• No third-party data sharing`,
      },
      {
        heading: 'What We Don’t Use',
        body: `• No advertising cookies
• No tracking pixels
• No third-party cookies
• No social media tracking
• No cross-site tracking of any kind`,
      },
    ],
  },
  refund: {
    title:       'Refund Policy',
    subtitle:    'Fair and straightforward.',
    icon:        'money',
    image:       '/legal-refund.jpg',
    lastUpdated: 'June 2026',
    sections: [
      {
        heading: 'Digital Purchases',
        body: `All purchases are processed by Lemon Squeezy (our Merchant of Record). Since virtual items are delivered instantly, refunds are handled on a case-by-case basis.

You may request a refund within 14 days of purchase if:
• The item was not delivered
• You were charged incorrectly
• There was a technical error`,
      },
      {
        heading: 'How to Request',
        body: `Contact support with your purchase receipt and a description of the issue. We aim to respond within 48 hours. Approved refunds are processed within 5-10 business days.`,
      },
    ],
  },
  dmca: {
    title:       'DMCA & Copyright',
    subtitle:    'Protecting creators and content.',
    icon:        'shield',
    image:       '/legal-dmca.jpg',
    lastUpdated: 'June 2026',
    sections: [
      {
        heading: 'Copyright',
        body: `All game content, including but not limited to text, graphics, UI design, game mechanics, and source code, is © Undercity 2026. All rights reserved under the BSL 1.1 license.`,
      },
      {
        heading: 'DMCA Takedown',
        body: `If you believe your copyrighted work has been used without permission, contact us with:

• Description of the copyrighted work
• The specific location within the game
• Your contact information
• A statement of good faith

We will respond within 72 hours. Repeat infringers will have their accounts terminated.`,
      },
    ],
  },
  gambling: {
    title:       'Gambling Disclaimer',
    subtitle:    'Virtual currency only. No real money.',
    icon:        'casino',
    image:       '/legal-gambling.jpg',
    lastUpdated: 'June 2026',
    sections: [
      {
        heading: 'Virtual Currency',
        body: `Undercity contains casino features (coming in Wave 3) that use in-game virtual currency only. No real money is wagered, won, or lost. Virtual currency cannot be exchanged for real money under any circumstances.`,
      },
      {
        heading: 'Age Restriction',
        body: `You must be 18 years or older to play Undercity. This applies to all game features, including the casino. Age verification may be required.`,
      },
      {
        heading: 'Responsible Gaming',
        body: `If you or someone you know has concerns about gambling behavior, even with virtual currency, please visit:

• begambleaware.org
• gamcare.org.uk
• 1-800-522-4700 (US National Helpline)`,
      },
    ],
  },
};

const LEGAL_NAV = [
  { key: 'privacy',  label: 'Privacy Policy' },
  { key: 'terms',    label: 'Terms of Service' },
  { key: 'cookies',  label: 'Cookie Policy' },
  { key: 'refund',   label: 'Refund Policy' },
  { key: 'dmca',     label: 'DMCA & Copyright' },
  { key: 'gambling', label: 'Gambling Notice' },
];

export default function Legal() {
  const { page } = useParams<{ page: string }>();
  const content = page ? LEGAL_PAGES[page] : null;

  if (!content) {
    return (
      <div className="landing-page">
        <Header />
        <div className="legal-shell">
          <div className="legal-shell-overlay" />
          <div className="legal-shell-content">
            <div className="legal-page">
              <div className="legal-inner">
                <div className="legal-content">
                  <h1 className="section-heading">PAGE NOT FOUND</h1>
                  <p className="legal-not-found">
                    That legal page doesn&apos;t exist. <Link to="/">Go home</Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="landing-page">
      <Header />

      {/* Everything between header and footer gets the image behind it */}
      <div
        className="legal-shell"
        style={{ backgroundImage: `url(${content.image})` }}
      >
        <div className="legal-shell-overlay" />
        <div className="legal-shell-content">

          {/* Hero */}
          <div className="legal-hero">
            <div className="legal-hero-content">
              <span className="section-eyebrow">LEGAL</span>
              <div className="legal-title-row">
                <span className="legal-title-icon">
                  <Icon name={content.icon} size={24} />
                </span>
                <h1 className="legal-hero-title">{content.title.toUpperCase()}</h1>
              </div>
              <p className="legal-hero-subtitle">{content.subtitle}</p>
              <span className="legal-hero-date">Last updated: {content.lastUpdated}</span>
            </div>
          </div>

          {/* Main content */}
          <div className="legal-page">
            <div className="legal-inner">

              <aside className="legal-sidebar">
                <h3 className="legal-sidebar-title">LEGAL DOCUMENTS</h3>
                {LEGAL_NAV.map((item) => (
                  <Link
                    key={item.key}
                    to={`/legal/${item.key}`}
                    className={`legal-sidebar-link ${page === item.key ? 'active' : ''}`}
                  >
                    {item.label}
                  </Link>
                ))}
              </aside>

              <div className="legal-content">
                {content.sections.map((section, i) => (
                  <div key={i} className="legal-section">
                    <h2 className="legal-section-heading">
                      <span className="legal-section-num">{String(i + 1).padStart(2, '0')}</span>
                      {section.heading}
                    </h2>
                    <div className="legal-section-body">
                      {section.body.split('\n').map((line, j) => (
                        <p key={j}>{line}</p>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="legal-back">
                  <Link to="/">
                    <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}>
                      <Icon name="arrow-right" size={14} />
                    </span>
                    Back to Home
                  </Link>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>

      <Footer />
    </div>
  );
}
