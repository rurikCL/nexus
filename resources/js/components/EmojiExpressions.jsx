import { useEffect, useState } from 'react';
import { getRelativeCenter } from './combatFx.jsx';

/* `desc` debe calzar en significado con PvpCombatController::EMOTES (el backend define su
   propia copia autoritativa para el registro de combate PvP; esta es la usada en combate
   contra NPC, donde el log es puramente local). */
export const EMOTES = [
  { id: 'saludar',    emoji: '👋',  label: 'Saludar',      desc: 'saluda a su rival' },
  { id: 'reir',       emoji: '😂',  label: 'Reír',         desc: 'se ríe de su rival' },
  { id: 'llorar',     emoji: '😢',  label: 'Llorar',       desc: 'llora' },
  { id: 'impresion',  emoji: '😲',  label: 'Impresión',    desc: 'se muestra impresionado' },
  { id: 'enojo',      emoji: '😠',  label: 'Enojarse',     desc: 'se enoja' },
  { id: 'dormir',     emoji: '😴',  label: 'Dormir',       desc: 'finge dormirse de aburrimiento' },
  { id: 'adios',      emoji: '🖐️', label: 'Decir adiós',  desc: 'se despide' },
];

/** Duración total del emoji central — debe calzar con emoji-expressions.css. */
export const EMOJI_BURST_MS = 1600;

const RING_RADIUS = 78;
const RING_PAD = 28;

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/**
 * Anillo de emoticones que se despliega alrededor del avatar del personaje
 * al presionarlo, para elegir una expresión. Se cierra al elegir un
 * emoticon o al hacer clic fuera del anillo.
 */
export function EmojiRing({ anchorRef, stageRef, onSelect, onClose }) {
  const [items, setItems] = useState(null);

  useEffect(() => {
    const stage = stageRef?.current;
    const anchor = anchorRef?.current;
    if (!stage || !anchor) return;
    const center = getRelativeCenter(anchor, stage);
    const stageRect = stage.getBoundingClientRect();
    const n = EMOTES.length;
    setItems(EMOTES.map((e, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      return {
        ...e,
        x: clamp(center.x + Math.cos(angle) * RING_RADIUS, RING_PAD, stageRect.width - RING_PAD),
        y: clamp(center.y + Math.sin(angle) * RING_RADIUS, RING_PAD, stageRect.height - RING_PAD),
        delay: i * 25,
      };
    }));
  }, [anchorRef, stageRef]);

  if (!items) return null;

  return (
    <div className="nx-emoji-ring-layer" onClick={onClose}>
      {items.map(it => (
        <button key={it.id} type="button" title={it.label} className="nx-emoji-ring-btn"
          style={{ left: it.x, top: it.y, animationDelay: `${it.delay}ms` }}
          onClick={(e) => { e.stopPropagation(); onSelect(it); }}
        >
          {it.emoji}
        </button>
      ))}
    </div>
  );
}

/**
 * Emoticon grande centrado en el escenario de combate, que aparece con un
 * pequeño rebote y se desvanece solo tras EMOJI_BURST_MS.
 */
export function EmojiBurst({ emoji, onDone }) {
  useEffect(() => {
    const t = setTimeout(() => onDone?.(), EMOJI_BURST_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="nx-emoji-burst-layer">
      <span className="nx-emoji-burst">{emoji}</span>
    </div>
  );
}
