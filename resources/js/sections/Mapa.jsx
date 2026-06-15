import { useState, useEffect, useRef, useCallback } from 'react';
import { Icon, Panel, Btn, Chip, Modal, toast } from '../components/ui.jsx';

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

/* ─── VISTA GALAXIA ────────────────────────────────────── */
function GalaxiaView({ onSelectSistema }) {
  const [sistemas, setSistemas]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [traveling, setTraveling]   = useState(null);
  const [hovered, setHovered]       = useState(null);
  const canvasRef                   = useRef(null);
  const rafRef                      = useRef(null);

  useEffect(() => {
    apiFetch('/map/sistemas')
      .then((d) => setSistemas(d.sistemas ?? []))
      .catch(() => toast('Error cargando sistemas', { tone: 'error', icon: 'x' }))
      .finally(() => setLoading(false));
  }, []);

  /* ── canvas: fondo espacial con nebulosas y estrellas en capas ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let stars = [], nebulae = [], t = 0;

    const init = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      if (!w || !h) return;
      canvas.width  = w;
      canvas.height = h;

      /* nebulosas — gradientes radiales suaves */
      nebulae = [
        { x: w * 0.12, y: h * 0.25, r: w * 0.32, color: [0, 47, 186],  a: 0.055 },
        { x: w * 0.80, y: h * 0.60, r: w * 0.30, color: [80, 0, 180],  a: 0.040 },
        { x: w * 0.50, y: h * 0.15, r: w * 0.38, color: [0, 30, 100],  a: 0.060 },
        { x: w * 0.90, y: h * 0.18, r: w * 0.22, color: [160, 40, 0],  a: 0.028 },
        { x: w * 0.18, y: h * 0.82, r: w * 0.28, color: [0, 60, 160],  a: 0.035 },
        { x: w * 0.60, y: h * 0.80, r: w * 0.25, color: [60, 0, 140],  a: 0.030 },
      ];

      /* capa 0 — estrellas de fondo, tiny, estáticas */
      const bg = Array.from({ length: 500 }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 0.65 + 0.15,
        a: Math.random() * 0.35 + 0.08,
        sp: 0, ph: 0, layer: 0, col: null,
      }));

      /* capa 1 — estrellas medias, parpadeo suave */
      const mid = Array.from({ length: 140 }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 0.9 + 0.7,
        a: Math.random() * 0.4 + 0.3,
        sp: Math.random() * 0.7 + 0.2, ph: Math.random() * Math.PI * 2,
        layer: 1, col: null,
      }));

      /* capa 2 — estrellas brillantes, parpadeo fuerte, algunas con tinte */
      const TINTS = ['219,230,245', '180,210,255', '255,220,160', '200,170,255'];
      const bright = Array.from({ length: 55 }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 1.4 + 1.4,
        a: Math.random() * 0.35 + 0.55,
        sp: Math.random() * 1.4 + 0.6, ph: Math.random() * Math.PI * 2,
        layer: 2,
        col: TINTS[Math.floor(Math.random() * TINTS.length)],
      }));

      /* capa 3 — estrellas destacadas grandes con destellos en cruz */
      const featured = Array.from({ length: 14 }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 1.8 + 2.2,
        a: 0.85,
        sp: Math.random() * 1.8 + 0.8, ph: Math.random() * Math.PI * 2,
        layer: 3,
        col: ['255,255,255', '230,240,255', '255,235,195'][Math.floor(Math.random() * 3)],
      }));

      stars = [...bg, ...mid, ...bright, ...featured];
    };

    const draw = () => {
      const ctx = canvas.getContext('2d');
      const { width: w, height: h } = canvas;
      ctx.clearRect(0, 0, w, h);

      /* nebulosas */
      nebulae.forEach(({ x, y, r, color: [cr, cg, cb], a }) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0,   `rgba(${cr},${cg},${cb},${a})`);
        g.addColorStop(0.55,`rgba(${cr},${cg},${cb},${a * 0.35})`);
        g.addColorStop(1,   `rgba(${cr},${cg},${cb},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      });

      /* estrellas */
      stars.forEach((s) => {
        const flicker = s.sp > 0 ? Math.sin(t * s.sp + s.ph) * 0.28 : 0;
        const alpha = Math.max(0.04, Math.min(1, s.a + flicker));
        const rgb = s.col ?? '219,230,245';

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb},${alpha})`;
        ctx.fill();

        /* destellos en cruz para estrellas destacadas */
        if (s.layer === 3 && alpha > 0.6) {
          const spike = s.r * 5;
          const sa = (alpha - 0.5) * 0.5;
          ctx.strokeStyle = `rgba(${rgb},${sa})`;
          ctx.lineWidth   = 0.6;
          ctx.beginPath();
          ctx.moveTo(s.x - spike, s.y); ctx.lineTo(s.x + spike, s.y);
          ctx.moveTo(s.x, s.y - spike); ctx.lineTo(s.x, s.y + spike);
          ctx.stroke();
        }
      });

      t += 0.012;
      rafRef.current = requestAnimationFrame(draw);
    };

    const ro = new ResizeObserver(() => { init(); });
    ro.observe(canvas);
    init();
    draw();

    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, []);

  const handleTravel = (sistema) => {
    setTraveling(sistema.id);
    setTimeout(() => { setTraveling(null); onSelectSistema(sistema); }, 1800);
  };

  if (loading) return <LoadingHUD text="ESCANEANDO GALAXIA..." />;

  const positions = buildPositions(sistemas);

  return (
    <div style={{ position: 'relative', minHeight: '82vh', overflow: 'hidden', borderRadius: 12 }}>

      {/* ── fondo canvas ── */}
      <canvas ref={canvasRef} style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'none', borderRadius: 12,
        background: 'radial-gradient(ellipse at 70% -5%, rgba(0,47,186,0.18) 0%, transparent 55%), linear-gradient(180deg,#07101f,#04070f)',
      }} />

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

