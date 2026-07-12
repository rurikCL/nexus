import { useState, useCallback, useRef } from 'react';

const SPIN_MS = 650;
const HOLD_MS = 500;
const TICK_MS = 55;

const randDie = () => 1 + Math.floor(Math.random() * 20);

/**
 * Overlay de dados animados (right side del combate). rollDice(items) hace
 * girar cada dado aleatoriamente y resuelve la Promise cuando aterriza en
 * su valor real — se usa para animar cada tirada (ataque, defensa, iniciativa…)
 * antes de revelar el resultado en el log.
 */
export function useDiceRoller() {
  const [state, setState] = useState(null); // { id, items: [{key,color,label,value,display}], spinning }
  const rollIdRef = useRef(0);

  const rollDice = useCallback((items) => new Promise((resolve) => {
    if (!items || items.length === 0) { resolve(); return; }
    const id = ++rollIdRef.current;
    setState({ id, spinning: true, items: items.map(it => ({ ...it, display: randDie() })) });

    const interval = setInterval(() => {
      setState(prev => (prev && prev.id === id)
        ? { ...prev, items: prev.items.map(it => ({ ...it, display: randDie() })) }
        : prev);
    }, TICK_MS);

    setTimeout(() => {
      clearInterval(interval);
      setState(prev => (prev && prev.id === id)
        ? { id, spinning: false, items: items.map(it => ({ ...it, display: it.value })) }
        : prev);
      setTimeout(() => {
        setState(prev => (prev && prev.id === id && !prev.spinning) ? null : prev);
      }, HOLD_MS);
      resolve();
    }, SPIN_MS);
  }), []);

  const diceOverlay = state && (
    <div style={{
      position: 'absolute', top: '50%', right: 14, transform: 'translateY(-50%)', zIndex: 16,
      display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', pointerEvents: 'none',
    }}>
      {state.items.map(it => (
        <div key={it.key} style={{
          width: 48, height: 48, borderRadius: 10,
          background: 'rgba(6,12,26,0.94)', border: `2px solid ${it.color}`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          boxShadow: state.spinning ? `0 0 10px ${it.color}55` : `0 0 18px ${it.color}bb`,
          animation: state.spinning ? 'nx-dice-spin 0.22s linear infinite' : 'nx-dice-land 0.32s ease-out',
        }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: it.color, fontFamily: 'var(--font-data)', lineHeight: 1 }}>{it.display}</span>
          {it.label && (
            <span style={{ fontSize: 6.5, color: it.color, opacity: 0.75, fontFamily: 'var(--font-data)', marginTop: 3, letterSpacing: '0.06em' }}>
              {it.label}
            </span>
          )}
        </div>
      ))}
    </div>
  );

  return { diceOverlay, rollDice, rolling: !!state };
}
