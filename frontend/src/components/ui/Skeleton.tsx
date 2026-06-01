import "../../styles/Skeleton.css";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  variant?: "text" | "rect" | "circle";
}

export function Skeleton({ width, height, className = "", variant = "rect" }: SkeletonProps) {
  const style: React.CSSProperties = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
  };
  return <div className={`skeleton skeleton-${variant} ${className}`} style={style} />;
}

// Preset: Crime Card Skeleton
export function CrimeCardSkeleton() {
  return (
    <div className="crime-skeleton-card">
      <Skeleton variant="text" width="60%" height={20} />
      <Skeleton variant="rect" width={50} height={28} className="crime-skeleton-badge" />
      <div className="crime-skeleton-bottom">
        <Skeleton variant="text" width="40%" height={14} />
        <Skeleton variant="rect" width="100%" height={6} />
        <Skeleton variant="rect" width="100%" height={36} />
      </div>
    </div>
  );
}

// Preset: Crimes Grid Skeleton
export function CrimesGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="crimes-grid">
      {Array.from({ length: count }).map((_, i) => (
        <CrimeCardSkeleton key={i} />
      ))}
    </div>
  );
}
