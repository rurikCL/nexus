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

/** Clases a aplicar al objetivo según el desenlace, y cuánto duran (debe calzar con energy-strike.css). */
const OUTCOME_TARGET_CLASSES = {
  hit:   { classes: ['nx-combat-hit-shake', 'nx-combat-hit-overlay'], ms: 360 },
  block: { classes: ['nx-combat-block-grow'],                          ms: 320 },
  dodge: { classes: ['nx-combat-dodge'],                               ms: 400 },
};
const ATTACKER_JUMP_MS = 280;

/**
 * Ciclo de vida compartido por los golpes de energía (melee/a distancia):
 * - Anima al atacante con un pequeño salto apenas se monta el efecto.
 * - En el instante `impactAt` (ms desde el montaje), reacciona según el
 *   desenlace (`outcome`): "hit" sacude el stage + overlay rojo y shake en
 *   el objetivo; "block" un crecimiento breve; "dodge" una salida y
 *   reentrada. Llama a `onDone` cuando el efecto completo termina (`totalMs`).
 */
export function useStrikeLifecycle({ stageRef, attackerRef, targetRef, outcome = 'hit', impactAt = 0, totalMs, onDone }) {
  useEffect(() => {
    const stage = stageRef?.current;
    const attacker = attackerRef?.current;
    const target = targetRef?.current;
    let clearShake;
    let clearTarget;

    attacker?.classList.add('nx-combat-atk-jump');
    const clearAttacker = setTimeout(() => attacker?.classList.remove('nx-combat-atk-jump'), ATTACKER_JUMP_MS);

    const { classes: targetClasses, ms: targetMs } = OUTCOME_TARGET_CLASSES[outcome] ?? OUTCOME_TARGET_CLASSES.hit;
    const addImpactClasses = setTimeout(() => {
      if (outcome === 'hit') stage?.classList.add('nx-strike-shake');
      target?.classList.add(...targetClasses);
      if (outcome === 'hit') clearShake = setTimeout(() => stage?.classList.remove('nx-strike-shake'), 160);
      clearTarget = setTimeout(() => target?.classList.remove(...targetClasses), targetMs);
    }, impactAt);

    const done = setTimeout(() => onDone?.(), totalMs);

    return () => {
      clearTimeout(clearAttacker);
      clearTimeout(addImpactClasses);
      clearTimeout(clearShake);
      clearTimeout(clearTarget);
      clearTimeout(done);
      attacker?.classList.remove('nx-combat-atk-jump');
      stage?.classList.remove('nx-strike-shake');
      target?.classList.remove(...targetClasses);
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
