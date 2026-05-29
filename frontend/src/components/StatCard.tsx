import OdometerNumber from './OdometerNumber';

interface Props {
  value: number;
  label: string;
  sublabel: string;
  start: boolean;
  delay?: number;
}

export default function StatCard({ value, label, sublabel, start, delay = 0 }: Props) {
  return (
    <div className="stat-card" style={{ animationDelay: `${delay}ms` }}>
      <OdometerNumber target={value} start={start} duration={1500 + delay} />
      <div className="stat-divider" />
      <div className="stat-label">{label}</div>
      <div className="stat-sublabel">{sublabel}</div>
    </div>
  );
}
