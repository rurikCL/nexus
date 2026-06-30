import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Icon, Panel, Btn, Chip, Modal, toast } from '../components/ui.jsx';
import PvpCombatScreen from '../components/PvpCombatScreen.jsx';

/* ─── helpers ─────────────────────────────────────────── */
const AUTH = () => {
  const t = localStorage.getItem('nx-token');
  return { Accept: 'application/json', Authorization: `Bearer ${t}` };
};
const apiFetch = (path) =>
  fetch(`/api${path}`, { headers: AUTH() }).then((r) => {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  });

const apiPost = (path, data) =>
  fetch(`/api${path}`, {
    method: 'POST',
    headers: { ...AUTH(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then((r) => {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  });

const mediaUrl = (path) => {
  if (!path) return null;
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:') || path.startsWith('blob:')) return path;

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (cleanPath.startsWith('/storage/')) return cleanPath;
  if (cleanPath.startsWith('/admin/')) return `/storage${cleanPath}`;
  if (cleanPath.startsWith('/public/')) return cleanPath.replace('/public/', '/storage/');

  return `/storage${cleanPath}`;
};

const HOSTILIDAD_COLOR = {
  seguro:   { bg: 'rgba(16,185,129,0.18)',  border: '#10b981', text: '#10b981',  label: 'Seguro'   },
  bajo:     { bg: 'rgba(56,205,240,0.15)',   border: '#38cdf0', text: '#38cdf0',  label: 'Bajo'     },
  medio:    { bg: 'rgba(230,179,37,0.18)',   border: '#E6B325', text: '#E6B325',  label: 'Medio'    },
  alto:     { bg: 'rgba(255,107,0,0.18)',    border: '#FF6B00', text: '#FF6B00',  label: 'Alto'     },
  extremo:  { bg: 'rgba(220,38,38,0.22)',    border: '#ff2d45', text: '#ff6b6b',  label: 'Extremo'  },
  default:  { bg: 'rgba(139,92,246,0.18)',   border: '#8b5cf6', text: '#8b5cf6',  label: '??'       },
};
const hostilidadStyle = (h) => HOSTILIDAD_COLOR[h?.toLowerCase()] ?? HOSTILIDAD_COLOR.default;

const RAREZA_COLOR = {
  comun:      '#8aa0c0',
  poco_comun: '#38cdf0',
  raro:       '#10b981',
  epico:      '#8b5cf6',
  legendario: '#E6B325',
};
const rarezaColor = (r) => RAREZA_COLOR[r?.toLowerCase()?.replace(' ', '_')] ?? '#8aa0c0';

/* ─── hash reproducible (sin Math.random) ───────────────── */
function hashf(n) {
  let s = (Math.imul(n + 1, 2654435761)) >>> 0;
  s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0;
  s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0;
  return (s >>> 0) / 0xffffffff;
}
function makeRng(seed) {
  let s = (Math.imul(seed + 1, 1664525) + 1013904223) >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return (s >>> 0) / 0x100000000; };
}

/* Distribuye en cuadrícula con jitter — posiciones reproducibles */
function buildPositions(sistemas) {
  const n = sistemas.length;
  if (!n) return [];
  const cols = Math.max(2, Math.ceil(Math.sqrt(n * 1.6)));
  const rows = Math.ceil(n / cols);

  /* celdas disponibles */
  const cells = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols && cells.length < n; c++)
      cells.push([c, r]);

  /* barajado determinístico */
  const rng = makeRng(sistemas.reduce((a, s) => a + s.id, 0));
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  return sistemas.map((s, i) => {
    const [c, r] = cells[i] ?? [i % cols, Math.floor(i / cols)];
    const jx = (hashf(s.id * 3 + 7)  - 0.5) * 0.6;
    const jy = (hashf(s.id * 11 + 3) - 0.5) * 0.6;
    const left = 8 + ((c + 0.5 + jx) / cols) * 84;
    const top  = 20 + ((r + 0.5 + jy) / rows) * 62;
    return {
      left: `${Math.max(7, Math.min(93, left))}%`,
      top:  `${Math.max(18, Math.min(90, top))}%`,
    };
  });
}

/* ─── PRESENTES ─────────────────────────────────────────── */
const SABER_COLORS = {
  azul: '#3aa0ff', verde: '#34d36a', ambar: '#ffb01f',
  purpura: '#b15cff', cian: '#26e3e3', blanco: '#eaf2ff', rojo: '#ff2d45',
};

function PresentesAvatars({ presentes = [], max = 3 }) {
  if (!presentes.length) return null;
  const visible = presentes.slice(0, max);
  const more = presentes.length - max;
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {visible.map((p, i) => {
        const color = SABER_COLORS[p.saber_color] ?? '#38cdf0';
        const photoUrl = mediaUrl(p.photo);
        return (
          <div key={p.id} title={`@${p.handle}`}
            style={{
              width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
              backgroundImage: photoUrl ? `url(${photoUrl})` : undefined,
              backgroundSize: 'cover', backgroundPosition: 'center',
              background: photoUrl ? undefined : color,
              border: '1.5px solid rgba(4,7,15,0.85)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 7, fontWeight: 800, color: '#fff',
              marginLeft: i > 0 ? -5 : 0,
              boxShadow: `0 0 5px ${color}55`,
              textTransform: 'uppercase', letterSpacing: 0,
            }}>
            {!photoUrl && (p.handle?.[0] ?? '?')}
          </div>
        );
      })}
      {more > 0 && (
        <span style={{ fontSize: 9, color: 'var(--txt-faint)', marginLeft: 5, fontFamily: 'var(--font-data)' }}>
          +{more}
        </span>
      )}
    </div>
  );
}

/* ─── COMPONENTE STARFIELD REUTILIZABLE ────────────────── */
function Starfield() {
  const { nebulaeCSS, bgCSS, midCSS, brightCSS, featuredStars } = useMemo(() => {
    /* 6 nebulosas radiales — azul / púrpura / naranja */
    const nebulaeCSS = [
      'radial-gradient(ellipse 64% 50% at 12% 25%, rgba(0,47,186,0.055) 0%, rgba(0,47,186,0.018) 55%, transparent 100%)',
      'radial-gradient(ellipse 60% 46% at 80% 60%, rgba(80,0,180,0.040) 0%, rgba(80,0,180,0.013) 55%, transparent 100%)',
      'radial-gradient(ellipse 76% 58% at 50% 15%, rgba(0,30,100,0.060) 0%, rgba(0,30,100,0.020) 55%, transparent 100%)',
      'radial-gradient(ellipse 44% 38% at 90% 18%, rgba(160,40,0,0.028) 0%, rgba(160,40,0,0.009) 55%, transparent 100%)',
      'radial-gradient(ellipse 56% 44% at 18% 82%, rgba(0,60,160,0.035) 0%, rgba(0,60,160,0.011) 55%, transparent 100%)',
      'radial-gradient(ellipse 50% 40% at 60% 80%, rgba(60,0,140,0.030) 0%, rgba(60,0,140,0.010) 55%, transparent 100%)',
    ].join(', ');

    /* helper: radial-gradient para una estrella puntual */
    const dot = (x, y, r, rgb, a, bloom = 0) => bloom > 0
      ? `radial-gradient(circle at ${x}% ${y}%, rgba(${rgb},${a}) 0px, rgba(${rgb},${a}) ${r}px, rgba(${rgb},0.10) ${bloom}px, transparent calc(${bloom}px + 1px))`
      : `radial-gradient(circle at ${x}% ${y}%, rgba(${rgb},${a}) 0px, rgba(${rgb},${a}) ${r}px, transparent calc(${r}px + 0.5px))`;

    /* capa 0 — 500 estrellas de fondo, tiny */
    const bgCSS = Array.from({ length: 500 }, (_, i) => {
      const x = (hashf(i * 7   + 1)  * 100).toFixed(2);
      const y = (hashf(i * 13  + 3)  * 100).toFixed(2);
      const r = (hashf(i * 3   + 5)  * 0.50 + 0.15).toFixed(2);
      const a = (hashf(i * 17  + 7)  * 0.27 + 0.08).toFixed(2);
      return dot(x, y, r, '219,230,245', a);
    }).join(', ');

    /* capa 1 — 140 estrellas medias */
    const midCSS = Array.from({ length: 140 }, (_, i) => {
      const x = (hashf(i * 11  + 101) * 100).toFixed(2);
      const y = (hashf(i * 19  + 103) * 100).toFixed(2);
      const r = (hashf(i * 7   + 107) * 0.70 + 0.70).toFixed(2);
      const a = (hashf(i * 29  + 109) * 0.30 + 0.30).toFixed(2);
      return dot(x, y, r, '219,230,245', a);
    }).join(', ');

    /* capa 2 — 55 estrellas brillantes con tinte de color y bloom */
    const BRIGHT_TINTS = ['219,230,245', '180,210,255', '255,220,160', '200,170,255'];
    const brightCSS = Array.from({ length: 55 }, (_, i) => {
      const x    = (hashf(i * 13  + 201) * 100).toFixed(2);
      const y    = (hashf(i * 23  + 203) * 100).toFixed(2);
      const r    = (hashf(i * 9   + 207) * 1.40 + 1.40).toFixed(2);
      const a    = (hashf(i * 37  + 209) * 0.30 + 0.55).toFixed(2);
      const rgb  = BRIGHT_TINTS[Math.floor(hashf(i * 41 + 211) * BRIGHT_TINTS.length)];
      const bloom = (parseFloat(r) * 2.8).toFixed(1);
      return dot(x, y, r, rgb, a, bloom);
    }).join(', ');

    /* capa 3 — 14 estrellas destacadas (DOM real → diffraction en CSS) */
    const FEAT_TINTS = [
      { rgb: '255,255,255', hex: '#ffffff' },
      { rgb: '230,240,255', hex: '#e6f0ff' },
      { rgb: '255,235,195', hex: '#ffebc3' },
    ];
    const featuredStars = Array.from({ length: 14 }, (_, i) => {
      const x    = (hashf(i * 17  + 301) * 86 + 7).toFixed(2);
      const y    = (hashf(i * 29  + 303) * 72 + 18).toFixed(2);
      const r    = (hashf(i * 11  + 307) * 1.80 + 2.20).toFixed(1);
      const tint = FEAT_TINTS[Math.floor(hashf(i * 47 + 311) * FEAT_TINTS.length)];
      const dur  = (hashf(i * 53  + 313) * 3.0 + 3.5).toFixed(1);
      const del  = (hashf(i * 59  + 317) * 4.0).toFixed(1);
      const glow = (parseFloat(r) * 3.5).toFixed(0);
      return { x, y, r, tint, dur, del, glow };
    });

    return { nebulaeCSS, bgCSS, midCSS, brightCSS, featuredStars };
  }, []);

  return (
    <>
      <div className="nx-nebulae"      style={{ backgroundImage: nebulaeCSS }} />
      <div className="nx-stars-bg"     style={{ backgroundImage: bgCSS }} />
      <div className="nx-stars-mid"    style={{ backgroundImage: midCSS,    animationDelay: '-3s' }} />
      <div className="nx-stars-bright" style={{ backgroundImage: brightCSS, animationDelay: '-1.5s' }} />
      {featuredStars.map((s, i) => (
        <div key={i} className="nx-star-featured" style={{
          left: `${s.x}%`, top: `${s.y}%`,
          width: `${s.r * 2}px`, height: `${s.r * 2}px`,
          background: `radial-gradient(circle at 40% 35%, #fff, rgba(${s.tint.rgb},0.85) 40%, rgba(${s.tint.rgb},0.2) 75%, transparent)`,
          boxShadow: `0 0 ${s.glow}px ${Math.ceil(s.glow / 3)}px rgba(${s.tint.rgb},0.2)`,
          color: s.tint.hex,
          '--dur': `${s.dur}s`,
          '--delay': `-${s.del}s`,
        }} />
      ))}
    </>
  );
}

/* ─── VISTA GALAXIA ────────────────────────────────────── */
function GalaxiaView({ onSelectSistema }) {
  const [sistemas, setSistemas]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [traveling, setTraveling]   = useState(null);
  const [hovered, setHovered]       = useState(null);

  useEffect(() => {
    apiFetch('/map/sistemas')
      .then((d) => setSistemas(d.sistemas ?? []))
      .catch(() => toast('Error cargando sistemas', { tone: 'error', icon: 'x' }))
      .finally(() => setLoading(false));
  }, []);

  /* ── Starfield CSS — posiciones determinísticas via hashf ── */
  const handleTravel = (sistema) => {
    setTraveling(sistema.id);
    setTimeout(() => { setTraveling(null); onSelectSistema(sistema); }, 1800);
  };

  if (loading) return <LoadingHUD text="ESCANEANDO GALAXIA..." />;

  const positions = buildPositions(sistemas);

  return (
    <div style={{ position: 'relative', minHeight: '82vh', overflow: 'hidden', borderRadius: 12,
      background: 'radial-gradient(ellipse at 70% -5%, rgba(0,47,186,0.18) 0%, transparent 55%), linear-gradient(180deg,#07101f,#04070f)' }}>

      {/* ── starfield CSS — 4 capas + 6 nebulosas + diffraction ── */}
      <div className="nx-starfield">
        <Starfield />
      </div>

      {/* ── viñeta ── */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 12,
        background: 'radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(2,5,12,0.65) 100%)',
        zIndex: 1,
      }} />

      {/* ── título ── */}
      <div className="nx-fade" style={{ textAlign: 'center', padding: '28px 0 20px', position: 'relative', zIndex: 4 }}>
        <div className="nx-kicker" style={{ marginBottom: 5 }}>NAVEGACIÓN GALÁCTICA</div>
        <div className="nx-display" style={{ fontSize: 26, color: 'var(--txt)', letterSpacing: '0.06em' }}>
          MAPA ESTELAR
        </div>
        <div style={{ fontSize: 12, color: 'var(--txt-faint)', marginTop: 5, fontFamily: 'var(--font-data)', letterSpacing: '0.1em' }}>
          {sistemas.length} SISTEMA{sistemas.length !== 1 ? 'S' : ''} DETECTADO{sistemas.length !== 1 ? 'S' : ''} · SELECCIONA UN OBJETIVO
        </div>
      </div>

      {/* ── nodos de sistemas (posición random) ── */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 3 }}>
        {sistemas.map((s, i) => {
          const pos      = positions[i];
          const h        = hostilidadStyle(s.hostilidad);
          const c        = s.color || h.border;
          const isTravel = traveling === s.id;
          const isHover  = hovered  === s.id;

          return (
            <button
              key={s.id}
              onMouseEnter={() => setHovered(s.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => !traveling && handleTravel(s)}
              style={{
                position: 'absolute',
                left: pos.left, top: pos.top,
                transform: 'translate(-50%, -50%)',
                background: 'transparent', border: 'none',
                cursor: traveling ? 'wait' : 'pointer',
                zIndex: isHover ? 10 : 3,
                padding: 0,
              }}
            >
              {/* anillo de escaneo al hover */}
              {isHover && !isTravel && (
                <div style={{
                  position: 'absolute', inset: -14,
                  borderRadius: '50%',
                  border: `1px solid ${c}66`,
                  animation: 'nx-pulse 1.2s ease-in-out infinite',
                  pointerEvents: 'none',
                }} />
              )}

              {/* orbe estrella */}
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: `radial-gradient(circle at 38% 32%, ${c}dd, ${c}55 55%, ${c}18)`,
                border: `1.5px solid ${c}${isTravel ? 'ff' : isHover ? 'cc' : '77'}`,
                boxShadow: isTravel
                  ? `0 0 28px 10px ${c}, 0 0 70px 30px ${c}44`
                  : isHover
                    ? `0 0 22px 6px ${c}88`
                    : `0 0 12px 2px ${c}44`,
                display: 'grid', placeItems: 'center',
                animation: isTravel ? 'nx-pulse 0.4s infinite' : 'none',
                transition: 'box-shadow 0.25s, border-color 0.25s',
                position: 'relative',
              }}>
                {/* brillo interno */}
                <div style={{
                  position: 'absolute', width: 14, height: 14, borderRadius: '50%',
                  background: `radial-gradient(circle, white 0%, ${c} 50%, transparent 100%)`,
                  opacity: 0.65, top: 8, left: 10,
                }} />
                <Icon name="star" size={18} style={{ color: c, opacity: 0.85, position: 'relative', zIndex: 1 }} />
              </div>

              {/* etiqueta nombre */}
              <div style={{
                position: 'absolute', top: '115%', left: '50%',
                transform: 'translateX(-50%)',
                pointerEvents: 'none', textAlign: 'center',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              }}>
                <span style={{
                  fontFamily: 'var(--font-data)', fontSize: 10, fontWeight: 700,
                  color: isHover ? c : 'var(--txt)',
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  textShadow: isHover ? `0 0 12px ${c}` : '0 1px 4px rgba(0,0,0,0.9)',
                  whiteSpace: 'nowrap', transition: 'color 0.2s',
                }}>
                  {s.nombre}
                </span>
                {s.faccion && (
                  <span style={{
                    fontSize: 8, fontFamily: 'var(--font-data)', letterSpacing: '0.12em',
                    textTransform: 'uppercase', color: h.text, opacity: 0.7,
                    textShadow: '0 1px 4px rgba(0,0,0,0.9)', whiteSpace: 'nowrap',
                  }}>
                    {s.faccion}
                  </span>
                )}
                {(s.presentes_personajes ?? []).length > 0 && (
                  <PresentesAvatars presentes={s.presentes_personajes} max={3} />
                )}
              </div>

              {/* tooltip info */}
              {isHover && !traveling && (
                <div className="nx-panel solid nx-fade" style={{
                  position: 'absolute', bottom: 'calc(100% + 16px)', left: '50%',
                  transform: 'translateX(-50%)',
                  padding: '10px 14px', minWidth: 175, zIndex: 20,
                  pointerEvents: 'none', whiteSpace: 'nowrap',
                }}>
                  <div className="nx-display" style={{ fontSize: 12, marginBottom: 7, color: c }}>{s.nombre}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <InfoRow label="Hostilidad"  value={h.label}                                    color={h.text} />
                    <InfoRow label="Rareza"       value={s.rareza ?? '—'}                            color={rarezaColor(s.rareza)} />
                    <InfoRow label="Facción"      value={s.faccion ?? '—'} />
                    <InfoRow label="Costo viaje"  value={s.costo_viaje > 0 ? `${s.costo_viaje} cr` : 'Libre'} />
                    {s.planetas_count !== undefined && (
                      <InfoRow label="Planetas" value={s.planetas_count} />
                    )}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* ── overlay salto hiperespacio ── */}
      {traveling && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(4,7,15,0.88)', backdropFilter: 'blur(10px)',
          display: 'grid', placeItems: 'center',
          animation: 'nx-fade-up 0.3s ease both',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 88, height: 88, borderRadius: '50%', margin: '0 auto 28px',
              background: 'radial-gradient(circle, rgba(56,205,240,0.9) 0%, rgba(56,205,240,0.3) 40%, transparent 70%)',
              boxShadow: '0 0 70px 24px rgba(56,205,240,0.35)',
              animation: 'nx-pulse 0.5s infinite',
            }} />
            <div className="nx-display" style={{ fontSize: 20, color: 'var(--holo)', letterSpacing: '0.1em', marginBottom: 10 }}>
              INICIANDO SALTO HIPERESPACIAL
            </div>
            <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-dim)', letterSpacing: '0.22em' }}>
              CALCULANDO RUTA · ESPERA...
            </div>
            <HyperspaceLines />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── ANIMACIÓN LÍNEAS HIPERSPACE ───────────────────────── */
function HyperspaceLines() {
  return (
    <div style={{ position: 'relative', width: 300, height: 80, margin: '32px auto 0', overflow: 'hidden' }}>
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} style={{
          position: 'absolute',
          top: `${8 + i * 6}%`,
          left: 0, right: 0, height: 1,
          background: `linear-gradient(90deg, transparent, rgba(56,205,240,${0.2 + Math.random() * 0.6}), transparent)`,
          animation: `nx-sweep ${0.6 + i * 0.08}s linear infinite`,
          animationDelay: `${i * 0.05}s`,
        }} />
      ))}
    </div>
  );
}

