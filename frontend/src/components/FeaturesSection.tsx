import { useEffect, useRef, useState } from 'react';
import FeatureTile from './FeatureTile';
import { FEATURES } from '../services/features';
import '../styles/FeaturesSection.css';

export default function FeaturesSection() {
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setVisible(true);
            obs.disconnect();
          }
        });
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="features" className="features-section" ref={sectionRef}>
      <div className="features-inner">
        <span className="features-eyebrow">THE GAME</span>
        <h2 className="features-heading">MASTER YOUR EMPIRE</h2>
        <div className="features-divider">
          <span className="line" />
          <span className="diamond">◆</span>
          <span className="line" />
        </div>
        <p className="features-subtitle">
          {FEATURES.length} systems. One ruthless city.
        </p>

        <div className={`features-grid ${visible ? 'is-visible' : ''}`}>
          {FEATURES.map((f, i) => (
            <FeatureTile key={f.id} feature={f} delay={i * 30} />
          ))}
        </div>
      </div>
    </section>
  );
}
