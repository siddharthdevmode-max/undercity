import { useState, useEffect } from 'react';

interface TimeLeft {
  d: number;
  h: number;
  m: number;
  s: number;
}

function getTimeLeft(target: string): TimeLeft {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0 };
  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff % 86400000) / 3600000),
    m: Math.floor((diff % 3600000)  / 60000),
    s: Math.floor((diff % 60000)    / 1000),
  };
}

interface Props {
  targetDate: string;
}

export default function Countdown({ targetDate }: Props) {
  const [time, setTime] = useState<TimeLeft>(() => getTimeLeft(targetDate));

  useEffect(() => {
    const id = setInterval(() => setTime(getTimeLeft(targetDate)), 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  const units = [
    { label: 'DAYS',    value: time.d },
    { label: 'HOURS',   value: time.h },
    { label: 'MINUTES', value: time.m },
    { label: 'SECONDS', value: time.s },
  ];

  return (
    <div className="countdown">
      <p className="countdown-eyebrow">LAUNCH IN</p>
      <div className="countdown-grid">
        {units.map(({ label, value }, i) => (
          <div key={label} className="countdown-unit-wrap">
            <div className="countdown-unit">
              <div className="countdown-value">
                {String(value).padStart(2, '0')}
              </div>
              <div className="countdown-unit-label">{label}</div>
            </div>
            {i < units.length - 1 && (
              <div className="countdown-sep">:</div>
            )}
          </div>
        ))}
      </div>
      <p className="countdown-date">December 15, 2026 · 00:00 UTC</p>
    </div>
  );
}
