import { useMemo, useRef } from 'react';
import { getRelativeCenter, useStrikeLifecycle, ImpactBurst } from './combatFx.jsx';

/** Duración total del efecto en ms — debe cubrir el remate más largo (partículas). */
export const STRIKE_TOTAL_MS = 750;

export { getRelativeCenter };

function buildArcPath(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = -dy / dist;
  const ny = dx / dist;
  const bulge = Math.min(dist * 0.22, 70);
  const mx = (from.x + to.x) / 2 + nx * bulge;
  const my = (from.y + to.y) / 2 + ny * bulge;
  return `M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`;
}

/**
 * Golpe de energía melee (estilo sable de luz) entre un atacante y un
 * objetivo dentro de un stage de combate. Se monta cuando ocurre el golpe y
 * llama a `onDone` cuando termina — el padre decide cuándo desmontarlo.
 *
 * - `from` / `to`: {x, y} en px, relativos al mismo elemento posicionado
 *   (position: relative) donde se monta este componente. Usa
 *   `getRelativeCenter(el, stageEl)` para calcularlos desde refs reales.
 * - `outcome`: "hit" dibuja el arco y dispara el estallido de impacto +
 *   overlay rojo/shake en el objetivo; "block" un crecimiento breve;
 *   "dodge" una salida y reentrada — en estos dos últimos el arco se dibuja
 *   igual (el ataque ocurrió) pero sin estallido de impacto.
 * - `stageRef` (opcional): ref del contenedor a sacudir (screen shake).
 * - `attackerRef` (opcional): ref del atacante (salto al actuar).
 * - `targetRef` (opcional): ref del objetivo (reacción según `outcome`).
 */
export default function EnergyStrikeEffect({ from, to, color = '#38cdf0', outcome = 'hit', stageRef, attackerRef, targetRef, onDone }) {
  const path = useMemo(() => buildArcPath(from, to), [from, to]);
  const filterId = useRef(`nx-strike-${Math.random().toString(36).slice(2)}`).current;

  useStrikeLifecycle({ stageRef, attackerRef, targetRef, outcome, impactAt: 140, totalMs: STRIKE_TOTAL_MS, onDone });

  return (
    <div className="nx-strike" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <defs>
          <filter id={`${filterId}-outer`} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="12" />
          </filter>
          <filter id={`${filterId}-mid`} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
          <filter id={`${filterId}-core`} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="1.5" />
          </filter>
        </defs>

        {/* capa exterior — glow difuso */}
        <path d={path} pathLength="100" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          filter={`url(#${filterId}-outer)`} opacity="0.55"
          className="nx-strike-arc nx-strike-arc-outer" />
        {/* capa media */}
        <path d={path} pathLength="100" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
          filter={`url(#${filterId}-mid)`} opacity="0.85"
          className="nx-strike-arc nx-strike-arc-mid" />
        {/* núcleo — blanco, casi nítido */}
        <path d={path} pathLength="100" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"
          filter={`url(#${filterId}-core)`}
          className="nx-strike-arc nx-strike-arc-core" />
      </svg>

      <ImpactBurst to={to} color={color} filterId={filterId} hit={outcome === 'hit'} />
    </div>
  );
}
