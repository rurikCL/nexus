import { useEffect, useMemo } from 'react';

const PARTICLE_COUNT = 14;

/** Centro de `el` en coordenadas relativas a `container` (para from/to). */
export function getRelativeCenter(el, container) {
  if (!el || !container) return { x: 0, y: 0 };
  const elRect = el.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  return {
    x: elRect.left + elRect.width / 2 - containerRect.left,
    y: elRect.top + elRect.height / 2 - containerRect.top,
  };
}

/**
 * Ciclo de vida compartido por los golpes de energía (melee/a distancia):
 * sacude el stage y aplica retroceso+flash al objetivo cuando el golpe
 * conecta (`hit`), en el instante `impactAt` (ms desde el montaje), y llama
 * a `onDone` cuando el efecto completo termina (`totalMs`). En una falla
 * (`hit=false`) no hay shake/retroceso — solo el viaje del golpe hasta el
 * objetivo.
 */
export function useStrikeLifecycle({ stageRef, targetRef, hit = true, impactAt = 0, totalMs, onDone }) {
  useEffect(() => {
    const stage = stageRef?.current;
    const target = targetRef?.current;
    let clearShake;
    let clearTarget;

    const addImpactClasses = hit ? setTimeout(() => {
      stage?.classList.add('nx-strike-shake');
      target?.classList.add('nx-strike-target-hit');
      clearShake = setTimeout(() => stage?.classList.remove('nx-strike-shake'), 160);
      clearTarget = setTimeout(() => target?.classList.remove('nx-strike-target-hit'), 400);
    }, impactAt) : null;

    const done = setTimeout(() => onDone?.(), totalMs);

    return () => {
      clearTimeout(addImpactClasses);
      clearTimeout(clearShake);
      clearTimeout(clearTarget);
      clearTimeout(done);
      stage?.classList.remove('nx-strike-shake');
      target?.classList.remove('nx-strike-target-hit');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * Estallido de impacto compartido: flash radial + anillo expansivo +
 * partículas. Se monta siempre (para que los hooks corran consistentemente)
 * pero no renderiza nada si `hit` es falso (golpe fallado). Su temporización
 * cuelga de `--nx-strike-impact-at`, definido por cada efecto contenedor.
 */
export function ImpactBurst({ to, color, filterId, hit = true }) {
  const particles = useMemo(() => (
    Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 30 + Math.random() * 50;
      return {
        id: i,
        px: `${Math.cos(angle) * dist}px`,
        py: `${Math.sin(angle) * dist}px`,
        stagger: `${Math.round(Math.random() * 40)}ms`,
      };
    })
  ), []);

  if (!hit) return null;

  return (
    <>
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <defs>
          <radialGradient id={`${filterId}-flash`}>
            <stop offset="0%" stopColor="#fff" stopOpacity="1" />
            <stop offset="55%" stopColor="#fff" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={to.x} cy={to.y} r="46" fill={`url(#${filterId}-flash)`} className="nx-strike-flash" />
      </svg>

      <div className="nx-strike-ring" style={{ left: to.x - 20, top: to.y - 20, borderColor: color }} />

      <div style={{ position: 'absolute', left: to.x, top: to.y, width: 0, height: 0 }}>
        {particles.map((p) => (
          <span key={p.id} className="nx-strike-particle"
            style={{
              '--px': p.px, '--py': p.py, '--stagger': p.stagger,
              marginLeft: -2.5, marginTop: -2.5, background: color,
            }}
          />
        ))}
      </div>
    </>
  );
}
