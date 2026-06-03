import "../../styles/EmptyState.css";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon = "🚧", title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
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
  icon: string;
  tagline: string;
  eta?: string;
}

function UnderConstruction({ feature, icon, tagline, eta }: UnderConstructionProps) {
  return (
    <div className="under-construction">
      <div className="uc-icon">{icon}</div>
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
  City: {
    icon: "🏙️",
    tagline: "Explore districts, find targets, run operations across the city.",
    eta: "Season 2",
  },
  Gym: {
    icon: "💪",
    tagline: "Train your strength, speed, and endurance. The streets respect power.",
    eta: "Season 2",
  },
  Job: {
    icon: "💼",
    tagline: "Earn steady income, build cover, and fund your criminal empire.",
    eta: "Season 2",
  },
  Company: {
    icon: "🏭",
    tagline: "Run legitimate fronts, manage staff, launder your earnings.",
    eta: "Season 3",
  },
  Properties: {
    icon: "🏢",
    tagline: "Buy safehouses, businesses, and hideouts. Own the city block by block.",
    eta: "Season 3",
  },
  Inventory: {
    icon: "🎒",
    tagline: "Manage your weapons, items, and contraband. Every tool has its purpose.",
    eta: "Season 2",
  },
  Travel: {
    icon: "✈️",
    tagline: "Move between cities. New territory, new opportunities, new enemies.",
    eta: "Season 3",
  },
  Casino: {
    icon: "🎰",
    tagline: "Gamble your earnings. High risk, high reward. The house always watches.",
    eta: "Season 2",
  },
  "Black Market": {
    icon: "🕶️",
    tagline: "Buy and sell contraband. No questions asked. Bring cash.",
    eta: "Season 2",
  },
  Faction: {
    icon: "⚔️",
    tagline: "Join a crew. Build loyalty. War with rivals. Control the streets.",
    eta: "Season 2",
  },
  "Faction Link": {
    icon: "🔗",
    tagline: "Connect with your faction members. Share intel, coordinate operations.",
    eta: "Season 2",
  },
  Forum: {
    icon: "💬",
    tagline: "Talk to the streets. Share intel, post bounties, negotiate deals.",
    eta: "Season 2",
  },
  Events: {
    icon: "📅",
    tagline: "City-wide events, heists, and competitions. Miss nothing.",
    eta: "Season 2",
  },
  Newspaper: {
    icon: "📰",
    tagline: "Read the latest from the underground. Crime reports, power shifts, hits.",
    eta: "Season 2",
  },
  Calendar: {
    icon: "🗓️",
    tagline: "Track events, cooldowns, and scheduled operations.",
    eta: "Season 2",
  },
  Hospital: {
    icon: "🏥",
    tagline: "Recover from attacks, heal injuries, and get back on your feet.",
    eta: "Season 2",
  },
  Jail: {
    icon: "🔒",
    tagline: "Do your time. Plan your escape. The cell won't hold you forever.",
    eta: "Season 2",
  },
  "Federal Jail": {
    icon: "🏛️",
    tagline: "Maximum security. Federal charges. This is serious time.",
    eta: "Season 2",
  },
};

export function ComingSoon({ feature }: { feature: string }) {
  const config = CONFIGS[feature] ?? {
    icon: "🚧",
    tagline: "This feature is under heavy construction. Check back soon.",
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
