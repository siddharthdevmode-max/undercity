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

// Preset for "coming soon" pages
export function ComingSoon({ feature }: { feature: string }) {
  return (
    <EmptyState
      icon="🚧"
      title={`${feature} - Coming Soon`}
      description="This feature is currently under construction. Check back soon for updates!"
    />
  );
}
