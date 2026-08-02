import { useState, useCallback, useRef } from 'react';
import { playSound } from '../utils/sounds.js';

const SPIN_MS = 650;
const HOLD_MS = 500;
const TICK_MS = 55;

const DEFAULT_PALETTE = ['#38cdf0', '#ff6b6b'];

/* d6 → dado cúbico (cuadrado redondeado, cara con el número). Todo el combate tira 2d6 por vez. */
const randDie = () => 1 + Math.floor(Math.random() * 6);

function DieFace({ value, color, size, spinning }) {
  return (
    <div style={{
      position: 'relative', width: size, height: size,
      filter: spinning ? `drop-shadow(0 0 6px ${color}88)` : `drop-shadow(0 0 10px ${color}cc)`,
      animation: spinning ? 'nx-dice-spin 0.22s linear infinite' : 'nx-dice-land 0.32s ease-out',
    }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: size * 0.26, background: color }} />
      <div style={{
        position: 'absolute', inset: size * 0.09, borderRadius: size * 0.18, background: 'rgba(6,12,26,0.96)',
        display: 'grid', placeItems: 'center',
      }}>
        <span style={{ fontSize: size * 0.42, fontWeight: 800, color, fontFamily: 'var(--font-data)', lineHeight: 1 }}>{value}</span>
      </div>
    </div>
  );
}

/**
 * Overlay de dados animados (right side del combate). rollDice(items) hace
 * girar dos d6 por cada item y resuelve la Promise cuando aterrizan en sus
 * caras reales (`item.values = [dado1, dado2]`) — se usa para animar cada
 * tirada (ataque, defensa, iniciativa…) antes de revelar el resultado en el log.
 */
export function useDiceRoller() {
  const [state, setState] = useState(null); // { id, items: [{key,color,label,values:[d1,d2],display:[d1,d2]}], spinning }
  const rollIdRef = useRef(0);

  const rollDice = useCallback((items) => new Promise((resolve) => {
    if (!items || items.length === 0) { resolve(); return; }
    void playSound('lanzamiento_dado');
    const id = ++rollIdRef.current;
    setState({ id, spinning: true, items: items.map(it => ({ ...it, display: [randDie(), randDie()] })) });

    const interval = setInterval(() => {
      setState(prev => (prev && prev.id === id)
        ? { ...prev, items: prev.items.map(it => ({ ...it, display: [randDie(), randDie()] })) }
        : prev);
    }, TICK_MS);

    setTimeout(() => {
      clearInterval(interval);
      setState(prev => (prev && prev.id === id)
        ? { id, spinning: false, items: items.map(it => ({ ...it, display: it.values })) }
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
      {state.items.map(it => {
        const [d1, d2] = it.display ?? [1, 1];
        return (
          <div key={it.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{ display: 'flex', gap: 5 }}>
              <DieFace value={d1} color={it.color} size={28} spinning={state.spinning} />
              <DieFace value={d2} color={it.color} size={28} spinning={state.spinning} />
            </div>
            {it.label && (
              <span style={{ fontSize: 6.5, color: it.color, opacity: 0.75, fontFamily: 'var(--font-data)', letterSpacing: '0.06em' }}>
                {it.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );

  return { diceOverlay, rollDice, rolling: !!state };
}

/**
 * Ex mecanismo de "arrastra el dado para lanzar": ahora la tirada se dispara de inmediato,
 * sin gesto del jugador. Se mantiene el mismo nombre y forma de retorno para no tener que
 * tocar los 3 combates que lo consumen (Pvp/Raid/NpcCombatScreen) — todos solo esperan
 * `armThrow()` antes de calcular la tirada real; `throwHandle` siempre null (nada que
 * renderizar) y `armed` siempre false (nunca bloquea el resto de los botones de acción).
 */
export function useDragToThrow() {
  const armThrow = useCallback(() => Promise.resolve(), []);

  return { throwHandle: null, armThrow, armed: false };
}

/* Dado cúbico pequeño e inline, para incrustar una cara de d6 dentro del texto del log */
export function InlineDie({ value, color = '#38cdf0', size = 18 }) {
  const ring = Math.max(1, size * 0.1);
  return (
    <span style={{
      position: 'relative', display: 'inline-block', width: size, height: size,
      verticalAlign: 'middle', margin: '0 1px', flexShrink: 0,
    }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: size * 0.26, background: `${color}cc` }} />
      <span style={{
        position: 'absolute', inset: ring, borderRadius: size * 0.18, background: 'rgba(6,12,26,0.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.52, fontWeight: 800, color, fontFamily: 'var(--font-data)', lineHeight: 1,
      }}>{value}</span>
    </span>
  );
}

/* Reemplaza las ocurrencias "2d6(d1+d2)+X=Y" de un texto de log por dos dados cúbicos inline
   mostrando cada cara. `colors` asigna el color de cada tirada en el orden en que aparecen
   (por convención: [propio, rival]), reciclándose si hay más ocurrencias que colores. */
export function renderDiceText(text, colors = DEFAULT_PALETTE) {
  if (typeof text !== 'string') return text;
  const rx = /2d6\((\d+)\+(\d+)\)\+(-?\d+)=(-?\d+)/g;
  const parts = [];
  let lastIndex = 0, m, i = 0;
  while ((m = rx.exec(text))) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
    const dado1 = Number(m[1]);
    const dado2 = Number(m[2]);
    const color = colors[i % colors.length];
    parts.push(<InlineDie key={`d1-${i}`} value={dado1} color={color} />);
    parts.push(<InlineDie key={`d2-${i}`} value={dado2} color={color} />);
    parts.push(`+${m[3]}=`);
    parts.push(
      <strong key={`t-${i}`} style={{
        color, fontWeight: 800, fontSize: '1.08em',
        textShadow: `0 0 7px ${color}99`,
      }}>{m[4]}</strong>
    );
    lastIndex = m.index + m[0].length;
    i++;
  }
  if (lastIndex === 0) return text;
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}
