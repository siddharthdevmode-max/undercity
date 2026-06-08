import Icon from './ui/Icon';
import { NEWS_ITEMS, ROADMAP_ITEMS } from '../services/news';
import '../styles/AboutGamesSection.css';

const STATUS_LABEL: Record<string, string> = {
  'done':        'DONE',
  'in-progress': 'IN PROGRESS',
  'planned':     'PLANNED',
};

const STATUS_ICON: Record<string, string> = {
  'done':        'check-circle',
  'in-progress': 'nerve',
  'planned':     'clock',
};

const WHY_BULLETS = [
  {
    icon:  'brain',
    title: 'DEPTH OVER FLASH',
    desc:  'Strategy beats spending. Smart play matters more than your wallet. Skill caps are high — mastery takes months.',
  },
  {
    icon:  'globe',
    title: 'ALWAYS ONLINE',
    desc:  'The city runs 24/7. Your nerve regenerates, your properties earn, and your enemies plot — even when you sleep.',
  },
  {
    icon:  'users',
    title: 'REAL COMMUNITY',
    desc:  'Make friends. Make enemies. Build alliances that last weeks. Every player has a reputation and a story.',
  },
  {
    icon:  'shield',
    title: 'YOUR STORY, YOUR RULES',
    desc:  'No quests forcing your hand. Build the criminal you want to be — solo operator, gang leader, or market mogul.',
  },
  {
    icon:  'speed',
    title: 'MODERN TECH',
    desc:  'Built in 2025 with real-time WebSockets, no page refreshes, and a mobile-first UI that works on any device.',
  },
  {
    icon:  'refresh',
    title: 'ACTIVE DEVELOPMENT',
    desc:  'Weekly updates. A public roadmap. A dev who actually plays. Your feedback shapes the next patch.',
  },
  {
    icon:  'star',
    title: 'NO PAY-TO-WIN',
    desc:  'Supporters get cosmetic perks and quality-of-life bonuses. No stat advantages. The playing field stays level.',
  },
  {
    icon:  'infinite',
    title: 'INFINITE REPLAYABILITY',
    desc:  '24 systems to master. The meta shifts. New events reshape the economy. No two weeks play the same.',
  },
];

const QUICK_FACTS = [
  { icon: 'money',       text: '100% free to play — no credit card needed'      },
  { icon: 'globe',       text: 'Plays in any browser — zero downloads'           },
  { icon: 'clock',       text: 'Persistent world — progress while you sleep'     },
  { icon: 'no-paywall',  text: 'No paywalls on core gameplay — ever'             },
  { icon: 'tools',       text: 'Built in 2025 with modern real-time tech'        },
  { icon: 'chart',       text: 'Public roadmap — ship weekly, build in public'   },
  { icon: 'attack',      text: 'PvP and PvE — you choose your playstyle'         },
  { icon: 'gang',        text: 'Gang wars, territory control & faction alliances' },
  { icon: 'shield',      text: 'Military-grade anti-cheat — cheaters get caught' },
  { icon: 'star',        text: 'No pay-to-win — skill and strategy win here'     },
];