/* ─── ANIMACIONES DE VIAJE ───────────────────────────────── */
function SpaceshipAnim() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {Array.from({ length: 26 }, (_, i) => {
        const top = 2 + i * 3.8;
        const opBase = [0.18, 0.28, 0.14, 0.35, 0.22, 0.42][i % 6];
        const dur = [0.48, 0.52, 0.44, 0.56, 0.50, 0.46][i % 6];
        const delay = (i % 10) * 0.05;
        const bright = i % 7 === 0;
        return (
          <div key={i} style={{
            position: 'absolute', top: `${top}%`,
            left: 0, right: 0, height: bright ? 2 : 1,
            background: bright
              ? `linear-gradient(90deg, transparent 0%, rgba(200,240,255,0.05) 15%, rgba(200,240,255,0.9) 52%, rgba(255,255,255,1) 58%, rgba(200,240,255,0.05) 80%, transparent 100%)`
              : `linear-gradient(90deg, transparent 0%, rgba(56,205,240,${opBase * 0.4}) 15%, rgba(120,210,255,${opBase}) 50%, rgba(220,240,255,0.8) 58%, transparent 100%)`,
            animation: `nx-sweep ${dur}s linear infinite`,
            animationDelay: `${delay}s`,
          }} />
        );
      })}
      <svg width="200" height="88" viewBox="0 0 200 88" style={{ position: 'relative', zIndex: 2, filter: 'drop-shadow(0 0 16px rgba(56,205,240,0.85))' }}>
        <defs>
          <radialGradient id="eng1" cx="0%" cy="50%" r="100%">
            <stop offset="0%" stopColor="rgba(56,205,240,0.9)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
        <ellipse cx="18" cy="46" rx="22" ry="7" fill="url(#eng1)" opacity="0.75" />
        <path d="M38,46 L158,34 L182,46 L158,58 Z" fill="#0d2240" stroke="#38cdf0" strokeWidth="1.5" />
        <path d="M80,34 L108,14 L118,26 L92,36 Z" fill="#0a1a30" stroke="#38cdf0" strokeWidth="1" />
        <path d="M80,58 L108,74 L118,62 L92,54 Z" fill="#0a1a30" stroke="#38cdf0" strokeWidth="1" />
        <ellipse cx="150" cy="46" rx="18" ry="10" fill="#091828" stroke="#38cdf0" strokeWidth="1.2" />
        <ellipse cx="152" cy="45" rx="11" ry="6" fill="rgba(56,205,240,0.18)" />
        <ellipse cx="154" cy="44" rx="5" ry="2.8" fill="rgba(56,205,240,0.38)" />
        <path d="M178,42 L196,46 L178,50 Z" fill="rgba(56,205,240,0.75)" />
        <circle cx="40" cy="42" r="5.5" fill="#152a50" stroke="rgba(56,205,240,0.55)" strokeWidth="1" />
        <circle cx="40" cy="50" r="5.5" fill="#152a50" stroke="rgba(56,205,240,0.55)" strokeWidth="1" />
        <circle cx="37" cy="42" r="3.5" fill="rgba(56,205,240,0.55)" style={{ animation: 'nx-pulse 0.35s infinite' }} />
        <circle cx="37" cy="50" r="3.5" fill="rgba(120,230,255,0.65)" style={{ animation: 'nx-pulse 0.35s infinite', animationDelay: '0.17s' }} />
      </svg>
      <div className="nx-display" style={{ marginTop: 40, fontSize: 17, color: 'var(--holo)', letterSpacing: '0.14em', animation: 'nx-pulse 1.3s ease-in-out infinite' }}>
        VIAJE ESPACIAL
      </div>
      <div className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)', marginTop: 8, letterSpacing: '0.2em' }}>
        CALCULANDO RUTA DE RETORNO...
      </div>
    </div>
  );
}

function VehicleAnim() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {Array.from({ length: 20 }, (_, i) => {
        const top = 53 + i * 2.3;
        const opBase = [0.12, 0.22, 0.08, 0.30, 0.16, 0.35][i % 6];
        const dur = [0.38, 0.44, 0.40, 0.50, 0.42, 0.36][i % 6];
        const bright = i % 5 === 0;
        return (
          <div key={i} style={{
            position: 'absolute', top: `${top}%`,
            left: 0, right: 0, height: bright ? 2 : 1,
            background: bright
              ? `linear-gradient(90deg, transparent 0%, rgba(255,220,100,0.05) 15%, rgba(255,200,60,0.85) 52%, rgba(255,240,180,1) 58%, rgba(255,200,60,0.05) 82%, transparent 100%)`
              : `linear-gradient(90deg, transparent 0%, rgba(255,160,50,${opBase * 0.4}) 15%, rgba(255,180,70,${opBase}) 50%, rgba(255,230,140,0.75) 58%, transparent 100%)`,
            animation: `nx-sweep ${dur}s linear infinite`,
            animationDelay: `${i * 0.045}s`,
          }} />
        );
      })}
      <div style={{ position: 'absolute', top: '57%', left: '5%', right: '5%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,160,50,0.35) 20%, rgba(255,180,60,0.55) 50%, rgba(255,160,50,0.35) 80%, transparent)' }} />
      <svg width="240" height="82" viewBox="0 0 240 82" style={{ position: 'relative', zIndex: 2, filter: 'drop-shadow(0 0 14px rgba(255,160,50,0.75))', transform: 'translateY(10px)' }}>
        <ellipse cx="120" cy="66" rx="72" ry="8" fill="rgba(255,140,20,0.10)" />
        <ellipse cx="120" cy="64" rx="50" ry="4.5" fill="rgba(255,160,40,0.22)" style={{ animation: 'nx-pulse 0.7s infinite' }} />
        <ellipse cx="120" cy="42" rx="82" ry="20" fill="#140e05" stroke="rgba(255,160,50,0.65)" strokeWidth="1.5" />
        <path d="M74,42 Q90,22 118,24 Q148,22 166,42 Z" fill="#0c1620" stroke="rgba(56,205,240,0.45)" strokeWidth="1" />
        <path d="M84,42 Q98,28 118,29 Q140,28 156,42 Z" fill="rgba(56,205,240,0.07)" />
        <path d="M198,38 L226,42 L198,46 Z" fill="rgba(255,160,50,0.88)" />
        <path d="M44,36 L16,26 L20,38 Z" fill="rgba(255,150,40,0.45)" />
        <path d="M44,48 L16,58 L20,46 Z" fill="rgba(255,150,40,0.45)" />
        <line x1="55" y1="39" x2="185" y2="37" stroke="rgba(255,155,45,0.28)" strokeWidth="0.8" />
        <line x1="55" y1="45" x2="185" y2="47" stroke="rgba(255,155,45,0.28)" strokeWidth="0.8" />
        <circle cx="216" cy="41" r="4.5" fill="rgba(255,235,160,0.92)" />
        <circle cx="216" cy="41" r="8" fill="rgba(255,230,140,0.18)" />
        <circle cx="47" cy="39" r="6.5" fill="#100a04" stroke="rgba(255,120,20,0.55)" strokeWidth="1" />
        <circle cx="47" cy="47" r="6.5" fill="#100a04" stroke="rgba(255,120,20,0.55)" strokeWidth="1" />
        <circle cx="44" cy="39" r="4" fill="rgba(255,120,20,0.55)" style={{ animation: 'nx-pulse 0.45s infinite' }} />
        <circle cx="44" cy="47" r="4" fill="rgba(255,130,30,0.55)" style={{ animation: 'nx-pulse 0.45s infinite', animationDelay: '0.22s' }} />
      </svg>
      <div className="nx-display" style={{ marginTop: 30, fontSize: 17, color: '#ffb01f', letterSpacing: '0.14em', animation: 'nx-pulse 1.3s ease-in-out infinite' }}>
        EN RUTA
      </div>
      <div className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)', marginTop: 8, letterSpacing: '0.2em' }}>
        DESPLAZÁNDOSE POR EL TERRITORIO...
      </div>
    </div>
  );
}

function TravelOverlay({ kind, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1750);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: kind === 'espacio'
        ? 'radial-gradient(ellipse at 50% 60%, #071428 0%, #04070f 100%)'
        : 'radial-gradient(ellipse at 50% 75%, #1c1408 0%, #08080a 100%)',
      animation: 'nx-fade-up 0.25s ease both',
      overflow: 'hidden',
    }}>
      {kind === 'espacio' ? <SpaceshipAnim /> : <VehicleAnim />}
    </div>
  );
}

/* ─── CABECERA CON BOTÓN VOLVER ──────────────────────────── */
function VolverHeader({ onVolver, crumbs }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <button
        onClick={onVolver}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(56,205,240,0.07)',
          border: '1px solid rgba(56,205,240,0.25)',
          borderRadius: 8, padding: '6px 14px',
          cursor: 'pointer', color: 'var(--holo)',
          fontSize: 11, fontFamily: 'var(--font-data)',
          letterSpacing: '0.1em', flexShrink: 0,
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(56,205,240,0.16)'; e.currentTarget.style.borderColor = 'var(--holo)'; e.currentTarget.style.boxShadow = '0 0 12px -3px var(--holo)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(56,205,240,0.07)'; e.currentTarget.style.borderColor = 'rgba(56,205,240,0.25)'; e.currentTarget.style.boxShadow = 'none'; }}
      >
        ← VOLVER
      </button>
      <BreadcrumbNav crumbs={crumbs} />
    </div>
  );
}

