import Icon from './Icon';
import "../../styles/EmptyState.css";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon = "construction", title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Icon name={icon} size={64} className="icon-accent" />
      </div>
      <h2 className="empty-state-title">{title}</h2>
      {description && <p className="empty-state-desc">{description}</p>}
      {action && (
        <button className="empty-state-btn" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}

interface UnderConstructionProps {
  feature: string;
  icon:    string;
  tagline: string;
  eta?:    string;
}

function UnderConstruction({ feature, icon, tagline, eta }: UnderConstructionProps) {
  return (
    <div className="under-construction">
      <div className="uc-icon">
        <Icon name={icon} size={72} className="icon-accent" />
      </div>
      <div className="uc-badge">COMING SOON</div>
      <h2 className="uc-title">{feature}</h2>
      <p className="uc-tagline">{tagline}</p>
      {eta && <div className="uc-eta">ETA: {eta}</div>}
      <div className="uc-bar-wrapper">
        <div className="uc-bar-track">
          <div className="uc-bar-fill" />
        </div>
        <span className="uc-bar-label">IN DEVELOPMENT</span>
      </div>
    </div>
  );
}

const CONFIGS: Record<string, { icon: string; tagline: string; eta?: string }> = {
  City:            { icon: 'city',          tagline: 'Explore districts, find targets, run operations across the city.',          eta: 'Season 2' },
  Gym:             { icon: 'gym',           tagline: 'Train your strength, speed, and endurance. The streets respect power.',       eta: 'Season 2' },
  Job:             { icon: 'job',           tagline: 'Earn steady income, build cover, and fund your criminal empire.',            eta: 'Season 2' },
  Company:         { icon: 'company',       tagline: 'Run legitimate fronts, manage staff, launder your earnings.',               eta: 'Season 3' },
  Properties:      { icon: 'properties',   tagline: 'Buy safehouses, businesses, and hideouts. Own the city block by block.',    eta: 'Season 3' },
  Inventory:       { icon: 'inventory',    tagline: 'Manage your weapons, items, and contraband. Every tool has its purpose.',   eta: 'Season 2' },
  Travel:          { icon: 'travel',        tagline: 'Move between cities. New territory, new opportunities, new enemies.',       eta: 'Season 3' },
  Missions:        { icon: 'missions',     tagline: 'Take contracts, run operations, build your reputation with the syndicates.',eta: 'Season 2' },
  Casino:          { icon: 'casino',        tagline: 'Gamble your earnings. High risk, high reward. The house always watches.',   eta: 'Season 2' },
  'Item Market':   { icon: 'market',        tagline: 'Buy and sell weapons, armor, and supplies. Every item has a price.',        eta: 'Season 2' },
  Gang:            { icon: 'gang',          tagline: 'Join a crew. Build loyalty. Control territory. The streets are yours.',     eta: 'Season 2' },
  'Linked Gangs':  { icon: 'linked-gangs', tagline: 'Form alliances, share resources, coordinate with allied gangs.',            eta: 'Season 3' },
  'Gang Wars':     { icon: 'gang-wars',    tagline: 'Wage war against rival gangs. Territory, respect, and blood.',              eta: 'Season 3' },
  Forum:           { icon: 'forum',         tagline: 'Talk to the streets. Share intel, post bounties, negotiate deals.',        eta: 'Season 2' },
  Events:          { icon: 'events',        tagline: 'City-wide events, heists, and competitions. Miss nothing.',                eta: 'Season 2' },
  Newspaper:       { icon: 'newspaper',    tagline: 'Read the latest from the underground. Crime reports, power shifts, hits.',  eta: 'Season 2' },
  Calendar:        { icon: 'calendar',     tagline: 'Track events, cooldowns, and scheduled operations.',                        eta: 'Season 2' },
  Hospital:        { icon: 'hospital',     tagline: 'Recover from attacks, heal injuries, and get back on your feet.',          eta: 'Season 2' },
  Jail:            { icon: 'jail',          tagline: 'Do your time. Plan your escape. The cell will not hold you forever.',      eta: 'Season 2' },
  'Federal Jail':  { icon: 'federal-jail', tagline: 'Maximum security. Federal charges. This is serious time.',                 eta: 'Season 2' },
};

export function ComingSoon({ feature }: { feature: string }) {
  const config = CONFIGS[feature] ?? {
    icon:    'construction',
    tagline: 'This feature is under heavy construction. Check back soon.',
  };
  return (
    <UnderConstruction
      feature={feature.toUpperCase()}
      icon={config.icon}
      tagline={config.tagline}
      eta={config.eta}
    />
  );
}