/* ─── VISTA SISTEMA SOLAR ───────────────────────────────── */
function SistemaView({ sistemaId, onSelectPlaneta, onBack }) {
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
      <BreadcrumbNav crumbs={[
        { label: 'Galaxia', onClick: onBack },
        { label: sistema.nombre },
      ]} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, marginTop: 16 }}>
        {/* ── visor del sistema ── */}
        <div className="nx-panel solid" style={{ position: 'relative', overflow: 'hidden', minHeight: 500 }}>
          <div className="nx-panel-head">
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
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {p.clima && <span style={{ fontSize: 10, color: 'var(--txt-dim)', fontFamily: 'var(--font-data)' }}>{p.clima}</span>}
                          <span style={{ fontSize: 10, color: h.text, fontFamily: 'var(--font-data)' }}>{h.label}</span>
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
      </div>
    </div>
  );
}

/* ─── VISTA PLANETA ─────────────────────────────────────── */
function PlanetaView({ planetaId, onSelectZona, onBack, onBackSistema }) {
  const [planeta, setPlaneta] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/map/planetas/${planetaId}`)
      .then((d) => setPlaneta(d.planeta))
      .catch(() => toast('Error cargando planeta', { tone: 'error', icon: 'x' }))
      .finally(() => setLoading(false));
  }, [planetaId]);

  if (loading) return <LoadingHUD text="ATERRIZANDO EN EL PLANETA..." />;
  if (!planeta) return null;

  const zonas = planeta.zonas ?? [];

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
      <BreadcrumbNav crumbs={[
        { label: 'Galaxia', onClick: onBack },
        { label: planeta.sistema?.nombre, onClick: onBackSistema },
        { label: planeta.nombre },
      ]} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, marginTop: 16 }}>
        {/* mapa del planeta */}
        <Panel title={planeta.nombre} kicker="MAPA PLANETARIO" icon="target"
          right={<Chip tone={hostilidadStyle(planeta.hostilidad).text !== '#8aa0c0' ? 'orange' : 'default'}>
            {hostilidadStyle(planeta.hostilidad).label}
          </Chip>}
        >
          <div style={{ position: 'relative', minHeight: 420 }}>
            {/* fondo tipo mapa */}
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: planeta.imagen ? `url(${planeta.imagen})` : 'none',
              backgroundSize: 'cover', backgroundPosition: 'center',
              borderRadius: 8, opacity: planeta.imagen ? 0.35 : 0,
            }} />
            <div style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(ellipse at 60% 40%, rgba(56,205,240,0.06) 0%, transparent 70%)',
              borderRadius: 8,
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
                      color: 'var(--txt)',
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
                    <Icon name="target" size={16} style={{ color: hs.text }} />
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-data)', fontWeight: 700, color: 'var(--txt)', lineHeight: 1.2 }}>
                      {z.nombre}
                    </span>
                    <span style={{ fontSize: 9, color: hs.text, fontFamily: 'var(--font-data)', letterSpacing: '0.08em' }}>
                      {hs.label}
                    </span>
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
                return (
                  <button key={z.id} onClick={() => onSelectZona(z)}
                    style={{
                      background: hs.bg, border: `1px solid ${hs.border}66`,
                      borderRadius: 'var(--radius-md)',
                      padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.2s', color: 'var(--txt)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = hs.border; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = hs.border + '66'; }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 3 }}>{z.nombre}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, color: hs.text, fontFamily: 'var(--font-data)' }}>{hs.label}</span>
                      {z.faccion && <span style={{ fontSize: 10, color: 'var(--txt-dim)', fontFamily: 'var(--font-data)' }}>{z.faccion}</span>}
                      {z.estrato_social && <span style={{ fontSize: 10, color: 'var(--txt-faint)', fontFamily: 'var(--font-data)' }}>{z.estrato_social}</span>}
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
      </div>
    </div>
  );
}

/* ─── VISTA ZONA ────────────────────────────────────────── */
function ZonaView({ zonaId, onSelectLugar, onBack, breadcrumbs }) {
  const [zona, setZona]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/map/zonas/${zonaId}`)
      .then((d) => setZona(d.zona))
      .catch(() => toast('Error cargando zona', { tone: 'error', icon: 'x' }))
      .finally(() => setLoading(false));
  }, [zonaId]);

  if (loading) return <LoadingHUD text="ESCANEANDO ZONA..." />;
  if (!zona) return null;

  const hs = hostilidadStyle(zona.hostilidad);
  const lugares = zona.lugares ?? [];

  return (
    <div className="nx-fade">
      <BreadcrumbNav crumbs={[...breadcrumbs, { label: zona.nombre }]} />

      <div style={{ marginTop: 16 }}>
        {/* header de zona */}
        <div className="nx-panel solid" style={{
          padding: '20px 24px', marginBottom: 20,
          borderLeft: `3px solid ${hs.border}`,
          background: hs.bg,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            {zona.imagen && (
              <img src={zona.imagen} alt={zona.nombre} style={{
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

        {/* grid de lugares */}
        <div className="nx-kicker" style={{ marginBottom: 12 }}>LUGARES VISITABLES — {lugares.length}</div>

        {lugares.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--txt-faint)', fontSize: 13 }}>
            Sin lugares registrados en esta zona
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {lugares.map((l) => (
            <LugarCard key={l.id} lugar={l} onClick={() => onSelectLugar(l)} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── CARD LUGAR ────────────────────────────────────────── */
function LugarCard({ lugar, onClick }) {
  const rc = rarezaColor(lugar.rareza);
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
        height: 120, background: lugar.imagen
          ? `url(${lugar.imagen}) center/cover`
          : 'linear-gradient(135deg, rgba(56,205,240,0.08), rgba(4,7,15,0.8))',
        position: 'relative',
      }}>
        {!lugar.imagen && (
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
        display: 'flex', justifyContent: 'flex-end',
      }}>
        <span style={{ fontSize: 10, color: 'var(--holo)', fontFamily: 'var(--font-data)', letterSpacing: '0.1em' }}>
          ENTRAR →
        </span>
      </div>
    </button>
  );
}

/* ─── VISTA LUGAR ────────────────────────────────────────── */
function LugarView({ lugarId, onSelectNpc, onBack, breadcrumbs }) {
  const [lugar, setLugar] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/map/lugares/${lugarId}`)
      .then((d) => setLugar(d.lugar))
      .catch(() => toast('Error cargando lugar', { tone: 'error', icon: 'x' }))
      .finally(() => setLoading(false));
  }, [lugarId]);

  if (loading) return <LoadingHUD text="EXPLORANDO UBICACIÓN..." />;
  if (!lugar) return null;

  const npcs = lugar.npcs ?? [];

  return (
    <div className="nx-fade">
      <BreadcrumbNav crumbs={[...breadcrumbs, { label: lugar.nombre }]} />

      {/* header */}
      <div style={{ display: 'grid', gridTemplateColumns: lugar.imagen ? '280px 1fr' : '1fr', gap: 20, marginTop: 16, marginBottom: 24 }}>
        {lugar.imagen && (
          <div style={{
            borderRadius: 12, overflow: 'hidden', height: 200,
            border: '1px solid var(--holo-line)',
          }}>
            <img src={lugar.imagen} alt={lugar.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}
        <div className="nx-panel solid" style={{ padding: '20px 24px' }}>
          <div className="nx-kicker" style={{ marginBottom: 4 }}>UBICACIÓN</div>
          <div className="nx-display" style={{ fontSize: 22, color: 'var(--txt)', marginBottom: 8 }}>{lugar.nombre}</div>
          {lugar.rareza && (
            <Chip style={{ color: rarezaColor(lugar.rareza), marginBottom: 10 }}>{lugar.rareza}</Chip>
          )}
          {lugar.historia && (
            <p style={{ fontSize: 13, color: 'var(--txt-dim)', lineHeight: 1.6, margin: 0 }}>
              {lugar.historia}
            </p>
          )}

          {/* conexiones cardinales */}
          {(lugar.norte || lugar.sur || lugar.este || lugar.oeste) && (
            <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div className="nx-kicker" style={{ width: '100%', marginBottom: 4 }}>SALIDAS</div>
              {[
                { dir: 'norte', label: '↑ Norte', data: lugar.norte },
                { dir: 'sur',   label: '↓ Sur',   data: lugar.sur   },
                { dir: 'este',  label: '→ Este',  data: lugar.este  },
                { dir: 'oeste', label: '← Oeste', data: lugar.oeste },
              ].filter(d => d.data).map(({ dir, label, data }) => (
                <Chip key={dir} icon="arrow" tone="dim">{label}: {data.nombre}</Chip>
              ))}
            </div>
          )}
        </div>
      </div>

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
        background: npc.imagen
          ? `url(${npc.imagen}) center top/cover`
          : 'linear-gradient(160deg, rgba(56,205,240,0.12), rgba(4,7,15,0.9))',
      }}>
        {!npc.imagen && npc.imagen_mini && (
          <img src={npc.imagen_mini} alt={npc.nombre} style={{
            width: '100%', height: '100%', objectFit: 'cover',
          }} />
        )}
        {!npc.imagen && !npc.imagen_mini && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', opacity: 0.3 }}>
            <Icon name="user" size={44} style={{ color: 'var(--holo)' }} />
          </div>
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

/* ─── SISTEMA DE DIÁLOGO RPG ────────────────────────────── */
function DialogoRPG({ npc, onClose }) {
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState('');
  const [phase, setPhase]         = useState('greeting'); // greeting | dialog | mission
  const [typing, setTyping]       = useState(false);
  const bottomRef                 = useRef(null);

  /* opciones de diálogo basadas en la interacción del NPC */
  const parseOptions = (texto) => {
    if (!texto) return [];
    const lines = texto.split('\n').filter(l => l.trim().startsWith('-'));
    return lines.map(l => l.replace(/^-\s*/, '').trim()).slice(0, 4);
  };

  const npcOptions = parseOptions(npc.interaccion);

  useEffect(() => {
    /* saludo inicial */
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
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const sendMessage = useCallback((text) => {
    if (!text.trim()) return;
    const playerMsg = { from: 'player', text: text.trim(), ts: Date.now() };
    setMessages(prev => [...prev, playerMsg]);
    setInput('');
    setTyping(true);

    setTimeout(() => {
      let response = '';
      const lower = text.toLowerCase();

      /* respuesta basada en palabras clave de la interacción */
      if (npc.interaccion) {
        const lines = npc.interaccion.split('\n');
        for (const line of lines) {
          const [keyword, ...rest] = line.split(':');
          if (keyword && rest.length && lower.includes(keyword.toLowerCase().replace(/^-/, '').trim())) {
            response = rest.join(':').trim();
            break;
          }
        }
      }

      if (!response) {
        const fallbacks = [
          'No tengo más información sobre eso, viajero.',
          'Eso está más allá de lo que puedo decirte.',
          'Busca en otro lugar esa respuesta.',
          'Interesting... pero no es algo que me incumba.',
        ];
        response = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      }

      if (npc.MisionID && lower.includes('misión')) {
        response = `Tengo una misión para ti. ${response || 'Habla con el coordinador para más detalles.'}`;
        setPhase('mission');
      }

      setMessages(prev => [...prev, { from: 'npc', text: response, ts: Date.now() }]);
      setTyping(false);
    }, 900 + Math.random() * 700);
  }, [npc]);

  const handleOption = (opt) => sendMessage(opt);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

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
            ? <img src={npc.imagen_mini || npc.imagen} alt={npc.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Icon name="user" size={24} style={{ color: 'var(--holo)', opacity: 0.5 }} />
          }
        </div>
        <div style={{ flex: 1 }}>
          <div className="nx-display" style={{ fontSize: 16, color: 'var(--txt)', marginBottom: 2 }}>{npc.nombre}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {npc.profesion && <span className="nx-kicker" style={{ fontSize: 9 }}>{npc.profesion}</span>}
            {npc.faccion   && <Chip tone="dim" icon="shield">{npc.faccion}</Chip>}
            {npc.tipo      && <Chip tone="dim">{npc.tipo}</Chip>}
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

      {/* opciones de diálogo rápido */}
      {npcOptions.length > 0 && phase === 'dialog' && (
        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--holo-line)',
          display: 'flex', gap: 8, flexWrap: 'wrap',
          background: 'rgba(7,16,31,0.9)',
        }}>
          {npcOptions.map((opt, i) => (
            <button key={i} onClick={() => handleOption(opt)}
              style={{
                background: 'rgba(56,205,240,0.08)', border: '1px solid var(--holo-line)',
                borderRadius: 20, padding: '6px 14px', cursor: 'pointer',
                fontSize: 12, color: 'var(--txt)', fontFamily: 'var(--font-body)',
                transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--holo)'; e.currentTarget.style.background = 'rgba(56,205,240,0.15)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--holo-line)'; e.currentTarget.style.background = 'rgba(56,205,240,0.08)'; }}
            >
              <Icon name="arrow" size={11} style={{ color: 'var(--holo)' }} />
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* input libre */}
      <div style={{
        padding: '12px 20px', borderTop: '1px solid var(--holo-line)',
        display: 'flex', gap: 10,
        background: 'rgba(4,7,15,0.95)',
      }}>
        <input
          className="nx-input"
          style={{ flex: 1, fontSize: 13 }}
          placeholder="Escribe algo..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={typing}
          autoFocus
        />
        <Btn kind="accent" icon="arrow" onClick={() => sendMessage(input)} disabled={typing || !input.trim()}>
          Enviar
        </Btn>
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
      {crumbs.map((c, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {i > 0 && <Icon name="chevron" size={12} style={{ color: 'var(--txt-faint)', flexShrink: 0 }} />}
          {c.onClick ? (
            <button onClick={c.onClick} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: 'var(--holo)', fontFamily: 'var(--font-data)',
              letterSpacing: '0.06em', padding: 0,
            }}>
              {c.label}
            </button>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--txt-dim)', fontFamily: 'var(--font-data)', letterSpacing: '0.06em' }}>
              {c.label}
            </span>
          )}
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

/* ─── VISTA PRINCIPAL ───────────────────────────────────── */
export default function MapaView() {
  /* niveles: galaxy | sistema | planeta | zona | lugar */
  const [nivel, setNivel]         = useState('galaxy');
  const [sistema, setSistema]     = useState(null);
  const [planeta, setPlaneta]     = useState(null);
  const [zona, setZona]           = useState(null);
  const [lugar, setLugar]         = useState(null);
  const [dialogNpc, setDialogNpc] = useState(null);

  const goGalaxy  = () => { setNivel('galaxy'); setSistema(null); setPlaneta(null); setZona(null); setLugar(null); };
  const goSistema = () => { setNivel('sistema'); setPlaneta(null); setZona(null); setLugar(null); };
  const goPlaneta = () => { setNivel('planeta'); setZona(null); setLugar(null); };
  const goZona    = () => { setNivel('zona'); setLugar(null); };

  const selectSistema = (s) => { setSistema(s); setNivel('sistema'); };
  const selectPlaneta = (p) => { setPlaneta(p); setNivel('planeta'); };
  const selectZona    = (z) => { setZona(z);    setNivel('zona');    };
  const selectLugar   = (l) => { setLugar(l);   setNivel('lugar');   };
  const selectNpc     = (n) => setDialogNpc(n);

  /* breadcrumbs dinámicos */
  const crumbsZona = [
    { label: 'Galaxia', onClick: goGalaxy },
    { label: sistema?.nombre, onClick: goSistema },
    { label: planeta?.nombre, onClick: goPlaneta },
  ].filter(c => c.label);

  const crumbsLugar = [
    ...crumbsZona,
    { label: zona?.nombre, onClick: goZona },
  ];

  return (
    <div className="nx-fade" style={{ paddingBottom: 40 }}>
      {nivel === 'galaxy'  && <GalaxiaView onSelectSistema={selectSistema} />}
      {nivel === 'sistema' && sistema && (
        <SistemaView
          sistemaId={sistema.id}
          onSelectPlaneta={selectPlaneta}
          onBack={goGalaxy}
        />
      )}
      {nivel === 'planeta' && planeta && (
        <PlanetaView
          planetaId={planeta.id}
          onSelectZona={selectZona}
          onBack={goGalaxy}
          onBackSistema={goSistema}
        />
      )}
      {nivel === 'zona' && zona && (
        <ZonaView
          zonaId={zona.id}
          onSelectLugar={selectLugar}
          onBack={goGalaxy}
          breadcrumbs={crumbsZona}
        />
      )}
      {nivel === 'lugar' && lugar && (
        <LugarView
          lugarId={lugar.id}
          onSelectNpc={selectNpc}
          onBack={goGalaxy}
          breadcrumbs={crumbsLugar}
        />
      )}

      {/* Diálogo RPG */}
      {dialogNpc && <DialogoRPG npc={dialogNpc} onClose={() => setDialogNpc(null)} />}
    </div>
  );
}
