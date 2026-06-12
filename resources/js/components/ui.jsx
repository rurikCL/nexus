/* NÉXUS — primitivas HUD compartidas + icon set */
import { useState, useEffect, useRef } from 'react';
import { NX } from '../data/seed.js';

/* ---- Icon set (línea fina, estilo HUD) ---- */
const ICON_PATHS = {
  command:  'M3 4h7v7H3zM14 4h7v4h-7zM14 11h7v9h-7zM3 14h7v6H3z',
  user:     'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0',
  calendar: 'M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  tasks:    'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2',
  trophy:   'M8 4h8v5a4 4 0 0 1-8 0zM6 4H4v2a3 3 0 0 0 3 3M18 4h2v2a3 3 0 0 1-3 3M10 14h4v3h-4zM8 20h8M9 17h6',
  swords:   'M14.5 3.5 21 3l-.5 6.5L9 21l-3-3zM9.5 3.5 3 3l.5 6.5L15 21l3-3M5 16l3 3M16 5l3 3',
  roster:   'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 19a6 6 0 0 1 12 0M16 6a3 3 0 0 1 0 6M18 19a6 6 0 0 0-3-5',
  coin:     'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v10M9.5 9.5a2.5 1.8 0 0 1 5 0M9.5 14.5a2.5 1.8 0 0 0 5 0',
  bell:     'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M10.5 21a2 2 0 0 0 3 0',
  plus:     'M12 5v14M5 12h14',
  x:        'M6 6l12 12M18 6 6 18',
  chevron:  'M9 6l6 6-6 6',
  chevdown: 'M6 9l6 6 6-6',
  shield:   'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z',
  ghost:    'M5 21V10a7 7 0 0 1 14 0v11l-2.5-2-2.5 2-2-2-2 2-2.5-2zM9.5 10h.01M14.5 10h.01',
  anvil:    'M5 8h10a4 4 0 0 1-4 4H9l-1 3h6l1 3H6l1-3M3 8h2v2H3zM15 6h5v3l-3 1',
  eye:      'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  flame:    'M12 3c1 3-1 4-2 6-1 1.5-2 3-2 5a6 6 0 0 0 12 0c0-2-1-3-2-4 0 1-.5 2-1.5 2 .5-3-1.5-6-4.5-9z',
  sword:    'M14.5 3.5 21 3l-.5 6.5L9 21l-3-3zM5 16l3 3M5 19l-2 2',
  crown:    'M3 7l4 4 5-7 5 7 4-4-2 12H5zM5 20h14',
  medal:    'M8 3l2 6M16 3l-2 6M12 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 13v4M10 15h4',
  check:    'M4 12l5 5L20 6',
  camera:   'M4 7h3l1.5-2h7L17 7h3v12H4zM12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  video:    'M3 7h12v10H3zM15 10l6-3v10l-6-3z',
  target:   'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  zap:      'M13 2 4 14h7l-1 8 9-12h-7z',
  clock:    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  star:     'M12 3l2.7 5.6 6.3.9-4.5 4.3 1 6.2L12 17.7 6.5 20l1-6.2L3 9.5l6.3-.9z',
  arrow:    'M5 12h14M13 6l6 6-6 6',
  upload:   'M12 16V4M8 8l4-4 4 4M4 17v3h16v-3',
  edit:     'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  link:     'M10 14a4 4 0 0 0 6 0l2-2a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-2 2a4 4 0 0 0 6 6l1-1',
  fire:     'M12 3c1 3-1 4-2 6-1 1.5-2 3-2 5a6 6 0 0 0 12 0c0-2-1-3-2-4 0 1-.5 2-1.5 2 .5-3-1.5-6-4.5-9z',
  filter:   'M3 5h18l-7 8v6l-4-2v-4z',
  dumbbell: 'M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12',
  trending: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  logout:   'M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8M17 8l4 4-4 4M9 12h12',
  menu:     'M3 6h18M3 12h18M3 18h18',
};
export function Icon({ name, size = 18, stroke = 1.8, fill = false, style, ...rest }) {
  const d = ICON_PATHS[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }} {...rest}>
      {d && d.split('M').filter(Boolean).map((seg, i) => (
        <path key={i} d={'M' + seg} fill={fill ? 'currentColor' : 'none'} />
      ))}
    </svg>
  );
}

