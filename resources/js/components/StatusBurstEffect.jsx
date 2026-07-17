import { useEffect, useMemo, useRef } from 'react';
import { Icon } from './ui.jsx';
import { getRelativeCenter } from './combatFx.jsx';

const VARIANTS = {
  buff: {
    icon: 'arrow',
    color: '#38cdf0',
    totalMs: 880,
    count: 7,
    targetClass: 'nx-combat-buff-bob',
  },
  heal: {
    icon: 'plus',
    color: '#10b981',
    totalMs: 900,
    count: 7,
    targetClass: 'nx-combat-heal-bob',
  },
};

function rand(min, max) {
  return min + Math.random() * (max - min);
}

export default function StatusBurstEffect({ variant = 'buff', stageRef, targetRef, onDone }) {
  const cfg = VARIANTS[variant] ?? VARIANTS.buff;
  const at = useMemo(
    () => getRelativeCenter(targetRef?.current, stageRef?.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const filterId = useRef(`nx-status-${Math.random().toString(36).slice(2)}`).current;
  const items = useMemo(() => (
    Array.from({ length: cfg.count }, (_, i) => ({
      id: i,
      dx: `${rand(-42, 42).toFixed(1)}px`,
      dy: `${rand(-54, -18).toFixed(1)}px`,
      rot: `${rand(-22, 22).toFixed(1)}deg`,
      delay: `${i * 55}ms`,
      scale: `${rand(0.75, 1.12).toFixed(2)}`,
    }))
  ), [cfg.count]);

  useEffect(() => {
    const target = targetRef?.current;
    if (!target) return undefined;
    target.classList.add(cfg.targetClass);
    const done = setTimeout(() => onDone?.(), cfg.totalMs);
    return () => {
      clearTimeout(done);
      target.classList.remove(cfg.targetClass);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.targetClass, cfg.totalMs, onDone]);

  return (
    <div className="nx-status-burst-layer" style={{ '--nx-status-color': cfg.color }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <defs>
          <radialGradient id={`${filterId}-glow`}>
            <stop offset="0%" stopColor={cfg.color} stopOpacity="0.9" />
            <stop offset="65%" stopColor={cfg.color} stopOpacity="0.45" />
            <stop offset="100%" stopColor={cfg.color} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={at.x} cy={at.y} r="28" fill={`url(#${filterId}-glow)`} className="nx-status-core" />
      </svg>

      <div className="nx-status-glyphs" style={{ left: at.x, top: at.y }}>
        {items.map((it) => (
          <span
            key={it.id}
            className={`nx-status-glyph nx-status-glyph-${variant}`}
            style={{
              '--dx': it.dx,
              '--dy': it.dy,
              '--rot': it.rot,
              '--delay': it.delay,
              '--scale': it.scale,
            }}
          >
            <Icon name={cfg.icon} size={variant === 'buff' ? 13 : 14} />
          </span>
        ))}
      </div>
    </div>
  );
}
