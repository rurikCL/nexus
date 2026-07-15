import { useEffect } from 'react';

/** Duración total en ms — debe calzar con floating-combat-text.css. */
export const FLOAT_TEXT_MS = 2000;

/**
 * Texto flotante con el resultado de un golpe (impacto/crítico/bloqueo/esquiva),
 * mostrado centrado en la pantalla justo después del golpe de energía. Salta al
 * aparecer y se desvanece flotando hacia arriba; se desmonta solo tras
 * FLOAT_TEXT_MS (el padre decide cuándo limpiar su estado vía `onDone`).
 */
export default function FloatingCombatText({ text, variant = 'hit', onDone }) {
  useEffect(() => {
    const t = setTimeout(() => onDone?.(), FLOAT_TEXT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`nx-float-text nx-float-text-${variant}`}>
      {text}
    </div>
  );
}