/* ---- Panel ---- */
export function Panel({ title, kicker, icon, right, children, solid, glow, className = '', style, bodyStyle, noBody }) {
  return (
    <section className={`nx-panel${solid ? ' solid' : ''}${glow ? ' nx-panel-glow' : ''} ${className}`} style={style}>
      {(title || kicker || right) && (
        <header className="nx-panel-head">
          {icon && <span style={{ color: 'var(--holo)' }}><Icon name={icon} size={15} /></span>}
          <div style={{ flex: 1, minWidth: 0 }}>
            {kicker && <div className="nx-kicker" style={{ marginBottom: 1 }}>{kicker}</div>}
            {title && <div className="nx-display" style={{ fontSize: 13, color: 'var(--txt)' }}>{title}</div>}
          </div>
          {right}
        </header>
      )}
      {noBody ? children : <div className="nx-panel-body" style={bodyStyle}>{children}</div>}
    </section>
  );
}

/* ---- Button ---- */
export function Btn({ kind = 'ghost', icon, iconRight, children, sm, className = '', ...rest }) {
  return (
    <button className={`nx-btn nx-btn-${kind} ${sm ? 'nx-btn-sm' : ''} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={sm ? 13 : 15} />}
      {children}
      {iconRight && <Icon name={iconRight} size={sm ? 13 : 15} />}
    </button>
  );
}

/* ---- Chip ---- */
export function Chip({ tone = '', icon, children, style }) {
  return (
    <span className={`nx-chip ${tone}`} style={style}>
      {icon && <Icon name={icon} size={11} />}
      {children}
    </span>
  );
}

/* ---- Avatar monograma ---- */
export function Avatar({ c, size = 40, ring, style }) {
  if (!c) return null;
  return (
    <div className="nx-avatar" style={{
      width: size, height: size, background: `linear-gradient(135deg, ${c.color}, ${c.color}99)`,
      fontSize: size * 0.4, boxShadow: ring ? `0 0 0 2px ${c.color}66, 0 0 16px -4px ${c.color}` : 'none', ...style }}>
      {c.initials}
      {c.gold && size >= 36 && (
        <img src="/assets/isotipo.png" alt="" style={{
          position: 'absolute', bottom: -2, right: -2, width: size * 0.42, height: size * 0.42,
          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.6))' }} />
      )}
    </div>
  );
}

/* ---- Tier badge ---- */
export function TierBadge({ tier, sm }) {
  const t = NX.TIERS[tier];
  if (!t) return null;
  return (
    <span className="nx-data" style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: sm ? 9 : 10,
      letterSpacing: '0.14em', textTransform: 'uppercase', color: t.color,
      padding: sm ? '2px 6px' : '3px 8px', border: `1px solid ${t.color}55`,
      borderRadius: 'var(--radius-sm)', background: `color-mix(in srgb, ${t.color} 12%, transparent)` }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: t.color, boxShadow: `0 0 6px ${t.color}` }} />
      {t.label}
    </span>
  );
}

/* ---- Stat bar ---- */
export function Stat({ label, value, max = 100, color = 'var(--holo)' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span className="nx-data" style={{ fontSize: 11, color: 'var(--txt-dim)', width: 76, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <div className="nx-bar" style={{ flex: 1 }}>
        <i style={{ width: `${value / max * 100}%`, background: `linear-gradient(90deg, ${color}88, ${color})` }} />
      </div>
      <span className="nx-num" style={{ fontSize: 13, width: 28, textAlign: 'right', color: 'var(--txt)' }}>{value}</span>
    </div>
  );
}

/* ---- Medal ---- */
export function MedalIcon({ id, size = 34 }) {
  const m = NX.MEDALS[id]; if (!m) return null;
  const tone = { gold: 'var(--pompeyo-oro)', orange: 'var(--pompeyo-naranja)', holo: 'var(--holo)', red: '#ff6b6b' }[m.tone] || 'var(--holo)';
  return (
    <div title={m.name} style={{
      width: size, height: size, display: 'grid', placeItems: 'center', color: tone,
      borderRadius: '50%', border: `1.5px solid ${tone}`, background: `radial-gradient(circle at 35% 30%, ${tone}33, transparent 70%)`,
      boxShadow: `0 0 14px -4px ${tone}` }}>
      <Icon name={m.icon} size={size * 0.5} />
    </div>
  );
}

/* ---- Modal ---- */
export function Modal({ open, onClose, title, kicker, children, width = 540 }) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div onMouseDown={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(2,5,12,0.72)',
      backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div className="nx-panel solid nx-panel-glow nx-fade" onMouseDown={(e) => e.stopPropagation()}
        style={{ width, maxWidth: '100%', maxHeight: '90vh', overflow: 'auto' }}>
        <header className="nx-panel-head">
          <div style={{ flex: 1 }}>
            {kicker && <div className="nx-kicker" style={{ marginBottom: 2 }}>{kicker}</div>}
            <div className="nx-display" style={{ fontSize: 14 }}>{title}</div>
          </div>
          <button className="nx-btn nx-btn-ghost nx-btn-sm" onClick={onClose} style={{ padding: 5 }}><Icon name="x" size={13} /></button>
        </header>
        <div className="nx-panel-body">{children}</div>
      </div>
    </div>
  );
}

/* ---- Toast ---- */
let _toastFn = null;
export function toast(msg, opts = {}) { _toastFn && _toastFn(msg, opts); }
export function ToastHost() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    _toastFn = (msg, opts) => {
      const id = Math.random().toString(36).slice(2);
      setItems((x) => [...x, { id, msg, ...opts }]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), opts.dur || 3400);
    };
    return () => { _toastFn = null; };
  }, []);
  const toneColor = { success: 'var(--green-500)', error: '#ff6b6b', warning: 'var(--pompeyo-naranja)', info: 'var(--holo)' };
  return (
    <div style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 2000, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 340 }}>
      {items.map((i) => (
        <div key={i.id} className="nx-panel solid nx-fade" style={{ padding: '12px 14px', borderLeft: `3px solid ${toneColor[i.tone] || 'var(--holo)'}` }}>
          <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
            <span style={{ color: toneColor[i.tone] || 'var(--holo)', marginTop: 1 }}><Icon name={i.icon || 'zap'} size={15} /></span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>{i.msg}</div>
              {i.desc && <div style={{ fontSize: 12, color: 'var(--txt-dim)', marginTop: 2 }}>{i.desc}</div>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}


/* ---- ImageSlot: subida de imagen (reemplaza al web component image-slot) ---- */
export function ImageSlot({ id, className = '', style, shape = 'rounded', radius = 12, placeholder = 'Sube una imagen' }) {
  const KEY = 'nx-img-' + id;
  const [url, setUrl] = useState(() => { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } });
  const inputRef = useRef(null);
  const br = shape === 'circle' ? '50%' : shape === 'rect' ? '0' : radius + 'px';
  const onFile = (f) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { setUrl(r.result); try { localStorage.setItem(KEY, r.result); } catch (e) {} };
    r.readAsDataURL(f);
  };
  return (
    <div className={className} onClick={() => inputRef.current && inputRef.current.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}
      style={{ borderRadius: br, border: '1px dashed var(--holo-line)', background: 'rgba(4,9,18,0.5)',
        cursor: 'pointer', overflow: 'hidden', display: 'grid', placeItems: 'center', color: 'var(--txt-faint)', ...style }}>
      {url
        ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <div style={{ textAlign: 'center', padding: 8 }}>
            <Icon name="upload" size={20} />
            <div style={{ fontSize: 11, fontFamily: 'var(--font-data)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 6 }}>{placeholder}</div>
          </div>}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => onFile(e.target.files[0])} />
    </div>
  );
}
