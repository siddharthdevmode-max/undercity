// ============================================================
// ICON — SVG sprite consumer
// Usage: <Icon name="crime" size={20} className="icon-accent" />
// All icons use currentColor — inherit from CSS
// ============================================================

interface IconProps {
  name: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  'aria-hidden'?: boolean;
  'aria-label'?: string;
}

export default function Icon({
  name,
  size = 20,
  className = '',
  style,
  'aria-hidden': ariaHidden = true,
  'aria-label': ariaLabel,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      className={`uc-icon ${className}`}
      style={style}
      aria-hidden={ariaHidden || undefined}
      aria-label={ariaLabel}
      focusable="false"
      role={ariaLabel ? 'img' : undefined}
    >
      <use href={`/icons.svg#icon-${name}`} />
    </svg>
  );
}
