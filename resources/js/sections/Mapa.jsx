import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Icon, Panel, Btn, Chip, Modal, toast } from '../components/ui.jsx';
import { playAtras, playSound } from '../utils/sounds.js';
import PvpCombatScreen from '../components/PvpCombatScreen.jsx';
import NpcCombatScreen from '../components/NpcCombatScreen.jsx';
import RaidCombatScreen, { RaidQueueModal } from '../components/RaidCombatScreen.jsx';

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
  }).then(async (r) => {
    const body = await r.json().catch(() => null);
    if (!r.ok) {
      const err = new Error(body?.message || body?.error || `HTTP ${r.status}`);
      err.body = body;
      throw err;
    }
    return body;
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

/* ─── referencias inline en textos de NPC ────────────────
   [Nombre Objeto]  -> rol_objetos
   @[Nombre NPC]    -> map_npcs                             */
const REF_TOKEN_RE = /(@)?\[([^\[\]]+)\]/g;

function parseRefTokens(text) {
  if (!text) return [];
  const tokens = [];
  let last = 0, m;
  REF_TOKEN_RE.lastIndex = 0;
  while ((m = REF_TOKEN_RE.exec(text))) {
    if (m.index > last) tokens.push({ type: 'text', value: text.slice(last, m.index) });
    tokens.push({ type: m[1] ? 'npc' : 'objeto', name: m[2].trim() });
    last = REF_TOKEN_RE.lastIndex;
  }
  if (last < text.length) tokens.push({ type: 'text', value: text.slice(last) });
  return tokens;
}

const REF_COLOR = { objeto: '#E6B325', npc: '#8b5cf6' };

function RefToken({ type, name, data }) {
  const [hover, setHover] = useState(false);
  const color = REF_COLOR[type];

  if (!data) {
    return <span>{type === 'npc' ? `@[${name}]` : `[${name}]`}</span>;
  }

  const imagen = mediaUrl(type === 'objeto' ? data.imagen : (data.imagen_mini || data.imagen));

  return (
    <span
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative', display: 'inline-block',
        color, fontWeight: 600, cursor: 'help',
        borderBottom: `1px dotted ${color}`,
      }}
    >
      {name}
      {hover && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          marginBottom: 6, width: 200, zIndex: 50,
          background: 'rgba(5,12,26,0.98)', border: `1px solid ${color}`,
          borderRadius: 8, padding: 10, boxShadow: '0 4px 18px rgba(0,0,0,0.5)',
          fontSize: 11, lineHeight: 1.5, color: 'var(--txt)',
          fontFamily: 'var(--font-body)', whiteSpace: 'normal', pointerEvents: 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: data.descripcion || data.efecto || data.profesion || data.faccion ? 6 : 0 }}>
            {imagen && (
              <img src={imagen} alt={data.nombre} style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover', border: `1px solid ${color}55`, flexShrink: 0 }} />
            )}
            <div style={{ fontWeight: 700, color, fontSize: 12 }}>{data.nombre}</div>
          </div>
          {type === 'objeto' ? (
            <>
              {data.rareza && <div style={{ fontSize: 9, color: 'var(--txt-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{data.rareza.replace('_', ' ')}</div>}
              {data.descripcion && <div>{data.descripcion}</div>}
              {data.efecto && <div style={{ marginTop: 4, color: 'var(--txt-dim)' }}>{data.efecto}</div>}
            </>
          ) : (
            <>
              {(data.profesion || data.faccion) && (
                <div style={{ color: 'var(--txt-dim)' }}>
                  {[data.profesion, data.faccion].filter(Boolean).join(' · ')}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </span>
  );
}

function RichNpcText({ text, refsMap }) {
  const tokens = useMemo(() => parseRefTokens(text), [text]);
  return (
    <>
      {tokens.map((tok, i) => {
        if (tok.type === 'text') return <span key={i}>{tok.value}</span>;
        const data = refsMap?.[tok.type]?.get(tok.name.toLowerCase());
        return <RefToken key={i} type={tok.type} name={tok.name} data={data} />;
      })}
    </>
  );
}

function useIsMobile() {
  const [m, setM] = useState(() => window.innerWidth < 700);
  useEffect(() => {
    const fn = () => setM(window.innerWidth < 700);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return m;
}

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
  const isMobile = useIsMobile();

  /* Confirmación de viaje: nave equipada (combustible) o transbordador de pasajeros (créditos) */
  const [confirmSistema, setConfirmSistema] = useState(null);
  const [confirmData, setConfirmData]       = useState(null); // { naveEquipada, credits }
  const [confirmLoading, setConfirmLoading] = useState(false);

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

  const openConfirm = (sistema) => {
    setConfirmSistema(sistema);
    setConfirmData(null);
    setConfirmLoading(true);
    apiFetch('/naves/mias')
      .then((d) => {
        const equipada = (d.naves ?? []).find((n) => n.id === d.nave_equipada_id) ?? null;
        setConfirmData({ naveEquipada: equipada, credits: d.credits ?? 0 });
      })
      .catch(() => setConfirmData({ naveEquipada: null, credits: 0 }))
      .finally(() => setConfirmLoading(false));
  };
  const closeConfirm = () => { setConfirmSistema(null); setConfirmData(null); };
  const confirmarViaje = () => {
    const sistema = confirmSistema;
    closeConfirm();
    handleTravel(sistema);
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
              onClick={() => {
                if (!traveling) {
                  if (isMobile && hovered !== s.id) { setHovered(s.id); return; }
                  setHovered(null);
                  openConfirm(s);
                }
              }}
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

      {/* ── confirmación de viaje: nave equipada (combustible) o transbordador (créditos) ── */}
      {confirmSistema && (
        <Modal open onClose={closeConfirm} title={`Viajar a ${confirmSistema.nombre}`} kicker="CONFIRMAR SALTO" width={380}>
          {confirmLoading ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--txt-faint)', fontSize: 12 }}>
              Calculando ruta...
            </div>
          ) : (() => {
            const nave = confirmData?.naveEquipada;
            const credits = confirmData?.credits ?? 0;
            const costo = confirmSistema.costo_viaje ?? 0;

            if (nave) {
              const fuelActual = nave.combustible_actual ?? 0;
              const fuelMax    = nave.nave?.capacidad_salto ?? 0;
              const sinCombustible = fuelActual <= 0;
              return (
                <>
                  <p style={{ fontSize: 13, color: 'var(--txt)', lineHeight: 1.5, marginBottom: 14 }}>
                    Vas a saltar con tu nave equipada <strong>{nave.nave?.nombre}</strong>. Este salto consumirá <strong>1 unidad de combustible</strong>.
                  </p>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: sinCombustible ? 'rgba(255,45,69,0.1)' : 'rgba(56,205,240,0.08)',
                    border: `1px solid ${sinCombustible ? 'rgba(255,45,69,0.35)' : 'var(--holo-line)'}`,
                  }}>
                    <Icon name="fuel" size={16} style={{ color: sinCombustible ? '#ff6b6b' : 'var(--holo)', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: sinCombustible ? '#ff6b6b' : 'var(--txt-dim)' }}>
                      Combustible actual: {fuelActual}/{fuelMax}
                      {sinCombustible && ' — insuficiente para saltar. Debes reabastecer tu nave.'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <Btn kind="ghost" onClick={closeConfirm}>Cancelar</Btn>
                    <Btn kind="primary" onClick={confirmarViaje} disabled={sinCombustible}>Confirmar salto</Btn>
                  </div>
                </>
              );
            }

            const sinCreditos = costo > 0 && credits < costo;
            return (
              <>
                <p style={{ fontSize: 13, color: 'var(--txt)', lineHeight: 1.5, marginBottom: 14 }}>
                  No tienes una nave equipada. Vas a viajar en un <strong>transbordador de pasajeros</strong> hacia {confirmSistema.nombre}.
                </p>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: sinCreditos ? 'rgba(255,45,69,0.1)' : 'rgba(230,179,37,0.08)',
                  border: `1px solid ${sinCreditos ? 'rgba(255,45,69,0.35)' : 'rgba(230,179,37,0.25)'}`,
                }}>
                  <Icon name="coin" size={16} style={{ color: sinCreditos ? '#ff6b6b' : 'var(--holocron-oro)', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: sinCreditos ? '#ff6b6b' : 'var(--txt-dim)' }}>
                    {costo > 0 ? `Costo del viaje: ${costo} cr (tienes ${credits} cr)` : 'Este viaje es gratuito.'}
                    {sinCreditos && ' — créditos insuficientes para pagar el transporte.'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <Btn kind="ghost" onClick={closeConfirm}>Cancelar</Btn>
                  <Btn kind="primary" onClick={confirmarViaje} disabled={sinCreditos}>Confirmar viaje</Btn>
                </div>
              </>
            );
          })()}
        </Modal>
      )}

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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
      <button
        onClick={() => { void playAtras(); onVolver(); }}
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
function SistemaView({ sistemaId, onSelectPlaneta, onBack, onTravel, onChat, onAttack, onNaveEncounter, myUserId }) {
  const [sistema, setSistema] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePlaneta, setActivePlaneta] = useState(null);
  const isMobile = useIsMobile();

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

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 320px', gap: isMobile ? 14 : 20, marginTop: 0 }}>
        {/* ── visor del sistema ── */}
        <div className="nx-panel solid" style={{ position: 'relative', overflow: 'hidden', minHeight: isMobile ? 260 : 500,
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
            position: 'relative', height: isMobile ? 240 : 460,
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

          {(sistema.npcs_espacio ?? []).length > 0 && (
            <Panel title="Encuentros espaciales" kicker="CONTACTOS DETECTADOS" icon="ship">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sistema.npcs_espacio.map((ne) => {
                  const h = hostilidadStyle(ne.hostilidad);
                  return (
                    <div key={ne.id} style={{
                      background: 'rgba(255,255,255,0.02)', border: `1px solid ${h.border}55`,
                      borderRadius: 'var(--radius-md)', padding: '10px 12px',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt)' }}>{ne.nombre}</div>
                        <div style={{ fontSize: 10, color: h.text, fontFamily: 'var(--font-data)' }}>{h.label}</div>
                      </div>
                      <Btn kind="ghost" sm icon="swords" onClick={() => onNaveEncounter?.(ne)}>Enfrentar</Btn>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}

          {sistema.historia && (
            <Panel title="Historia" kicker="REGISTRO" icon="shield">
              <p style={{ fontSize: 12, color: 'var(--txt-dim)', lineHeight: 1.6, margin: 0 }}>
                {sistema.historia}
              </p>
            </Panel>
          )}
        </div>
      </div>

      {/* ── footer presentes ── */}
      <PresentesPanel
        presentes={sistema.presentes_personajes ?? []}
        onChat={onChat}
        onAttack={onAttack}
        myUserId={myUserId}
      />
    </div>
  );
}

/* ─── VISTA PLANETA ─────────────────────────────────────── */
function PlanetaView({ planetaId, onSelectZona, onBack, onTravel, onChat, onAttack, onTrade, onPlanetaImagen, myUserId }) {
  const [planeta, setPlaneta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shipPopup, setShipPopup] = useState(null);
  const isMobile = useIsMobile();

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

  /* posiciones dispersas deterministas (mismo algoritmo que los sistemas de la galaxia) */
  /* zonas y naves comparten una única cuadrícula de celdas para no sobreponerse entre sí */
  const presentesPlaneta = planeta.presentes_personajes ?? [];
  const allPositions = buildPositions([...zonas, ...presentesPlaneta]);
  const positions = allPositions.slice(0, zonas.length);
  const shipPositions = allPositions.slice(zonas.length);

  return (
    <div className="nx-fade">
      <VolverHeader
        onVolver={() => onTravel('espacio', onBack)}
        crumbs={[{ label: 'Galaxia' }, { label: planeta.sistema?.nombre }, { label: planeta.nombre }]}
      />

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 300px', gap: isMobile ? 14 : 20, marginTop: 0 }}>
        {/* mapa del planeta */}
        <Panel title={planeta.nombre} kicker="MAPA PLANETARIO" icon="target"
          right={<Chip tone={hostilidadStyle(planeta.hostilidad).text !== '#8aa0c0' ? 'orange' : 'default'}>
            {hostilidadStyle(planeta.hostilidad).label}
          </Chip>}
        >
          <div style={{ position: 'relative', minHeight: isMobile ? 300 : 420, overflow: 'hidden' }}>
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

            {zonas.length === 0 && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: 'var(--txt-faint)', fontSize: 13, zIndex: 1,
              }}>
                Sin zonas registradas
              </div>
            )}

            {/* íconos de zona — dispersos, posición fija */}
            {zonas.map((z, i) => {
              const hs = hostilidadStyle(z.hostilidad);
              const pos = positions[i];
              return (
                <button
                  key={z.id}
                  onClick={() => onSelectZona(z)}
                  style={{
                    position: 'absolute', left: pos.left, top: pos.top,
                    transform: 'translate(-50%, -50%)', zIndex: 1,
                    background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  }}
                  onMouseEnter={(e) => {
                    const orb = e.currentTarget.querySelector('.nx-zona-orb');
                    if (orb) { orb.style.boxShadow = `0 0 22px 6px ${hs.border}88`; orb.style.transform = 'scale(1.15)'; }
                  }}
                  onMouseLeave={(e) => {
                    const orb = e.currentTarget.querySelector('.nx-zona-orb');
                    if (orb) { orb.style.boxShadow = `0 0 14px 3px ${hs.border}44`; orb.style.transform = 'scale(1)'; }
                  }}
                >
                  <div className="nx-zona-orb" style={{
                    width: 38, height: 38, borderRadius: '50%',
                    background: `radial-gradient(circle at 35% 30%, ${hs.border}cc, ${hs.border}33 60%, transparent)`,
                    border: `1.5px solid ${hs.border}`,
                    boxShadow: `0 0 14px 3px ${hs.border}44`,
                    display: 'grid', placeItems: 'center',
                    transition: 'box-shadow 0.2s, transform 0.2s',
                  }}>
                    <Icon name="target" size={16} style={{ color: hs.text }} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: 10, fontWeight: 700, color: 'var(--txt)',
                      fontFamily: 'var(--font-data)', whiteSpace: 'nowrap',
                      textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                    }}>
                      {z.nombre}
                    </div>
                    <div style={{
                      fontSize: 8, color: hs.text, fontFamily: 'var(--font-data)',
                      letterSpacing: '0.08em', textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                    }}>
                      {hs.label}
                    </div>
                  </div>
                </button>
              );
            })}

            {/* naves de jugadores presentes en el planeta — deriva lenta simulando vuelo orbital */}
            {presentesPlaneta.map((p, i) => {
              const isMe = p.user_id === myUserId;
              const pos = shipPositions[i];
              const color = p.saber_color || 'var(--holo)';
              const ax = 8 + hashf(p.id * 17 + 4) * 14;
              const ay = 5 + hashf(p.id * 23 + 8) * 9;
              const dur = 16 + hashf(p.id * 5 + 2) * 12;
              const delay = -hashf(p.id * 13 + 6) * dur;
              return (
                <button key={p.id}
                  onClick={() => !isMe && setShipPopup(p)}
                  style={{
                    position: 'absolute', left: pos.left, top: pos.top, zIndex: 2,
                    background: 'transparent', border: 'none', padding: 0,
                    cursor: isMe ? 'default' : 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    animation: `nx-node-drift ${dur}s ease-in-out infinite`,
                    animationDelay: `${delay}s`,
                    '--ax': `${ax}px`, '--ay': `${ay}px`,
                  }}
                >
                  <Icon name="ship" size={18} style={{ color, filter: `drop-shadow(0 0 6px ${color})` }} />
                  <span style={{
                    fontSize: 8, color: 'var(--txt-dim)', fontFamily: 'var(--font-data)',
                    whiteSpace: 'nowrap', textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                  }}>
                    {p.handle}{isMe ? ' (tú)' : ''}
                  </span>
                </button>
              );
            })}
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
            {zonas.length === 0 ? (
              <div style={{ color: 'var(--txt-faint)', fontSize: 13, textAlign: 'center', padding: 16 }}>
                Sin zonas registradas
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? 'repeat(auto-fill, minmax(130px, 1fr))' : '1fr',
                gap: isMobile ? 8 : 10,
              }}>
                {zonas.map((z) => (
                  <ZonaCard
                    key={z.id}
                    zona={z}
                    presentes={z.presentes_personajes ?? []}
                    onClick={() => onSelectZona(z)}
                    compact={isMobile}
                  />
                ))}
              </div>
            )}
          </Panel>

          {planeta.historia && (
            <Panel title="Crónica" kicker="HISTORIA" icon="flame">
              <p style={{ fontSize: 12, color: 'var(--txt-dim)', lineHeight: 1.6, margin: 0 }}>
                {planeta.historia}
              </p>
            </Panel>
          )}
        </div>
      </div>

      {/* popup de acciones sobre la nave de un jugador */}
      {shipPopup && (
        <Modal open onClose={() => setShipPopup(null)} title={`@${shipPopup.handle}`} kicker="ACCIONES" width={320}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Btn kind="ghost" icon="message" onClick={() => { onChat?.(shipPopup); setShipPopup(null); }}>
              Enviar mensaje
            </Btn>
            <Btn kind="ghost" icon="coin" onClick={() => { onTrade?.(shipPopup); setShipPopup(null); }}>
              Comerciar
            </Btn>
            <Btn kind="ghost" icon="swords" onClick={() => { onAttack?.(shipPopup, 'nave'); setShipPopup(null); }}>
              Atacar
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─── CARD ZONA ─────────────────────────────────────────── */
function ZonaCard({ zona, presentes = [], onClick, compact = false }) {
  const hs = hostilidadStyle(zona.hostilidad);
  const zonaImagen = mediaUrl(zona.imagen);
  return (
    <button onClick={onClick}
      style={{
        background: 'rgba(12,30,64,0.55)', border: `1px solid ${hs.border}55`,
        borderRadius: 'var(--radius-lg)', cursor: 'pointer', textAlign: 'left',
        padding: 0, overflow: 'hidden', transition: 'all 0.2s', width: '100%',
        display: 'flex', flexDirection: 'column', color: 'var(--txt)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = hs.border;
        e.currentTarget.style.boxShadow = `0 0 20px -6px ${hs.border}`;
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = hs.border + '55';
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'none';
      }}
    >
      {/* cabecera: imagen */}
      <div style={{
        height: compact ? 64 : 90, flexShrink: 0, position: 'relative',
        background: zonaImagen
          ? `url(${zonaImagen}) center/cover`
          : 'linear-gradient(135deg, rgba(56,205,240,0.08), rgba(4,7,15,0.8))',
      }}>
        {!zonaImagen && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', opacity: 0.3 }}>
            <Icon name="target" size={compact ? 22 : 32} style={{ color: 'var(--holo)' }} />
          </div>
        )}
        <div style={{
          position: 'absolute', top: 6, right: 6,
          background: `${hs.bg}`, border: `1px solid ${hs.border}88`,
          borderRadius: 4, padding: '2px 6px',
          fontSize: 9, color: hs.text, fontFamily: 'var(--font-data)',
          letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap',
        }}>
          {hs.label}
        </div>
      </div>

      {/* cuerpo: nombre */}
      <div style={{ padding: compact ? '8px 10px' : '10px 12px', flex: 1 }}>
        <div style={{
          fontSize: compact ? 11 : 13, fontWeight: 700, color: 'var(--txt)',
          lineHeight: 1.25, marginBottom: (compact || (!zona.faccion && !zona.estrato_social && !zona.impuestos)) ? 0 : 6,
        }}>
          {zona.nombre}
        </div>
        {!compact && (zona.faccion || zona.estrato_social || Number(zona.impuestos) > 0) && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: zona.historia ? 6 : 0 }}>
            {zona.faccion && <span style={{ fontSize: 10, color: 'var(--txt-dim)', fontFamily: 'var(--font-data)' }}>{zona.faccion}</span>}
            {zona.estrato_social && <span style={{ fontSize: 10, color: 'var(--txt-faint)', fontFamily: 'var(--font-data)' }}>{zona.estrato_social}</span>}
            {Number(zona.impuestos) > 0 && (
              <span style={{
                fontSize: 10, color: 'var(--holocron-oro)', fontFamily: 'var(--font-data)',
                display: 'flex', alignItems: 'center', gap: 3,
              }}>
                <Icon name="coin" size={10} /> {Number(zona.impuestos)}% impuestos
              </span>
            )}
          </div>
        )}
        {!compact && zona.historia && (
          <p style={{
            fontSize: 11, color: 'var(--txt-dim)', lineHeight: 1.5, margin: 0,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {zona.historia}
          </p>
        )}
      </div>

      {/* footer: usuarios presentes */}
      <div style={{
        padding: compact ? '6px 10px' : '8px 12px', borderTop: '1px solid var(--holo-line)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
      }}>
        {presentes.length > 0
          ? <PresentesAvatars presentes={presentes} max={compact ? 3 : 4} />
          : <span style={{ fontSize: 10, color: 'var(--txt-faint)', fontFamily: 'var(--font-data)' }}>Sin presencia</span>}
        {!compact && (
          <span style={{ fontSize: 10, color: 'var(--holo)', fontFamily: 'var(--font-data)', letterSpacing: '0.1em', flexShrink: 0 }}>
            ENTRAR →
          </span>
        )}
      </div>
    </button>
  );
}

/* ─── VISTA ZONA ────────────────────────────────────────── */
function ZonaView({ zonaId, onSelectLugar, onBack, onTravel, breadcrumbs, onChat, onAttack, onZonaImagen, myUserId }) {
  const [zona, setZona]     = useState(null);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

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

      <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden' }}>
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

      {/* footer presentes */}
      <PresentesPanel
        presentes={zona.presentes_personajes ?? []}
        onChat={onChat}
        onAttack={onAttack}
        myUserId={myUserId}
      />
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
function LugarView({ lugarId, onSelectNpc, onBack, onTravel, breadcrumbs, onLugarChange, onLugarImagen, onChat, onAttack, myUserId, refreshToken, onNpcsUpdated }) {
  const [navStack, setNavStack]     = useState([lugarId]);
  const [navNames, setNavNames]     = useState({});
  const [lugar, setLugar]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const isMobile = useIsMobile();

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

  /* refresco silencioso (sin spinner) cuando cambia el estado de una misión o se obtiene un hito */
  const skipFirstRefresh = useRef(true);
  useEffect(() => {
    if (skipFirstRefresh.current) { skipFirstRefresh.current = false; return; }
    let cancelled = false;
    apiFetch(`/map/lugares/${currentId}`)
      .then((d) => { if (!cancelled) setLugar(d.lugar); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [refreshToken]);

  /* Notifica NPCs frescos al padre para resincronizar un diálogo ya abierto
     (p.ej. una misión que se completó sin cerrar el diálogo del NPC). */
  useEffect(() => {
    if (lugar) onNpcsUpdated?.(lugar.npcs ?? []);
  }, [lugar, onNpcsUpdated]);

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

        <Btn kind="ghost" onClick={() => { void playAtras(); goBack(); }}>← Volver</Btn>
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
        <div style={{ display: 'grid', gridTemplateColumns: lugarImagen && !isMobile ? '280px 1fr' : '1fr', gap: 16, position: 'relative', zIndex: 1, padding: 12 }}>
          {lugarImagen && (
            <div style={{ borderRadius: 12, overflow: 'hidden', height: isMobile ? 160 : 200, border: '1px solid var(--holo-line)' }}>
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
            {DIRS.map(({ key, label, icon, data }) => {
              const thumb = mediaUrl(data.imagen);
              return (
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
                    background: thumb ? `url(${thumb}) center/cover` : 'rgba(56,205,240,0.10)',
                    border: '1px solid rgba(56,205,240,0.30)',
                    display: 'grid', placeItems: 'center',
                    fontSize: 18, color: 'var(--holo)',
                    position: 'relative', overflow: 'hidden',
                  }}>
                    {!thumb && icon}
                    {thumb && (
                      <span style={{
                        position: 'absolute', bottom: 1, right: 1, lineHeight: 1, fontSize: 9,
                        background: 'rgba(2,6,16,0.72)', color: 'var(--holo)',
                        borderRadius: 3, padding: '1px 3px',
                      }}>{icon}</span>
                    )}
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
              );
            })}
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
  const tieneMision = Boolean(npc.mision_disponible) && npc.mision_disponible.estado !== 'completada';
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
          ? `url(${npcImagen}) center/contain no-repeat`
          : 'linear-gradient(160deg, rgba(56,205,240,0.12), rgba(4,7,15,0.9))',
      }}>
        {!npcImagen && npcMiniImagen && (
          <img src={npcMiniImagen} alt={npc.nombre} style={{
            width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center',
          }} />
        )}
        {!npcImagen && !npcMiniImagen && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', opacity: 0.3 }}>
            <Icon name="user" size={44} style={{ color: 'var(--holo)' }} />
          </div>
        )}
        {tieneMision && (
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
        <Icon name="zap" size={12} style={{ color: 'var(--holocron-naranja)' }} />
        <span style={{ fontSize: 10, color: 'var(--holocron-naranja)', fontFamily: 'var(--font-data)', letterSpacing: '0.1em' }}>
          HABLAR
        </span>
        {tieneMision && (
          <>
            <span style={{ marginLeft: 'auto' }} />
            <Icon name="star" size={11} style={{ color: 'var(--holocron-oro)' }} />
            <span style={{ fontSize: 9, color: 'var(--holocron-oro)', fontFamily: 'var(--font-data)' }}>MISIÓN</span>
          </>
        )}
      </div>
    </button>
  );
}

/* Forma numérica (1-7) de la Especialización ("Forma de Combate") elegida en Mi Personaje */
function formaEspecializacion(character) {
  const n = parseInt(String(character?.cls ?? '').replace('forma', ''), 10);
  return n >= 1 && n <= 7 ? n : 1;
}

/* ─── STATS DE COMBATE DEL JUGADOR ─────────────────────── */
function getPlayerCombatStats(character) {
  const bonos = character?.sable_bonos ?? { ataque: 0, defensa: 0, punteria: 0, movimiento: 0, iniciativa: 0, vida: 0, escudo: 0, fuerza: 0, generacion_fuerza: 0 };
  const combat = character?.combat_stats ?? null;
  return {
    vida:       combat?.vida       ?? ((character?.vida       ?? 8) + (bonos.vida ?? 0)),
    escudo:     combat?.escudo     ?? ((character?.escudo     ?? 4) + (bonos.escudo ?? 0)),
    ataque:     combat?.ataque     ?? ((character?.ataque     ?? 2) + (bonos.ataque ?? 0)),
    defensa:    combat?.defensa    ?? ((character?.defensa    ?? 2) + (bonos.defensa ?? 0)),
    movimiento: combat?.movimiento ?? ((character?.movimiento ?? 2) + (bonos.movimiento ?? 0)),
    iniciativa: combat?.iniciativa ?? ((character?.iniciativa ?? 2) + (bonos.iniciativa ?? 0)),
    punteria:   combat?.punteria   ?? ((character?.punteria   ?? 2) + (bonos.punteria ?? 0)),
    nombre:     character?.name ?? 'Tú',
    photo:      character?.photo_url ?? null,
    maxFuerza:      10 + (bonos.fuerza ?? 0),
    fuerzaPorTurno: 2 + (bonos.generacion_fuerza ?? 0),
    arma_equipada: character?.arma_efectiva
      ? {
          nombre: character.arma_efectiva.nombre,
          dano: character.arma_efectiva.dano,
          dano_perforante: character.arma_efectiva.dano_perforante ?? 0,
          critico: character.arma_efectiva.critico ?? 0,
          tipo_ataque: character.arma_efectiva.tipo_ataque,
          es_sable: character.arma_efectiva.es_sable ?? false,
          color_hoja: character.arma_efectiva.color_hoja ?? null,
          imagen: character.arma_efectiva.imagen ?? null,
        }
      : null,
    current_forma:         formaEspecializacion(character),
    habilidades_por_forma: character?.habilidades_por_forma ?? {},
    all_habilidades_data:  character?.all_habilidades_data  ?? {},
    /* current form's habilidades for backward compat */
    habilidades: (() => {
      const forma   = formaEspecializacion(character);
      const por     = character?.habilidades_por_forma ?? {};
      const allHabs = character?.all_habilidades_data  ?? {};
      const ids     = Array.isArray(por[String(forma)]) ? por[String(forma)] : [];
      return ids.filter(Boolean).map(id => allHabs[String(id)]).filter(Boolean);
    })(),
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

function postNpcVictory(npcId) {
  const token = localStorage.getItem('nx-token');
  return fetch('/api/character/npc-victory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, Accept: 'application/json' },
    body: JSON.stringify({ npc_id: npcId }),
  })
    .then(r => r.ok ? r.json() : null)
    .then(d => { if (d?.hito) toast(`🏆 Hito obtenido: "${d.hito}"`, { tone: 'success', icon: 'star' }); })
    .catch(() => {});
}

/* Victoria contra un enemigo de encuentro aleatorio (ver checkLugarEncuentro). */
function postEnemigoVictory(enemigoId) {
  const token = localStorage.getItem('nx-token');
  return fetch('/api/character/enemigo-victory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, Accept: 'application/json' },
    body: JSON.stringify({ enemigo_id: enemigoId }),
  }).catch(() => {});
}

/* Persiste el HP/escudo restante de la nave equipada tras un encuentro naval contra
   NPC (emboscada pirata o encuentro espacial), sin importar el desenlace — de lo
   contrario el daño sufrido se pierde y la nave siempre vuelve a verse a full. */
function persistNaveDano(ownedId, hp) {
  if (!ownedId || !hp) return Promise.resolve();
  return apiPost(`/naves/${ownedId}/registrar-dano`, { vida: hp.vida, escudo: hp.escudo }).catch(() => {});
}

function postNaveEspacioVictory(npcEspacioId) {
  const token = localStorage.getItem('nx-token');
  return fetch('/api/character/npc-espacio-victory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, Accept: 'application/json' },
    body: JSON.stringify({ npc_espacio_id: npcEspacioId }),
  })
    .then(r => r.ok ? r.json() : null)
    .then(d => { if (d?.hito) toast(`🏆 Hito obtenido: "${d.hito}"`, { tone: 'success', icon: 'star' }); })
    .catch(() => {});
}

/* Suma un campo de bono (bono_ataque, bono_capacidad_salto, etc.) entre las 4 mejoras
   instaladas en una nave poseída — espejo de CharacterNave::sumaBono en el backend. */
function sumaBonoNave(owned, campo) {
  return [1, 2, 3, 4].reduce((acc, i) => acc + (owned?.[`mejora${i}`]?.[campo] ?? 0), 0);
}

/* ─── STATS DE COMBATE NAVAL — nave del jugador y encuentro enemigo ── */
function getNaveCombatPlayerStats(owned) {
  const nave = owned?.nave;
  if (!nave) return null;

  /* Habilidades de tipo "nave" asignadas en los 4 slots de la nave — se usan
     como si fueran las de la "forma 1" (las naves no tienen estancias). */
  const habs = [nave.habilidad1, nave.habilidad2, nave.habilidad3, nave.habilidad4].filter(Boolean);
  const allHabilidadesData = Object.fromEntries(habs.map((h) => [String(h.id), h]));

  return {
    /* id de la nave poseída (character_naves), para persistir el daño al terminar el
       encuentro — ver registrar-dano en Mapa.jsx onVictory/onDefeat/onFlee. */
    owned_id: owned.id,
    /* vida/escudo ACTUALES (persisten el daño hasta reparar en el hangar) — el máximo
       real de la nave (con mejoras) viaja aparte en vida_max/escudo_max. */
    vida: owned.vida_actual, escudo: owned.escudo_actual,
    vida_max: owned.vida_max ?? nave.vida, escudo_max: owned.escudo_max ?? nave.escudo,
    ataque: nave.ataque + sumaBonoNave(owned, 'bono_ataque'),
    defensa: nave.maniobrabilidad + sumaBonoNave(owned, 'bono_defensa'),
    movimiento: nave.maniobrabilidad + sumaBonoNave(owned, 'bono_movimiento'),
    iniciativa: nave.velocidad + sumaBonoNave(owned, 'bono_iniciativa'),
    punteria: nave.ataque + sumaBonoNave(owned, 'bono_punteria'),
    nombre: nave.nombre, photo: mediaUrl(nave.imagen),
    maxFuerza: 10, fuerzaPorTurno: 2,
    arma_equipada: null,
    current_forma: 1,
    habilidades_por_forma: { 1: habs.map((h) => h.id) },
    all_habilidades_data: allHabilidadesData,
  };
}

/* Los combates espaciales siempre enfrentan al jugador contra una nave pirata genérica. */
const NAVE_ENEMIGA_NOMBRE = 'Pirata Espacial';

function getNaveEncuentroStats(npcEspacio) {
  const naveEnemiga = npcEspacio?.nave;
  const npcEnemigo  = npcEspacio?.npc;

  if (naveEnemiga) {
    return {
      vida: naveEnemiga.vida, escudo: naveEnemiga.escudo,
      ataque: naveEnemiga.ataque, defensa: naveEnemiga.maniobrabilidad,
      movimiento: naveEnemiga.maniobrabilidad, iniciativa: naveEnemiga.velocidad, punteria: naveEnemiga.ataque,
      nombre: NAVE_ENEMIGA_NOMBRE, imagen: naveEnemiga.imagen ?? null,
    };
  }
  if (npcEnemigo) {
    return {
      vida: npcEnemigo.vida, escudo: npcEnemigo.escudo,
      ataque: npcEnemigo.ataque, defensa: npcEnemigo.defensa,
      movimiento: npcEnemigo.movimiento, iniciativa: npcEnemigo.iniciativa, punteria: npcEnemigo.punteria,
      nombre: NAVE_ENEMIGA_NOMBRE, imagen: npcEnemigo.imagen_mini ?? npcEnemigo.imagen ?? null,
    };
  }
  return {
    vida: 30, escudo: 10, ataque: 8, defensa: 6, movimiento: 6, iniciativa: 8, punteria: 8,
    nombre: NAVE_ENEMIGA_NOMBRE, imagen: null,
  };
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


/* ─── SISTEMA DE DIÁLOGO RPG ────────────────────────────── */
/* ─── TIENDA DE NPC VENDEDOR (naves u objetos, con interés ya aplicado) ── */
/* Atributos de nave mostrados como badges en la tienda: ícono + etiqueta corta */
const NAVE_ATTRS = [
  { key: 'vida',             label: 'VID',    icon: 'anvil' },
  { key: 'escudo',           label: 'ESC',    icon: 'shield' },
  { key: 'velocidad',        label: 'VEL',    icon: 'zap' },
  { key: 'ataque',           label: 'ATQ',    icon: 'sword' },
  { key: 'maniobrabilidad',  label: 'MAN',    icon: 'trending' },
  { key: 'capacidad_salto',  label: 'SALTOS', icon: 'star' },
  { key: 'capacidad_carga',  label: 'CARGA',  icon: 'download' },
];

function TiendaModal({ npc, tipo, lugarImagen, onClose, onCreditsChange }) {
  const isMobile = useIsMobile();
  const isNaves = tipo === 'vendedor_naves';
  const [items, setItems]         = useState([]);
  const [inventario, setInventario] = useState(null); // { ocupado, capacidad } — solo objetos
  const [credits, setCredits]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [busy, setBusy]           = useState(null);
  const [confirmItem, setConfirmItem] = useState(null); // objeto pendiente de confirmar
  const [cantidad, setCantidad]   = useState(1);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const path = isNaves ? `/npcs/${npc.id}/tienda-naves` : `/npcs/${npc.id}/tienda-objetos`;
    apiFetch(path)
      .then((d) => {
        setItems(isNaves ? (d.naves ?? []) : (d.objetos ?? []));
        setInventario(d.inventario ?? null);
        if (d.credits !== undefined) setCredits(d.credits);
      })
      .catch(() => toast('No se pudo cargar la tienda', { tone: 'error', icon: 'x' }))
      .finally(() => setLoading(false));
  }, [npc.id, isNaves]);

  useEffect(() => { load(); }, [load]);

  const espacioDisponible = inventario ? Math.max(0, inventario.capacidad - inventario.ocupado) : null;

  const comprarNave = async (item) => {
    setBusy(item.id);
    try {
      const d = await apiPost(`/npcs/${npc.id}/naves/${item.id}/comprar`, {});
      if (d?.credits !== undefined) { onCreditsChange?.(d.credits); setCredits(d.credits); }
      toast('¡Gracias por su compra!', { tone: 'success', icon: 'coin', desc: `${item.nombre} · -${item.precio_final} cr` });
      load();
    } catch (err) {
      toast(err?.message || 'No se pudo completar la compra', { tone: 'error', icon: 'x' });
    } finally {
      setBusy(null);
    }
  };

  const abrirConfirmacion = (item) => { setConfirmItem(item); setCantidad(1); };
  const cerrarConfirmacion = () => { setConfirmItem(null); setCantidad(1); };

  const confirmarCompraObjeto = async () => {
    if (!confirmItem) return;
    setConfirming(true);
    try {
      const d = await apiPost(`/npcs/${npc.id}/objetos/${confirmItem.id}/comprar`, { cantidad });
      if (d?.credits !== undefined) { onCreditsChange?.(d.credits); setCredits(d.credits); }
      toast('¡Gracias por su compra!', {
        tone: 'success', icon: 'coin',
        desc: `${confirmItem.nombre} x${cantidad} · -${d?.precio_pagado ?? confirmItem.precio_final * cantidad} cr`,
      });
      cerrarConfirmacion();
      load();
    } catch (err) {
      toast(err?.message || 'No se pudo completar la compra', { tone: 'error', icon: 'x' });
    } finally {
      setConfirming(false);
    }
  };

  const inventarioLleno = !isNaves && inventario && espacioDisponible === 0;

  return (
    <Modal open onClose={onClose} title={npc.nombre} kicker={isNaves ? 'VENDEDOR DE NAVES' : 'VENDEDOR'} width={560} zIndex={1300}>
      {/* Retrato del vendedor */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <div style={{
          width: 60, height: 60, borderRadius: 12, flexShrink: 0, overflow: 'hidden',
          background: 'rgba(56,205,240,0.08)', border: '1px solid var(--holo-line)',
          display: 'grid', placeItems: 'center',
        }}>
          {(npc.imagen || npc.imagen_mini)
            ? <img src={mediaUrl(npc.imagen || npc.imagen_mini)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Icon name="user" size={24} style={{ color: 'var(--holo)' }} />}
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="nx-display" style={{ fontSize: 15 }}>{npc.nombre}</div>
          {npc.profesion && <div style={{ fontSize: 11, color: 'var(--txt-faint)', marginTop: 2 }}>{npc.profesion}</div>}
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '10px 12px',
        borderRadius: 'var(--radius-md)',
        background: inventarioLleno ? 'rgba(255,45,69,0.1)' : 'rgba(230,179,37,0.08)',
        border: `1px solid ${inventarioLleno ? 'rgba(255,45,69,0.35)' : 'rgba(230,179,37,0.25)'}`,
      }}>
        <Icon name={inventarioLleno ? 'x' : 'coin'} size={16} style={{ color: inventarioLleno ? '#ff6b6b' : 'var(--holocron-oro)', flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: inventarioLleno ? '#ff6b6b' : 'var(--txt-dim)' }}>
          {inventarioLleno
            ? `Tu inventario está lleno (${inventario.ocupado}/${inventario.capacidad}). Libera espacio para poder comprar objetos.`
            : <>Los precios ya incluyen el interés que {npc.nombre} aplica sobre cada {isNaves ? 'nave' : 'objeto'}.
              {!isNaves && inventario && ` Inventario: ${inventario.ocupado}/${inventario.capacidad} espacios usados.`}</>}
        </span>
      </div>

      <div style={{ position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        {lugarImagen && (
          <>
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: `url(${lugarImagen})`, backgroundSize: 'cover', backgroundPosition: 'center',
              opacity: 0.28,
            }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(4,7,15,0.6), rgba(4,7,15,0.88))' }} />
          </>
        )}
        <div style={{ position: 'relative', padding: lugarImagen ? 10 : 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--txt-faint)' }}>Cargando tienda...</div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--txt-faint)', fontSize: 12 }}>
              Este vendedor no tiene nada en existencia por ahora.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto' }}>
              {items.map((item) => (
                <div key={item.id} className="nx-panel solid" style={{
                  padding: isMobile ? 10 : 12, display: 'flex', flexDirection: 'column', gap: 8,
                  maxWidth: isNaves && isMobile ? 320 : undefined,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12 }}>
                    <div style={{
                      width: isMobile ? 36 : 44, height: isMobile ? 36 : 44, borderRadius: 8, background: 'rgba(56,205,240,0.08)',
                      display: 'grid', placeItems: 'center', flexShrink: 0, overflow: 'hidden',
                    }}>
                      {item.imagen
                        ? <img src={mediaUrl(item.imagen)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <Icon name={isNaves ? 'ship' : 'star'} size={20} style={{ color: 'var(--holo)' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="nx-display" style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.nombre}</div>
                      {!isNaves && item.tipo && (
                        <div style={{ fontSize: 10, color: 'var(--txt-faint)', fontFamily: 'var(--font-data)', marginTop: 3, textTransform: 'capitalize' }}>
                          {item.tipo.replace(/_/g, ' ')}
                        </div>
                      )}
                    </div>
                    <Btn kind="gold" sm icon="coin"
                      onClick={() => (isNaves ? comprarNave(item) : abrirConfirmacion(item))}
                      disabled={busy === item.id}
                    >
                      {busy === item.id ? '...' : `${item.precio_final} cr`}
                    </Btn>
                  </div>

                  {isNaves && (
                    <>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {NAVE_ATTRS.map(a => (
                          <span key={a.key} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 10, fontFamily: 'var(--font-data)', padding: '3px 7px', borderRadius: 5,
                            background: 'rgba(56,205,240,0.08)', border: '1px solid rgba(56,205,240,0.22)', color: 'var(--txt-dim)',
                          }}>
                            <Icon name={a.icon} size={11} style={{ color: 'var(--holo)' }} />
                            {a.label} {item[a.key]}
                          </span>
                        ))}
                      </div>
                      {item.habilidades?.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {item.habilidades.map(h => (
                            <span key={h.id} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              fontSize: 10, fontFamily: 'var(--font-data)', padding: '3px 7px', borderRadius: 5,
                              background: 'rgba(230,179,37,0.08)', border: '1px solid rgba(230,179,37,0.25)', color: 'var(--holocron-oro)',
                            }}>
                              <Icon name="zap" size={11} />
                              {h.nombre}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Créditos disponibles del jugador — para saber de un vistazo qué se puede pagar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        marginTop: 12, padding: '10px 12px', borderRadius: 'var(--radius-md)',
        background: 'rgba(230,179,37,0.1)', border: '1px solid rgba(230,179,37,0.3)',
      }}>
        <span style={{ fontSize: 11, color: 'var(--txt-dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="coin" size={14} style={{ color: 'var(--holocron-oro)' }} />
          Tus créditos
        </span>
        <span className="nx-num" style={{ fontSize: 16, color: 'var(--holocron-oro)' }}>
          {credits != null ? `${credits} cr` : '—'}
        </span>
      </div>

      {confirmItem && (
        <Modal open onClose={cerrarConfirmacion} title="Confirmar compra" kicker={npc.nombre} width={420} zIndex={1310}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 8, background: 'rgba(56,205,240,0.08)',
              display: 'grid', placeItems: 'center', flexShrink: 0, overflow: 'hidden',
            }}>
              {confirmItem.imagen
                ? <img src={mediaUrl(confirmItem.imagen)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <Icon name="star" size={22} style={{ color: 'var(--holo)' }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="nx-display" style={{ fontSize: 13 }}>{confirmItem.nombre}</div>
              <div style={{ fontSize: 11, color: 'var(--txt-faint)', fontFamily: 'var(--font-data)' }}>
                {confirmItem.precio_final} cr c/u
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <label className="nx-label" style={{ margin: 0 }}>Cantidad</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button type="button" onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                style={{
                  width: 36, height: 36, borderRadius: 6, border: '1px solid var(--holo-line)', background: 'rgba(255,255,255,0.04)',
                  color: 'var(--txt)', cursor: 'pointer', fontSize: 16, lineHeight: 1,
                }}
              >−</button>
              <input type="number" className="nx-input" min={1} max={espacioDisponible ?? 99}
                value={cantidad}
                onChange={(e) => {
                  const v = Math.max(1, Number(e.target.value) || 1);
                  setCantidad(espacioDisponible != null ? Math.min(v, Math.max(1, espacioDisponible)) : v);
                }}
                style={{ width: 56, textAlign: 'center', padding: '4px 6px' }}
              />
              <button type="button"
                onClick={() => setCantidad((c) => (espacioDisponible != null ? Math.min(espacioDisponible, c + 1) : c + 1))}
                disabled={espacioDisponible != null && cantidad >= espacioDisponible}
                style={{
                  width: 36, height: 36, borderRadius: 6, border: '1px solid var(--holo-line)', background: 'rgba(255,255,255,0.04)',
                  color: 'var(--txt)', cursor: 'pointer', fontSize: 16, lineHeight: 1,
                  opacity: (espacioDisponible != null && cantidad >= espacioDisponible) ? 0.4 : 1,
                }}
              >+</button>
            </div>
          </div>

          {espacioDisponible === 0 ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', marginBottom: 14,
              borderRadius: 'var(--radius-md)', background: 'rgba(255,45,69,0.1)', border: '1px solid rgba(255,45,69,0.35)',
              color: '#ff6b6b', fontSize: 12,
            }}>
              <Icon name="x" size={14} style={{ flexShrink: 0 }} />
              Tu inventario está lleno. No puedes comprar hasta liberar espacio.
            </div>
          ) : espacioDisponible != null && (
            <div style={{ fontSize: 10, color: 'var(--txt-faint)', marginBottom: 14 }}>
              Espacio disponible en tu inventario: {espacioDisponible}
            </div>
          )}

          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px',
            background: 'rgba(230,179,37,0.08)', border: '1px solid rgba(230,179,37,0.25)', borderRadius: 'var(--radius-md)', marginBottom: 8,
          }}>
            <span style={{ fontSize: 12, color: 'var(--txt-dim)' }}>Total a pagar</span>
            <span className="nx-num" style={{ fontSize: 18, color: 'var(--holocron-oro)' }}>{confirmItem.precio_final * cantidad} cr</span>
          </div>
          {credits != null && (
            <div style={{
              fontSize: 11, marginBottom: 18, textAlign: 'right',
              color: credits < confirmItem.precio_final * cantidad ? '#ff6b6b' : 'var(--txt-faint)',
            }}>
              Tus créditos: {credits} cr
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn kind="ghost" onClick={cerrarConfirmacion} disabled={confirming}>Cancelar</Btn>
            <Btn kind="accent" icon="check" onClick={confirmarCompraObjeto} disabled={confirming || espacioDisponible === 0}>
              {confirming ? 'Comprando...' : 'Confirmar compra'}
            </Btn>
          </div>
        </Modal>
      )}
    </Modal>
  );
}

function DialogoRPG({ npc, userCharacter, lugarImagen, onClose, onCombatStart, onRaidJoin, onMisionChange, onCreditsChange, onUserUpdate }) {
  const isMobile = useIsMobile();
  const isAI = Boolean(npc.prompt);
  const [showTienda, setShowTienda] = useState(false);
  const [messages, setMessages]   = useState([]);
  const [phase, setPhase]         = useState('greeting');
  const [typing, setTyping]       = useState(false);
  const [aiInput, setAiInput]     = useState('');
  const [remaining, setRemaining] = useState(null);
  const bottomRef                 = useRef(null);
  const [typingInMsg, setTypingInMsg] = useState(null); // { text, visibleChars }
  const [npcTextDelay, setNpcTextDelay] = useState(30); // ms por carácter

  const [misionInfo, setMisionInfo]   = useState(npc.mision_disponible ?? null);
  const [showMisionPopup, setShowMisionPopup] = useState(false);

  /* Si el NPC se resincroniza desde el padre (lugar refrescado tras completar
     una misión u obtener un hito), refleja su misión disponible actualizada
     sin necesidad de cerrar y reabrir el diálogo. */
  useEffect(() => {
    setMisionInfo(npc.mision_disponible ?? null);
  }, [npc]);
  const [misionBusy, setMisionBusy]   = useState(false);

  /* Bloquea el scroll de la página mientras el diálogo está en pantalla */
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);

  /* Carga el retraso_texto_npc desde configuraciones */
  useEffect(() => {
    apiFetch('/admin/configuraciones?q=retraso_texto_npc')
      .then(d => {
        const row = (d.data ?? d.items ?? []).find(r => r.nombre === 'retraso_texto_npc');
        if (row && row.valor_numerico > 0) setNpcTextDelay(row.valor_numerico);
      })
      .catch(() => {});
  }, []);

  /* Typewriter: avanza un carácter por tick */
  useEffect(() => {
    if (!typingInMsg) return;
    if (typingInMsg.visibleChars >= typingInMsg.text.length) {
      setMessages(prev => [...prev, { from: 'npc', text: typingInMsg.text, ts: Date.now() }]);
      setTypingInMsg(null);
      return;
    }
    const t = setTimeout(() => {
      setTypingInMsg(prev => prev ? { ...prev, visibleChars: prev.visibleChars + 1 } : null);
    }, npcTextDelay);
    return () => clearTimeout(t);
  }, [typingInMsg, npcTextDelay]);

  const showNpcMsg = (text) => setTypingInMsg({ text, visibleChars: 0 });

  const npcTipo      = (npc.tipo ?? '').toLowerCase();
  const isAliado     = npcTipo === 'aliado';
  const isHostil     = npcTipo === 'hostil';
  const isEntrenador = npcTipo === 'entrenador';
  const isVendedor       = npcTipo === 'vendedor';
  const isVendedorNaves  = npcTipo === 'vendedor_naves';
  const isJefe       = npcTipo === 'jefe';
  const isNeutral    = !isAliado && !isHostil && !isEntrenador && !isJefe;

  const startCombat = useCallback(() => { onCombatStart?.(npcTipo); onClose(); }, [npcTipo]);

  /* Los jefes se combaten en Combate RAID (varios jugadores vs 1, cupos configurables): en vez de iniciar
     un combate normal, se une a la cola de espera de ese NPC. */
  const joinRaid = useCallback(() => { onRaidJoin?.(npc); onClose(); }, [npc]);

  const attackNeutral = useCallback(() => {
    postReputation(-50);
    toast('−50 reputación por atacar a un neutral', { tone: 'error', icon: 'shield' });
    onCombatStart?.(npcTipo);
    onClose();
  }, [npcTipo]);

  const checkHostileAttack = useCallback(() => {
    if (!isHostil) return;
    if (Math.floor(Math.random() * 6) + 1 >= 4) {
      setTimeout(() => {
        showNpcMsg(`*${npc.nombre} adopta una postura amenazante y ataca*`);
        setTimeout(() => { onCombatStart?.(npcTipo); onClose(); }, 900);
      }, 1100);
    }
  }, [isHostil, npc.nombre, npcTipo]);

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

  /* El panel de opciones (diálogo estático) debe aparecer si hay algo que mostrar en él:
     opciones de diálogo, misión disponible, o los botones de Comprar/Atacar. */
  const hasSidebarContent = npcOptions.length > 0 || Boolean(misionInfo)
    || isVendedor || isVendedorNaves || (!isAliado && npc.ataque > 0);

  /* Referencias [Objeto] / @[NPC] presentes en los textos del NPC: se resuelven
     una vez por nombre nuevo y se cachean para pintar los tokens + tooltip. */
  const [refsMap, setRefsMap] = useState({ objeto: new Map(), npc: new Map() });
  const resolvedNamesRef = useRef({ objeto: new Set(), npc: new Set() });

  useEffect(() => {
    const npcTexts = [
      npc.saludo,
      ...npcOptions.map(o => o.response),
      ...messages.filter(m => m.from === 'npc').map(m => m.text),
    ].filter(Boolean);

    const nuevos = { objeto: [], npc: [] };
    npcTexts.forEach(text => {
      parseRefTokens(text).forEach(tok => {
        if (tok.type === 'text') return;
        const key = tok.name.toLowerCase();
        if (!resolvedNamesRef.current[tok.type].has(key)) {
          resolvedNamesRef.current[tok.type].add(key);
          nuevos[tok.type].push(tok.name);
        }
      });
    });

    if (!nuevos.objeto.length && !nuevos.npc.length) return;

    const params = new URLSearchParams();
    if (nuevos.objeto.length) params.set('objetos', nuevos.objeto.join(','));
    if (nuevos.npc.length)    params.set('npcs', nuevos.npc.join(','));

    apiFetch(`/npcs/refs?${params.toString()}`)
      .then(d => {
        setRefsMap(prev => {
          const objeto = new Map(prev.objeto);
          const npcM   = new Map(prev.npc);
          (d.objetos ?? []).forEach(o => objeto.set(o.nombre.toLowerCase(), o));
          (d.npcs ?? []).forEach(n => npcM.set(n.nombre.toLowerCase(), n));
          return { objeto, npc: npcM };
        });
      })
      .catch(() => {});
  }, [npc.saludo, npcOptions, messages]);

  useEffect(() => {
    if (isAI) return;
    if (npc.saludo) {
      setTyping(true);
      setTimeout(() => {
        showNpcMsg(npc.saludo);
        setTyping(false);
        if (hasSidebarContent) setPhase('dialog');
      }, 800);
    } else if (hasSidebarContent) {
      setPhase('dialog');
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
            showNpcMsg(npc.saludo);
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
        showNpcMsg(data.reply);
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
  }, [messages, typing, typingInMsg]);

  const handleOption = useCallback(async (opt) => {
    setMessages(prev => [...prev, { from: 'player', text: opt.keyword, ts: Date.now() }]);
    setTyping(true);

    if (opt.misionId) {
      try {
        const d = await apiPost(`/misiones/${opt.misionId}/accept`, {});
        toast('¡Misión aceptada!', { tone: 'success', icon: 'star' });
        if (d?.mision) setMisionInfo(d.mision);
      } catch {
        toast('Error al aceptar la misión', { tone: 'error', icon: 'x' });
      }
    }

    setTimeout(() => {
      showNpcMsg(opt.response);
      setTyping(false);
      checkHostileAttack();
    }, 800);
  }, [checkHostileAttack]);

  const consultarMision = useCallback(() => {
    if (!misionInfo || typing) return;
    setMessages(prev => [...prev, { from: 'player', text: 'Consultar por misión', ts: Date.now() }]);
    setTyping(true);
    setTimeout(() => {
      showNpcMsg(misionInfo.descripcion || misionInfo.mision || '...');
      setTyping(false);
      setShowMisionPopup(true);
    }, 800);
  }, [misionInfo, typing]);

  const handleAceptarMision = useCallback(async () => {
    if (!misionInfo) return;
    setMisionBusy(true);
    try {
      const d = await apiPost(`/misiones/${misionInfo.id}/accept`, {});
      toast('¡Misión aceptada!', { tone: 'success', icon: 'star' });
      if (d?.mision) {
        setMisionInfo(prev => ({ ...prev, ...d.mision }));
      } else {
        setMisionInfo(prev => ({ ...prev, estado: 'pendiente' }));
      }
      setShowMisionPopup(false);
      onMisionChange?.();
    } catch {
      toast('Error al aceptar la misión', { tone: 'error', icon: 'x' });
    } finally {
      setMisionBusy(false);
    }
  }, [misionInfo, onMisionChange]);

  const handleCompletarMision = useCallback(async () => {
    if (!misionInfo) return;
    setMisionBusy(true);
    try {
      const d = await apiPost(`/misiones/${misionInfo.id}/completar`, {});
      toast('¡Misión completada!', { tone: 'success', icon: 'check' });
      (d?.hitos_otorgados ?? []).forEach((hito) => {
        toast(`🏆 Hito obtenido: "${hito}"`, { tone: 'success', icon: 'star' });
      });
      setMisionInfo(prev => ({ ...prev, estado: 'completada' }));
      setShowMisionPopup(false);
      onMisionChange?.();

      // Las recompensas (créditos, hitos, títulos) ya se otorgaron en el servidor —
      // refresca el usuario global para que se reflejen sin recargar la página
      // (p. ej. el widget de Hitos en Comando).
      apiFetch('/me').then((me) => onUserUpdate?.(me)).catch(() => {});
    } catch (e) {
      toast(e.message || 'Error al completar la misión', { tone: 'error', icon: 'x' });
    } finally {
      setMisionBusy(false);
    }
  }, [misionInfo, onMisionChange, onUserUpdate]);

  const STATS = [
    { label: 'VID', val: npc.vida },
    { label: 'ESC', val: npc.escudo },
    { label: 'DEF', val: npc.defensa },
    { label: 'ATQ', val: npc.ataque },
    { label: 'AGI', val: npc.movimiento },
    { label: 'INI', val: npc.iniciativa },
    { label: 'PNT', val: npc.punteria },
  ].filter(s => s.val > 0);

  const statsCluster = STATS.length > 0 && (
    <div style={{
      display: 'flex', gap: 6, padding: '6px 10px', flexWrap: 'wrap',
      background: 'rgba(4,7,15,0.5)', borderRadius: 8, border: '1px solid var(--holo-line)',
    }}>
      {STATS.map(s => (
        <div key={s.label} style={{ textAlign: 'center' }}>
          <div className="nx-num" style={{ fontSize: 14, color: s.label === 'ATQ' ? 'var(--holocron-naranja)' : s.label === 'VID' ? '#10b981' : 'var(--holo)' }}>
            {s.val}
          </div>
          <div style={{ fontSize: 8, color: 'var(--txt-faint)', fontFamily: 'var(--font-data)', letterSpacing: '0.08em' }}>
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );

  const remainingBox = isAI && remaining !== null && (
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
  );

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1200,
      background: 'rgba(2,5,12,0.88)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: isMobile ? 6 : 16,
      animation: 'nx-fade-up 0.3s ease both',
    }}>
    <div className="nx-panel solid nx-panel-glow" style={{
      width: '100%', maxWidth: 920,
      height: '100%', maxHeight: 680,
      borderRadius: 16, overflow: 'hidden',
      display: 'flex', flexDirection: 'column', alignItems: 'stretch',
    }}>
      {/* barra superior — retrato del NPC */}
      <div style={{
        background: 'rgba(7,16,31,0.95)', borderBottom: '1px solid var(--holo-line)',
        padding: isMobile ? '10px 12px' : '12px 20px', flexShrink: 0,
        display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 14 }}>
          {/* retrato */}
          <div style={{
            width: isMobile ? 42 : 56, height: isMobile ? 42 : 56, borderRadius: 8, overflow: 'hidden',
            border: '2px solid var(--holo-line)', flexShrink: 0,
            background: 'rgba(56,205,240,0.08)', display: 'grid', placeItems: 'center',
          }}>
            {npc.imagen_mini || npc.imagen
              ? <img src={mediaUrl(npc.imagen_mini) || mediaUrl(npc.imagen)} alt={npc.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <Icon name="user" size={24} style={{ color: 'var(--holo)', opacity: 0.5 }} />
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="nx-display" style={{
              fontSize: isMobile ? 14 : 16, color: 'var(--txt)', marginBottom: 2,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{npc.nombre}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {npc.ataque > 0 && npc.nivel > 0 && (
                <div title={`Nivel de dificultad ${npc.nivel}`} style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {Array.from({ length: Math.min(npc.nivel, 5) }, (_, i) => (
                    <Icon key={i} name="star" fill size={11} style={{ color: '#E6B325' }} />
                  ))}
                  {npc.nivel > 5 && <span style={{ fontSize: 9, color: '#E6B325', fontFamily: 'var(--font-data)', marginLeft: 2 }}>×{npc.nivel}</span>}
                </div>
              )}
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
                    : isEntrenador
                    ? { background: 'rgba(56,205,240,0.14)', border: '1px solid rgba(56,205,240,0.35)', color: '#38cdf0' }
                    : { background: 'rgba(230,179,37,0.14)', border: '1px solid rgba(230,179,37,0.35)', color: '#E6B325' }
                  ),
                }}>
                  {isAliado ? '▲ ALIADO' : isHostil ? '⚠ HOSTIL' : isEntrenador ? '◆ ENTRENADOR'
                    : isVendedorNaves ? '⛁ VENDEDOR DE NAVES' : isVendedor ? '⛁ VENDEDOR' : '◈ NEUTRAL'}
                </span>
              )}
            </div>
          </div>

          {/* stats combate + contador de respuestas — en la misma fila solo en desktop */}
          {!isMobile && statsCluster}
          {!isMobile && remainingBox}

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

        {/* en mobile, stats + contador bajan a una segunda fila para no apretar el header */}
        {isMobile && (statsCluster || remainingBox) && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {statsCluster}
            {remainingBox}
          </div>
        )}
      </div>

      {/* cuerpo: mensajes + barra lateral de opciones (mobile: apilados en columna) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', overflow: 'hidden' }}>

        {/* área de mensajes */}
        <div style={{
          flex: 1, minHeight: 0, overflowY: 'auto', padding: isMobile ? '14px 14px' : '20px 24px',
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
                maxWidth: isMobile ? '86%' : '72%', padding: '11px 15px', borderRadius: 12,
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
                {m.from === 'npc' ? <RichNpcText text={m.text} refsMap={refsMap} /> : m.text}
              </div>
            </div>
          ))}

          {typingInMsg && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', animation: 'nx-fade-up 0.2s ease both' }}>
              <div style={{
                maxWidth: isMobile ? '86%' : '72%', padding: '11px 15px', borderRadius: 12,
                fontSize: 13, lineHeight: 1.55,
                background: 'rgba(12,30,64,0.7)', border: '1px solid var(--holo-line)',
                color: 'var(--txt)', borderBottomLeftRadius: 4,
              }}>
                <div style={{ fontSize: 9, color: 'var(--holo)', fontFamily: 'var(--font-data)', letterSpacing: '0.12em', marginBottom: 5 }}>
                  {npc.nombre.toUpperCase()}
                </div>
                {typingInMsg.text.slice(0, typingInMsg.visibleChars)}
                <span style={{ display: 'inline-block', width: 2, height: '1em', background: 'var(--holo)', marginLeft: 2, verticalAlign: 'text-bottom', animation: 'nx-pulse 0.7s infinite' }} />
              </div>
            </div>
          )}

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

        {/* panel lateral: modo AI o diálogo estático (mobile: full width, debajo del chat) */}
        {isAI ? (
          <div style={{
            width: isMobile ? '100%' : 230, flexShrink: 0,
            borderLeft: isMobile ? 'none' : '1px solid var(--holo-line)',
            borderTop: isMobile ? '1px solid var(--holo-line)' : 'none',
            maxHeight: isMobile ? '45%' : undefined,
            overflowY: isMobile ? 'auto' : 'visible',
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
            {misionInfo && (
              <div style={{ padding: '10px 12px 0' }}>
                <button onClick={consultarMision} disabled={typing} style={{
                  width: '100%', textAlign: 'left', background: 'rgba(230,179,37,0.10)',
                  border: '1px solid rgba(230,179,37,0.35)', borderRadius: 8, padding: '9px 11px',
                  cursor: typing ? 'wait' : 'pointer', fontSize: 12, color: '#E6B325',
                  display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
                  opacity: typing ? 0.45 : 1,
                }}
                  onMouseEnter={e => { if (typing) return; e.currentTarget.style.background = 'rgba(230,179,37,0.20)'; e.currentTarget.style.borderColor = '#E6B325'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(230,179,37,0.10)'; e.currentTarget.style.borderColor = 'rgba(230,179,37,0.35)'; }}
                >
                  <span style={{ width: 18, height: 18, borderRadius: 4, background: 'rgba(230,179,37,0.20)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 900, flexShrink: 0 }}>!</span>
                  <span>Consultar por misión</span>
                </button>
              </div>
            )}
            <div style={{ flex: 1 }} />
            {(isVendedor || isVendedorNaves) && (
              <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(230,179,37,0.15)' }}>
                <button onClick={() => setShowTienda(true)} style={{
                  width: '100%', textAlign: 'left', background: 'rgba(230,179,37,0.10)',
                  border: '1px solid rgba(230,179,37,0.35)', borderRadius: 8, padding: '9px 11px',
                  cursor: 'pointer', fontSize: 12, color: 'var(--holocron-oro)',
                  display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(230,179,37,0.20)'; e.currentTarget.style.borderColor = '#E6B325'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(230,179,37,0.10)'; e.currentTarget.style.borderColor = 'rgba(230,179,37,0.35)'; }}
                >
                  <span style={{ width: 18, height: 18, borderRadius: 4, background: 'rgba(230,179,37,0.20)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Icon name="coin" size={11} />
                  </span>
                  <span>Comprar{isVendedorNaves ? ' naves' : ''}</span>
                </button>
              </div>
            )}
            {!isAliado && npc.ataque > 0 && (
              <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,45,69,0.15)' }}>
                <button onClick={isJefe ? joinRaid : (isNeutral ? attackNeutral : startCombat)} style={{
                  width: '100%', textAlign: 'left', background: 'rgba(255,45,69,0.08)',
                  border: '1px solid rgba(255,45,69,0.28)', borderRadius: 8, padding: '9px 11px',
                  cursor: 'pointer', fontSize: 12, color: '#ff6b6b',
                  display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,45,69,0.18)'; e.currentTarget.style.borderColor = '#ff2d45'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,45,69,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,45,69,0.28)'; }}
                >
                  <span style={{ width: 18, height: 18, borderRadius: 4, background: 'rgba(255,45,69,0.2)', display: 'grid', placeItems: 'center', fontSize: 10, flexShrink: 0 }}>⚔</span>
                  <span>{isJefe ? 'UNIRSE AL ASALTO' : `ATACAR${isNeutral ? ' (−rep)' : ''}`}</span>
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
          hasSidebarContent && phase === 'dialog' && (
            <div style={{
              width: isMobile ? '100%' : 210, flexShrink: 0,
              borderLeft: isMobile ? 'none' : '1px solid var(--holo-line)',
              borderTop: isMobile ? '1px solid var(--holo-line)' : 'none',
              maxHeight: isMobile ? '45%' : undefined,
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
              {misionInfo && (
                <button onClick={consultarMision} disabled={typing} style={{
                  width: '100%', textAlign: 'left', background: 'rgba(230,179,37,0.10)',
                  border: '1px solid rgba(230,179,37,0.35)', borderRadius: 8, padding: '9px 11px',
                  cursor: typing ? 'wait' : 'pointer', fontSize: 12, color: '#E6B325',
                  display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
                  opacity: typing ? 0.45 : 1,
                }}
                  onMouseEnter={e => { if (typing) return; e.currentTarget.style.background = 'rgba(230,179,37,0.20)'; e.currentTarget.style.borderColor = '#E6B325'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(230,179,37,0.10)'; e.currentTarget.style.borderColor = 'rgba(230,179,37,0.35)'; }}
                >
                  <span style={{ width: 18, height: 18, borderRadius: 4, background: 'rgba(230,179,37,0.20)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 900, flexShrink: 0 }}>!</span>
                  <span>Consultar por misión</span>
                </button>
              )}
              {(isVendedor || isVendedorNaves) && (
                <button onClick={() => setShowTienda(true)} style={{
                  width: '100%', textAlign: 'left', background: 'rgba(230,179,37,0.10)',
                  border: '1px solid rgba(230,179,37,0.35)', borderRadius: 8, padding: '9px 11px',
                  cursor: 'pointer', fontSize: 12, color: 'var(--holocron-oro)',
                  display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(230,179,37,0.20)'; e.currentTarget.style.borderColor = '#E6B325'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(230,179,37,0.10)'; e.currentTarget.style.borderColor = 'rgba(230,179,37,0.35)'; }}
                >
                  <span style={{ width: 18, height: 18, borderRadius: 4, background: 'rgba(230,179,37,0.20)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Icon name="coin" size={11} />
                  </span>
                  <span>Comprar{isVendedorNaves ? ' naves' : ''}</span>
                </button>
              )}
              {!isAliado && npc.ataque > 0 && (
                <button onClick={isJefe ? joinRaid : (isNeutral ? attackNeutral : startCombat)} style={{
                  width: '100%', textAlign: 'left', background: 'rgba(255,45,69,0.08)',
                  border: '1px solid rgba(255,45,69,0.28)', borderRadius: 8, padding: '9px 11px',
                  cursor: 'pointer', fontSize: 12, color: '#ff6b6b',
                  display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,45,69,0.18)'; e.currentTarget.style.borderColor = '#ff2d45'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,45,69,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,45,69,0.28)'; }}
                >
                  <span style={{ width: 18, height: 18, borderRadius: 4, background: 'rgba(255,45,69,0.2)', display: 'grid', placeItems: 'center', fontSize: 10, flexShrink: 0 }}>⚔</span>
                  <span>{isJefe ? 'UNIRSE AL ASALTO' : `ATACAR${isNeutral ? ' (−rep)' : ''}`}</span>
                </button>
              )}
              {npcOptions.map((opt, i) => (
                <button key={i} onClick={() => {
                  if (typing) return;
                  playSound('click_npc');
                  handleOption(opt);
                }} disabled={typing}
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
                    playSound('click_minimo');
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
    </div>

      {showMisionPopup && misionInfo && (
        <MisionOfrecidaPopup
          mision={misionInfo}
          busy={misionBusy}
          onClose={() => setShowMisionPopup(false)}
          onAceptar={handleAceptarMision}
          onCompletar={handleCompletarMision}
        />
      )}

      {showTienda && (
        <TiendaModal
          npc={npc}
          tipo={isVendedorNaves ? 'vendedor_naves' : 'vendedor'}
          lugarImagen={lugarImagen}
          onClose={() => setShowTienda(false)}
          onCreditsChange={onCreditsChange}
        />
      )}

    </div>,
    document.body
  );
}

/* ─── POPUP DE MISIÓN OFRECIDA POR NPC ─────────────────── */
function MisionOfrecidaPopup({ mision, busy, onClose, onAceptar, onCompletar }) {
  const isMobile = useIsMobile();
  const ESTADO_LABEL = { pendiente: 'Pendiente', 'en-curso': 'En curso', completada: 'Completada' };
  const ESTADO_COLOR = { pendiente: '#E6B325', 'en-curso': '#38cdf0', completada: '#10b981' };
  const recIcon = (t) => t === 'creditos' ? '💰' : t === 'titulo' ? '🏷️' : t === 'insignia' ? '🏅' : t === 'hito' ? '⭐' : t === 'habilidad' ? '⚡' : '📦';

  const hitosReq = mision.hito_requerimiento
    ? mision.hito_requerimiento.split(',').map(h => h.trim()).filter(Boolean)
    : [];

  return (
    <div onMouseDown={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1300,
      background: 'rgba(2,5,12,0.78)', backdropFilter: 'blur(6px)',
      display: 'flex', justifyContent: 'center', alignItems: 'center', padding: isMobile ? 8 : 20,
      animation: 'nx-fade-up 0.25s ease both',
    }}>
      <div onMouseDown={e => e.stopPropagation()} className="nx-panel solid nx-panel-glow" style={{
        width: 480, maxWidth: '100%', minWidth: 0, maxHeight: isMobile ? '92vh' : '86vh', overflowY: 'auto',
      }}>
        {mision.foto_mision && (
          <div style={{ height: isMobile ? 90 : 140, overflow: 'hidden' }}>
            <img src={mediaUrl(mision.foto_mision)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}
        <header className="nx-panel-head">
          <div style={{ flex: 1 }}>
            <div className="nx-kicker" style={{ marginBottom: 2, color: '#E6B325' }}>MISIÓN</div>
            <div className="nx-display" style={{ fontSize: 15 }}>{mision.nombre}</div>
          </div>
          {mision.estado && (
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-data)', letterSpacing: '0.1em',
              padding: '3px 9px', borderRadius: 4, fontWeight: 700,
              background: `${ESTADO_COLOR[mision.estado]}18`, border: `1px solid ${ESTADO_COLOR[mision.estado]}55`,
              color: ESTADO_COLOR[mision.estado],
            }}>{ESTADO_LABEL[mision.estado]?.toUpperCase()}</span>
          )}
          <button className="nx-btn nx-btn-ghost nx-btn-sm" onClick={onClose} style={{ padding: 5 }}><Icon name="x" size={13} /></button>
        </header>
        <div className="nx-panel-body" style={{ display: 'grid', gap: 16 }}>
          {mision.mision && (
            <p style={{ fontSize: 13, color: 'var(--txt)', fontWeight: 600, margin: 0 }}>{mision.mision}</p>
          )}
          {mision.descripcion && (
            <p style={{ fontSize: 12.5, color: 'var(--txt-dim)', lineHeight: 1.6, margin: 0 }}>{mision.descripcion}</p>
          )}

          {mision.objetivos?.length > 0 && (
            <div>
              <div className="nx-kicker" style={{ marginBottom: 8 }}>OBJETIVOS</div>
              <div style={{ display: 'grid', gap: 7 }}>
                {mision.objetivos.map(o => (
                  <div key={o.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px',
                    background: 'rgba(56,205,240,0.05)', border: '1px solid var(--holo-line)', borderRadius: 7,
                  }}>
                    <Icon name="target" size={13} style={{ color: 'var(--holo)', marginTop: 1, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--txt)', fontWeight: 600 }}>
                        {o.nombre}{o.meta > 1 ? ` (${o.meta}${o.unidad ? ` ${o.unidad}` : ''})` : ''}
                      </div>
                      {o.descripcion && <div style={{ fontSize: 11, color: 'var(--txt-faint)', marginTop: 2 }}>{o.descripcion}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {mision.recompensas?.length > 0 && (
            <div>
              <div className="nx-kicker" style={{ marginBottom: 8 }}>RECOMPENSAS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {mision.recompensas.map(r => (
                  <div key={r.id} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
                    background: 'rgba(230,179,37,0.08)', border: '1px solid rgba(230,179,37,0.25)', borderRadius: 20,
                  }}>
                    <span style={{ fontSize: 13 }}>{recIcon(r.tipo)}</span>
                    <span style={{ fontSize: 11, color: 'var(--txt)' }}>
                      {r.tipo === 'creditos' ? `${r.valor} créditos` : r.tipo === 'hito' ? (r.hito || r.nombre) : (r.habilidad?.nombre || r.objeto?.nombre || r.nombre)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hitosReq.length > 0 && mision.estado !== 'completada' && (
            <div style={{ fontSize: 11, color: mision.puede_completar ? '#10b981' : 'var(--txt-faint)' }}>
              Requiere: {hitosReq.join(', ')}
            </div>
          )}

          {mision.estado === 'completada' ? (
            <div style={{ fontSize: 12, color: '#10b981', textAlign: 'right' }}>Ya completaste esta misión.</div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
              {!mision.estado && (
                <Btn kind="accent" icon="star" onClick={onAceptar} disabled={busy}>
                  {busy ? 'Aceptando...' : 'Aceptar misión'}
                </Btn>
              )}
              {(mision.estado === 'pendiente' || mision.estado === 'en-curso') && (
                <Btn kind="accent" icon="check" onClick={onCompletar} disabled={busy || !mision.puede_completar}>
                  {busy ? 'Completando...' : 'Completar misión'}
                </Btn>
              )}
            </div>
          )}
        </div>
      </div>
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
    <div className="nx-panel solid" style={{ marginTop: 16, padding: 0, overflow: 'hidden' }}>
      <div style={{
        padding: '10px 14px', borderBottom: presentes.length > 0 ? '1px solid var(--holo-line)' : 'none',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <Icon name="user" size={13} style={{ color: 'var(--holo)', opacity: 0.7 }} />
        <span className="nx-kicker" style={{ fontSize: 9, letterSpacing: '0.14em' }}>PRESENTES</span>
        {presentes.length > 0 && (
          <span style={{
            fontSize: 9, fontFamily: 'var(--font-data)',
            color: 'var(--holo)', background: 'rgba(56,205,240,0.12)',
            border: '1px solid rgba(56,205,240,0.25)', borderRadius: 10,
            padding: '1px 7px',
          }}>{presentes.length}</span>
        )}
      </div>

      {presentes.length === 0 ? (
        <div style={{
          padding: '14px', textAlign: 'center',
          color: 'var(--txt-faint)', fontSize: 11, fontFamily: 'var(--font-data)',
        }}>
          Nadie presente aquí
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 14px' }}>
          {presentes.map((p) => {
            const color = SABER_COLORS[p.saber_color] ?? '#38cdf0';
            const photoUrl = mediaUrl(p.photo);
            const isMe = p.user_id === myUserId;
            return (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 8px 5px 5px', borderRadius: 20,
                background: 'rgba(255,255,255,0.02)', border: '1px solid var(--holo-line)',
              }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
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
                <div style={{
                  fontSize: 11, color: 'var(--txt)', fontFamily: 'var(--font-data)',
                  fontWeight: 600, whiteSpace: 'nowrap',
                }}>
                  @{p.handle}{isMe && <span style={{ color: 'var(--holo)' }}> (tú)</span>}
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

  /* Bloquea el scroll de la página mientras el chat está en pantalla */
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);

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

  return createPortal(
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
    </div>,
    document.body
  );
}

/* ─── RETO DE COMBATE RECIBIDO ───────────────────────────── */
function PvpChallengeReceived({ combat, onAccept, onDecline, lugarImagen }) {
  const [busy, setBusy] = useState(false);
  const attacker  = combat.attacker;
  const color     = SABER_COLORS[attacker?.saber_color] ?? '#38cdf0';
  const photoUrl  = mediaUrl(attacker?.photo_url);

  /* Bloquea el scroll de la página mientras el popup está en pantalla */
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);

  const AUTH = () => {
    const t = localStorage.getItem('nx-token');
    return { Accept: 'application/json', Authorization: `Bearer ${t}` };
  };
  const apiPost = (path, data) =>
    fetch(`/api${path}`, {
      method: 'POST',
      headers: { ...AUTH(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });

  const handleAccept = async () => {
    setBusy(true);
    try {
      const d = await apiPost(`/pvp/${combat.id}/accept`, {});
      if (d?.combat) onAccept(d.combat);
    } catch {
      toast('Error al aceptar el reto', { tone: 'error', icon: 'x' });
      setBusy(false);
    }
  };

  const handleDecline = async () => {
    setBusy(true);
    try {
      await apiPost(`/pvp/${combat.id}/decline`, {});
      onDecline();
    } catch {
      toast('Error al rechazar el reto', { tone: 'error', icon: 'x' });
      setBusy(false);
    }
  };

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {lugarImagen
        ? <img src={lugarImagen} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
        : null
      }
      <div style={{
        position: 'absolute', inset: 0,
        background: lugarImagen
          ? 'linear-gradient(to bottom, rgba(4,7,15,0.55) 0%, rgba(4,7,15,0.82) 60%, rgba(4,7,15,0.97) 100%)'
          : 'rgba(4,7,15,0.92)',
      }} />

      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: 400, padding: '0 24px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24,
      }}>
        {/* Etiqueta transmisión entrante */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div className="nx-display" style={{
            fontSize: 9, color: '#E6B325', letterSpacing: '0.22em',
            border: '1px solid rgba(230,179,37,0.4)', padding: '3px 14px', borderRadius: 2,
          }}>
            TRANSMISIÓN ENTRANTE
          </div>
          <div className="nx-display" style={{
            fontSize: 14, color: '#fff', letterSpacing: '0.14em',
            textShadow: '0 0 24px rgba(230,179,37,0.4)',
          }}>
            ⚔ RETO DE COMBATE
          </div>
        </div>

        {/* Avatar del retador */}
        <div style={{
          width: 80, height: 80, borderRadius: 14,
          border: `2px solid ${color}`,
          overflow: 'hidden',
          display: 'grid', placeItems: 'center',
          background: 'rgba(255,255,255,0.06)',
          boxShadow: `0 0 24px ${color}44`,
        }}>
          {photoUrl
            ? <img src={photoUrl} alt={attacker?.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Icon name="user" size={32} style={{ color, opacity: 0.6 }} />
          }
        </div>

        {/* Info del retador */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
            {attacker?.name ?? 'Desconocido'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--txt-faint)', fontFamily: 'var(--font-data)' }}>
            @{attacker?.handle ?? '?'} te reta a un duelo
          </div>
        </div>

        {/* Botones */}
        <div style={{ display: 'flex', gap: 14, width: '100%' }}>
          <button
            onClick={handleDecline}
            disabled={busy}
            style={{
              flex: 1, padding: '12px 0', borderRadius: 10, cursor: busy ? 'not-allowed' : 'pointer',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.18)',
              color: 'var(--txt-dim)', fontFamily: 'var(--font-data)', fontSize: 11,
              letterSpacing: '0.14em', transition: 'all 0.14s', opacity: busy ? 0.4 : 1,
            }}
            onMouseEnter={e => { if (!busy) { e.currentTarget.style.background = 'rgba(255,45,69,0.12)'; e.currentTarget.style.borderColor = 'rgba(255,45,69,0.5)'; e.currentTarget.style.color = '#ff6b6b'; } }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; e.currentTarget.style.color = 'var(--txt-dim)'; }}
          >
            RECHAZAR
          </button>
          <button
            onClick={handleAccept}
            disabled={busy}
            style={{
              flex: 1, padding: '12px 0', borderRadius: 10, cursor: busy ? 'not-allowed' : 'pointer',
              background: 'rgba(230,179,37,0.14)', border: '1px solid rgba(230,179,37,0.5)',
              color: '#E6B325', fontFamily: 'var(--font-data)', fontSize: 11,
              letterSpacing: '0.14em', transition: 'all 0.14s', opacity: busy ? 0.4 : 1,
            }}
            onMouseEnter={e => { if (!busy) { e.currentTarget.style.background = 'rgba(230,179,37,0.26)'; e.currentTarget.style.borderColor = '#E6B325'; } }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(230,179,37,0.14)'; e.currentTarget.style.borderColor = 'rgba(230,179,37,0.5)'; }}
          >
            {busy ? 'INICIANDO…' : '⚔ ACEPTAR'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─── CONFIRMACIÓN DE ATAQUE PVP ────────────────────────── */
function PvpAttackConfirm({ target, onConfirm, onCancel, busy, lugarImagen }) {
  const color    = SABER_COLORS[target?.saber_color] ?? '#38cdf0';
  const photoUrl = mediaUrl(target?.photo);

  /* Bloquea el scroll de la página mientras el popup está en pantalla */
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);

  return createPortal(
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
    </div>,
    document.body
  );
}

/* ─── PROPUESTA DE COMERCIO (construir oferta) ──────────── */
function TradeOfferModal({ target, userCharacter, onClose, onSent }) {
  const inventario = userCharacter?.rol_objetos ?? [];
  const misCreditos = userCharacter?.credits ?? 0;

  const [selected, setSelected]           = useState({});
  const [offerCredits, setOfferCredits]   = useState(0);
  const [requestCredits, setRequestCredits] = useState(0);
  const [sending, setSending]             = useState(false);

  const setCantidad = (objetoId, cantidad, max) => {
    const v = Math.max(0, Math.min(max, Number(cantidad) || 0));
    setSelected((prev) => {
      const next = { ...prev };
      if (v > 0) next[objetoId] = v; else delete next[objetoId];
      return next;
    });
  };

  const items = Object.entries(selected).map(([rol_objeto_id, cantidad]) => ({
    rol_objeto_id: Number(rol_objeto_id), cantidad,
  }));
  const ofertaVacia = offerCredits <= 0 && requestCredits <= 0 && items.length === 0;

  const send = async () => {
    if (ofertaVacia || sending) return;
    setSending(true);
    try {
      const d = await apiPost('/trades/propose', {
        target_id: target.user_id,
        offer_credits: offerCredits,
        request_credits: requestCredits,
        items,
      });
      toast('Propuesta de comercio enviada', { tone: 'success', icon: 'coin' });
      onSent?.(d?.trade);
    } catch (err) {
      toast(err.message || 'No se pudo enviar la propuesta', { tone: 'error', icon: 'x' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Comerciar con @${target?.handle ?? '?'}`} kicker="PROPUESTA DE INTERCAMBIO" width={440}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div className="nx-kicker" style={{ marginBottom: 8 }}>TU OFERTA</div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--txt-dim)' }}>Créditos a ofrecer (tienes {misCreditos})</span>
            <input
              type="number" min={0} max={misCreditos} className="nx-input"
              value={offerCredits}
              onChange={(e) => setOfferCredits(Math.max(0, Math.min(misCreditos, Number(e.target.value) || 0)))}
            />
          </label>

          {inventario.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--txt-faint)', padding: '6px 0' }}>No tienes objetos en tu inventario.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
              {inventario.map((obj) => {
                const max = obj.pivot?.cantidad ?? 0;
                const imgUrl = mediaUrl(obj.imagen);
                return (
                  <div key={obj.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                    border: '1px solid var(--holo-line)', borderRadius: 8,
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 6, flexShrink: 0,
                      background: imgUrl ? `url(${imgUrl}) center/cover` : 'rgba(56,205,240,0.08)',
                      display: 'grid', placeItems: 'center',
                    }}>
                      {!imgUrl && <Icon name="coin" size={14} style={{ color: 'var(--holo)', opacity: 0.5 }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt)' }}>{obj.nombre}</div>
                      <div style={{ fontSize: 9, color: 'var(--txt-faint)', fontFamily: 'var(--font-data)' }}>x{max} disponibles</div>
                    </div>
                    <input
                      type="number" min={0} max={max} className="nx-input"
                      style={{ width: 56, fontSize: 11 }}
                      value={selected[obj.id] ?? 0}
                      onChange={(e) => setCantidad(obj.id, e.target.value, max)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div className="nx-kicker" style={{ marginBottom: 8 }}>QUÉ PIDES A CAMBIO</div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--txt-dim)' }}>Créditos que solicitas</span>
            <input
              type="number" min={0} className="nx-input"
              value={requestCredits}
              onChange={(e) => setRequestCredits(Math.max(0, Number(e.target.value) || 0))}
            />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn kind="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn kind="primary" onClick={send} disabled={ofertaVacia || sending}>
            {sending ? 'Enviando...' : 'Enviar propuesta'}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

/* ─── PROPUESTA DE COMERCIO RECIBIDA ────────────────────── */
function TradeRequestReceived({ trade, onAccept, onDecline, onCreditsChange, lugarImagen }) {
  const [busy, setBusy] = useState(false);
  const initiator = trade.initiator;
  const color      = SABER_COLORS[initiator?.saber_color] ?? '#38cdf0';
  const photoUrl   = mediaUrl(initiator?.photo_url);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);

  const handleAccept = async () => {
    setBusy(true);
    try {
      const d = await apiPost(`/trades/${trade.id}/accept`, {});
      toast('¡Comercio completado!', { tone: 'success', icon: 'coin' });
      if (d?.my_credits !== undefined) onCreditsChange?.(d.my_credits);
      onAccept(d?.trade);
    } catch (err) {
      toast(err.message || 'Error al aceptar la propuesta', { tone: 'error', icon: 'x' });
      setBusy(false);
    }
  };

  const handleDecline = async () => {
    setBusy(true);
    try {
      await apiPost(`/trades/${trade.id}/decline`, {});
      onDecline();
    } catch (err) {
      toast(err.message || 'Error al rechazar la propuesta', { tone: 'error', icon: 'x' });
      setBusy(false);
    }
  };

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {lugarImagen
        ? <img src={lugarImagen} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
        : null
      }
      <div style={{
        position: 'absolute', inset: 0,
        background: lugarImagen
          ? 'linear-gradient(to bottom, rgba(4,7,15,0.55) 0%, rgba(4,7,15,0.82) 60%, rgba(4,7,15,0.97) 100%)'
          : 'rgba(4,7,15,0.92)',
      }} />

      <div style={{
        position: 'relative', zIndex: 1, width: '100%', maxWidth: 420, padding: '0 24px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div className="nx-display" style={{
            fontSize: 9, color: '#E6B325', letterSpacing: '0.22em',
            border: '1px solid rgba(230,179,37,0.4)', padding: '3px 14px', borderRadius: 2,
          }}>
            TRANSMISIÓN ENTRANTE
          </div>
          <div className="nx-display" style={{ fontSize: 14, color: '#fff', letterSpacing: '0.14em', textShadow: '0 0 24px rgba(230,179,37,0.4)' }}>
            ⌬ PROPUESTA DE COMERCIO
          </div>
        </div>

        <div style={{
          width: 72, height: 72, borderRadius: 14, border: `2px solid ${color}`, overflow: 'hidden',
          display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.06)', boxShadow: `0 0 24px ${color}44`,
        }}>
          {photoUrl
            ? <img src={photoUrl} alt={initiator?.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Icon name="user" size={28} style={{ color, opacity: 0.6 }} />
          }
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{initiator?.name ?? 'Desconocido'}</div>
          <div style={{ fontSize: 12, color: 'var(--txt-faint)', fontFamily: 'var(--font-data)' }}>@{initiator?.handle ?? '?'} te propone un intercambio</div>
        </div>

        <div className="nx-panel solid" style={{ width: '100%', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div className="nx-kicker" style={{ marginBottom: 6 }}>TE OFRECE</div>
            {trade.offer_credits > 0 && (
              <div style={{ fontSize: 12, color: 'var(--holocron-oro)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <Icon name="coin" size={12} /> {trade.offer_credits} créditos
              </div>
            )}
            {trade.offer_items.length === 0 && trade.offer_credits <= 0 && (
              <div style={{ fontSize: 11, color: 'var(--txt-faint)' }}>Nada</div>
            )}
            {trade.offer_items.map((it) => (
              <div key={it.rol_objeto_id} style={{ fontSize: 12, color: 'var(--txt)' }}>
                {it.nombre} ×{it.cantidad}
              </div>
            ))}
          </div>
          <div style={{ height: 1, background: 'var(--holo-line)' }} />
          <div>
            <div className="nx-kicker" style={{ marginBottom: 6 }}>A CAMBIO PIDE</div>
            <div style={{ fontSize: 12, color: trade.request_credits > 0 ? 'var(--holocron-oro)' : 'var(--txt-faint)', display: 'flex', alignItems: 'center', gap: 4 }}>
              {trade.request_credits > 0 ? <><Icon name="coin" size={12} /> {trade.request_credits} créditos</> : 'Nada'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 14, width: '100%' }}>
          <button onClick={handleDecline} disabled={busy} style={{
            flex: 1, padding: '12px 0', borderRadius: 10, cursor: busy ? 'not-allowed' : 'pointer',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.18)',
            color: 'var(--txt-dim)', fontFamily: 'var(--font-data)', fontSize: 11,
            letterSpacing: '0.14em', transition: 'all 0.14s', opacity: busy ? 0.4 : 1,
          }}
            onMouseEnter={e => { if (!busy) { e.currentTarget.style.background = 'rgba(255,45,69,0.12)'; e.currentTarget.style.borderColor = 'rgba(255,45,69,0.5)'; e.currentTarget.style.color = '#ff6b6b'; } }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; e.currentTarget.style.color = 'var(--txt-dim)'; }}
          >
            RECHAZAR
          </button>
          <button onClick={handleAccept} disabled={busy} style={{
            flex: 1, padding: '12px 0', borderRadius: 10, cursor: busy ? 'not-allowed' : 'pointer',
            background: 'rgba(230,179,37,0.14)', border: '1px solid rgba(230,179,37,0.5)',
            color: '#E6B325', fontFamily: 'var(--font-data)', fontSize: 11,
            letterSpacing: '0.14em', transition: 'all 0.14s', opacity: busy ? 0.4 : 1,
          }}
            onMouseEnter={e => { if (!busy) { e.currentTarget.style.background = 'rgba(230,179,37,0.26)'; e.currentTarget.style.borderColor = '#E6B325'; } }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(230,179,37,0.14)'; e.currentTarget.style.borderColor = 'rgba(230,179,37,0.5)'; }}
          >
            {busy ? 'PROCESANDO…' : '⌬ ACEPTAR'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─── COMERCIO PROPUESTO — pendiente de respuesta ───────── */
function OutgoingTradePanel({ trade, onCancelled }) {
  const [busy, setBusy] = useState(false);
  const cancel = async () => {
    setBusy(true);
    try {
      await apiPost(`/trades/${trade.id}/cancel`, {});
      toast('Propuesta de comercio cancelada', { tone: 'default', icon: 'x' });
      onCancelled();
    } catch (err) {
      toast(err.message || 'No se pudo cancelar la propuesta', { tone: 'error', icon: 'x' });
      setBusy(false);
    }
  };

  return createPortal(
    <div className="nx-panel solid nx-fade" style={{
      position: 'fixed', right: 20, bottom: 20, zIndex: 700,
      width: 280, padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name="coin" size={14} style={{ color: 'var(--holo)' }} />
        <div className="nx-kicker" style={{ flex: 1 }}>COMERCIO PENDIENTE</div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--txt)' }}>
        Esperando respuesta de <strong>@{trade.target?.handle ?? '?'}</strong>
      </div>
      <div style={{ fontSize: 11, color: 'var(--txt-dim)', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {trade.offer_credits > 0 && <span>Ofreces: {trade.offer_credits} créditos</span>}
        {trade.offer_items.map((it) => <span key={it.rol_objeto_id}>Ofreces: {it.nombre} ×{it.cantidad}</span>)}
        {trade.request_credits > 0 && <span>Pides: {trade.request_credits} créditos</span>}
      </div>
      <Btn kind="ghost" sm onClick={cancel} disabled={busy}>
        {busy ? 'Cancelando...' : 'Cancelar propuesta'}
      </Btn>
    </div>,
    document.body
  );
}

/* ─── VISTA PRINCIPAL ───────────────────────────────────── */
export default function MapaView({ S, setMapLocation, initialLocation, userId, userCharacter, externalChatTarget, onExternalChatConsumed, onUserUpdate }) {
  /* niveles: galaxy | sistema | planeta | zona | lugar */
  const [nivel, setNivel]         = useState('galaxy');
  const syncCredits = useCallback((c) => { S?.setCredits?.(c); }, [S]);
  const [sistema, setSistema]     = useState(null);
  const [planeta, setPlaneta]     = useState(null);
  const [zona, setZona]           = useState(null);
  const [lugar, setLugar]         = useState(null);
  const [dialogNpc, setDialogNpc] = useState(null);
  const [lugarRefreshKey, setLugarRefreshKey] = useState(0);
  const [activeNpcCombat, setActiveNpcCombat] = useState(() => {
    try { const s = localStorage.getItem('nx-npc-combat'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [activeNaveCombat, setActiveNaveCombat] = useState(null);
  const [raidQueueNpcId, setRaidQueueNpcId] = useState(null);
  const [activeRaidId, setActiveRaidId] = useState(null);
  const [lugarImagen,   setLugarImagen]   = useState(null);
  const [zonaImagen,    setZonaImagen]    = useState(null);
  const [planetaImagen, setPlanetaImagen] = useState(null);
  const [chatTarget, setChatTarget]     = useState(null);
  const [pendingTravel, setPendingTravel] = useState(null);
  const [activePvpCombat, setActivePvpCombat] = useState(null);
  const [pvpAttackTarget, setPvpAttackTarget]  = useState(null);
  const [pvpChallenging, setPvpChallenging]    = useState(false);
  const [pendingChallenge, setPendingChallenge] = useState(null);
  const pvpPollRef = useRef(null);

  useEffect(() => {
    const handler = () => setLugarRefreshKey((k) => k + 1);
    window.addEventListener('nx-mision-updated', handler);
    return () => window.removeEventListener('nx-mision-updated', handler);
  }, []);
  const [tradeTarget, setTradeTarget] = useState(null);
  const [pendingTrade, setPendingTrade] = useState(null);
  const [outgoingTrade, setOutgoingTrade] = useState(null);
  const tradePollRef = useRef(null);

  // Polling: detecta propuestas de comercio entrantes y refleja el estado de las que yo envié
  useEffect(() => {
    const checkTrade = () => {
      apiFetch('/trades/active')
        .then(d => {
          if (!d?.trade) { setPendingTrade(null); setOutgoingTrade(null); return; }
          if (d.trade.i_am_initiator) { setOutgoingTrade(d.trade); setPendingTrade(null); }
          else { setPendingTrade(d.trade); setOutgoingTrade(null); }
        })
        .catch(() => {});
    };
    checkTrade();
    tradePollRef.current = setInterval(checkTrade, 5000);
    return () => clearInterval(tradePollRef.current);
  }, []);

  // Comprueba si hay un combate PvP activo o pendiente al entrar al mapa
  useEffect(() => {
    const checkCombat = () => {
      apiFetch('/pvp/active')
        .then(d => {
          if (!d?.combat) return;
          const c = d.combat;
          if (c.status === 'pending' && !c.i_am_attacker) {
            setPendingChallenge(c);
            setActivePvpCombat(null);
          } else {
            setActivePvpCombat(c);
            setPendingChallenge(null);
          }
        })
        .catch(() => {});
    };
    checkCombat();
  }, []);

  // Restaura un combate RAID en cola/activo (p.ej. tras recargar la página)
  useEffect(() => {
    apiFetch('/raid/active')
      .then(d => {
        if (!d?.raid) return;
        if (d.raid.status === 'esperando') setRaidQueueNpcId(d.raid.npc?.id ?? null);
        else if (d.raid.status === 'activo') setActiveRaidId(d.raid.id);
      })
      .catch(() => {});
  }, []);

  // Polling para detectar retos entrantes cuando no hay combate activo
  useEffect(() => {
    clearInterval(pvpPollRef.current);
    if (activePvpCombat || pendingChallenge) return;
    pvpPollRef.current = setInterval(() => {
      apiFetch('/pvp/active')
        .then(d => {
          if (!d?.combat) return;
          const c = d.combat;
          if (c.status === 'pending' && !c.i_am_attacker) {
            setPendingChallenge(c);
          } else {
            setActivePvpCombat(c);
          }
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(pvpPollRef.current);
  }, [activePvpCombat, pendingChallenge]);

  /* origin: 'nave' solo cuando se ataca desde el icono de nave del mapa planetario
     (el backend decide si el combate es naval según si ambos tienen nave equipada;
     cualquier otro origen — lugar, zona, sistema — siempre es PvP normal). */
  const handleAttackUser = (character, origin = 'normal') =>
    setPvpAttackTarget({ ...character, __origin: origin });

  const handleNaveEncounter = useCallback(async (npcEspacio) => {
    try {
      const mias = await apiFetch('/naves/mias');
      const equipada = (mias.naves ?? []).find((n) => n.id === mias.nave_equipada_id);
      if (!equipada) {
        toast('Necesitas una nave equipada para el combate espacial', {
          tone: 'error', icon: 'ship',
          desc: 'Consíguela con un vendedor de naves y equípala en Mi Personaje.',
        });
        return;
      }
      const player = getNaveCombatPlayerStats(equipada);
      const npc = getNaveEncuentroStats(npcEspacio);
      setActiveNaveCombat({ npcEspacio, player, npc });
    } catch {
      toast('No se pudo iniciar el encuentro espacial', { tone: 'error', icon: 'x' });
    }
  }, []);

  /* Al viajar a un planeta de un sistema hostil, hay una chance de emboscada
     pirata. El chequeo (probabilidad, nave del pirata) se resuelve en el
     servidor para que no pueda manipularse desde el cliente. */
  const checkPirataAmbush = useCallback(async (planetaId) => {
    try {
      const d = await apiPost(`/map/planetas/${planetaId}/pirata-encuentro`, {});
      if (!d?.ambush) return;
      const mias = await apiFetch('/naves/mias');
      const equipada = (mias.naves ?? []).find((n) => n.id === mias.nave_equipada_id);
      if (!equipada) return; // el backend ya lo valida; esto es solo defensivo
      const player = getNaveCombatPlayerStats(equipada);
      const npc = getNaveEncuentroStats({ nave: d.pirata });
      toast('¡Emboscada pirata!', { tone: 'error', icon: 'ship', desc: `${d.pirata.nombre} te intercepta` });
      setActiveNaveCombat({ npcEspacio: null, pirataEncuentroId: d.encuentro_id, player, npc });
    } catch {
      // silencioso: si el chequeo falla simplemente no hay emboscada
    }
  }, []);

  /* Al viajar a un lugar de una zona hostil, hay una chance de que un enemigo asignado a
     ese lugar ataque (20% por nivel de hostilidad de la zona). El chequeo (probabilidad,
     enemigo elegido) se resuelve en el servidor para que no pueda manipularse desde el
     cliente — ver LugarEncuentroController. */
  const checkLugarEncuentro = useCallback(async (lugarId, lugarNombre) => {
    try {
      const d = await apiPost(`/map/lugares/${lugarId}/enemigo-encuentro`, {});
      if (!d?.ataque) return;
      toast('¡Emboscada!', { tone: 'error', icon: 'swords', desc: `${d.enemigo.nombre} te ataca` });
      const session = {
        npc: d.enemigo, player: getPlayerCombatStats(userCharacter), lugarImagen,
        npcTipo: 'hostil', esEnemigoAmbush: true,
        planetaNombre: planeta?.nombre, lugarNombre, planetaImagen,
      };
      localStorage.setItem('nx-npc-combat', JSON.stringify(session));
      setActiveNpcCombat(session);
    } catch {
      // silencioso: si el chequeo falla simplemente no hay ataque
    }
  }, [userCharacter, lugarImagen, planeta, planetaImagen]);

  const handleStartPvp = async () => {
    if (!pvpAttackTarget || pvpChallenging) return;
    setPvpChallenging(true);
    try {
      const d = await apiPost('/pvp/challenge', {
        defender_id: pvpAttackTarget.user_id,
        origen: pvpAttackTarget.__origin === 'nave' ? 'nave' : 'normal',
      });
      if (d?.combat) {
        if (d.nave_advertencia) {
          toast(d.nave_advertencia, { tone: 'warning', icon: 'ship' });
        }
        setActivePvpCombat(d.combat);
        setPvpAttackTarget(null);
      }
    } catch (e) {
      toast(e?.message || 'No se pudo iniciar el combate', { tone: 'error', icon: 'x' });
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

  const updateLocation = useCallback(async (loc) => {
    try {
      const d = await apiPost('/map/location', loc);
      if (d?.credits !== undefined) syncCredits(d.credits);
      return { ok: true };
    } catch (err) {
      toast(err?.message || 'No se pudo completar el movimiento.', { tone: 'error', icon: 'x' });
      return { ok: false };
    }
  }, [syncCredits]);

  /* restaura la última ubicación al volver al Mapa */
  const hasRestored = useRef(false);
  useEffect(() => {
    if (hasRestored.current || !initialLocation?.nivel) return;
    hasRestored.current = true;
    const loc = initialLocation;
    if (loc.sistema_id) setSistema({ id: loc.sistema_id, nombre: loc.sistema_nombre });
    if (loc.planeta_id) setPlaneta({ id: loc.planeta_id, nombre: loc.planeta_nombre });
    if (loc.zona_id)    setZona   ({ id: loc.zona_id,    nombre: loc.zona_nombre    });
    if (loc.lugar_id)   setLugar  ({ id: loc.lugar_id,   nombre: loc.lugar_nombre   });
    setNivel(loc.nivel);

    // Al restaurar directamente en un nivel profundo, PlanetaView nunca llega a montarse,
    // así que su imagen (usada en la tarjeta de combate) no se carga por su propio efecto — se pide aquí.
    if (loc.planeta_id) {
      apiFetch(`/map/planetas/${loc.planeta_id}`)
        .then((d) => setPlanetaImagen(d.planeta?.imagen ? mediaUrl(d.planeta.imagen) : null))
        .catch(() => {});
    }
  }, [initialLocation]);

  const goGalaxy  = () => {
    setNivel('galaxy'); setSistema(null); setPlaneta(null); setZona(null); setLugar(null);
    setLugarImagen(null); setZonaImagen(null); setPlanetaImagen(null);
    updateLocation({ sistema_id: null, planeta_id: null, zona_id: null, lugar_id: null });
    setMapLocation?.(null);
  };
  const goSistema = async (tgt) => {
    if (tgt?.id) {
      /* El salto entre sistemas puede cobrar créditos (transporte pagado) o
         combustible de la nave equipada — solo avanzamos si el servidor lo permite. */
      const result = await updateLocation({ sistema_id: tgt.id, planeta_id: null, zona_id: null, lugar_id: null });
      if (!result.ok) return;
      setSistema(tgt);
      setMapLocation?.({
        nombre: tgt.nombre, nivel: 'sistema',
        sistema_id: tgt.id, sistema_nombre: tgt.nombre,
        planeta_id: null, planeta_nombre: null,
        zona_id: null, zona_nombre: null,
        lugar_id: null, lugar_nombre: null,
      });
    }
    setNivel('sistema'); setPlaneta(null); setZona(null); setLugar(null);
    setLugarImagen(null); setZonaImagen(null); setPlanetaImagen(null);
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

  const selectSistema = (s) => { goSistema(s); };
  const selectPlaneta = (p) => { setPlaneta(p); goPlaneta(p); checkPirataAmbush(p.id); };
  const selectZona    = (z) => { setZona(z);    goZona(z);    };
  const selectLugar   = (l) => { setLugar(l);   setNivel('lugar'); };
  const selectNpc     = (n) => setDialogNpc(n);

  /* Cuando el lugar refresca (misión completada / hito obtenido), resincroniza
     el NPC del diálogo abierto para que refleje datos frescos sin recargar. */
  const handleNpcsUpdated = useCallback((npcs) => {
    setDialogNpc((prev) => (prev ? (npcs.find((n) => n.id === prev.id) ?? prev) : prev));
  }, []);

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
    checkLugarEncuentro(lugarId, lugarNombre);
  }, [sistema, planeta, zona, setMapLocation, updateLocation, checkLugarEncuentro]);

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
          onNaveEncounter={handleNaveEncounter}
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
          onTrade={setTradeTarget}
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
          refreshToken={lugarRefreshKey}
          onNpcsUpdated={handleNpcsUpdated}
        />
      )}

      {/* Diálogo RPG */}
      {dialogNpc && (
        <DialogoRPG
          npc={dialogNpc}
          userCharacter={userCharacter}
          lugarImagen={lugarImagen}
          onClose={() => setDialogNpc(null)}
          onCombatStart={(npcTipo) => {
            const session = {
              npc: dialogNpc, player: getPlayerCombatStats(userCharacter), lugarImagen, npcTipo,
              planetaNombre: planeta?.nombre, lugarNombre: lugar?.nombre, planetaImagen,
            };
            localStorage.setItem('nx-npc-combat', JSON.stringify(session));
            setActiveNpcCombat(session);
          }}
          onRaidJoin={(npc) => setRaidQueueNpcId(npc.id)}
          onMisionChange={() => setLugarRefreshKey((k) => k + 1)}
          onCreditsChange={syncCredits}
          onUserUpdate={onUserUpdate}
        />
      )}

      {/* Chat con jugador */}
      {chatTarget && (
        <ChatModal
          target={chatTarget}
          myUserId={userId}
          onClose={() => setChatTarget(null)}
        />
      )}

      {/* Construir propuesta de comercio */}
      {tradeTarget && (
        <TradeOfferModal
          target={tradeTarget}
          userCharacter={userCharacter}
          onClose={() => setTradeTarget(null)}
          onSent={(trade) => { setTradeTarget(null); if (trade) setOutgoingTrade(trade); }}
        />
      )}

      {/* Propuesta de comercio recibida — overlay de aceptar/rechazar */}
      {pendingTrade && (
        <TradeRequestReceived
          trade={pendingTrade}
          lugarImagen={lugarImagen || zonaImagen || planetaImagen}
          onAccept={() => setPendingTrade(null)}
          onDecline={() => setPendingTrade(null)}
          onCreditsChange={syncCredits}
        />
      )}

      {/* Comercio que propuse y sigue pendiente de respuesta — panel no bloqueante */}
      {outgoingTrade && (
        <OutgoingTradePanel
          trade={outgoingTrade}
          onCancelled={() => setOutgoingTrade(null)}
        />
      )}

      {/* Combate NPC activo — overlay persistente */}
      {activeNpcCombat && (
        <NpcCombatScreen
          npc={activeNpcCombat.npc}
          player={activeNpcCombat.player ?? getPlayerCombatStats(userCharacter)}
          lugarImagen={activeNpcCombat.lugarImagen || lugarImagen}
          planetaNombre={activeNpcCombat.planetaNombre}
          lugarNombre={activeNpcCombat.lugarNombre}
          planetaImagen={activeNpcCombat.planetaImagen || planetaImagen}
          initialState={activeNpcCombat.state}
          onVictory={async () => {
            localStorage.removeItem('nx-npc-combat');
            if (activeNpcCombat.npcTipo === 'entrenador') {
              // Los entrenadores no otorgan ni quitan reputación.
            } else if (activeNpcCombat.npcTipo === 'hostil') {
              postReputation(25); toast('+25 reputación', { tone: 'success', icon: 'star' });
            } else {
              postReputation(-50); toast('−50 reputación adicional', { tone: 'error', icon: 'shield' });
            }
            if (activeNpcCombat.esEnemigoAmbush) {
              if (activeNpcCombat.npc?.id) await postEnemigoVictory(activeNpcCombat.npc.id);
            } else if (activeNpcCombat.npc?.id) {
              await postNpcVictory(activeNpcCombat.npc.id);
            }
            // Refresca el lugar: un hito recién obtenido puede desbloquear NPCs/misiones sin recargar la página.
            setLugarRefreshKey((k) => k + 1);
            setActiveNpcCombat(null);
          }}
          onDefeat={() => { localStorage.removeItem('nx-npc-combat'); setActiveNpcCombat(null); }}
          onFlee={() => { localStorage.removeItem('nx-npc-combat'); setActiveNpcCombat(null); }}
        />
      )}

      {/* Combate naval activo (encuentro espacial) — overlay persistente */}
      {activeNaveCombat && (
        <NpcCombatScreen
          npc={activeNaveCombat.npc}
          player={activeNaveCombat.player}
          naveMode
          onVictory={async (hp) => {
            await persistNaveDano(activeNaveCombat.player?.owned_id, hp);
            if (activeNaveCombat.pirataEncuentroId) {
              try {
                const d = await apiPost(`/pirata-encuentros/${activeNaveCombat.pirataEncuentroId}/victoria`, {});
                if (d?.credits !== undefined) syncCredits(d.credits);
                toast('Pirata derrotado', { tone: 'success', icon: 'coin', desc: `+${d?.credits_awarded ?? 0} créditos` });
              } catch {
                toast('No se pudo cobrar la recompensa del encuentro', { tone: 'error', icon: 'x' });
              }
            } else {
              postReputation(25); toast('+25 reputación', { tone: 'success', icon: 'star' });
              if (activeNaveCombat.npcEspacio?.id) await postNaveEspacioVictory(activeNaveCombat.npcEspacio.id);
            }
            setActiveNaveCombat(null);
          }}
          onDefeat={(hp) => { persistNaveDano(activeNaveCombat.player?.owned_id, hp); setActiveNaveCombat(null); }}
          onFlee={(hp) => { persistNaveDano(activeNaveCombat.player?.owned_id, hp); setActiveNaveCombat(null); }}
        />
      )}

      {/* Cola de espera de Combate RAID (varios jugadores vs 1 jefe, cupos configurables) */}
      {raidQueueNpcId && (
        <RaidQueueModal
          npcId={raidQueueNpcId}
          onClose={() => setRaidQueueNpcId(null)}
          onStarted={(id) => { setRaidQueueNpcId(null); setActiveRaidId(id); }}
        />
      )}

      {/* Combate RAID activo — overlay bloqueante */}
      {activeRaidId && (
        <RaidCombatScreen
          raidId={activeRaidId}
          lugarImagen={lugarImagen || zonaImagen || planetaImagen}
          onClose={() => setActiveRaidId(null)}
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

      {/* Reto de combate recibido — overlay de aceptar/rechazar */}
      {pendingChallenge && (
        <PvpChallengeReceived
          combat={pendingChallenge}
          lugarImagen={lugarImagen || zonaImagen || planetaImagen}
          onAccept={(activeCombat) => {
            setPendingChallenge(null);
            setActivePvpCombat(activeCombat);
          }}
          onDecline={() => setPendingChallenge(null)}
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
