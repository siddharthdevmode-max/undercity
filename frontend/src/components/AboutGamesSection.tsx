import Icon from './ui/Icon';
import { NEWS_ITEMS, ROADMAP_ITEMS } from '../services/news';
import '../styles/AboutGamesSection.css';

const STATUS_LABEL: Record<string, string> = {
  'done':        'DONE',
  'in-progress': 'IN PROGRESS',
  'planned':     'PLANNED',
};

const STATUS_ICON: Record<string, string> = {
  'done':        'success',
  'in-progress': 'nerve',
  'planned':     'clock',
};

const WHY_BULLETS = [
  { icon: 'brain',      title: 'DEPTH OVER FLASH',       desc: 'Strategy beats spending. Smart play matters more than your wallet.'       },
  { icon: 'globe',      title: 'ALWAYS ONLINE',          desc: 'The city runs 24/7. Your empire grows even when you sleep.'              },
  { icon: 'handshake',  title: 'REAL COMMUNITY',         desc: 'Make friends. Make enemies. Make alliances. Every player matters.'       },
  { icon: 'shield',     title: 'YOUR STORY, YOUR RULES', desc: 'No quests forcing your hand. Build the criminal you want to be.'        },
];

const QUICK_FACTS = [
  { icon: 'money',       text: '100% free to play'                  },
  { icon: 'globe',       text: 'Plays in any browser. No download.' },
  { icon: 'clock',       text: 'Persistent world. 24/7 progression.' },
  { icon: 'no-paywall',  text: 'No paywalls on core gameplay.'      },
  { icon: 'tools',       text: 'Built in 2025 with modern tech.'    },
  { icon: 'chart',       text: 'Active development. Public roadmap.' },
  { icon: 'attack',      text: 'PvP and PvE — your choice.'         },
  { icon: 'gang',        text: 'Faction wars & territory control.'  },
];

export default function AboutGamesSection() {
  return (
    <section className="about-games-section">
      <div className="about-games-inner">
        <span className="ag-eyebrow">LEARN THE STREETS</span>
        <h2 className="ag-heading">WELCOME TO UNDERCITY</h2>
        <div className="ag-divider">
          <span className="line" /><span className="diamond">◆</span><span className="line" />
        </div>

        <div className="ag-grid">
          {/* LEFT */}
          <div className="ag-left">

            <div className="ag-card ag-about">
              <h3 className="ag-card-title">ABOUT TEXT-BASED GAMES</h3>
              <p>
                Undercity is a gritty, real-life text-based game set in a city that doesn't sleep.
                Every shadow hides a hustle. Every door leads to a deal. New players start weak,
                broke, and unknown — but in the streets, <em>everyone</em> gets a chance to climb.
              </p>
              <p>
                Train your stats at the gym. Pull off crimes for cash. Take jobs to stay clean.
                Attack rivals or get attacked. Join a faction, start a war, take territory. Run a
                black market, trade in the bazaar, gamble at the casino. With 24 systems to master
                and a community of players to outsmart, no two playthroughs are the same.
              </p>
              <p>
                Undercity is built for the long game. Free to play, deep to master, brutal to win.
              </p>
            </div>

            <div className="ag-card ag-about">
              <h3 className="ag-card-title">WHY UNDERCITY?</h3>
              <ul className="ag-why-list">
                {WHY_BULLETS.map((b) => (
                  <li key={b.title} className="ag-why-item">
                    <span className="why-icon">
                      <Icon name={b.icon} size={24} className="icon-accent" />
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
              <p>A man who fell in love with an iconic crime MMO called Torn.</p>
              <p>
                He played it for years. He never got over it. The grind, the factions,
                the late-night chats, the rivalries that lasted months — there's nothing else like it.
              </p>
              <p>
                Undercity is a small attempt to build that magic for the next generation.
                Not a clone. Not a cash grab. A love letter, rebuilt from scratch with
                modern tools, by someone who actually plays.
              </p>
              <blockquote className="ag-gratitude">
                Before I close — a thank you. To the Torn team and everyone behind the game:
                you built something that defined years of my life. Undercity isn't here to
                replace Torn. It's here because Torn taught me what's possible. Forever a fan.
              </blockquote>
              <div className="ag-signature">
                <div className="sig-name">— Challenger_69</div>
                <div className="sig-role">Founder &amp; Dev · Former Torn player</div>
              </div>
            </div>

          </div>

          {/* RIGHT */}
          <div className="ag-right">

            <div className="ag-card ag-about">
              <h3 className="ag-card-title">LATEST NEWS</h3>
              <ul className="ag-news-list">
                {NEWS_ITEMS.map((n) => (
                  <li key={n.id} className="ag-news-item">
                    <span className="ag-news-icon">
                      <Icon name={n.icon} size={18} className="icon-accent" />
                    </span>
                    <div className="ag-news-text">
                      <div className="ag-news-title">{n.title}</div>
                      <div className="ag-news-date">{n.date}</div>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="ag-news-footer">Updates appear here as we ship features.</p>
            </div>

            <div className="ag-card ag-about">
              <h3 className="ag-card-title">ROADMAP</h3>
              <ul className="ag-roadmap-list">
                {ROADMAP_ITEMS.map((r) => (
                  <li key={r.id} className={`ag-roadmap-item status-${r.status}`}>
                    <span className="rm-icon">
                      <Icon name={STATUS_ICON[r.status]} size={14}
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

            <div className="ag-card ag-about">
              <h3 className="ag-card-title">QUICK FACTS</h3>
              <ul className="ag-facts-list">
                {QUICK_FACTS.map((f, i) => (
                  <li key={i} className="ag-facts-item">
                    <span className="fact-icon">
                      <Icon name={f.icon} size={18} className="icon-accent" />
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