/* ─── VISTA SISTEMA SOLAR ───────────────────────────────── */
function SistemaView({ sistemaId, onSelectPlaneta, onBack, onTravel, onChat, onAttack, myUserId }) {
  const [sistema, setSistema] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePlaneta, setActivePlaneta] = useState(null);

  useEffect(() => {
    apiFetch(`/map/sistemas/${sistemaId}`)
      .then((d) => setSistema(d.sistema))
      .catch(() => toast('Error cargando sistema', { tone: 'error', icon: 'x' }))
      .finally(() => setLoading(false));
  }, [sistemaId]);

  if (loading) return <LoadingHUD text="ENTRANDO AL SISTEMA..." />;
  if (!sistema) return null;

  const planetas = sistema.planetas ?? [];

  /* órbitas diagonales — eje inclinado 30° */
  const ORBIT_SCALE = [1, 1.7, 2.5, 3.4, 4.4, 5.5, 6.7, 8.0];
  const PLANET_SIZE = [28, 34, 38, 30, 22, 42, 36, 26];
  const PLANET_COLORS = [
    '#a87d4a', '#e8c56a', '#38cdf0', '#ff6b4a',
    '#c4a882', '#d4a76a', '#7bc8d4', '#a8b8d4',
  ];

  return (
    <div className="nx-fade">
      <VolverHeader
        onVolver={() => onTravel('espacio', onBack)}
        crumbs={[{ label: 'Galaxia' }, { label: sistema.nombre }]}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px 220px', gap: 20, marginTop: 0 }}>
        {/* ── visor del sistema ── */}
        <div className="nx-panel solid" style={{ position: 'relative', overflow: 'hidden', minHeight: 500,
          background: 'linear-gradient(180deg,#07101f,#04070f)' }}>

          <div className="nx-starfield">
            <Starfield />
          </div>

          <div className="nx-panel-head" style={{ position: 'relative', zIndex: 5 }}>
            <span style={{ color: 'var(--holo)' }}><Icon name="star" size={15} /></span>
            <div style={{ flex: 1 }}>
              <div className="nx-kicker">SISTEMA SOLAR</div>
              <div className="nx-display" style={{ fontSize: 13, color: 'var(--txt)' }}>{sistema.nombre}</div>
            </div>
            {sistema.faccion && <Chip tone="dim">{sistema.faccion}</Chip>}
          </div>

          <div style={{
            position: 'relative', height: 460,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {/* Sol central */}
            <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', zIndex: 5 }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'radial-gradient(circle at 40% 35%, #fff9c4, #ffcc00 40%, #ff8800 70%, #ff4400)',
                boxShadow: '0 0 50px 20px rgba(255,180,0,0.5), 0 0 120px 60px rgba(255,120,0,0.2)',
                animation: 'nx-pulse 3s ease-in-out infinite',
              }} />
            </div>

            {/* Órbitas y planetas */}
            {planetas.map((p, i) => {
              const orbitScale = ORBIT_SCALE[i % ORBIT_SCALE.length];
              const pSize      = PLANET_SIZE[i % PLANET_SIZE.length];
              const pColor     = PLANET_COLORS[i % PLANET_COLORS.length];
              const h          = hostilidadStyle(p.hostilidad);

              /* elipse inclinada — transform diagonal */
              const orbitW = orbitScale * 70;
              const orbitH = orbitScale * 28;

              /* posición del planeta en la órbita (ángulo fijo por índice) */
              const angle = (i / planetas.length) * Math.PI * 2 + Math.PI / 6;
              const px    = Math.cos(angle) * (orbitW / 2);
              const py    = Math.sin(angle) * (orbitH / 2);
              const isActive = activePlaneta === p.id;

              return (
                <g key={p.id} style={{ position: 'absolute', left: '50%', top: '50%' }}>
                  {/* elipse de la órbita */}
                  <svg style={{
                    position: 'absolute',
                    left: `calc(-${orbitW / 2}px)`,
                    top: `calc(-${orbitH / 2}px)`,
                    pointerEvents: 'none',
                    overflow: 'visible',
                    zIndex: 1,
                  }}
                    width={orbitW} height={orbitH}
                  >
                    <ellipse
                      cx={orbitW / 2} cy={orbitH / 2}
                      rx={orbitW / 2 - 1} ry={orbitH / 2 - 1}
                      fill="none"
                      stroke={isActive ? 'rgba(56,205,240,0.4)' : 'rgba(56,205,240,0.12)'}
                      strokeWidth="1"
                      strokeDasharray={isActive ? '4 3' : '3 6'}
                    />
                  </svg>

                  {/* planeta */}
                  <button
                    onMouseEnter={() => setActivePlaneta(p.id)}
                    onMouseLeave={() => setActivePlaneta(null)}
                    onClick={() => onSelectPlaneta(p)}
                    style={{
                      position: 'absolute',
                      left: px, top: py,
                      transform: 'translate(-50%,-50%)',
                      background: 'transparent', border: 'none',
                      cursor: 'pointer', zIndex: isActive ? 10 : 3,
                    }}
                  >
                    <div style={{
                      width: pSize, height: pSize, borderRadius: '50%',
                      background: `radial-gradient(circle at 35% 30%, ${pColor}cc, ${pColor}66 60%, ${pColor}22)`,
                      border: `2px solid ${isActive ? h.border : pColor + '88'}`,
                      boxShadow: isActive
                        ? `0 0 20px 6px ${h.border}66`
                        : `0 0 8px 2px ${pColor}44`,
                      transition: 'all 0.2s',
                    }} />

                    {isActive && (
                      <div className="nx-panel solid nx-fade" style={{
                        position: 'absolute', bottom: '120%', left: '50%',
                        transform: 'translateX(-50%)',
                        padding: '8px 12px', minWidth: 160, whiteSpace: 'nowrap',
                        pointerEvents: 'none', zIndex: 20,
                      }}>
                        <div className="nx-display" style={{ fontSize: 11, color: 'var(--txt)', marginBottom: 4 }}>{p.nombre}</div>
                        <InfoRow label="Clima"      value={p.clima ?? '—'} />
                        <InfoRow label="Hostilidad" value={h.label} color={h.text} />
                        <InfoRow label="Facción"    value={p.faccion ?? '—'} />
                      </div>
                    )}
                  </button>
                </g>
              );
            })}
          </div>
        </div>

        {/* ── panel de planetas ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Panel title="Planetas del sistema" kicker="CUERPOS CELESTES" icon="target">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {planetas.length === 0 && (
                <div style={{ color: 'var(--txt-faint)', fontSize: 13, textAlign: 'center', padding: 16 }}>
                  Sin planetas registrados
                </div>
              )}
              {planetas.map((p) => {
                const h = hostilidadStyle(p.hostilidad);
                return (
                  <button key={p.id} onClick={() => onSelectPlaneta(p)}
                    style={{
                      background: activePlaneta === p.id ? h.bg : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${activePlaneta === p.id ? h.border : 'var(--holo-line)'}`,
                      borderRadius: 'var(--radius-md)',
                      padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.2s', color: 'var(--txt)',
                    }}
                    onMouseEnter={() => setActivePlaneta(p.id)}
                    onMouseLeave={() => setActivePlaneta(null)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                        background: `radial-gradient(circle at 35% 30%, ${PLANET_COLORS[planetas.indexOf(p) % PLANET_COLORS.length]}cc, ${PLANET_COLORS[planetas.indexOf(p) % PLANET_COLORS.length]}33)`,
                        border: `1.5px solid ${h.border}88`,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt)', marginBottom: 2 }}>{p.nombre}</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          {p.clima && <span style={{ fontSize: 10, color: 'var(--txt-dim)', fontFamily: 'var(--font-data)' }}>{p.clima}</span>}
                          <span style={{ fontSize: 10, color: h.text, fontFamily: 'var(--font-data)' }}>{h.label}</span>
                          {(p.presentes_personajes ?? []).length > 0 && (
                            <PresentesAvatars presentes={p.presentes_personajes} max={3} />
                          )}
                        </div>
                      </div>
                      <Icon name="arrow" size={14} style={{ color: 'var(--holo)', opacity: 0.6 }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </Panel>

          {sistema.historia && (
            <Panel title="Historia" kicker="REGISTRO" icon="shield">
              <p style={{ fontSize: 12, color: 'var(--txt-dim)', lineHeight: 1.6, margin: 0 }}>
                {sistema.historia}
              </p>
            </Panel>
          )}
        </div>

        {/* ── panel presentes ── */}
        <PresentesPanel
          presentes={sistema.presentes_personajes ?? []}
          onChat={onChat}
          onAttack={onAttack}
          myUserId={myUserId}
        />
      </div>
    </div>
  );
}

