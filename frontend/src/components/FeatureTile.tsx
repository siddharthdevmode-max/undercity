import { useState } from 'react';
import Icon from './ui/Icon';
import type { Feature } from '../services/features';

interface Props {
  feature: Feature;
  delay?:  number;
}

const TAG_COLORS: Record<string, string> = {
  LIVE: 'var(--color-success, #4ade80)',
  SOON: 'var(--accent)',
  NEW:  '#facc15',
};

export default function FeatureTile({ feature, delay = 0 }: Props) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={`feature-tile ${hovered ? 'feature-tile--hovered' : ''}`}
      style={{ animationDelay: `${delay}ms` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role="button"
      tabIndex={0}
      aria-label={`${feature.name}: ${feature.description}`}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      {/* Tag badge */}
      {feature.tag && (
        <div
          className="feature-tag"
          style={{ color: TAG_COLORS[feature.tag] ?? 'var(--accent)' }}
        >
          {feature.tag === 'LIVE' && (
            <span className="feature-tag-dot" style={{ background: TAG_COLORS['LIVE'] }} />
          )}
          {feature.tag}
        </div>
      )}

      {/* Icon */}
      <div className="feature-icon" aria-hidden="true">
        <Icon name={feature.icon} size={32} />
      </div>

      {/* Name */}
      <div className="feature-name">{feature.name}</div>

      {/* Description — shown when not hovered */}
      <div className={`feature-desc ${hovered ? 'feature-desc--hidden' : ''}`}>
        {feature.description}
      </div>

      {/* Detail — shown on hover */}
      <div className={`feature-detail ${hovered ? 'feature-detail--visible' : ''}`}>
        {feature.detail}
      </div>
    </div>
  );
}
