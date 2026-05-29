import { useEffect, useRef, useState } from 'react';

export function useCountUp(target: number, duration = 1500, start = false) {
  const [value, setValue] = useState(0);
  const animatedRef = useRef(false);
  const lastTargetRef = useRef(target);

  useEffect(() => {
    // Reset animation if target changes (e.g. data refresh)
    if (lastTargetRef.current !== target) {
      animatedRef.current = false;
      lastTargetRef.current = target;
    }

    if (!start || animatedRef.current) return;
    if (target <= 0) return;

    animatedRef.current = true;
    const startTime = performance.now();
    const initial = 0;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(initial + (target - initial) * eased);
      setValue(current);
      if (progress < 1) requestAnimationFrame(tick);
      else setValue(target);
    };

    requestAnimationFrame(tick);
  }, [start, target, duration]);

  return value;
}
