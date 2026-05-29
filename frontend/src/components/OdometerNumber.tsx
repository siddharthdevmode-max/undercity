import { useCountUp } from '../hooks/useCountUp';

interface Props {
  target: number;
  start: boolean;
  duration?: number;
}

export default function OdometerNumber({ target, start, duration = 1500 }: Props) {
  const current = useCountUp(target, duration, start);
  const formatted = current.toLocaleString('en-US');
  const chars = formatted.split('');

  return (
    <div className="odometer" aria-label={`${target}`}>
      {chars.map((ch, i) => (
        <span key={i} className={`odo-slot ${ch === ',' ? 'comma' : ''}`}>
          {ch}
        </span>
      ))}
    </div>
  );
}
