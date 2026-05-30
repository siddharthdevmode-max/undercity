import { NEWS_ITEMS, ROADMAP_ITEMS } from '../services/news';
import '../styles/AboutGamesSection.css';

const STATUS_LABEL: Record<string, string> = {
  'done': 'DONE',
  'in-progress': 'IN PROGRESS',
  'planned': 'PLANNED',
};

const STATUS_ICON: Record<string, string> = {
  'done': '🟢',
  'in-progress': '🟡',
  'planned': '⏳',
};

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
          {/* LEFT — About card */}
          <div className="ag-card ag-about">
            <h3 className="ag-card-title">ABOUT TEXT-BASED GAMES</h3>
            <p>
              Undercity is a gritty, real-life text-based game set in a city that doesn't sleep.
              Every shadow hides a hustle. Every door leads to a deal. New players start weak,
              broke, and unknown — but in the streets, <em>everyone</em> gets a chance to climb.
              Or fall. The choice is yours, and the city is watching.
            </p>
            <p>
              Train your stats at the gym. Pull off crimes for cash. Take jobs to stay clean.
              Attack rivals or get attacked. Join a faction, start a war, take territory. Run a
              black market, trade in the bazaar, gamble at the casino. Buy property, invest in
              stocks, climb the underworld. With 24 systems to master and a community of players
              to outsmart, no two playthroughs are the same.
            </p>
            <p>
              Undercity is built for the long game. Free to play, deep to master, brutal to win.
              Register now, claim your name, and start writing your story in a city that
              never forgets.
            </p>
          </div>

          {/* RIGHT — News + Roadmap stacked */}
          <div className="ag-right">
            <div className="ag-card">
              <h3 className="ag-card-title">LATEST NEWS</h3>
              <ul className="ag-news-list">
                {NEWS_ITEMS.map((n) => (
                  <li key={n.id} className="ag-news-item">
                    <span className="ag-news-icon">{n.icon}</span>
                    <div className="ag-news-text">
                      <div className="ag-news-title">{n.title}</div>
                      <div className="ag-news-date">{n.date}</div>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="ag-news-footer">
                Updates will appear here once we launch.
              </p>
            </div>

            <div className="ag-card">
              <h3 className="ag-card-title">ROADMAP</h3>
              <ul className="ag-roadmap-list">
                {ROADMAP_ITEMS.map((r) => (
                  <li key={r.id} className={`ag-roadmap-item status-${r.status}`}>
                    <span className="rm-icon">{STATUS_ICON[r.status]}</span>
                    <span className="rm-version">{r.version}</span>
                    <span className="rm-title">{r.title}</span>
                    <span className="rm-status">{STATUS_LABEL[r.status]}</span>
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