/* ─── VISTA PLANETA ─────────────────────────────────────── */
function PlanetaView({ planetaId, onSelectZona, onBack, onTravel, onChat, onAttack, onPlanetaImagen, myUserId }) {
  const [planeta, setPlaneta] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/map/planetas/${planetaId}`)
      .then((d) => {
        setPlaneta(d.planeta);
        onPlanetaImagen?.(d.planeta.imagen ? mediaUrl(d.planeta.imagen) : null);
      })
      .catch(() => toast('Error cargando planeta', { tone: 'error', icon: 'x' }))
      .finally(() => setLoading(false));
  }, [planetaId]);

  if (loading) return <LoadingHUD text="ATERRIZANDO EN EL PLANETA..." />;
  if (!planeta) return null;

  const zonas = planeta.zonas ?? [];
  const planetaImagen = mediaUrl(planeta.imagen);

  /* colores de zona para mapa */
  const getZonaStyle = (z) => hostilidadStyle(z.hostilidad);

  /* distribución visual tipo mapa (grid orgánico) */
  const GRID_POS = [
    { col: 2, row: 1 }, { col: 4, row: 1 }, { col: 3, row: 2 },
    { col: 1, row: 2 }, { col: 5, row: 2 }, { col: 2, row: 3 },
    { col: 4, row: 3 }, { col: 1, row: 4 }, { col: 3, row: 4 },
    { col: 5, row: 4 }, { col: 2, row: 5 }, { col: 4, row: 5 },
  ];

  return (
    <div className="nx-fade">
      <VolverHeader
        onVolver={() => onTravel('espacio', onBack)}
        crumbs={[{ label: 'Galaxia' }, { label: planeta.sistema?.nombre }, { label: planeta.nombre }]}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px 220px', gap: 20, marginTop: 0 }}>
        {/* mapa del planeta */}
        <Panel title={planeta.nombre} kicker="MAPA PLANETARIO" icon="target"
          right={<Chip tone={hostilidadStyle(planeta.hostilidad).text !== '#8aa0c0' ? 'orange' : 'default'}>
            {hostilidadStyle(planeta.hostilidad).label}
          </Chip>}
        >
          <div style={{ position: 'relative', minHeight: 420 }}>
            {/* fondo imagen del planeta */}
            {planetaImagen && (
              <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: `url(${planetaImagen})`,
                backgroundSize: 'cover', backgroundPosition: 'center',
                borderRadius: 8, opacity: 0.28,
              }} />
            )}
            {/* overlay tono azulado + rejilla */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 8,
              background: 'radial-gradient(ellipse at 60% 40%, rgba(56,205,240,0.10) 0%, rgba(4,10,30,0.45) 70%)',
              backgroundImage: [
                'radial-gradient(ellipse at 60% 40%, rgba(56,205,240,0.10) 0%, rgba(4,10,30,0.45) 70%)',
                'linear-gradient(rgba(56,205,240,0.07) 1px, transparent 1px)',
                'linear-gradient(90deg, rgba(56,205,240,0.07) 1px, transparent 1px)',
              ].join(', '),
              backgroundSize: 'auto, 48px 48px, 48px 48px',
            }} />

            {/* grid de zonas */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, 1fr)',
              gridTemplateRows: `repeat(${Math.ceil(zonas.length / 2) + 2}, 1fr)`,
              gap: 8, padding: 16, minHeight: 400, position: 'relative', zIndex: 1,
            }}>
              {zonas.length === 0 && (
                <div style={{
                  gridColumn: '1 / -1', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: 'var(--txt-faint)', fontSize: 13,
                }}>
                  Sin zonas registradas
                </div>
              )}
              {zonas.map((z, i) => {
                const hs = getZonaStyle(z);
                const pos = GRID_POS[i % GRID_POS.length];
                const zonaImagen = mediaUrl(z.imagen);
                return (
                  <button
                    key={z.id}
                    onClick={() => onSelectZona(z)}
                    style={{
                      gridColumn: pos.col, gridRow: pos.row,
                      background: hs.bg, border: `1.5px solid ${hs.border}`,
                      borderRadius: 8, padding: '10px 8px', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      gap: 4, textAlign: 'center', transition: 'all 0.2s',
                      color: 'var(--txt)', position: 'relative', overflow: 'hidden',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = `0 0 16px 4px ${hs.border}55`;
                      e.currentTarget.style.transform = 'scale(1.04)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.transform = 'none';
                    }}
                  >
                    {zonaImagen && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        backgroundImage: `url(${zonaImagen})`,
                        backgroundSize: 'cover', backgroundPosition: 'center',
                        opacity: 0.30, borderRadius: 7,
                      }} />
                    )}
                    <Icon name="target" size={16} style={{ color: hs.text, position: 'relative', zIndex: 1 }} />
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-data)', fontWeight: 700, color: 'var(--txt)', lineHeight: 1.2, position: 'relative', zIndex: 1 }}>
                      {z.nombre}
                    </span>
                    <span style={{ fontSize: 9, color: hs.text, fontFamily: 'var(--font-data)', letterSpacing: '0.08em', position: 'relative', zIndex: 1 }}>
                      {hs.label}
                    </span>
                    {(z.presentes_personajes ?? []).length > 0 && (
                      <div style={{ position: 'relative', zIndex: 1 }}>
                        <PresentesAvatars presentes={z.presentes_personajes} max={2} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* leyenda */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: '8px 0 0', borderTop: '1px solid var(--holo-line)', marginTop: 8 }}>
            <div className="nx-kicker" style={{ width: '100%', marginBottom: 4 }}>NIVEL DE HOSTILIDAD</div>
            {Object.entries(HOSTILIDAD_COLOR).filter(([k]) => k !== 'default').map(([k, v]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: v.border, opacity: 0.85 }} />
                <span style={{ fontSize: 10, color: v.text, fontFamily: 'var(--font-data)' }}>{v.label}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* cards de zonas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Panel title="Zonas del planeta" kicker="TERRITORIOS" icon="shield">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {zonas.map((z) => {
                const hs = hostilidadStyle(z.hostilidad);
                const zonaImagen = mediaUrl(z.imagen);
                return (
                  <button key={z.id} onClick={() => onSelectZona(z)}
                    style={{
                      background: hs.bg, border: `1px solid ${hs.border}66`,
                      borderRadius: 'var(--radius-md)',
                      padding: '8px 10px', cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.2s', color: 'var(--txt)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = hs.border; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = hs.border + '66'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {zonaImagen ? (
                        <div style={{
                          width: 44, height: 44, borderRadius: 6, flexShrink: 0,
                          backgroundImage: `url(${zonaImagen})`,
                          backgroundSize: 'cover', backgroundPosition: 'center',
                          border: `1px solid ${hs.border}55`,
                        }} />
                      ) : (
                        <div style={{
                          width: 44, height: 44, borderRadius: 6, flexShrink: 0,
                          background: hs.bg, border: `1px solid ${hs.border}44`,
                          display: 'grid', placeItems: 'center',
                        }}>
                          <Icon name="target" size={18} style={{ color: hs.text, opacity: 0.5 }} />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 3 }}>{z.nombre}</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: 10, color: hs.text, fontFamily: 'var(--font-data)' }}>{hs.label}</span>
                          {z.faccion && <span style={{ fontSize: 10, color: 'var(--txt-dim)', fontFamily: 'var(--font-data)' }}>{z.faccion}</span>}
                          {z.estrato_social && <span style={{ fontSize: 10, color: 'var(--txt-faint)', fontFamily: 'var(--font-data)' }}>{z.estrato_social}</span>}
                          {(z.presentes_personajes ?? []).length > 0 && (
                            <PresentesAvatars presentes={z.presentes_personajes} max={3} />
                          )}
                        </div>
                      </div>
                      <Icon name="arrow" size={14} style={{ color: 'var(--holo)', opacity: 0.6, flexShrink: 0 }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </Panel>

          {planeta.historia && (
            <Panel title="Crónica" kicker="HISTORIA" icon="flame">
              <p style={{ fontSize: 12, color: 'var(--txt-dim)', lineHeight: 1.6, margin: 0 }}>
                {planeta.historia}
              </p>
            </Panel>
          )}
        </div>

        {/* ── panel presentes ── */}
        <PresentesPanel
          presentes={planeta.presentes_personajes ?? []}
          onChat={onChat}
          onAttack={onAttack}
          myUserId={myUserId}
        />
      </div>
    </div>
  );
}

/* ─── VISTA ZONA ────────────────────────────────────────── */
function ZonaView({ zonaId, onSelectLugar, onBack, onTravel, breadcrumbs, onChat, onAttack, onZonaImagen, myUserId }) {
  const [zona, setZona]     = useState(null);
  const [loading, setLoading] = useState(true);

  const handleSelectLugar = useCallback((lugar) => {
    onSelectLugar(lugar);
  }, [onSelectLugar]);

  useEffect(() => {
    apiFetch(`/map/zonas/${zonaId}`)
      .then((d) => {
        setZona(d.zona);
        onZonaImagen?.(d.zona.imagen ? mediaUrl(d.zona.imagen) : null);
      })
      .catch(() => toast('Error cargando zona', { tone: 'error', icon: 'x' }))
      .finally(() => setLoading(false));
  }, [zonaId]);

  if (loading) return <LoadingHUD text="ESCANEANDO ZONA..." />;
  if (!zona) return null;

  const hs = hostilidadStyle(zona.hostilidad);
  const lugares = zona.lugares ?? [];
  const exteriores = lugares.filter((l) => !l.tipo || l.tipo === 'exterior');
  const zonaImagen = mediaUrl(zona.imagen);

  return (
    <div className="nx-fade">
      <VolverHeader
        onVolver={() => onTravel('vehiculo', onBack)}
        crumbs={[...breadcrumbs, { label: zona.nombre }]}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 20, marginTop: 0, alignItems: 'start' }}>
        {/* columna principal */}
        <div style={{
          position: 'relative',
          borderRadius: 12,
          overflow: 'hidden',
        }}>
          {zonaImagen && (
            <div style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url(${zonaImagen})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: 0.22,
            }} />
          )}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at 58% 38%, rgba(56,205,240,0.09) 0%, rgba(4,10,30,0.55) 70%)',
            backgroundImage: [
              'radial-gradient(ellipse at 58% 38%, rgba(56,205,240,0.09) 0%, rgba(4,10,30,0.55) 70%)',
              'linear-gradient(rgba(56,205,240,0.06) 1px, transparent 1px)',
              'linear-gradient(90deg, rgba(56,205,240,0.06) 1px, transparent 1px)',
            ].join(', '),
            backgroundSize: 'auto, 48px 48px, 48px 48px',
            pointerEvents: 'none',
          }} />
          <div style={{ position: 'relative', zIndex: 1, padding: 12 }}>
          {/* header de zona */}
          <div className="nx-panel solid" style={{
            padding: '20px 24px', marginBottom: 20,
            borderLeft: `3px solid ${hs.border}`,
            background: hs.bg,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              {zonaImagen && (
                <img src={zonaImagen} alt={zona.nombre} style={{
                  width: 100, height: 100, objectFit: 'cover', borderRadius: 8,
                  border: `1px solid ${hs.border}55`, flexShrink: 0,
                }} />
              )}
              <div style={{ flex: 1 }}>
                <div className="nx-kicker" style={{ marginBottom: 4 }}>ZONA</div>
                <div className="nx-display" style={{ fontSize: 22, color: 'var(--txt)', marginBottom: 8 }}>{zona.nombre}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: zona.historia ? 12 : 0 }}>
                  <Chip style={{ color: hs.text, borderColor: hs.border + '66', background: hs.bg }}>{hs.label}</Chip>
                  {zona.faccion && <Chip tone="dim">{zona.faccion}</Chip>}
                  {zona.estrato_social && <Chip tone="dim">{zona.estrato_social}</Chip>}
                  {zona.rareza && <Chip style={{ color: rarezaColor(zona.rareza) }}>{zona.rareza}</Chip>}
                </div>
                {zona.historia && (
                  <p style={{ fontSize: 13, color: 'var(--txt-dim)', lineHeight: 1.6, margin: 0 }}>
                    {zona.historia}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* grid de lugares exteriores */}
          <div className="nx-kicker" style={{ marginBottom: 12 }}>LUGARES VISITABLES — {exteriores.length}</div>

          {exteriores.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--txt-faint)', fontSize: 13 }}>
              Sin lugares registrados en esta zona
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            {exteriores.map((l) => (
              <LugarCard key={l.id} lugar={l} presentes={l.presentes_personajes ?? []} onClick={() => handleSelectLugar(l)} />
            ))}
          </div>
          </div>
        </div>

        {/* panel presentes */}
        <PresentesPanel
          presentes={zona.presentes_personajes ?? []}
          onChat={onChat}
          onAttack={onAttack}
          myUserId={myUserId}
        />
      </div>
    </div>
  );
}

/* ─── CARD LUGAR ────────────────────────────────────────── */
function LugarCard({ lugar, presentes = [], onClick }) {
  const rc = rarezaColor(lugar.rareza);
  const lugarImagen = mediaUrl(lugar.imagen);
  const tipoLabel = lugar.tipo === 'interior' ? 'Interior' : 'Exterior';
  return (
    <button onClick={onClick}
      style={{
        background: 'rgba(12,30,64,0.55)', border: `1px solid var(--holo-line)`,
        borderRadius: 'var(--radius-lg)', cursor: 'pointer', textAlign: 'left',
        padding: 0, overflow: 'hidden', transition: 'all 0.2s',
        display: 'flex', flexDirection: 'column', color: 'var(--txt)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.border = `1px solid var(--holo)`;
        e.currentTarget.style.boxShadow = '0 0 20px -6px var(--holo)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.border = `1px solid var(--holo-line)`;
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'none';
      }}
    >
      <div style={{
        height: 120, background: lugarImagen
          ? `url(${lugarImagen}) center/cover`
          : 'linear-gradient(135deg, rgba(56,205,240,0.08), rgba(4,7,15,0.8))',
        position: 'relative',
      }}>
        {!lugarImagen && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', opacity: 0.3 }}>
            <Icon name="target" size={40} style={{ color: 'var(--holo)' }} />
          </div>
        )}
        {lugar.rareza && (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            background: `${rc}22`, border: `1px solid ${rc}66`,
            borderRadius: 4, padding: '2px 7px',
            fontSize: 9, color: rc, fontFamily: 'var(--font-data)',
            letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            {lugar.rareza}
          </div>
        )}
      </div>
      <div style={{ padding: '12px 14px', flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', marginBottom: 6 }}>{lugar.nombre}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: lugar.historia ? 8 : 0 }}>
          <Chip tone="dim">{tipoLabel}</Chip>
          {lugar.pase ? <Chip tone="warning">Requiere pase</Chip> : null}
        </div>
        {lugar.historia && (
          <p style={{
            fontSize: 11, color: 'var(--txt-dim)', lineHeight: 1.5, margin: 0,
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {lugar.historia}
          </p>
        )}
      </div>
      <div style={{
        padding: '8px 14px', borderTop: '1px solid var(--holo-line)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {presentes.length > 0
          ? <PresentesAvatars presentes={presentes} max={4} />
          : <span />
        }
        <span style={{ fontSize: 10, color: 'var(--holo)', fontFamily: 'var(--font-data)', letterSpacing: '0.1em' }}>
          ENTRAR →
        </span>
      </div>
    </button>
  );
}

/* ─── VISTA LUGAR ────────────────────────────────────────── */
function LugarView({ lugarId, onSelectNpc, onBack, onTravel, breadcrumbs, onLugarChange, onLugarImagen, onChat, onAttack, myUserId }) {
  const [navStack, setNavStack]     = useState([lugarId]);
  const [navNames, setNavNames]     = useState({});
  const [lugar, setLugar]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const currentId = navStack[navStack.length - 1];

  /* reset cuando el lugar raíz cambia desde fuera */
  useEffect(() => {
    setNavStack([lugarId]);
    setNavNames({});
  }, [lugarId]);

  /* carga el lugar actual; cancela si el efecto se limpia antes */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLugar(null);
    setAccessDenied(false);
    apiFetch(`/map/lugares/${currentId}`)
      .then((d) => {
        if (cancelled) return;
        setLugar(d.lugar);
        setNavNames((prev) => ({ ...prev, [currentId]: d.lugar.nombre }));
        onLugarChange?.(currentId, d.lugar.nombre);
        onLugarImagen?.(d.lugar.imagen ? mediaUrl(d.lugar.imagen) : null);
      })
      .catch((err) => {
        if (cancelled) return;
        if (String(err.message) === '403') {
          setAccessDenied(true);
        } else {
          toast('Error cargando lugar', { tone: 'error', icon: 'x' });
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentId]);

  const navigateTo = (conn) => onTravel('vehiculo', () => setNavStack((prev) => [...prev, conn.id]));

  /* breadcrumbs dinámicos: ruta base + pasos interiores visitados */
  const stackCrumbs = navStack.slice(0, -1).map((id) => ({
    label: navNames[id] ?? '…',
  }));

  const goBack = navStack.length > 1
    ? () => onTravel('vehiculo', () => setNavStack((prev) => prev.slice(0, -1)))
    : () => onTravel('vehiculo', onBack);

  if (loading) return <LoadingHUD text="EXPLORANDO UBICACIÓN..." />;

  /* ── pantalla de acceso denegado ── */
  if (accessDenied) return (
    <div className="nx-fade">
      <VolverHeader
        onVolver={goBack}
        crumbs={[...breadcrumbs, ...stackCrumbs, { label: 'Acceso restringido' }]}
      />
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: 420, gap: 28, textAlign: 'center',
        marginTop: 24,
      }}>
        {/* ícono puerta con brillo rojo */}
        <div style={{
          width: 100, height: 100, borderRadius: 20,
          background: 'rgba(220,38,38,0.09)',
          border: '2px solid rgba(220,38,38,0.42)',
          boxShadow: '0 0 48px 14px rgba(220,38,38,0.12), inset 0 0 24px rgba(220,38,38,0.07)',
          display: 'grid', placeItems: 'center',
          animation: 'nx-pulse 2.5s ease-in-out infinite',
        }}>
          <Icon name="shield" size={44} style={{ color: '#ff2d45' }} />
        </div>

        <div>
          <div className="nx-kicker" style={{ color: '#ff2d45', marginBottom: 10, fontSize: 10, letterSpacing: '0.24em' }}>
            ACCESO DENEGADO
          </div>
          <div className="nx-display" style={{ fontSize: 26, color: 'var(--txt)', marginBottom: 14, letterSpacing: '0.04em' }}>
            Puerta Cerrada
          </div>
          <p style={{ fontSize: 13, color: 'var(--txt-dim)', maxWidth: 340, lineHeight: 1.7, margin: '0 auto' }}>
            No posees el objeto de acceso requerido para entrar a este lugar.
          </p>
        </div>

        <Btn kind="ghost" onClick={goBack}>← Volver</Btn>
      </div>
    </div>
  );

  if (!lugar) return null;

  const npcs       = lugar.npcs ?? [];
  const lugarImagen = mediaUrl(lugar.imagen);

  /* accesos: norte/sur/este/oeste con datos */
  const DIRS = [
    { key: 'norte', label: 'Norte', icon: '↑', data: lugar.norte },
    { key: 'sur',   label: 'Sur',   icon: '↓', data: lugar.sur   },
    { key: 'este',  label: 'Este',  icon: '→', data: lugar.este  },
    { key: 'oeste', label: 'Oeste', icon: '←', data: lugar.oeste },
  ].filter((d) => d.data);

  return (
    <div className="nx-fade">
      <VolverHeader
        onVolver={goBack}
        crumbs={[...breadcrumbs, ...stackCrumbs, { label: lugar.nombre }]}
      />

      {/* fondo imagen del lugar */}
      <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginTop: 16, marginBottom: 24 }}>
        {lugarImagen && (
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url(${lugarImagen})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
            opacity: 0.24,
          }} />
        )}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(4,7,15,0.20) 0%, rgba(4,7,15,0.82) 100%)',
          pointerEvents: 'none',
        }} />

        {/* header info */}
        <div style={{ display: 'grid', gridTemplateColumns: lugarImagen ? '280px 1fr' : '1fr', gap: 20, position: 'relative', zIndex: 1, padding: 12 }}>
          {lugarImagen && (
            <div style={{ borderRadius: 12, overflow: 'hidden', height: 200, border: '1px solid var(--holo-line)' }}>
              <img src={lugarImagen} alt={lugar.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
          <div className="nx-panel solid" style={{ padding: '20px 24px' }}>
            <div className="nx-kicker" style={{ marginBottom: 4 }}>UBICACIÓN</div>
            <div className="nx-display" style={{ fontSize: 22, color: 'var(--txt)', marginBottom: 8 }}>{lugar.nombre}</div>
            {lugar.rareza && <Chip style={{ color: rarezaColor(lugar.rareza), marginBottom: 10 }}>{lugar.rareza}</Chip>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: lugar.historia ? 10 : 0 }}>
              {lugar.tipo && <Chip tone="dim">{lugar.tipo === 'interior' ? 'Interior' : 'Exterior'}</Chip>}
              {lugar.pase ? <Chip tone="warning">Pase #{lugar.pase}</Chip> : null}
            </div>
            {lugar.historia && (
              <p style={{ fontSize: 13, color: 'var(--txt-dim)', lineHeight: 1.6, margin: 0 }}>{lugar.historia}</p>
            )}
          </div>
        </div>
      </div>

      {/* presentes en este lugar */}
      {(lugar.presentes_personajes ?? []).length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div className="nx-kicker" style={{ marginBottom: 8 }}>PRESENTES AQUÍ</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {lugar.presentes_personajes.map((p) => {
              const color = SABER_COLORS[p.saber_color] ?? '#38cdf0';
              const photoUrl = mediaUrl(p.photo);
              const isMe = p.user_id === myUserId;
              return (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: `${color}11`, border: `1px solid ${color}33`,
                  borderRadius: 8, padding: '5px 10px',
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                    backgroundImage: photoUrl ? `url(${photoUrl})` : undefined,
                    backgroundSize: 'cover', backgroundPosition: 'center',
                    background: photoUrl ? undefined : color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 800, color: '#fff', textTransform: 'uppercase',
                  }}>
                    {!photoUrl && (p.handle?.[0] ?? '?')}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--txt-dim)', fontFamily: 'var(--font-data)', flex: 1 }}>
                    @{p.handle}
                  </span>
                  {!isMe && (
                    <button onClick={() => onAttack?.(p)} style={{
                      background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)',
                      borderRadius: 5, padding: '3px 7px', cursor: 'pointer', color: '#ef4444',
                      fontSize: 9, fontFamily: 'var(--font-data)', letterSpacing: '0.06em',
                    }}>ATK</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* accesos interiores — árbol de recorridos */}
      {DIRS.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div className="nx-kicker" style={{ marginBottom: 10 }}>ACCESOS — {DIRS.length}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
            {DIRS.map(({ key, label, icon, data }) => (
              <button key={key} onClick={() => navigateTo(data)}
                style={{
                  background: 'rgba(56,205,240,0.05)',
                  border: '1px solid rgba(56,205,240,0.22)',
                  borderRadius: 10, padding: '12px 14px',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.2s', color: 'var(--txt)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(56,205,240,0.13)';
                  e.currentTarget.style.borderColor = 'var(--holo)';
                  e.currentTarget.style.boxShadow = '0 0 16px -4px var(--holo)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(56,205,240,0.05)';
                  e.currentTarget.style.borderColor = 'rgba(56,205,240,0.22)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: 8, flexShrink: 0,
                  background: 'rgba(56,205,240,0.10)',
                  border: '1px solid rgba(56,205,240,0.30)',
                  display: 'grid', placeItems: 'center',
                  fontSize: 18, color: 'var(--holo)',
                }}>
                  {icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 9, color: 'var(--holo)', fontFamily: 'var(--font-data)', letterSpacing: '0.12em', marginBottom: 2 }}>
                    {label.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {data.nombre}
                  </div>
                </div>
                <Icon name="arrow" size={12} style={{ color: 'var(--holo)', opacity: 0.6, flexShrink: 0 }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* NPCs */}
      <div className="nx-kicker" style={{ marginBottom: 12 }}>PERSONAJES EN ESTE LUGAR — {npcs.length}</div>

      {npcs.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--txt-faint)', fontSize: 13 }}>
          No hay personajes en esta ubicación
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        {npcs.map((npc) => (
          <NpcCard key={npc.id} npc={npc} onClick={() => onSelectNpc(npc)} />
        ))}
      </div>
    </div>
  );
}

/* ─── CARD NPC ──────────────────────────────────────────── */
function NpcCard({ npc, onClick }) {
  const npcImagen = mediaUrl(npc.imagen);
  const npcMiniImagen = mediaUrl(npc.imagen_mini);
  return (
    <button onClick={onClick}
      style={{
        background: 'rgba(12,30,64,0.55)', border: '1px solid var(--holo-line)',
        borderRadius: 'var(--radius-lg)', padding: 0, cursor: 'pointer',
        textAlign: 'left', overflow: 'hidden', transition: 'all 0.2s',
        display: 'flex', flexDirection: 'column', color: 'var(--txt)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.border = '1px solid var(--holo)';
        e.currentTarget.style.boxShadow = '0 0 20px -6px var(--holo)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.border = '1px solid var(--holo-line)';
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'none';
      }}
    >
      {/* retrato */}
      <div style={{
        height: 140, position: 'relative',
        background: npcImagen
          ? `url(${npcImagen}) center top/cover`
          : 'linear-gradient(160deg, rgba(56,205,240,0.12), rgba(4,7,15,0.9))',
      }}>
        {!npcImagen && npcMiniImagen && (
          <img src={npcMiniImagen} alt={npc.nombre} style={{
            width: '100%', height: '100%', objectFit: 'cover',
          }} />
        )}
        {!npcImagen && !npcMiniImagen && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', opacity: 0.3 }}>
            <Icon name="user" size={44} style={{ color: 'var(--holo)' }} />
          </div>
        )}
        {npc.MisionID && (
          <div style={{
            position: 'absolute', top: 8, right: 8, zIndex: 2,
            width: 22, height: 22, borderRadius: '50%',
            background: 'rgba(230,179,37,0.92)',
            boxShadow: '0 0 10px 2px rgba(230,179,37,0.55)',
            display: 'grid', placeItems: 'center',
            fontSize: 13, fontWeight: 900, color: '#1a1000',
            fontFamily: 'var(--font-data)',
            animation: 'nx-pulse 2s ease-in-out infinite',
          }}>!</div>
        )}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(transparent, rgba(4,7,15,0.95))',
          padding: '20px 12px 10px',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>{npc.nombre}</div>
          {npc.profesion && (
            <div style={{ fontSize: 10, color: 'var(--holo)', fontFamily: 'var(--font-data)', letterSpacing: '0.08em' }}>
              {npc.profesion}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '10px 12px', flex: 1 }}>
        {npc.faccion && (
          <div style={{ marginBottom: 6 }}>
            <Chip tone="dim" icon="shield">{npc.faccion}</Chip>
          </div>
        )}
        {npc.saludo && (
          <p style={{
            fontSize: 11, color: 'var(--txt-dim)', lineHeight: 1.5, margin: 0,
            fontStyle: 'italic',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            "{npc.saludo}"
          </p>
        )}
      </div>

      <div style={{
        padding: '8px 12px', borderTop: '1px solid var(--holo-line)',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <Icon name="zap" size={12} style={{ color: 'var(--pompeyo-naranja)' }} />
        <span style={{ fontSize: 10, color: 'var(--pompeyo-naranja)', fontFamily: 'var(--font-data)', letterSpacing: '0.1em' }}>
          HABLAR
        </span>
        {npc.MisionID && (
          <>
            <span style={{ marginLeft: 'auto' }} />
            <Icon name="star" size={11} style={{ color: 'var(--pompeyo-oro)' }} />
            <span style={{ fontSize: 9, color: 'var(--pompeyo-oro)', fontFamily: 'var(--font-data)' }}>MISIÓN</span>
          </>
        )}
      </div>
    </button>
  );
}

/* ─── STATS DE COMBATE DEL JUGADOR ─────────────────────── */
function getPlayerCombatStats(character) {
  const s = character?.stats ?? {};
  const f = s.fuerza    ?? 50;
  const v = s.velocidad ?? 50;
  const t = s.tecnica   ?? 50;
  const d = s.defensa   ?? 50;
  const k = s.foco      ?? 50;
  return {
    vida:       character?.vida       ?? (30 + Math.round(f * 1.5)),
    escudo:     character?.escudo     ?? (10 + Math.round(t * 0.4)),
    ataque:     character?.ataque     ?? Math.round(f * 0.8),
    defensa:    character?.defensa    ?? Math.round(d * 0.8),
    movimiento: character?.movimiento ?? Math.round(v * 0.8),
    iniciativa: character?.iniciativa ?? Math.round((v + k) / 2 * 0.5),
    punteria:   character?.punteria   ?? Math.round((t + k) / 2 * 0.5),
    nombre:     character?.name ?? 'Tú',
    photo:      character?.photo_url ?? null,
  };
}

function postReputation(delta) {
  const token = localStorage.getItem('nx-token');
  fetch('/api/character/reputation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, Accept: 'application/json' },
    body: JSON.stringify({ delta }),
  }).catch(() => {});
}

/* ─── BARRA HP + ESCUDO ─────────────────────────────────── */
function CombatHPBar({ vida, maxVida, escudo, maxEscudo, nombre, photoUrl, align = 'left' }) {
  const vidaPct   = maxVida   > 0 ? Math.max(0, Math.min(100, (vida   / maxVida)   * 100)) : 0;
  const escudoPct = maxEscudo > 0 ? Math.max(0, Math.min(100, (escudo / maxEscudo) * 100)) : 0;
  const vidaColor = vidaPct > 50 ? '#10b981' : vidaPct > 25 ? '#E6B325' : '#ff2d45';
  return (
    <div style={{ display: 'flex', flexDirection: align === 'right' ? 'row-reverse' : 'row', alignItems: 'center', gap: 14 }}>
      <div style={{
        width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
        backgroundImage: photoUrl ? `url(${photoUrl})` : undefined,
        backgroundSize: 'cover', backgroundPosition: 'center',
        background: photoUrl ? undefined : 'rgba(56,205,240,0.15)',
        border: '2px solid var(--holo-line)', display: 'grid', placeItems: 'center',
      }}>
        {!photoUrl && <Icon name="user" size={20} style={{ color: 'var(--holo)', opacity: 0.5 }} />}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-data)', fontWeight: 700, color: 'var(--txt)', marginBottom: 6, textAlign: align }}>
          {nombre}
        </div>
        {maxEscudo > 0 && (
          <div style={{ marginBottom: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontSize: 8, color: '#38cdf0', fontFamily: 'var(--font-data)', letterSpacing: '0.1em' }}>ESCUDO</span>
              <span style={{ fontSize: 8, color: '#38cdf0', fontFamily: 'var(--font-data)' }}>{escudo}/{maxEscudo}</span>
            </div>
            <div style={{ height: 4, background: 'rgba(56,205,240,0.12)', borderRadius: 2 }}>
              <div style={{ height: '100%', width: `${escudoPct}%`, background: '#38cdf0', borderRadius: 2, transition: 'width 0.45s ease', boxShadow: '0 0 6px #38cdf055' }} />
            </div>
          </div>
        )}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ fontSize: 8, color: vidaColor, fontFamily: 'var(--font-data)', letterSpacing: '0.1em' }}>VIDA</span>
            <span style={{ fontSize: 8, color: vidaColor, fontFamily: 'var(--font-data)' }}>{vida}/{maxVida}</span>
          </div>
          <div style={{ height: 9, background: 'rgba(16,185,129,0.12)', borderRadius: 5 }}>
            <div style={{ height: '100%', width: `${vidaPct}%`, background: vidaColor, borderRadius: 5, transition: 'width 0.45s ease', boxShadow: `0 0 8px ${vidaColor}55` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── COMBATE POR TURNOS ─────────────────────────────────── */
function NpcCombatScreen({ npc, player, lugarImagen, onVictory, onDefeat, onFlee }) {
  const d6 = () => Math.floor(Math.random() * 6) + 1;

  const maxPlayer = { vida: player.vida, escudo: player.escudo };
  const maxNpc    = { vida: Math.max(npc.vida, 1), escudo: npc.escudo ?? 0 };

  const npcAtk = Math.max(npc.ataque,     1);
  const npcDef = Math.max(npc.defensa,    1);
  const npcMov = Math.max(npc.movimiento, 1);
  const npcIni = Math.max(npc.iniciativa, 1);
  const npcPnt = npc.punteria ?? 0;

  const [playerHp,     setPlayerHp]     = useState({ vida: maxPlayer.vida, escudo: maxPlayer.escudo });
  const [npcHp,        setNpcHp]        = useState({ vida: maxNpc.vida,    escudo: maxNpc.escudo    });
  const [phase,        setPhase]        = useState('initiative');
  const [currTurn,     setCurrTurn]     = useState(null);
  const [log,          setLog]          = useState([]);
  const [npcBusy,      setNpcBusy]      = useState(false);
  const [logCollapsed, setLogCollapsed] = useState(false);
  const [defBonus,     setDefBonus]     = useState(0);
  const [bgImg,        setBgImg]        = useState(lugarImagen ?? null);
  const logRef = useRef(null);

  /* Carga la imagen del lugar desde el LugarID del NPC */
  useEffect(() => {
    if (bgImg || !npc.LugarID) return;
    const token = localStorage.getItem('nx-token');
    fetch(`/api/map/lugares/${npc.LugarID}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
      .then(r => r.json())
      .then(d => { if (d.lugar?.imagen) setBgImg(mediaUrl(d.lugar.imagen)); })
      .catch(() => {});
  }, []);

  const applyDmg = (dmg, hp) => {
    const newEsc = Math.max(0, hp.escudo - dmg);
    const rem    = dmg - hp.escudo;
    return { escudo: newEsc, vida: rem > 0 ? Math.max(0, hp.vida - rem) : hp.vida };
  };

  /* Iniciativa */
  useEffect(() => {
    const pR = d6(); const nR = d6();
    const pT = pR + player.iniciativa; const nT = nR + npcIni;
    const first = pT >= nT ? 'player' : 'npc';
    setTimeout(() => {
      setLog([
        { text: '⚔ ¡COMBATE INICIADO!', type: 'system', id: 0 },
        { text: `Iniciativa — Tú: 1d6(${pR})+${player.iniciativa}=${pT} | ${npc.nombre}: 1d6(${nR})+${npcIni}=${nT}`, type: 'info', id: 1 },
        { text: first === 'player' ? '¡Atacas primero!' : `¡${npc.nombre} actúa primero!`, type: first === 'player' ? 'success' : 'danger', id: 2 },
      ]);
      setPhase('battle');
      setCurrTurn(first);
    }, 500);
  }, []);

  /* Turno del NPC */
  /* Turno NPC */
  useEffect(() => {
    if (currTurn !== 'npc' || phase !== 'battle') return;
    setNpcBusy(true);
    const t = setTimeout(() => {
      const useRanged = npcPnt > 0 && Math.random() > 0.5;
      let entries = [];
      let newHp;
      const curDef = player.defensa + defBonus;
      if (useRanged) {
        const [aR, dR] = [d6(), d6()];
        const [aT, dT] = [aR + npcPnt, dR + player.movimiento];
        entries = [
          { text: `${npc.nombre} dispara: 1d6(${aR})+${npcPnt}=${aT}`, type: 'info' },
          { text: `Esquivas: 1d6(${dR})+${player.movimiento}=${dT}`, type: 'info' },
        ];
        newHp = aT > dT ? applyDmg(npcAtk, playerHp) : { ...playerHp };
        entries.push(aT > dT ? { text: `¡Te impactan! −${npcAtk} daño`, type: 'danger' } : { text: '¡Esquivas!', type: 'success' });
      } else {
        const [aR, dR] = [d6(), d6()];
        const [aT, dT] = [aR + npcAtk, dR + curDef];
        entries = [
          { text: `${npc.nombre} ataca: 1d6(${aR})+${npcAtk}=${aT}`, type: 'info' },
          { text: `Defiendes: 1d6(${dR})+${curDef}=${dT}${defBonus > 0 ? ` (+${defBonus} postura)` : ''}`, type: 'info' },
        ];
        newHp = aT > dT ? applyDmg(npcAtk, playerHp) : { ...playerHp };
        entries.push(aT > dT ? { text: `¡Golpe! −${npcAtk} daño`, type: 'danger' } : { text: 'Bloqueas el ataque', type: 'success' });
      }
      setDefBonus(0);
      setLog(prev => [...prev, ...entries.map((e, i) => ({ ...e, id: prev.length + i }))]);
      setPlayerHp(newHp);
      setNpcBusy(false);
      if (newHp.vida <= 0) {
        setLog(prev => [...prev, { text: '☠ Has sido derrotado.', type: 'danger', id: prev.length }]);
        setPhase('defeat');
      } else {
        setCurrTurn('player');
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [currTurn, phase, defBonus]);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log]);

  /* Acciones del jugador */
  const doPlayerAttack = (label, atkVal, defVal, dmg) => {
    const [aR, dR] = [d6(), d6()];
    const [aT, dT] = [aR + atkVal, dR + defVal];
    const hit = aT > dT;
    const newNpcHp = hit ? applyDmg(dmg, npcHp) : { ...npcHp };
    const entries = [
      { text: `${label}: 1d6(${aR})+${atkVal}=${aT} vs 1d6(${dR})+${defVal}=${dT}`, type: 'info' },
      hit ? { text: `¡Impacto! −${dmg} daño`, type: 'success' } : { text: 'Bloqueado / Falla', type: 'miss' },
    ];
    setLog(prev => [...prev, ...entries.map((e, i) => ({ ...e, id: prev.length + i }))]);
    setNpcHp(newNpcHp);
    if (newNpcHp.vida <= 0) {
      setLog(prev => [...prev, { text: `⚡ ¡${npc.nombre} derrotado!`, type: 'success', id: prev.length }]);
      setPhase('victory');
    } else {
      setCurrTurn('npc');
    }
  };

  const isPlayerTurn = currTurn === 'player' && phase === 'battle' && !npcBusy;

  /* Habilidades del jugador */
  const SKILLS = [
    { id: 'melee',   icon: '⚔', name: 'Melee',         desc: `ATQ ${player.ataque}`,     fn: () => doPlayerAttack('Melee',   player.ataque,   npcDef, player.ataque) },
    { id: 'ranged',  icon: '◎', name: 'Distancia',      desc: `PNT ${player.punteria}`,   fn: () => doPlayerAttack('Distancia', player.punteria, npcMov, player.ataque), disabled: player.punteria <= 0 },
    { id: 'postura', icon: '🛡', name: 'Postura',        desc: '+4 DEF 1 turno',          fn: () => { setDefBonus(4); setLog(prev => [...prev, { text: 'Postura defensiva — +4 DEF este turno', type: 'info', id: prev.length }]); setCurrTurn('npc'); } },
    { id: 'potente', icon: '⚡', name: 'Golpe Potente',  desc: `ATQ ×1.5`,                fn: () => doPlayerAttack('Golpe potente', player.ataque, npcDef, Math.ceil(player.ataque * 1.5)) },
  ];

  /* Visual helpers */
  const pct  = (v, m) => m > 0 ? Math.max(0, Math.min(100, (v / m) * 100)) : 0;
  const vcol = (p) => p > 50 ? '#10b981' : p > 25 ? '#E6B325' : '#ff2d45';
  const LOG_C = { info: 'rgba(200,225,255,0.78)', success: '#10b981', danger: '#ff6b6b', miss: 'rgba(150,180,220,0.5)', system: '#38cdf0' };

  const npcBadges = [
    { l: 'ATQ', v: npcAtk, c: '#ff7043' }, { l: 'DEF', v: npcDef, c: '#38cdf0' },
    { l: 'MOV', v: npcMov, c: '#a78bfa' }, { l: 'INI', v: npcIni, c: '#E6B325' },
    ...(npcPnt > 0 ? [{ l: 'PNT', v: npcPnt, c: '#10b981' }] : []),
  ];
  const playerBadges = [
    { l: 'ATQ', v: player.ataque,           c: '#ff7043' },
    { l: 'DEF', v: player.defensa + defBonus, c: '#38cdf0', bonus: defBonus > 0 },
    { l: 'MOV', v: player.movimiento,       c: '#a78bfa' },
    { l: 'INI', v: player.iniciativa,       c: '#E6B325' },
    ...(player.punteria > 0 ? [{ l: 'PNT', v: player.punteria, c: '#10b981' }] : []),
  ];

  /* Sub-component HUD */
  const HUD = ({ hp, maxHp, escudo, maxEscudo, photoUrl, nombre, borderColor, badges, align }) => {
    const vPct = pct(hp, maxHp);
    const ePct = pct(escudo, maxEscudo);
    const vc   = vcol(vPct);
    const rev  = align === 'right';
    return (
      <div style={{
        background: 'rgba(6,12,26,0.92)', backdropFilter: 'blur(16px)',
        border: `1px solid ${borderColor}`, borderRadius: 14,
        padding: 14, display: 'flex', flexDirection: rev ? 'row-reverse' : 'row',
        gap: 14, alignItems: 'flex-start', minWidth: 260,
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
          border: `2px solid ${borderColor}`, background: 'rgba(255,255,255,0.06)', display: 'grid', placeItems: 'center',
        }}>
          {photoUrl
            ? <img src={photoUrl} alt={nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Icon name="user" size={26} style={{ color: 'var(--holo)', opacity: 0.5 }} />
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8, textAlign: rev ? 'right' : 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombre}</div>
          {maxEscudo > 0 && (
            <div style={{ marginBottom: 5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 8, color: '#38cdf0', fontFamily: 'var(--font-data)' }}>ESC</span>
                <span style={{ fontSize: 8, color: '#38cdf0', fontFamily: 'var(--font-data)' }}>{escudo}/{maxEscudo}</span>
              </div>
              <div style={{ height: 4, background: 'rgba(56,205,240,0.12)', borderRadius: 2 }}>
                <div style={{ height: '100%', width: `${ePct}%`, background: '#38cdf0', borderRadius: 2, transition: 'width 0.4s ease' }} />
              </div>
            </div>
          )}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontSize: 8, color: vc, fontFamily: 'var(--font-data)' }}>VID</span>
              <span style={{ fontSize: 8, color: vc, fontFamily: 'var(--font-data)' }}>{hp}/{maxHp}</span>
            </div>
            <div style={{ height: 9, background: 'rgba(16,185,129,0.12)', borderRadius: 5 }}>
              <div style={{ height: '100%', width: `${vPct}%`, background: vc, borderRadius: 5, transition: 'width 0.4s ease' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: rev ? 'flex-end' : 'flex-start' }}>
            {badges.map(b => (
              <span key={b.l} style={{
                fontSize: 9, fontFamily: 'var(--font-data)', padding: '2px 6px', borderRadius: 4,
                background: `${b.c}14`, border: `1px solid ${b.c}45`, color: b.c,
                ...(b.bonus ? { boxShadow: `0 0 8px ${b.c}55`, fontWeight: 700 } : {}),
              }}>{b.l} {b.v}{b.bonus ? ' ▲' : ''}</span>
            ))}
          </div>
        </div>
      </div>
    );
  };

  /* ── helpers para botones de acción ── */
  const ActionBtn = ({ onClick, disabled, bg, border, hoverBg, hoverBorder, children, minW = 56 }) => (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} style={{
      minWidth: minW, borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
      background: bg, border: `1px solid ${border}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 3, padding: '6px 8px', opacity: disabled ? 0.35 : 1, transition: 'all 0.14s', flexShrink: 0,
    }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = hoverBg; e.currentTarget.style.borderColor = hoverBorder; } }}
      onMouseLeave={e => { e.currentTarget.style.background = bg; e.currentTarget.style.borderColor = border; }}
    >{children}</button>
  );

  return (
    /* Outer overlay — centra el modal */
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1300,
      background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '12px',
    }}>
      {/* Modal compacto */}
      <div style={{
        position: 'relative',
        width: '100%', maxWidth: 900,
        height: '100%', maxHeight: 640,
        borderRadius: 18,
        overflow: 'hidden',
        boxShadow: '0 0 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(56,205,240,0.18)',
      }}>
        {/* Fondo: imagen del lugar (via LugarID del NPC) */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: bgImg ? `url(${bgImg})` : undefined,
          background: bgImg ? undefined : 'radial-gradient(ellipse at 50% 30%, #0c1e42, #020810)',
          backgroundSize: 'cover', backgroundPosition: 'center',
        }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(2,6,16,0.72)' }} />

        {/* NPC HUD — arriba derecha */}
        <div style={{
          position: 'absolute', top: 14, right: 14, zIndex: 10,
          width: 'clamp(190px, 36%, 260px)',
        }}>
          <HUD
            hp={npcHp.vida} maxHp={maxNpc.vida} escudo={npcHp.escudo} maxEscudo={maxNpc.escudo}
            nombre={npc.nombre} photoUrl={mediaUrl(npc.imagen_mini) || mediaUrl(npc.imagen)}
            borderColor="rgba(255,45,69,0.40)" badges={npcBadges} align="left"
          />
        </div>

        {/* Jugador HUD — abajo izquierda, sobre la action bar */}
        <div style={{
          position: 'absolute', bottom: 82, left: 14, zIndex: 10,
          width: 'clamp(190px, 36%, 260px)',
        }}>
          <HUD
            hp={playerHp.vida} maxHp={maxPlayer.vida} escudo={playerHp.escudo} maxEscudo={maxPlayer.escudo}
            nombre={player.nombre} photoUrl={player.photo}
            borderColor="rgba(56,205,240,0.30)" badges={playerBadges} align="right"
          />
        </div>

        {/* Log de combate — izquierda, colapsable */}
        <div style={{
          position: 'absolute', left: 14, top: 14, zIndex: 10,
          width: logCollapsed ? 40 : 'clamp(150px, 26%, 240px)',
          maxHeight: 'calc(100% - 250px)',
          background: 'rgba(4,9,20,0.88)', backdropFilter: 'blur(12px)',
          borderRadius: 10, border: '1px solid rgba(56,205,240,0.14)',
          display: 'flex', flexDirection: 'column',
          transition: 'width 0.20s ease', overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 9px',
            cursor: 'pointer', userSelect: 'none', flexShrink: 0,
            borderBottom: logCollapsed ? 'none' : '1px solid rgba(56,205,240,0.10)',
          }} onClick={() => setLogCollapsed(p => !p)}>
            <span style={{ fontSize: 14, flexShrink: 0, lineHeight: 1 }}>📋</span>
            {!logCollapsed && (
              <span style={{ fontSize: 7, color: 'rgba(150,200,255,0.5)', fontFamily: 'var(--font-data)', letterSpacing: '0.16em', flex: 1, whiteSpace: 'nowrap' }}>
                REGISTRO
              </span>
            )}
            <span style={{ fontSize: 11, color: 'rgba(150,200,255,0.4)', flexShrink: 0 }}>{logCollapsed ? '›' : '‹'}</span>
          </div>
          {!logCollapsed && (
            <div ref={logRef} style={{ overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
              {log.map(e => (
                <div key={e.id} style={{
                  fontSize: 10, color: LOG_C[e.type] ?? 'rgba(200,225,255,0.75)',
                  fontFamily: 'var(--font-data)', letterSpacing: '0.03em', lineHeight: 1.45,
                  borderLeft: e.type === 'system' ? '2px solid #38cdf0' : 'none',
                  paddingLeft: e.type === 'system' ? 6 : 0,
                  animation: 'nx-fade-up 0.2s ease both',
                }}>{e.text}</div>
              ))}
              {npcBusy && (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 3 }}>
                  <span style={{ fontSize: 9, color: '#ff9999', fontFamily: 'var(--font-data)' }}>{npc.nombre}…</span>
                  {[0,1,2].map(i => <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: '#ff9999', animation: `nx-pulse 0.8s ${i*0.2}s infinite` }} />)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Barra de acciones — fija al fondo del modal */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
          background: 'rgba(3,7,16,0.96)', backdropFilter: 'blur(16px)',
          borderTop: '1px solid rgba(56,205,240,0.13)',
          padding: '8px 12px', display: 'flex', gap: 6, alignItems: 'stretch',
          minHeight: 76,
        }}>
          {(phase === 'initiative') && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'rgba(150,200,255,0.4)', fontSize: 11, fontFamily: 'var(--font-data)', letterSpacing: '0.15em' }}>CALCULANDO INICIATIVA…</span>
            </div>
          )}
          {phase === 'victory' && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
              <span style={{ fontSize: 16, color: '#10b981', fontFamily: 'var(--font-data)', letterSpacing: '0.14em' }}>⚡ VICTORIA</span>
              <button onClick={onVictory} style={{ padding: '8px 22px', borderRadius: 7, cursor: 'pointer', background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.5)', color: '#10b981', fontFamily: 'var(--font-data)', fontSize: 10, letterSpacing: '0.14em' }}>CONTINUAR →</button>
            </div>
          )}
          {phase === 'defeat' && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
              <span style={{ fontSize: 16, color: '#ff6b6b', fontFamily: 'var(--font-data)', letterSpacing: '0.14em' }}>☠ DERROTA</span>
              <button onClick={onDefeat} style={{ padding: '8px 22px', borderRadius: 7, cursor: 'pointer', background: 'rgba(255,45,69,0.14)', border: '1px solid rgba(255,45,69,0.45)', color: '#ff6b6b', fontFamily: 'var(--font-data)', fontSize: 10, letterSpacing: '0.14em' }}>RETIRARSE</button>
            </div>
          )}
          {phase === 'battle' && (
            <>
              {/* 4 habilidades */}
              {SKILLS.map(sk => {
                const active = isPlayerTurn && !sk.disabled;
                return (
                  <button key={sk.id} onClick={() => active && sk.fn()} disabled={!active} style={{
                    flex: 1, minWidth: 0, borderRadius: 8, cursor: active ? 'pointer' : 'not-allowed',
                    background: active ? 'rgba(56,205,240,0.08)' : 'rgba(56,205,240,0.03)',
                    border: `1px solid ${active ? 'rgba(56,205,240,0.26)' : 'rgba(56,205,240,0.09)'}`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 3, padding: '6px 4px', opacity: active ? 1 : 0.36, transition: 'all 0.13s',
                  }}
                    onMouseEnter={e => { if (active) { e.currentTarget.style.background = 'rgba(56,205,240,0.16)'; e.currentTarget.style.borderColor = 'rgba(56,205,240,0.48)'; e.currentTarget.style.boxShadow = '0 0 14px -5px rgba(56,205,240,0.4)'; } }}
                    onMouseLeave={e => { e.currentTarget.style.background = active ? 'rgba(56,205,240,0.08)' : 'rgba(56,205,240,0.03)'; e.currentTarget.style.borderColor = active ? 'rgba(56,205,240,0.26)' : 'rgba(56,205,240,0.09)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <span style={{ fontSize: 18, lineHeight: 1 }}>{sk.icon}</span>
                    <span style={{ fontSize: 9, color: 'var(--txt)', fontFamily: 'var(--font-data)', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{sk.name}</span>
                    <span style={{ fontSize: 7, color: 'var(--txt-faint)', fontFamily: 'var(--font-data)' }}>{sk.desc}</span>
                  </button>
                );
              })}

              <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', flexShrink: 0, alignSelf: 'stretch', margin: '4px 0' }} />

              {/* Usar ítem */}
              <ActionBtn disabled bg="rgba(255,255,255,0.04)" border="rgba(255,255,255,0.09)" hoverBg="" hoverBorder="" minW={52}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>🎒</span>
                <span style={{ fontSize: 8, color: 'var(--txt-dim)', fontFamily: 'var(--font-data)' }}>ÍTEM</span>
              </ActionBtn>

              {/* Desarmado */}
              <ActionBtn onClick={() => doPlayerAttack('Desarmado', 2, npcDef, 3)} disabled={!isPlayerTurn}
                bg={isPlayerTurn ? 'rgba(230,179,37,0.08)' : 'rgba(230,179,37,0.03)'}
                border={isPlayerTurn ? 'rgba(230,179,37,0.28)' : 'rgba(230,179,37,0.09)'}
                hoverBg="rgba(230,179,37,0.18)" hoverBorder="rgba(230,179,37,0.5)" minW={60}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>👊</span>
                <span style={{ fontSize: 8, color: '#E6B325', fontFamily: 'var(--font-data)', opacity: isPlayerTurn ? 1 : 0.5 }}>DESARMADO</span>
              </ActionBtn>

              {/* Huir */}
              <ActionBtn onClick={() => { setPhase('fled'); onFlee?.(); }}
                bg="rgba(255,45,69,0.07)" border="rgba(255,45,69,0.22)"
                hoverBg="rgba(255,45,69,0.18)" hoverBorder="rgba(255,45,69,0.5)" minW={50}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>🏃</span>
                <span style={{ fontSize: 8, color: '#ff6b6b', fontFamily: 'var(--font-data)' }}>HUIR</span>
              </ActionBtn>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── SISTEMA DE DIÁLOGO RPG ────────────────────────────── */
function DialogoRPG({ npc, userCharacter, lugarImagen, onClose }) {
  const isAI = Boolean(npc.prompt);
  const [messages, setMessages]   = useState([]);
  const [phase, setPhase]         = useState('greeting');
  const [typing, setTyping]       = useState(false);
  const [aiInput, setAiInput]     = useState('');
  const [remaining, setRemaining] = useState(null);
  const bottomRef                 = useRef(null);
  const [combat, setCombat]       = useState(false);

  const npcTipo  = (npc.tipo ?? '').toLowerCase();
  const isAliado = npcTipo === 'aliado';
  const isHostil = npcTipo === 'hostil';
  const isNeutral = !isAliado && !isHostil;

  const startCombat = useCallback(() => setCombat(true), []);

  const attackNeutral = useCallback(() => {
    postReputation(-50);
    toast('−50 reputación por atacar a un neutral', { tone: 'error', icon: 'shield' });
    setCombat(true);
  }, []);

  const checkHostileAttack = useCallback(() => {
    if (!isHostil) return;
    if (Math.floor(Math.random() * 6) + 1 >= 4) {
      setTimeout(() => {
        setMessages(prev => [...prev, { from: 'npc', text: `*${npc.nombre} adopta una postura amenazante y ataca*`, ts: Date.now() }]);
        setTimeout(() => setCombat(true), 900);
      }, 1100);
    }
  }, [isHostil, npc.nombre]);

  /* Parsea "- keyword[misionId]: respuesta" o "- keyword: respuesta" */
  const npcOptions = useMemo(() => {
    if (!npc.interaccion) return [];
    return npc.interaccion.split('\n')
      .filter(l => l.trim().startsWith('-'))
      .map(l => {
        const clean = l.replace(/^-\s*/, '').trim();
        const match = clean.match(/^(.*?)(?:\[(\d+)\])?\s*:\s*(.*)$/);
        if (!match) return null;
        return {
          keyword:  match[1].trim(),
          misionId: match[2] ? parseInt(match[2]) : null,
          response: match[3].trim(),
        };
      })
      .filter(Boolean)
      .slice(0, 4);
  }, [npc.interaccion]);

  useEffect(() => {
    if (isAI) return;
    if (npc.saludo) {
      setTyping(true);
      setTimeout(() => {
        setMessages([{ from: 'npc', text: npc.saludo, ts: Date.now() }]);
        setTyping(false);
        if (npcOptions.length > 0) setPhase('dialog');
      }, 800);
    }
  }, []);

  useEffect(() => {
    if (!isAI) return;
    apiFetch(`/npcs/${npc.id}/chat/status`)
      .then(d => {
        setRemaining(d.remaining);
        const hist = d.history ?? [];
        if (hist.length > 0) {
          setMessages(hist.map(m => ({
            from: m.role === 'user' ? 'player' : 'npc',
            text: m.content,
            ts:   new Date(m.created_at).getTime(),
          })));
        }
        if (d.show_greeting && npc.saludo) {
          setTyping(true);
          setTimeout(() => {
            setMessages(prev => [...prev, { from: 'npc', text: npc.saludo, ts: Date.now() }]);
            setTyping(false);
          }, 800);
        }
      })
      .catch(() => setRemaining(15));
  }, []);

  const handleAiSend = useCallback(async () => {
    const msg = aiInput.trim();
    if (!msg || typing || remaining === 0) return;
    setAiInput('');
    setMessages(prev => [...prev, { from: 'player', text: msg, ts: Date.now() }]);
    setTyping(true);
    try {
      const token = localStorage.getItem('nx-token');
      const resp = await fetch(`/api/npcs/${npc.id}/chat`, {
        method: 'POST',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      const data = await resp.json();
      if (resp.status === 429) {
        setRemaining(0);
        toast('Límite alcanzado. Vuelve en 5 min.', { tone: 'error', icon: 'x' });
      } else if (!resp.ok) {
        toast('Error al contactar al NPC.', { tone: 'error', icon: 'x' });
      } else {
        setMessages(prev => [...prev, { from: 'npc', text: data.reply, ts: Date.now() }]);
        setRemaining(data.remaining);
        checkHostileAttack();
      }
    } catch {
      toast('Error de conexión.', { tone: 'error', icon: 'x' });
    } finally {
      setTyping(false);
    }
  }, [aiInput, typing, remaining, npc.id, checkHostileAttack]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const handleOption = useCallback(async (opt) => {
    setMessages(prev => [...prev, { from: 'player', text: opt.keyword, ts: Date.now() }]);
    setTyping(true);

    if (opt.misionId) {
      try {
        await apiPost(`/misiones/${opt.misionId}/accept`, {});
        toast('¡Misión aceptada!', { tone: 'success', icon: 'star' });
      } catch {
        toast('Error al aceptar la misión', { tone: 'error', icon: 'x' });
      }
    }

    setTimeout(() => {
      setMessages(prev => [...prev, { from: 'npc', text: opt.response, ts: Date.now() }]);
      setTyping(false);
      checkHostileAttack();
    }, 800);
  }, [checkHostileAttack]);

  const STATS = [
    { label: 'VID', val: npc.vida },
    { label: 'ESC', val: npc.escudo },
    { label: 'DEF', val: npc.defensa },
    { label: 'ATQ', val: npc.ataque },
    { label: 'MOV', val: npc.movimiento },
    { label: 'INI', val: npc.iniciativa },
    { label: 'PNT', val: npc.punteria },
  ].filter(s => s.val > 0);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1200,
      background: 'rgba(2,5,12,0.88)', backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column', alignItems: 'stretch',
      animation: 'nx-fade-up 0.3s ease both',
    }}>
      {/* barra superior — retrato del NPC */}
      <div style={{
        background: 'rgba(7,16,31,0.95)', borderBottom: '1px solid var(--holo-line)',
        padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
      }}>
        {/* retrato */}
        <div style={{
          width: 56, height: 56, borderRadius: 8, overflow: 'hidden',
          border: '2px solid var(--holo-line)', flexShrink: 0,
          background: 'rgba(56,205,240,0.08)', display: 'grid', placeItems: 'center',
        }}>
          {npc.imagen_mini || npc.imagen
            ? <img src={mediaUrl(npc.imagen_mini) || mediaUrl(npc.imagen)} alt={npc.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Icon name="user" size={24} style={{ color: 'var(--holo)', opacity: 0.5 }} />
          }
        </div>
        <div style={{ flex: 1 }}>
          <div className="nx-display" style={{ fontSize: 16, color: 'var(--txt)', marginBottom: 2 }}>{npc.nombre}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {npc.profesion && <span className="nx-kicker" style={{ fontSize: 9 }}>{npc.profesion}</span>}
            {npc.faccion   && <Chip tone="dim" icon="shield">{npc.faccion}</Chip>}
            {npc.tipo && (
              <span style={{
                fontSize: 9, fontFamily: 'var(--font-data)', letterSpacing: '0.14em',
                padding: '3px 8px', borderRadius: 4, fontWeight: 700,
                ...(isAliado
                  ? { background: 'rgba(16,185,129,0.14)', border: '1px solid rgba(16,185,129,0.35)', color: '#10b981' }
                  : isHostil
                  ? { background: 'rgba(255,45,69,0.14)', border: '1px solid rgba(255,45,69,0.35)', color: '#ff6b6b' }
                  : { background: 'rgba(230,179,37,0.14)', border: '1px solid rgba(230,179,37,0.35)', color: '#E6B325' }
                ),
              }}>
                {isAliado ? '▲ ALIADO' : isHostil ? '⚠ HOSTIL' : '◈ NEUTRAL'}
              </span>
            )}
          </div>
        </div>

        {/* stats combate */}
        {STATS.length > 0 && (
          <div style={{
            display: 'flex', gap: 10, padding: '6px 12px',
            background: 'rgba(4,7,15,0.5)', borderRadius: 8, border: '1px solid var(--holo-line)',
          }}>
            {STATS.map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div className="nx-num" style={{ fontSize: 14, color: s.label === 'ATQ' ? 'var(--pompeyo-naranja)' : s.label === 'VID' ? '#10b981' : 'var(--holo)' }}>
                  {s.val}
                </div>
                <div style={{ fontSize: 8, color: 'var(--txt-faint)', fontFamily: 'var(--font-data)', letterSpacing: '0.08em' }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {isAI && remaining !== null && (
          <div style={{
            flexShrink: 0, padding: '5px 10px',
            background: remaining === 0 ? 'rgba(255,100,100,0.10)' : 'rgba(56,205,240,0.07)',
            border: `1px solid ${remaining === 0 ? 'rgba(255,100,100,0.35)' : 'var(--holo-line)'}`,
            borderRadius: 6, textAlign: 'center',
          }}>
            <div className="nx-num" style={{ fontSize: 18, lineHeight: 1, color: remaining === 0 ? '#ff6b6b' : 'var(--holo)' }}>
              {remaining}
            </div>
            <div style={{ fontSize: 8, color: 'var(--txt-faint)', fontFamily: 'var(--font-data)', letterSpacing: '0.1em' }}>
              {remaining === 1 ? 'RESP.' : 'RESP.'}
            </div>
          </div>
        )}

        <button onClick={onClose} style={{
          background: 'transparent', border: '1px solid var(--holo-line)',
          borderRadius: 6, padding: 8, cursor: 'pointer', color: 'var(--txt-dim)',
          transition: 'all 0.15s', flexShrink: 0,
        }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--holo)'; e.currentTarget.style.color = 'var(--txt)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--holo-line)'; e.currentTarget.style.color = 'var(--txt-dim)'; }}
        >
          <Icon name="x" size={16} />
        </button>
      </div>

      {/* cuerpo: mensajes + barra lateral de opciones */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* área de mensajes */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '20px 24px',
          display: 'flex', flexDirection: 'column', gap: 14,
          backgroundImage: 'radial-gradient(ellipse at 60% 30%, rgba(0,71,186,0.08), transparent 60%)',
        }}>
          {messages.map((m, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: m.from === 'player' ? 'flex-end' : 'flex-start',
              animation: 'nx-fade-up 0.25s ease both',
            }}>
              <div style={{
                maxWidth: '72%', padding: '11px 15px', borderRadius: 12,
                fontSize: 13, lineHeight: 1.55,
                ...(m.from === 'npc' ? {
                  background: 'rgba(12,30,64,0.7)', border: '1px solid var(--holo-line)',
                  color: 'var(--txt)', borderBottomLeftRadius: 4,
                } : {
                  background: 'rgba(0,71,186,0.35)', border: '1px solid rgba(56,205,240,0.3)',
                  color: 'var(--txt)', borderBottomRightRadius: 4,
                }),
              }}>
                {m.from === 'npc' && (
                  <div style={{ fontSize: 9, color: 'var(--holo)', fontFamily: 'var(--font-data)', letterSpacing: '0.12em', marginBottom: 5 }}>
                    {npc.nombre.toUpperCase()}
                  </div>
                )}
                {m.text}
              </div>
            </div>
          ))}

          {typing && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', animation: 'nx-fade-up 0.2s ease' }}>
              <div style={{
                background: 'rgba(12,30,64,0.7)', border: '1px solid var(--holo-line)',
                borderRadius: '12px 12px 12px 4px', padding: '12px 16px',
                display: 'flex', gap: 5, alignItems: 'center',
              }}>
                {[0, 1, 2].map((d) => (
                  <div key={d} style={{
                    width: 6, height: 6, borderRadius: '50%', background: 'var(--holo)',
                    animation: `nx-pulse 1s ${d * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* panel lateral: modo AI o diálogo estático */}
        {isAI ? (
          <div style={{
            width: 230, flexShrink: 0,
            borderLeft: '1px solid var(--holo-line)',
            background: 'rgba(5,12,26,0.97)',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              padding: '10px 12px 8px',
              fontSize: 8, color: 'var(--txt-faint)', fontFamily: 'var(--font-data)',
              letterSpacing: '0.18em', textTransform: 'uppercase',
              borderBottom: '1px solid var(--holo-line)',
            }}>
              IA · {npc.nombre.toUpperCase()}
            </div>
            <div style={{ flex: 1 }} />
            {!isAliado && npc.ataque > 0 && (
              <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,45,69,0.15)' }}>
                <button onClick={isNeutral ? attackNeutral : startCombat} style={{
                  width: '100%', textAlign: 'left', background: 'rgba(255,45,69,0.08)',
                  border: '1px solid rgba(255,45,69,0.28)', borderRadius: 8, padding: '9px 11px',
                  cursor: 'pointer', fontSize: 12, color: '#ff6b6b',
                  display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,45,69,0.18)'; e.currentTarget.style.borderColor = '#ff2d45'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,45,69,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,45,69,0.28)'; }}
                >
                  <span style={{ width: 18, height: 18, borderRadius: 4, background: 'rgba(255,45,69,0.2)', display: 'grid', placeItems: 'center', fontSize: 10, flexShrink: 0 }}>⚔</span>
                  <span>ATACAR{isNeutral ? ' (−rep)' : ''}</span>
                </button>
              </div>
            )}
            <div style={{ padding: '12px 12px', borderTop: '1px solid var(--holo-line)' }}>
              {remaining === 0 ? (
                <div style={{
                  fontSize: 11, color: 'var(--txt-dim)', textAlign: 'center',
                  padding: '16px 8px', lineHeight: 1.6,
                }}>
                  Límite alcanzado.<br />
                  <span style={{ fontSize: 10, color: 'var(--txt-faint)' }}>Vuelve en 5 min.</span>
                </div>
              ) : (
                <>
                  <textarea
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAiSend(); } }}
                    disabled={typing}
                    placeholder={`Hablar con ${npc.nombre}…`}
                    rows={3}
                    style={{
                      width: '100%', resize: 'none', boxSizing: 'border-box',
                      background: 'rgba(56,205,240,0.05)', border: '1px solid var(--holo-line)',
                      borderRadius: 8, padding: '8px 10px', fontSize: 12,
                      color: 'var(--txt)', fontFamily: 'var(--font-body)',
                      outline: 'none', lineHeight: 1.45, opacity: typing ? 0.5 : 1,
                    }}
                  />
                  <button
                    onClick={handleAiSend}
                    disabled={typing || !aiInput.trim()}
                    style={{
                      marginTop: 6, width: '100%',
                      background: 'rgba(56,205,240,0.10)', border: '1px solid var(--holo-line)',
                      borderRadius: 8, padding: '8px', cursor: (typing || !aiInput.trim()) ? 'not-allowed' : 'pointer',
                      fontSize: 11, color: 'var(--holo)', fontFamily: 'var(--font-data)',
                      letterSpacing: '0.14em', textTransform: 'uppercase',
                      opacity: (typing || !aiInput.trim()) ? 0.4 : 1,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { if (!typing && aiInput.trim()) { e.currentTarget.style.background = 'rgba(56,205,240,0.20)'; e.currentTarget.style.borderColor = 'var(--holo)'; } }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(56,205,240,0.10)'; e.currentTarget.style.borderColor = 'var(--holo-line)'; }}
                  >
                    {typing ? 'PROCESANDO…' : 'ENVIAR · ENTER'}
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          npcOptions.length > 0 && phase === 'dialog' && (
            <div style={{
              width: 210, flexShrink: 0,
              borderLeft: '1px solid var(--holo-line)',
              background: 'rgba(5,12,26,0.96)',
              overflowY: 'auto',
              display: 'flex', flexDirection: 'column',
              padding: '16px 10px', gap: 6,
            }}>
              <div style={{
                fontSize: 8, color: 'var(--txt-faint)', fontFamily: 'var(--font-data)',
                letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6,
                paddingBottom: 8, borderBottom: '1px solid var(--holo-line)',
              }}>
                OPCIONES DE DIÁLOGO
              </div>
              {!isAliado && npc.ataque > 0 && (
                <button onClick={isNeutral ? attackNeutral : startCombat} style={{
                  width: '100%', textAlign: 'left', background: 'rgba(255,45,69,0.08)',
                  border: '1px solid rgba(255,45,69,0.28)', borderRadius: 8, padding: '9px 11px',
                  cursor: 'pointer', fontSize: 12, color: '#ff6b6b',
                  display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,45,69,0.18)'; e.currentTarget.style.borderColor = '#ff2d45'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,45,69,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,45,69,0.28)'; }}
                >
                  <span style={{ width: 18, height: 18, borderRadius: 4, background: 'rgba(255,45,69,0.2)', display: 'grid', placeItems: 'center', fontSize: 10, flexShrink: 0 }}>⚔</span>
                  <span>ATACAR{isNeutral ? ' (−rep)' : ''}</span>
                </button>
              )}
              {npcOptions.map((opt, i) => (
                <button key={i} onClick={() => handleOption(opt)} disabled={typing}
                  style={{
                    width: '100%', textAlign: 'left',
                    background: opt.misionId ? 'rgba(230,179,37,0.08)' : 'rgba(56,205,240,0.06)',
                    border: `1px solid ${opt.misionId ? 'rgba(230,179,37,0.30)' : 'rgba(56,205,240,0.18)'}`,
                    borderRadius: 8, padding: '9px 11px',
                    cursor: typing ? 'wait' : 'pointer',
                    fontSize: 12, color: 'var(--txt)', fontFamily: 'var(--font-body)',
                    transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 8,
                    opacity: typing ? 0.45 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (typing) return;
                    e.currentTarget.style.borderColor = opt.misionId ? '#E6B325' : 'var(--holo)';
                    e.currentTarget.style.background = opt.misionId ? 'rgba(230,179,37,0.18)' : 'rgba(56,205,240,0.14)';
                    e.currentTarget.style.boxShadow = opt.misionId ? '0 0 10px -3px rgba(230,179,37,0.4)' : '0 0 10px -3px rgba(56,205,240,0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = opt.misionId ? 'rgba(230,179,37,0.30)' : 'rgba(56,205,240,0.18)';
                    e.currentTarget.style.background = opt.misionId ? 'rgba(230,179,37,0.08)' : 'rgba(56,205,240,0.06)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <span style={{
                    flexShrink: 0, width: 18, height: 18, borderRadius: 4,
                    background: opt.misionId ? 'rgba(230,179,37,0.20)' : 'rgba(56,205,240,0.12)',
                    display: 'grid', placeItems: 'center',
                    fontSize: opt.misionId ? 11 : 10,
                    color: opt.misionId ? '#E6B325' : 'var(--holo)',
                    fontWeight: 900,
                  }}>
                    {opt.misionId ? '!' : '›'}
                  </span>
                  <span style={{ flex: 1, lineHeight: 1.35 }}>{opt.keyword}</span>
                </button>
              ))}
            </div>
          )
        )}

      </div>

      {combat && (
        <NpcCombatScreen
          npc={npc}
          player={getPlayerCombatStats(userCharacter)}
          lugarImagen={lugarImagen}
          onVictory={() => {
            if (isHostil) { postReputation(25); toast('+25 reputación', { tone: 'success', icon: 'star' }); }
            else          { postReputation(-50); toast('−50 reputación adicional', { tone: 'error', icon: 'shield' }); }
            setCombat(false);
            onClose();
          }}
          onDefeat={() => { setCombat(false); onClose(); }}
          onFlee={() => setCombat(false)}
        />
      )}
    </div>
  );
}

/* ─── COMPONENTES AUXILIARES ────────────────────────────── */
function LoadingHUD({ text }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 16 }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        border: '2px solid var(--holo)', borderTopColor: 'transparent',
        animation: 'spin 1s linear infinite',
      }} />
      <div className="nx-kicker" style={{ letterSpacing: '0.2em' }}>{text}</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function BreadcrumbNav({ crumbs }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {crumbs.filter(c => c.label).map((c, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {i > 0 && <Icon name="chevron" size={12} style={{ color: 'var(--txt-faint)', flexShrink: 0 }} />}
          <span style={{
            fontSize: 12, fontFamily: 'var(--font-data)', letterSpacing: '0.06em',
            color: i === crumbs.filter(c => c.label).length - 1 ? 'var(--txt)' : 'var(--txt-dim)',
          }}>
            {c.label}
          </span>
        </span>
      ))}
    </div>
  );
}

function InfoRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: 10, color: 'var(--txt-faint)', fontFamily: 'var(--font-data)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ fontSize: 10, color: color || 'var(--txt-dim)', fontFamily: 'var(--font-data)', fontWeight: 700 }}>
        {value}
      </span>
    </div>
  );
}

/* ─── PANEL PRESENTES ───────────────────────────────────── */
function PresentesPanel({ presentes = [], onChat, onAttack, myUserId }) {
  return (
    <div style={{
      width: 220, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      position: 'sticky', top: 0, alignSelf: 'flex-start',
    }}>
      <div className="nx-panel solid" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          padding: '10px 14px', borderBottom: '1px solid var(--holo-line)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Icon name="user" size={13} style={{ color: 'var(--holo)', opacity: 0.7 }} />
          <span className="nx-kicker" style={{ fontSize: 9, letterSpacing: '0.14em' }}>PRESENTES</span>
          {presentes.length > 0 && (
            <span style={{
              marginLeft: 'auto', fontSize: 9, fontFamily: 'var(--font-data)',
              color: 'var(--holo)', background: 'rgba(56,205,240,0.12)',
              border: '1px solid rgba(56,205,240,0.25)', borderRadius: 10,
              padding: '1px 7px',
            }}>{presentes.length}</span>
          )}
        </div>

        {presentes.length === 0 ? (
          <div style={{
            padding: '24px 14px', textAlign: 'center',
            color: 'var(--txt-faint)', fontSize: 11,
            fontFamily: 'var(--font-data)', lineHeight: 1.6,
          }}>
            Nadie en<br />este lugar
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {presentes.map((p) => {
              const color = SABER_COLORS[p.saber_color] ?? '#38cdf0';
              const photoUrl = mediaUrl(p.photo);
              const isMe = p.user_id === myUserId;
              return (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px',
                  borderBottom: '1px solid rgba(56,205,240,0.06)',
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    backgroundImage: photoUrl ? `url(${photoUrl})` : undefined,
                    backgroundSize: 'cover', backgroundPosition: 'center',
                    background: photoUrl ? undefined : color,
                    border: `2px solid ${color}55`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 800, color: '#fff', textTransform: 'uppercase',
                    boxShadow: `0 0 8px ${color}44`,
                  }}>
                    {!photoUrl && (p.handle?.[0] ?? '?')}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 11, color: 'var(--txt)', fontFamily: 'var(--font-data)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      fontWeight: 600,
                    }}>
                      @{p.handle}
                    </div>
                    {isMe && (
                      <div style={{ fontSize: 9, color: 'var(--holo)', fontFamily: 'var(--font-data)', letterSpacing: '0.08em' }}>
                        (tú)
                      </div>
                    )}
                  </div>
                  {!isMe && (
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button onClick={() => onChat?.(p)} style={{
                        background: 'rgba(56,205,240,0.08)', border: '1px solid rgba(56,205,240,0.25)',
                        borderRadius: 6, padding: '4px 7px', cursor: 'pointer', color: 'var(--holo)',
                        fontSize: 9, fontFamily: 'var(--font-data)', letterSpacing: '0.06em', transition: 'all 0.15s',
                      }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(56,205,240,0.18)'; e.currentTarget.style.borderColor = 'var(--holo)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(56,205,240,0.08)'; e.currentTarget.style.borderColor = 'rgba(56,205,240,0.25)'; }}
                      >MSG</button>
                      <button onClick={() => onAttack?.(p)} style={{
                        background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)',
                        borderRadius: 6, padding: '4px 7px', cursor: 'pointer', color: '#ef4444',
                        fontSize: 9, fontFamily: 'var(--font-data)', letterSpacing: '0.06em', transition: 'all 0.15s',
                      }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(220,38,38,0.2)'; e.currentTarget.style.borderColor = '#ef4444'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(220,38,38,0.08)'; e.currentTarget.style.borderColor = 'rgba(220,38,38,0.3)'; }}
                      >ATK</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── CHAT MODAL ────────────────────────────────────────── */
function ChatModal({ target, myUserId, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [sending, setSending]   = useState(false);
  const [other, setOther]       = useState(null);
  const bottomRef               = useRef(null);
  const intervalRef             = useRef(null);
  const inputRef                = useRef(null);

  const loadMessages = useCallback(() => {
    if (!target?.user_id) return;
    apiFetch(`/messages/${target.user_id}`)
      .then((d) => {
        setMessages(d.messages ?? []);
        setOther(d.other);
      })
      .catch(() => {});
  }, [target?.user_id]);

  useEffect(() => {
    loadMessages();
    intervalRef.current = setInterval(loadMessages, 5000);
    return () => clearInterval(intervalRef.current);
  }, [loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(() => {
    const body = input.trim();
    if (!body || sending || !target?.user_id) return;
    setSending(true);
    apiPost('/messages', { receiver_id: target.user_id, body })
      .then(() => { setInput(''); loadMessages(); })
      .catch(() => toast('Error enviando mensaje', { tone: 'error', icon: 'x' }))
      .finally(() => {
        setSending(false);
        requestAnimationFrame(() => inputRef.current?.focus());
      });
  }, [input, sending, target?.user_id, loadMessages]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const color = SABER_COLORS[(other?.saber_color ?? target?.saber_color)] ?? '#38cdf0';
  const photoUrl = mediaUrl(other?.photo ?? target?.photo);
  const displayName = other?.handle ?? target?.handle ?? '?';

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0,
      width: 360, zIndex: 1100,
      display: 'flex', flexDirection: 'column',
      background: 'rgba(4,7,15,0.97)',
      borderLeft: '1px solid var(--holo-line)',
      backdropFilter: 'blur(12px)',
      animation: 'nx-fade-up 0.22s ease both',
    }}>
      {/* header */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--holo-line)',
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        background: 'rgba(7,16,31,0.9)',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          backgroundImage: photoUrl ? `url(${photoUrl})` : undefined,
          backgroundSize: 'cover', backgroundPosition: 'center',
          background: photoUrl ? undefined : color,
          border: `2px solid ${color}66`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 800, color: '#fff', textTransform: 'uppercase',
          boxShadow: `0 0 12px ${color}44`,
        }}>
          {!photoUrl && displayName[0]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', fontFamily: 'var(--font-data)' }}>
            @{displayName}
          </div>
          <div className="nx-kicker" style={{ fontSize: 8, letterSpacing: '0.12em' }}>TRANSMISIÓN DIRECTA</div>
        </div>
        <button onClick={onClose} style={{
          background: 'transparent', border: '1px solid var(--holo-line)',
          borderRadius: 6, padding: 7, cursor: 'pointer', color: 'var(--txt-dim)',
          transition: 'all 0.15s', flexShrink: 0,
        }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--holo)'; e.currentTarget.style.color = 'var(--txt)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--holo-line)'; e.currentTarget.style.color = 'var(--txt-dim)'; }}
        >
          <Icon name="x" size={14} />
        </button>
      </div>

      {/* messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {messages.length === 0 && (
          <div style={{
            textAlign: 'center', color: 'var(--txt-faint)', fontSize: 12,
            marginTop: 'auto', marginBottom: 'auto', lineHeight: 1.7,
          }}>
            Sin mensajes aún.<br />
            <span style={{ fontSize: 10, fontFamily: 'var(--font-data)', letterSpacing: '0.08em' }}>Inicia la transmisión.</span>
          </div>
        )}
        {messages.map((m) => {
          const isMe = m.sender_id === myUserId;
          return (
            <div key={m.id} style={{
              display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start',
              animation: 'nx-fade-up 0.2s ease both',
            }}>
              <div style={{
                maxWidth: '80%', padding: '9px 13px', borderRadius: 10,
                fontSize: 12, lineHeight: 1.55,
                ...(isMe ? {
                  background: 'rgba(0,71,186,0.35)', border: '1px solid rgba(56,205,240,0.3)',
                  color: 'var(--txt)', borderBottomRightRadius: 3,
                } : {
                  background: 'rgba(12,30,64,0.8)', border: '1px solid var(--holo-line)',
                  color: 'var(--txt)', borderBottomLeftRadius: 3,
                }),
              }}>
                {!isMe && (
                  <div style={{ fontSize: 9, color: 'var(--holo)', fontFamily: 'var(--font-data)', letterSpacing: '0.1em', marginBottom: 4 }}>
                    @{displayName}
                  </div>
                )}
                {m.body}
                <div style={{ fontSize: 9, color: 'var(--txt-faint)', marginTop: 4, textAlign: isMe ? 'right' : 'left', fontFamily: 'var(--font-data)' }}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {isMe && m.read_at && <span style={{ marginLeft: 4, color: 'var(--holo)' }}>✓</span>}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* input */}
      <div style={{
        padding: '10px 12px', borderTop: '1px solid var(--holo-line)',
        display: 'flex', gap: 8,
        background: 'rgba(4,7,15,0.95)', flexShrink: 0,
      }}>
        <input
          ref={inputRef}
          className="nx-input"
          style={{ flex: 1, fontSize: 12 }}
          placeholder="Transmitir mensaje..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={sending}
          autoFocus
        />
        <Btn kind="accent" icon="arrow" onClick={send} disabled={sending || !input.trim()} />
      </div>
    </div>
  );
}

/* ─── CONFIRMACIÓN DE ATAQUE PVP ────────────────────────── */
function PvpAttackConfirm({ target, onConfirm, onCancel, busy, lugarImagen }) {
  const color    = SABER_COLORS[target?.saber_color] ?? '#38cdf0';
  const photoUrl = mediaUrl(target?.photo);
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Fondo: imagen del lugar + gradiente oscuro */}
      {lugarImagen
        ? <img src={lugarImagen} alt="" style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center',
          }} />
        : null
      }
      <div style={{
        position: 'absolute', inset: 0,
        background: lugarImagen
          ? 'linear-gradient(to bottom, rgba(4,7,15,0.55) 0%, rgba(4,7,15,0.82) 60%, rgba(4,7,15,0.97) 100%)'
          : 'rgba(4,7,15,0.92)',
      }} />

      {/* Contenido centrado */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: 380, padding: '0 24px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24,
      }}>
        {/* Etiqueta alerta */}
        <div className="nx-display" style={{
          fontSize: 11, color: '#ef4444', letterSpacing: '0.18em',
          border: '1px solid rgba(220,38,38,0.4)', padding: '4px 14px', borderRadius: 2,
        }}>
          ALERTA DE COMBATE
        </div>

        {/* Avatar del objetivo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%', flexShrink: 0,
            backgroundImage: photoUrl ? `url(${photoUrl})` : undefined,
            backgroundSize: 'cover', backgroundPosition: 'center',
            backgroundColor: photoUrl ? undefined : color,
            border: `3px solid ${color}88`, boxShadow: `0 0 28px ${color}55, 0 0 60px ${color}22`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 800, color: '#fff', textTransform: 'uppercase',
          }}>
            {!photoUrl && (target?.handle?.[0] ?? '?')}
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="nx-display" style={{ fontSize: 18 }}>{target?.name ?? target?.handle}</div>
            <div className="nx-data" style={{ fontSize: 12, color: 'var(--holo)', marginTop: 4 }}>@{target?.handle}</div>
          </div>
        </div>

        {/* Línea divisoria */}
        <div style={{ width: '100%', height: 1, background: 'linear-gradient(to right, transparent, rgba(220,38,38,0.4), transparent)' }} />

        <p style={{
          fontSize: 12, color: 'var(--txt-dim)', fontFamily: 'var(--font-data)',
          textAlign: 'center', margin: 0, lineHeight: 1.7,
        }}>
          ¿Iniciar combate por turnos contra este objetivo?<br />
          Deberás resolverlo antes de poder viajar.
        </p>

        {/* Botones */}
        <div style={{ display: 'flex', gap: 12, width: '100%' }}>
          <button className="nx-btn nx-btn-ghost" style={{ flex: 1 }} onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button
            className="nx-btn nx-btn-accent"
            style={{ flex: 1, background: '#dc2626', borderColor: '#dc2626', fontWeight: 700 }}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Iniciando...' : '⚔ ATACAR'}
          </button>
        </div>
      </div>
    </div>
  );
}



/* ─── VISTA PRINCIPAL ───────────────────────────────────── */
export default function MapaView({ setMapLocation, initialLocation, userId, userCharacter, externalChatTarget, onExternalChatConsumed }) {
  /* niveles: galaxy | sistema | planeta | zona | lugar */
  const [nivel, setNivel]         = useState('galaxy');
  const [sistema, setSistema]     = useState(null);
  const [planeta, setPlaneta]     = useState(null);
  const [zona, setZona]           = useState(null);
  const [lugar, setLugar]         = useState(null);
  const [dialogNpc, setDialogNpc] = useState(null);
  const [lugarImagen,   setLugarImagen]   = useState(null);
  const [zonaImagen,    setZonaImagen]    = useState(null);
  const [planetaImagen, setPlanetaImagen] = useState(null);
  const [chatTarget, setChatTarget]     = useState(null);
  const [pendingTravel, setPendingTravel] = useState(null);
  const [activePvpCombat, setActivePvpCombat] = useState(null);
  const [pvpAttackTarget, setPvpAttackTarget]  = useState(null);
  const [pvpChallenging, setPvpChallenging]    = useState(false);

  // Comprueba si hay un combate PvP activo al entrar al mapa
  useEffect(() => {
    apiFetch('/pvp/active')
      .then(d => { if (d?.combat) setActivePvpCombat(d.combat); })
      .catch(() => {});
  }, []);

  const handleAttackUser = (character) => setPvpAttackTarget(character);

  const handleStartPvp = async () => {
    if (!pvpAttackTarget || pvpChallenging) return;
    setPvpChallenging(true);
    try {
      const d = await apiPost('/pvp/challenge', { defender_id: pvpAttackTarget.user_id });
      if (d?.combat) {
        setActivePvpCombat(d.combat);
        setPvpAttackTarget(null);
      }
    } catch {
      toast('No se pudo iniciar el combate', { tone: 'error', icon: 'x' });
      setPvpAttackTarget(null);
    } finally {
      setPvpChallenging(false);
    }
  };

  // Abre automáticamente el chat cuando llega un target externo (desde notificación)
  useEffect(() => {
    if (!externalChatTarget) return;
    setChatTarget(externalChatTarget);
    onExternalChatConsumed?.();
  }, [externalChatTarget]);

  const triggerTravel = useCallback((kind, fn) => {
    if (activePvpCombat) {
      toast('Debes resolver tu combate PvP antes de viajar', { tone: 'error', icon: 'swords' });
      return;
    }
    setPendingTravel({ kind, fn });
  }, [activePvpCombat]);

  const updateLocation = useCallback((loc) => {
    apiPost('/map/location', loc).catch(() => {});
  }, []);

  /* restaura la última ubicación al volver al Mapa */
  const hasRestored = useRef(false);
  useEffect(() => {
    if (hasRestored.current || !initialLocation?.nivel) return;
    hasRestored.current = true;
    const loc = initialLocation;
    if (loc.sistema_id) setSistema({ id: loc.sistema_id, nombre: loc.sistema_nombre });
    if (loc.planeta_id) setPlaneta({ id: loc.planeta_id, nombre: loc.planeta_nombre });
    if (loc.zona_id)    setZona   ({ id: loc.zona_id,    nombre: loc.zona_nombre    });
    if (loc.lugar_id)   setLugar  ({ id: loc.lugar_id });
    setNivel(loc.nivel);
  }, [initialLocation]);

  const goGalaxy  = () => {
    setNivel('galaxy'); setSistema(null); setPlaneta(null); setZona(null); setLugar(null);
    setLugarImagen(null); setZonaImagen(null); setPlanetaImagen(null);
    updateLocation({ sistema_id: null, planeta_id: null, zona_id: null, lugar_id: null });
    setMapLocation?.(null);
  };
  const goSistema = (tgt) => {
    setNivel('sistema'); setPlaneta(null); setZona(null); setLugar(null);
    setLugarImagen(null); setZonaImagen(null); setPlanetaImagen(null);
    if (tgt?.id) {
      updateLocation({ sistema_id: tgt.id, planeta_id: null, zona_id: null, lugar_id: null });
      setMapLocation?.({
        nombre: tgt.nombre, nivel: 'sistema',
        sistema_id: tgt.id, sistema_nombre: tgt.nombre,
        planeta_id: null, planeta_nombre: null,
        zona_id: null, zona_nombre: null,
        lugar_id: null, lugar_nombre: null,
      });
    }
  };
  const goPlaneta = (tgt) => {
    setNivel('planeta'); setZona(null); setLugar(null);
    setLugarImagen(null); setZonaImagen(null);
    if (tgt?.id) {
      updateLocation({ sistema_id: sistema?.id ?? null, planeta_id: tgt.id, zona_id: null, lugar_id: null });
      setMapLocation?.({
        nombre: tgt.nombre, nivel: 'planeta',
        sistema_id: sistema?.id ?? null, sistema_nombre: sistema?.nombre ?? null,
        planeta_id: tgt.id, planeta_nombre: tgt.nombre,
        zona_id: null, zona_nombre: null,
        lugar_id: null, lugar_nombre: null,
      });
    }
  };
  const goZona = (tgt) => {
    setNivel('zona'); setLugar(null);
    setLugarImagen(null);
    if (tgt?.id) {
      updateLocation({ sistema_id: sistema?.id ?? null, planeta_id: planeta?.id ?? null, zona_id: tgt.id, lugar_id: null });
      setMapLocation?.({
        nombre: tgt.nombre, nivel: 'zona',
        sistema_id: sistema?.id ?? null, sistema_nombre: sistema?.nombre ?? null,
        planeta_id: planeta?.id ?? null, planeta_nombre: planeta?.nombre ?? null,
        zona_id: tgt.id, zona_nombre: tgt.nombre,
        lugar_id: null, lugar_nombre: null,
      });
    }
  };

  const selectSistema = (s) => { setSistema(s); goSistema(s); };
  const selectPlaneta = (p) => { setPlaneta(p); goPlaneta(p); };
  const selectZona    = (z) => { setZona(z);    goZona(z);    };
  const selectLugar   = (l) => { setLugar(l);   setNivel('lugar'); };
  const selectNpc     = (n) => setDialogNpc(n);

  const handleLugarChange = useCallback((lugarId, lugarNombre) => {
    updateLocation({
      sistema_id: sistema?.id ?? null,
      planeta_id: planeta?.id ?? null,
      zona_id:    zona?.id    ?? null,
      lugar_id:   lugarId,
    });
    setMapLocation?.({
      nombre: lugarNombre, nivel: 'lugar',
      sistema_id: sistema?.id ?? null, sistema_nombre: sistema?.nombre ?? null,
      planeta_id: planeta?.id ?? null, planeta_nombre: planeta?.nombre ?? null,
      zona_id:    zona?.id    ?? null, zona_nombre:    zona?.nombre    ?? null,
      lugar_id:   lugarId,             lugar_nombre:   lugarNombre,
    });
  }, [sistema, planeta, zona, setMapLocation, updateLocation]);

  /* breadcrumbs — sólo etiquetas, sin onClick (los links se quitaron) */
  const crumbsZona = [
    { label: 'Galaxia' },
    { label: sistema?.nombre },
    { label: planeta?.nombre },
  ].filter(c => c.label);

  const crumbsLugar = [
    ...crumbsZona,
    { label: zona?.nombre },
  ].filter(c => c.label);

  return (
    <div className="nx-fade" style={{ paddingBottom: 40 }}>
      {nivel === 'galaxy'  && <GalaxiaView onSelectSistema={selectSistema} />}
      {nivel === 'sistema' && sistema && (
        <SistemaView
          sistemaId={sistema.id}
          onSelectPlaneta={selectPlaneta}
          onBack={goGalaxy}
          onTravel={triggerTravel}
          onChat={setChatTarget}
          onAttack={handleAttackUser}
          myUserId={userId}
        />
      )}
      {nivel === 'planeta' && planeta && (
        <PlanetaView
          planetaId={planeta.id}
          onSelectZona={selectZona}
          onBack={() => goSistema(sistema)}
          onTravel={triggerTravel}
          onChat={setChatTarget}
          onAttack={handleAttackUser}
          onPlanetaImagen={setPlanetaImagen}
          myUserId={userId}
        />
      )}
      {nivel === 'zona' && zona && (
        <ZonaView
          zonaId={zona.id}
          onSelectLugar={selectLugar}
          onBack={() => goPlaneta(planeta)}
          onTravel={triggerTravel}
          breadcrumbs={crumbsZona}
          onChat={setChatTarget}
          onAttack={handleAttackUser}
          onZonaImagen={setZonaImagen}
          myUserId={userId}
        />
      )}
      {nivel === 'lugar' && lugar && (
        <LugarView
          lugarId={lugar.id}
          onSelectNpc={selectNpc}
          onBack={() => goZona(zona)}
          onTravel={triggerTravel}
          breadcrumbs={crumbsLugar}
          onLugarChange={handleLugarChange}
          onLugarImagen={setLugarImagen}
          onChat={setChatTarget}
          onAttack={handleAttackUser}
          myUserId={userId}
        />
      )}

      {/* Diálogo RPG */}
      {dialogNpc && <DialogoRPG npc={dialogNpc} userCharacter={userCharacter} lugarImagen={lugarImagen} onClose={() => setDialogNpc(null)} />}

      {/* Chat con jugador */}
      {chatTarget && (
        <ChatModal
          target={chatTarget}
          myUserId={userId}
          onClose={() => setChatTarget(null)}
        />
      )}

      {/* Combate PvP activo — overlay bloqueante */}
      {activePvpCombat && (
        <PvpCombatScreen
          combat={activePvpCombat}
          userId={userId}
          onClose={() => setActivePvpCombat(null)}
          lugarImagen={lugarImagen || zonaImagen || planetaImagen}
        />
      )}

      {/* Confirmación de ataque */}
      {pvpAttackTarget && (
        <PvpAttackConfirm
          target={pvpAttackTarget}
          busy={pvpChallenging}
          onConfirm={handleStartPvp}
          onCancel={() => setPvpAttackTarget(null)}
          lugarImagen={lugarImagen || zonaImagen || planetaImagen}
        />
      )}

      {/* Animación de viaje */}
      {pendingTravel && (
        <TravelOverlay
          kind={pendingTravel.kind}
          onDone={() => {
            const fn = pendingTravel.fn;
            setPendingTravel(null);
            fn();
          }}
        />
      )}
    </div>
  );
}
