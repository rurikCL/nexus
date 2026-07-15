import { useEffect, useMemo } from 'react';
import { getRelativeCenter } from './combatFx.jsx';

/** Duraciones totales — deben calzar con flee-effect.css. */
export const FLEE_SUCCESS_MS = 650;
export const FLEE_FAIL_MS = 520;

/**
 * Animación de huida (distinta de la de ataque): se dispara sobre la
 * tarjeta HUD de quien intenta huir (`actorRef`), nunca sobre el rival.
 *
 * - `outcome: "success"` — la tarjeta se lanza hacia su lado de salida
 *   (según `dir`) dejando un destello cian tipo "warp" y se desvanece.
 * - `outcome: "fail"` — arranca, rebota contra algo invisible y vuelve a
 *   su sitio con sacudida + destello ámbar, como quien choca con una
 *   barrera.
 * - `dir`: 1 o -1, hacia qué lado se lanza la huida (el propio jugador
 *   huye hacia su borde de pantalla; el rival hacia el suyo).
 *
 * No renderiza el remate de partículas dentro de la tarjeta (para no
 * quedar recortado por su `overflow: hidden`) — lo dibuja como overlay
 * sobre el stage, centrado en la posición de la tarjeta.
 */
export default function FleeEffect({ outcome = 'success', dir = 1, stageRef, actorRef, onDone }) {
  const at = useMemo(
    () => getRelativeCenter(actorRef?.current, stageRef?.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const color = outcome === 'success' ? '#38cdf0' : '#E6B325';

  useEffect(() => {
    const actor = actorRef?.current;
    actor?.style.setProperty('--nx-flee-dir', dir);
    const cls = outcome === 'success' ? ['nx-flee-success'] : ['nx-flee-fail', 'nx-flee-fail-overlay'];
    actor?.classList.add(...cls);

    const ms = outcome === 'success' ? FLEE_SUCCESS_MS : FLEE_FAIL_MS;
    const done = setTimeout(() => onDone?.(), ms);

    return () => {
      clearTimeout(done);
      actor?.classList.remove(...cls);
      actor?.style.removeProperty('--nx-flee-dir');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}>
      <div className="nx-flee-burst" style={{ left: at.x, top: at.y, borderColor: color, background: `${color}33` }} />
    </div>
  );
}
