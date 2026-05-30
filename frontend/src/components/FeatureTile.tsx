import type { Feature } from '../services/features';

interface Props {
  feature: Feature;
  delay?: number;
}

export default function FeatureTile({ feature, delay = 0 }: Props) {
  return (
    <div className="feature-tile" style={{ animationDelay: `${delay}ms` }}>
      <div className="feature-icon" aria-hidden>{feature.icon}</div>
      <div className="feature-name">{feature.name}</div>
      <div className="feature-desc">{feature.description}</div>
    </div>
  );
}
