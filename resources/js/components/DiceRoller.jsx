import { useState, useCallback, useRef } from 'react';
import { playSound } from '../utils/sounds.js';

const SPIN_MS = 650;
const HOLD_MS = 500;
const TICK_MS = 55;
const THROW_THRESHOLD = 56; // px de arrastre mínimo para considerar el dado "lanzado"

/* d20 → dado hexagonal (icosaedro estilizado en 2D) */
const HEX_CLIP = 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';
const DEFAULT_PALETTE = ['#38cdf0', '#ff6b6b'];

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
    void playSound('lanzamiento_dado');
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
          position: 'relative', width: 50, height: 50,
          filter: state.spinning ? `drop-shadow(0 0 6px ${it.color}88)` : `drop-shadow(0 0 10px ${it.color}cc)`,
          animation: state.spinning ? 'nx-dice-spin 0.22s linear infinite' : 'nx-dice-land 0.32s ease-out',
        }}>
          {/* Anillo hexagonal (hace de "borde") */}
          <div style={{ position: 'absolute', inset: 0, clipPath: HEX_CLIP, background: it.color }} />
          {/* Relleno hexagonal, calado hacia adentro para dejar ver el anillo */}
          <div style={{
            position: 'absolute', inset: 2.5, clipPath: HEX_CLIP, background: 'rgba(6,12,26,0.96)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: it.color, fontFamily: 'var(--font-data)', lineHeight: 1 }}>{it.display}</span>
            {it.label && (
              <span style={{ fontSize: 6.5, color: it.color, opacity: 0.75, fontFamily: 'var(--font-data)', marginTop: 3, letterSpacing: '0.06em' }}>
                {it.label}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  return { diceOverlay, rollDice, rolling: !!state };
}

/**
 * Dado arrastrable (área del jugador). `armThrow(anchorEl)` planta el dado
 * junto al elemento ancla y devuelve una Promise que solo se resuelve cuando
 * el jugador lo arrastra al menos THROW_THRESHOLD px y lo suelta — recién ahí
 * el llamador debe calcular el d20() real y reproducir `rollDice(...)` como
 * de costumbre. Mientras está armado, `armed` permite bloquear el resto de
 * los botones de acción (no se puede cancelar, solo lanzar).
 */
export function useDragToThrow() {
  const [pending, setPending] = useState(null); // { x, y, dx, dy, dragging }
  const resolveRef = useRef(null);
  const startRef = useRef({ x: 0, y: 0 });

  const armThrow = useCallback((anchorEl) => new Promise((resolve) => {
    const rect = anchorEl?.getBoundingClientRect?.();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    resolveRef.current = resolve;
    setPending({ x, y, dx: 0, dy: 0, dragging: false });
  }), []);

  const onPointerDown = useCallback((e) => {
    e.preventDefault();
    startRef.current = { x: e.clientX, y: e.clientY };
    setPending(p => p && { ...p, dragging: true });

    const onMove = (ev) => {
      const dx = ev.clientX - startRef.current.x;
      const dy = ev.clientY - startRef.current.y;
      setPending(p => p && { ...p, dx, dy });
    };
    const onUp = (ev) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const dx = ev.clientX - startRef.current.x;
      const dy = ev.clientY - startRef.current.y;
      if (Math.hypot(dx, dy) >= THROW_THRESHOLD) {
        setPending(null);
        const resolve = resolveRef.current;
        resolveRef.current = null;
        resolve?.();
      } else {
        setPending(p => p && { ...p, dragging: false, dx: 0, dy: 0 });
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, []);

  const throwHandle = pending && (
    <div
      onPointerDown={onPointerDown}
      style={{
        position: 'fixed', left: pending.x, top: pending.y, zIndex: 60,
        transform: `translate(-50%, -50%) translate(${pending.dx}px, ${pending.dy}px)`,
        transition: pending.dragging ? 'none' : 'transform 0.28s cubic-bezier(.2,.8,.3,1.4)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        cursor: pending.dragging ? 'grabbing' : 'grab', touchAction: 'none', userSelect: 'none',
      }}
    >
      <div style={{
        position: 'relative', width: 54, height: 54,
        filter: `drop-shadow(0 0 10px #38cdf0cc)`,
        animation: pending.dragging ? 'none' : 'nx-dice-pulse 1.1s ease-in-out infinite',
      }}>
        <div style={{ position: 'absolute', inset: 0, clipPath: HEX_CLIP, background: '#38cdf0' }} />
        <div style={{
          position: 'absolute', inset: 2.5, clipPath: HEX_CLIP, background: 'rgba(6,12,26,0.96)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 19, fontWeight: 800, color: '#38cdf0', fontFamily: 'var(--font-data)' }}>D20</span>
        </div>
      </div>
      {!pending.dragging && (
        <span style={{
          fontSize: 8.5, color: '#38cdf0', fontFamily: 'var(--font-data)', letterSpacing: '0.1em',
          textShadow: '0 0 6px #38cdf0cc', whiteSpace: 'nowrap',
        }}>ARRASTRA PARA LANZAR</span>
      )}
    </div>
  );

  return { throwHandle, armThrow, armed: !!pending };
}

/* Dado hexagonal pequeño e inline, para incrustar el resultado de una tirada dentro del texto del log */
export function InlineDie({ value, color = '#38cdf0', size = 18 }) {
  const ring = Math.max(1, size * 0.09);
  return (
    <span style={{
      position: 'relative', display: 'inline-block', width: size, height: size,
      verticalAlign: 'middle', margin: '0 2px', flexShrink: 0,
    }}>
      {/* Anillo hexagonal (hace de "borde") */}
      <span style={{ position: 'absolute', inset: 0, clipPath: HEX_CLIP, background: `${color}cc` }} />
      {/* Relleno hexagonal, calado hacia adentro para dejar ver el anillo */}
      <span style={{
        position: 'absolute', inset: ring, clipPath: HEX_CLIP, background: 'rgba(6,12,26,0.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.58, fontWeight: 800, color, fontFamily: 'var(--font-data)', lineHeight: 1,
      }}>{value}</span>
    </span>
  );
}

/* Reemplaza las ocurrencias "1d20+X=Y" / "1d20(D)+X=Y" de un texto de log por un dado hexagonal
   inline mostrando la cara (D). `colors` asigna el color de cada dado en el orden en que aparecen
   (por convención: [propio, rival]), reciclándose si hay más ocurrencias que colores. */
export function renderDiceText(text, colors = DEFAULT_PALETTE) {
  if (typeof text !== 'string') return text;
  const rx = /1d20(?:\((\d+)\))?\+(-?\d+)=(-?\d+)/g;
  const parts = [];
  let lastIndex = 0, m, i = 0;
  while ((m = rx.exec(text))) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
    const dado  = m[1] !== undefined ? Number(m[1]) : Number(m[3]) - Number(m[2]);
    const color = colors[i % colors.length];
    parts.push(<InlineDie key={`d-${i}`} value={dado} color={color} />);
    parts.push(`+${m[2]}=`);
    parts.push(
      <strong key={`t-${i}`} style={{
        color, fontWeight: 800, fontSize: '1.08em',
        textShadow: `0 0 7px ${color}99`,
      }}>{m[3]}</strong>
    );
    lastIndex = m.index + m[0].length;
    i++;
  }
  if (lastIndex === 0) return text;
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}
