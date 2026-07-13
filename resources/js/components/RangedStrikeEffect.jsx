import { useRef } from 'react';
import { useStrikeLifecycle, ImpactBurst } from './combatFx.jsx';

/** Duración total del efecto en ms — debe cubrir el remate más largo (partículas). */
export const RANGED_TOTAL_MS = 870;

/** Cuánto tarda la mira en viajar del atacante al objetivo — calza con --nx-reticle-travel-dur. */
const TRAVEL_MS = 260;

/**
 * Golpe a distancia: una mira (reticle) viaja desde el atacante y hace
 * "lock-on" sobre el objetivo, seguida del mismo estallido de impacto
 * (flash/anillo/partículas) que el golpe melee — comparte `ImpactBurst` y
 * `useStrikeLifecycle` con `EnergyStrikeEffect`, solo cambia cómo se cierra
 * la distancia (mira en vez de arco de energía).
 */
export default function RangedStrikeEffect({ from, to, color = '#38cdf0', hit = true, stageRef, targetRef, onDone }) {
  const filterId = useRef(`nx-ranged-${Math.random().toString(36).slice(2)}`).current;
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  useStrikeLifecycle({ stageRef, targetRef, hit, impactAt: TRAVEL_MS, totalMs: RANGED_TOTAL_MS, onDone });

  return (
    <div className="nx-strike" style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible',
      '--nx-strike-impact-at': 'var(--nx-reticle-travel-dur)',
    }}>
      <div className="nx-reticle" style={{ left: from.x, top: from.y, '--rx': `${dx}px`, '--ry': `${dy}px`, borderColor: color }}>
        <span className="nx-reticle-line nx-reticle-line-h" style={{ background: color }} />
        <span className="nx-reticle-line nx-reticle-line-v" style={{ background: color }} />
      </div>

      <ImpactBurst to={to} color={color} filterId={filterId} hit={hit} />
    </div>
  );
}