export default function AboutGamesSection() {
  return (
    <section className="about-games-section">
      <div className="about-games-inner">
        <span className="ag-eyebrow">LEARN THE STREETS</span>
        <h2 className="ag-heading">WELCOME TO UNDERCITY</h2>
        <div className="ag-divider">
          <span className="line" />
          <span className="diamond">◆</span>
          <span className="line" />
        </div>

        <div className="ag-grid">

          {/* ── LEFT ── */}
          <div className="ag-col">

            <div className="ag-card">
              <h3 className="ag-card-title">ABOUT TEXT-BASED GAMES</h3>
              <p>
                Undercity is a gritty, real-life text-based MMO set in a city that
                never sleeps. Every shadow hides a hustle. Every door leads to a deal.
                New players start weak, broke, and unknown — but in the streets,{' '}
                <em>everyone</em> gets a chance to climb.
              </p>
              <p>
                Train your stats at the gym. Pull off crimes for cash. Take jobs to
                stay clean. Attack rivals or get attacked. Join a gang, start a war,
                take territory. Run a back alley shop, trade on the exchange, gamble
                at the casino. With 24 systems to master and a city full of players
                to outsmart, no two runs are the same.
              </p>
              <p>
                Undercity is built for the long game. Free to play, deep to master,
                brutal to win.
              </p>
            </div>

            <div className="ag-card">
              <h3 className="ag-card-title">WHY UNDERCITY?</h3>
              <ul className="ag-why-list">
                {WHY_BULLETS.map((b) => (
                  <li key={b.title} className="ag-why-item">
                    <span className="why-icon">
                      <Icon name={b.icon} size={20} className="icon-accent" />
                    </span>
                    <div className="why-body">
                      <div className="why-title">{b.title}</div>
                      <div className="why-desc">{b.desc}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="ag-card ag-story">
              <h3 className="ag-card-title">THE STORY</h3>
              <p>A developer who fell in love with an iconic crime MMO.</p>
              <p>
                Years of grinding, late-night faction chats, rivalries that lasted
                months — there is nothing else like a text-based crime MMO done right.
                The grind, the community, the economy — all of it left a mark.
              </p>
              <p>
                Undercity is a small attempt to build that magic for the next
                generation. Not a clone. Not a cash grab. A love letter, rebuilt from
                scratch with modern tools, by someone who actually plays.
              </p>
              <blockquote className="ag-gratitude">
                To the games and communities that came before — you built something
                that defined years of my life. Undercity is not here to replace you.
                It is here because you taught me what is possible. Forever grateful.
              </blockquote>
              <div className="ag-signature">
                <div className="sig-name">— Challenger_69</div>
                <div className="sig-role">Founder &amp; Dev · Undercity</div>
              </div>
            </div>

          </div>

          {/* ── RIGHT ── */}
          <div className="ag-col">

            <div className="ag-card">
              <h3 className="ag-card-title">LATEST NEWS</h3>
              <ul className="ag-news-list">
                {NEWS_ITEMS.map((n) => (
                  <li key={n.id} className="ag-news-item">
                    <span className="ag-news-icon">
                      <Icon name={n.icon} size={16} className="icon-accent" />
                    </span>
                    <div className="ag-news-text">
                      <div className="ag-news-title">{n.title}</div>
                      <div className="ag-news-date">{n.date}</div>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="ag-news-footer">
                Updates appear here as we ship. Follow{' '}
                <a
                  href="https://x.com/undercityonline"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ag-link"
                >
                  @undercityonline
                </a>{' '}
                for real-time updates.
              </p>
            </div>

            <div className="ag-card">
              <h3 className="ag-card-title">ROADMAP</h3>
              <ul className="ag-roadmap-list">
                {ROADMAP_ITEMS.map((r) => (
                  <li key={r.id} className={`ag-roadmap-item status-${r.status}`}>
                    <span className="rm-icon">
                      <Icon
                        name={STATUS_ICON[r.status] ?? 'clock'}
                        size={13}
                        className={
                          r.status === 'done'        ? 'icon-success' :
                          r.status === 'in-progress' ? 'icon-warning' :
                                                       'icon-muted'
                        }
                      />
                    </span>
                    <span className="rm-version">{r.version}</span>
                    <span className="rm-title">{r.title}</span>
                    <span className="rm-status">{STATUS_LABEL[r.status]}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="ag-card">
              <h3 className="ag-card-title">QUICK FACTS</h3>
              <ul className="ag-facts-list">
                {QUICK_FACTS.map((f, i) => (
                  <li key={i} className="ag-facts-item">
                    <span className="fact-icon">
                      <Icon name={f.icon} size={15} className="icon-accent" />
                    </span>
                    <span className="fact-text">{f.text}</span>
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
