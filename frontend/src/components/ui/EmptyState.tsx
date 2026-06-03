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

// Preset for "coming soon" pages — each with unique personality
export function ComingSoon({ feature }: { feature: string }) {
  const configs: Record<string, { icon: string; tagline: string; eta?: string }> = {
    City: {
      icon: "🏙️",
      tagline: "Explore districts, find targets, run operations across the city.",
      eta: "Season 2",
    },
    Job: {
      icon: "💼",
      tagline: "Earn steady income, build cover, and fund your criminal empire.",
      eta: "Season 2",
    },
    Gym: {
      icon: "💪",
      tagline: "Train your strength, speed, and endurance. The streets respect power.",
      eta: "Season 2",
    },
    Properties: {
      icon: "🏢",
      tagline: "Buy safehouses, businesses, and hideouts. Own the city block by block.",
      eta: "Season 3",
    },
    Missions: {
      icon: "📋",
      tagline: "Take contracts, run operations, build your reputation with the syndicates.",
      eta: "Season 3",
    },
    Jail: {
      icon: "🔒",
      tagline: "Do your time. Plan your escape. The cell won't hold you forever.",
      eta: "Season 2",
    },
  };

  const config = configs[feature] ?? {
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
