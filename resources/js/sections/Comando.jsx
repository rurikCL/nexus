import { useState, useEffect, useRef, cloneElement } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { NX } from '../data/seed.js';
import { Icon, Panel, Btn, Chip, Avatar, TierBadge, Stat, MedalIcon, Modal, toast, ImageSlot } from '../components/ui.jsx';
import { playClickHabilidad, playClickOpcion } from '../utils/sounds.js';
import { BONUS_FIELDS } from './ArmadoSable.jsx';
import CharacterCardModal from '../components/CharacterCard.jsx';

/* NÉXUS — Comando (dashboard) + Mi Personaje */

function useWindowWidth() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return w;
}

function mapApiCharacterToStoreCharacter(character, fallback = {}) {
  if (!character) return null;
  const combat = character.combat_stats ?? {};
  const baseCombat = character.combat_base_stats ?? {};
  const safeFallback = fallback ?? {};
  const resolvedPhoto = mediaUrl(
    character.photo_url
      ?? character.photo
      ?? safeFallback.photo_url
      ?? safeFallback.photo
      ?? null
  );
  return {
    ...character,
    saber: character.saber_color ?? character.saber ?? 'azul',
    photo: resolvedPhoto,
    photo_url: resolvedPhoto,
    pool: character.puntos_libres ?? character.pool ?? safeFallback.pool ?? 0,
    current_forma: character.current_forma ?? safeFallback.current_forma ?? 1,
    arma_equipada: character.arma_equipada ?? safeFallback.arma_equipada ?? null,
    nave_equipada: character.nave_equipada ?? safeFallback.nave_equipada ?? null,
    sable_activo: character.sable_activo ?? safeFallback.sable_activo ?? null,
    sable_bonos: character.sable_bonos ?? safeFallback.sable_bonos ?? {},
    vida: baseCombat.vida ?? safeFallback.vida ?? character.vida ?? 8,
    escudo: baseCombat.escudo ?? safeFallback.escudo ?? character.escudo ?? 4,
    defensa: baseCombat.defensa ?? safeFallback.defensa ?? character.defensa ?? 2,
    ataque: baseCombat.ataque ?? safeFallback.ataque ?? character.ataque ?? 2,
    movimiento: baseCombat.movimiento ?? safeFallback.movimiento ?? character.movimiento ?? 2,
    iniciativa: baseCombat.iniciativa ?? safeFallback.iniciativa ?? character.iniciativa ?? 2,
    punteria: baseCombat.punteria ?? safeFallback.punteria ?? character.punteria ?? 2,
    habilidades_por_forma: character.habilidades_por_forma ?? safeFallback.habilidades_por_forma ?? {},
    all_habilidades_data: character.all_habilidades_data ?? safeFallback.all_habilidades_data ?? {},
    combat_stats: Object.keys(combat).length ? combat : (safeFallback.combat_stats ?? combat),
    combat_base_stats: Object.keys(baseCombat).length ? baseCombat : (safeFallback.combat_base_stats ?? baseCombat),
  };
}

const SIDES = {
  luminoso: { label: 'Lado Luminoso', color: '#3aa0ff', img: '/assets/lado-luminoso.png', desc: 'Disciplina, honor y protección' },
  oscuro:   { label: 'Lado Oscuro',   color: '#ff2d45', img: '/assets/lado-oscuro.png',   desc: 'Pasión, ambición y poder' },
};

const TIER_RANGO_IMG = {
  iniciado:    '/assets/INITIATE_sm.png',
  padawan:     '/assets/PADAWAN_sm.png',
  caballero:   '/assets/KNIGHT_sm.png',
  maestro:     '/assets/MASTER_sm.png',
  granmaestro: '/assets/GRANDMASTER_sm.png',
};

function mediaUrl(path) {
  if (!path) return null;
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:') || path.startsWith('blob:')) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (cleanPath.startsWith('/storage/')) return cleanPath;
  if (cleanPath.startsWith('/public/'))  return cleanPath.replace('/public/', '/storage/');
  return `/storage${cleanPath}`;
}

export function classIcon(clsId) {
  const c = NX.CLASSES.find(x => x.id === clsId);
  return c ? c.icon : 'shield';
}

/* ===================== GRIP HANDLE + COL TOGGLE ===================== */
function GripHandle() {
  return (
    <div
      title="Arrastrar widget"
      style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 4px',
        padding: '4px 6px', cursor: 'grab', opacity: 0.28,
        userSelect: 'none', alignSelf: 'center', flexShrink: 0,
      }}
    >
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--txt)', display: 'block' }} />
      ))}
    </div>
  );
}

function ColToggle({ cols, onToggle }) {
  const full = cols === 2;
  return (
    <button
      title={full ? 'Dividir en media columna' : 'Expandir a columna completa'}
      onClick={e => { e.stopPropagation(); onToggle(); }}
      onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.18)'; }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '0.28'; e.currentTarget.style.borderColor = 'transparent'; }}
      style={{
        background: 'none', border: '1px solid transparent', padding: '3px 5px',
        cursor: 'pointer', display: 'flex', gap: 2, alignItems: 'center',
        opacity: 0.28, borderRadius: 4, flexShrink: 0,
      }}
    >
      {/* izq siempre sólido; der sólido=2col, vacío=1col */}
      <span style={{ display: 'block', width: 6, height: 9, borderRadius: 2, background: 'var(--txt)' }} />
      <span style={{
        display: 'block', width: 6, height: 9, borderRadius: 2,
        background: full ? 'var(--txt)' : 'transparent',
        border: full ? 'none' : '1.5px solid rgba(255,255,255,.45)',
      }} />
    </button>
  );
}

/* ===================== COMANDO ===================== */
const WIDGET_DEFAULT_ORDER = [
  { id: 'kpis',       cols: 2 },
  { id: 'combate',    cols: 1 },
  { id: 'temporada',  cols: 1 },
  { id: 'tareas',     cols: 1 },
  { id: 'eventos',    cols: 1 },
  { id: 'ranking',    cols: 1 },
  { id: 'hitos',      cols: 1 },
  { id: 'qr',         cols: 1 },
  { id: 'carta',      cols: 1 },
];

const fmtHitoDate = (d) => d
  ? new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
  : '';

function HitoRow({ hito }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
      background: 'rgba(255,255,255,.03)', border: '1px solid var(--holo-line)', borderRadius: 'var(--radius-md)',
    }}>
      <span style={{ color: 'var(--holocron-oro)', flexShrink: 0 }}><Icon name="star" size={16} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>{hito.hito}</div>
        <div className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)' }}>{fmtHitoDate(hito.created_at)}</div>
      </div>
    </div>
  );
}

/* ---- Widget: QR de perfil público ---- */
function QrWidget({ url, handle, right, style }) {
  const [dataUrl, setDataUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { width: 240, margin: 1, color: { dark: '#eaf9ff', light: '#00000000' } })
      .then((d) => { if (!cancelled) setDataUrl(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [url]);

  const copyLink = () => {
    navigator.clipboard?.writeText(url).catch(() => {});
    toast('Link público copiado', { tone: 'success', icon: 'link', desc: url.replace(/^https?:\/\//, '') });
  };

  const download = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `nexus-qr-${handle}.png`;
    a.click();
  };

  return (
    <Panel title="Mi Código QR" kicker="Perfil público · escanear para ver" icon="link" right={right} style={style}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 168, height: 168, borderRadius: 'var(--radius-md)', border: '1px solid var(--holo-line)', background: 'rgba(255,255,255,.03)', display: 'grid', placeItems: 'center', padding: 10, flexShrink: 0 }}>
          {dataUrl
            ? <img src={dataUrl} alt="Código QR del perfil público" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            : <span className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)' }}>Generando...</span>}
        </div>
        <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)', textAlign: 'center' }}>
          {url.replace(/^https?:\/\//, '')}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn sm icon="link" onClick={copyLink}>Copiar link</Btn>
          <Btn sm icon="download" onClick={download} disabled={!dataUrl}>Descargar</Btn>
        </div>
      </div>
    </Panel>
  );
}

const PODIO_CMD = [
  { key: 'primer_lugar',  color: 'var(--holocron-oro)', num: '1' },
  { key: 'segundo_lugar', color: '#c0c0c0',            num: '2' },
  { key: 'tercer_lugar',  color: '#cd7f32',            num: '3' },
];

const TIER_COLOR = {
  iniciado: '#8aa0c0', padawan: '#38cdf0', caballero: '#10b981',
  maestro: '#FF6B00', granmaestro: '#E6B325',
};

/** Modal para elegir/cambiar la sede propia — lista todas las sedes activas. */
function SedeChangeModal({ open, currentId, onClose, onChanged }) {
  const [sedes, setSedes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const token = localStorage.getItem('nx-token');
    setLoading(true);
    fetch('/api/public/sedes', { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setSedes(d.sedes ?? []))
      .catch(() => toast('No se pudo cargar la lista de sedes', { tone: 'error', icon: 'x' }))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const elegir = async (sedeId) => {
    if (sedeId === currentId) { onClose(); return; }
    setSaving(true);
    try {
      const token = localStorage.getItem('nx-token');
      const res = await fetch('/api/me/sede', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sede_id: sedeId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? 'No se pudo cambiar de sede.');
      toast('Sede actualizada', { tone: 'success', icon: 'check', desc: data.sede?.nombre });
      onChanged(data.sede);
      onClose();
    } catch (err) {
      toast(err.message ?? 'No se pudo cambiar de sede', { tone: 'error', icon: 'x' });
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div onMouseDown={onClose} className="nx-saber-modal-backdrop" style={{ zIndex: 1400 }}>
      <div onMouseDown={e => e.stopPropagation()} className="nx-panel solid nx-panel-glow" style={{
        width: '100%', maxWidth: 420, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <header className="nx-panel-head">
          <div style={{ flex: 1 }}>
            <div className="nx-kicker">Membresía</div>
            <div className="nx-display" style={{ fontSize: 14 }}>Cambiar de Sede</div>
          </div>
          <button className="nx-btn nx-btn-ghost nx-btn-sm" style={{ padding: 7 }} onClick={onClose}><Icon name="x" size={15} /></button>
        </header>
        <div className="nx-panel-body" style={{ overflowY: 'auto', display: 'grid', gap: 6 }}>
          {loading ? (
            <div style={{ fontSize: 12, color: 'var(--txt-faint)', padding: '6px 0' }}>Cargando sedes...</div>
          ) : sedes.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--txt-faint)', padding: '6px 0' }}>No hay sedes disponibles.</div>
          ) : sedes.map(s => {
            const active = s.id === currentId;
            return (
              <button key={s.id} disabled={saving} onClick={() => elegir(s.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', textAlign: 'left',
                borderRadius: 'var(--radius-md)', cursor: saving ? 'wait' : 'pointer', transition: 'all 0.15s',
                border: `1px solid ${active ? 'var(--holo)' : 'var(--holo-line)'}`,
                background: active ? 'color-mix(in srgb, var(--holo) 12%, transparent)' : 'rgba(255,255,255,0.02)',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, flexShrink: 0, overflow: 'hidden',
                  background: 'rgba(56,205,240,0.08)', display: 'grid', placeItems: 'center',
                }}>
                  {s.imagen_url
                    ? <img src={s.imagen_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <Icon name="target" size={16} style={{ color: 'var(--holo)' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt)' }}>{s.nombre}</div>
                  {(s.ubicacion || s.pais || s.region) && (
                    <div style={{ fontSize: 10, color: 'var(--txt-faint)', marginTop: 1 }}>
                      {[s.ubicacion, s.region, s.pais].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
                {active && <Icon name="check" size={14} style={{ color: 'var(--holo)', flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function ComandoView({ S, go, user, onUserUpdate, onGoToCombat }) {
  const me = S.byId('you') ?? {};
  const myTier = user?.tier ?? me.tier ?? 'iniciado';
  const ch = S.character;
  const sab = NX.SABERS[ch.saber] || NX.SABERS.azul;
  const publicProfileUrl = `${window.location.origin}/c/${encodeURIComponent(ch.handle)}`;
  const isMobile = useWindowWidth() < 640;
  const myTasks = S.tasks.filter(t => t.pupil === 'you' && t.status !== 'completada');
  const nextCombat = S.combats.find(m => m.a === 'you' || m.b === 'you');
  const loggedCount = Object.keys(S.training.logged).length;
  const opp = nextCombat
    ? (nextCombat.a === 'you' ? (nextCombat._b ?? S.byId(nextCombat.b)) : (nextCombat._a ?? S.byId(nextCombat.a)))
    : null;

  const KPIS = [
    { k: 'Créditos',   v: NX.fmtCLP(S.credits),      icon: 'coin',     tone: 'var(--holocron-oro)' },
    { k: 'Victorias',  v: me.wins ?? 0,               sub: `${me.winrate ?? 0}% efectividad`, icon: 'trophy', tone: 'var(--holocron-naranja)' },
    { k: 'Racha',      v: `${me.streak ?? 0} W`,      sub: 'sin perder', icon: 'flame',    tone: 'var(--holo)' },
    { k: 'Asistencia', v: `${loggedCount} días`,      icon: 'calendar', tone: 'var(--green-500)' },
  ];

  const [widgetOrder, setWidgetOrder]         = useState(WIDGET_DEFAULT_ORDER);
  const [draggingId,  setDraggingId]          = useState(null);
  const [overIdx,     setOverIdx]             = useState(null);
  const [activaTemporada, setActivaTemporada] = useState(null);
  const [showAllHitos, setShowAllHitos]       = useState(false);
  const [showSedeModal, setShowSedeModal]     = useState(false);
  const [showCardModal, setShowCardModal]     = useState(false);
  const hitos = user?.character?.hitos ?? [];
  const saveTimer = useRef(null);

  const cardStorageKey = `nx-character-card-${user?.id ?? ch.handle ?? 'me'}`;
  const [savedCardUrl, setSavedCardUrl] = useState(() => {
    try { return localStorage.getItem(cardStorageKey); } catch { return null; }
  });
  const handleCardGenerated = (dataUrl) => {
    setSavedCardUrl(dataUrl);
    try { localStorage.setItem(cardStorageKey, dataUrl); } catch { /* cuota excedida — se mantiene solo en memoria */ }
  };

  useEffect(() => {
    const token = localStorage.getItem('nx-token');
    if (!token) return;
    fetch('/api/temporadas', {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    }).then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.temporadas) return;
        const activa = d.temporadas.find(t => t.activa) ?? d.temporadas[0] ?? null;
        setActivaTemporada(activa);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('nx-token');
    if (!token) return;
    fetch('/api/layout/comando', {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    }).then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.widgets?.length) return;
        const knownIds = new Set(WIDGET_DEFAULT_ORDER.map(w => w.id));
        // compatibilidad con formato antiguo (string[]) + descartar IDs obsoletos
        const saved = d.widgets
          .map(w => typeof w === 'string' ? { id: w, cols: 2 } : w)
          .filter(w => knownIds.has(w.id));
        // anexar widgets nuevos que no estaban en el layout guardado
        const savedIds = new Set(saved.map(w => w.id));
        const fresh = WIDGET_DEFAULT_ORDER.filter(w => !savedIds.has(w.id));
        setWidgetOrder([...saved, ...fresh]);
      })
      .catch(() => {});
  }, []);

  const saveOrder = (order) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const token = localStorage.getItem('nx-token');
      fetch('/api/layout/comando', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ widgets: order }),
      }).catch(() => {});
    }, 800);
  };

  const applyDrop = (toIdx) => {
    const fromIdx = widgetOrder.findIndex(w => w.id === draggingId);
    if (fromIdx < 0 || fromIdx === toIdx) return;
    const next = [...widgetOrder];
    const [item] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, item);
    setWidgetOrder(next);
    saveOrder(next);
  };

  const toggleCols = (id) => {
    const next = widgetOrder.map(w => w.id === id ? { ...w, cols: w.cols === 2 ? 1 : 2 } : w);
    setWidgetOrder(next);
    saveOrder(next);
  };

  return (
    <div className="nx-fade" style={{ display: 'grid', gap: 18 }}>
      {/* Hero — fijo, sin drag */}
      <section className="nx-panel" style={{ overflow: 'hidden', position: 'relative' }}>
        {ch.photo && (
          <img
            src={ch.photo}
            alt=""
            aria-hidden="true"
            style={{
              position: 'absolute', right: 0, top: 0, height: '100%', width: 'auto',
              objectFit: 'cover', objectPosition: 'top center',
              pointerEvents: 'none', userSelect: 'none',
              WebkitMaskImage: 'linear-gradient(to left, black 40%, transparent 85%)',
              maskImage:       'linear-gradient(to left, black 40%, transparent 85%)',
            }}
          />
        )}
        <div style={{ display: 'flex', gap: isMobile ? 14 : 22, padding: isMobile ? 16 : 22, flexWrap: 'wrap', alignItems: 'center', position: 'relative', zIndex: 1 }}>
          <Avatar c={me} size={isMobile ? 64 : 86} ring />
          <div style={{ flex: 1, minWidth: isMobile ? 140 : 220 }}>
            <div className="nx-kicker">Combatiente{me.sector ? ` · ${me.sector}` : ''}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '4px 0 8px', flexWrap: 'wrap' }}>
              <h1 className="nx-display" style={{ fontSize: isMobile ? 22 : 30, margin: 0, color: 'var(--txt)' }}>{ch.name}</h1>
              {user?.character?.titulo_activo && (
                <span className="nx-data" style={{ fontSize: isMobile ? 11 : 13, color: 'var(--holocron-oro)' }}>
                  {user.character.titulo_activo.nombre}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <TierBadge tier={myTier} />
              {(() => { const c = NX.CLASSES.find(x => x.id === ch.cls); return c ? <Chip icon={c.icon}>{c.num} · {c.name}</Chip> : null; })()}
              <Chip tone="dim" icon="user">@{ch.handle}</Chip>
              <span className="nx-chip dim" style={{ borderColor: `${sab}66` }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: sab, boxShadow: `0 0 8px ${sab}` }} />Sable {ch.saber}</span>
              <button
                type="button"
                onClick={() => setShowSedeModal(true)}
                title="Cambiar de sede"
                className="nx-chip dim"
                style={{ gap: 6, paddingLeft: user?.sede ? 4 : undefined, cursor: 'pointer' }}
              >
                {user?.sede ? (
                  <>
                    <span style={{
                      width: 18, height: 18, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
                      background: 'rgba(56,205,240,0.15)', display: 'grid', placeItems: 'center',
                    }}>
                      {user.sede.imagen_url
                        ? <img src={user.sede.imagen_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <Icon name="target" size={10} style={{ color: 'var(--holo)' }} />}
                    </span>
                    Sede {user.sede.nombre}
                  </>
                ) : (
                  <><Icon name="target" size={11} />Sin sede — asignar</>
                )}
                <Icon name="edit" size={9} style={{ opacity: 0.5 }} />
              </button>
            </div>
          </div>
        </div>

        <SedeChangeModal
          open={showSedeModal}
          currentId={user?.sede?.id ?? null}
          onClose={() => setShowSedeModal(false)}
          onChanged={(sede) => onUserUpdate?.({ ...user, sede })}
        />
      </section>

      {/* Widgets reordenables — grilla de 2 columnas */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 18, alignItems: 'stretch' }}>
        {widgetOrder.map(({ id, cols }, idx) => {
          const isDragging = draggingId === id;
          const isOver    = overIdx === idx && !isDragging;

          const panelRight = (extra) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {extra}
              {!isMobile && <ColToggle cols={cols} onToggle={() => toggleCols(id)} />}
              {!isMobile && <GripHandle />}
            </div>
          );

          const content = ({
            combate: (
              <Panel title="Próximo Combate" kicker="Arena" icon="swords"
                right={panelRight(<Btn sm onClick={() => go('combates')}>Arena</Btn>)}>
                {nextCombat ? (
                  <div style={{ display: 'grid', gap: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Avatar c={opp} size={48} ring />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>vs {opp?.name}</div>
                        <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-dim)', marginTop: 3 }}>
                          {nextCombat.round}
                        </div>
                        {nextCombat.when && (
                          <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)', marginTop: 1 }}>
                            {nextCombat.when}
                          </div>
                        )}
                      </div>
                      {nextCombat.live && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#ff2d45', fontSize: 10, fontFamily: 'var(--font-data)', letterSpacing: '0.12em' }}>
                          <span className="nx-live-dot" />EN VIVO
                        </div>
                      )}
                    </div>
                    <Btn kind="accent" icon="swords" onClick={() => onGoToCombat ? onGoToCombat(nextCombat) : go('combates')} style={{ width: '100%', justifyContent: 'center' }}>
                      Ir al combate
                    </Btn>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 12 }}>
                    <Empty label="Sin combate agendado" />
                    <Btn sm icon="target" onClick={() => go('combatientes')} style={{ width: '100%', justifyContent: 'center' }}>
                      Buscar rival
                    </Btn>
                  </div>
                )}
              </Panel>
            ),
            kpis: (
              <Panel title="Estadísticas" kicker="Temporada activa" icon="trending" right={panelRight(null)}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                  {KPIS.map((k) => (
                    <div key={k.k} style={{ padding: '12px 14px', background: 'rgba(255,255,255,.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--holo-line)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div className="nx-kicker">{k.k}</div>
                        <span style={{ color: k.tone }}><Icon name={k.icon} size={15} /></span>
                      </div>
                      <div className="nx-num" style={{ fontSize: 28, color: k.tone, marginTop: 6, lineHeight: 1 }}>{k.v}</div>
                      {k.sub && <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)', marginTop: 4 }}>{k.sub}</div>}
                    </div>
                  ))}
                </div>
              </Panel>
            ),
            tareas: (
              <Panel title="Tareas Asignadas" kicker="Tutor · Diego Fuentes" icon="tasks"
                right={panelRight(<Btn sm icon="arrow" iconRight={null} onClick={() => go('tareas')}>Ver todas</Btn>)}>
                <div style={{ display: 'grid', gap: 10 }}>
                  {myTasks.length === 0 && <Empty label="Sin Tareas" />}
                  {myTasks.map((t) => (
                    <div key={t.id} className="nx-panel solid" style={{ padding: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{t.title}</div>
                        <Chip tone="dim" icon="clock">{t.due}</Chip>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 9 }}>
                        <div className="nx-bar" style={{ flex: 1 }}><i style={{ width: `${t.progress}%` }} /></div>
                        <span className="nx-num" style={{ fontSize: 12, color: 'var(--holo)' }}>{t.progress}%</span>
                        <Chip tone="gold" icon="coin">+{t.reward}</Chip>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            ),
            eventos: (
              <Panel title="Próximos Eventos" kicker="Presentaciones" icon="star"
                right={panelRight(<Btn sm onClick={() => go('eventos')}>Más</Btn>)}>
                <div style={{ display: 'grid', gap: 10 }}>
                  {S.events.filter(e => e.status !== 'REALIZADO').slice(0, 3).map((e) => (
                    <div key={e.id} style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
                      <span style={{ width: 4, alignSelf: 'stretch', borderRadius: 4, background: e.banner }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</div>
                        <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)' }}>{e.date}</div>
                      </div>
                      <Chip tone={e.mine ? 'green' : e.status === 'ABIERTO' ? 'green' : 'dim'}>{e.mine ? 'Inscrito' : e.status}</Chip>
                    </div>
                  ))}
                </div>
              </Panel>
            ),
            temporada: (() => {
              const t = activaTemporada;
              const fmtDate = (d) => d
                ? new Date(d + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
                : '—';
              return (
                <Panel title={t ? t.nombre : 'Temporada'} kicker={t?.activa ? 'ACTIVA AHORA' : 'TEMPORADA'} icon="crown"
                  right={panelRight(null)}>
                  {!t ? (
                    <Empty label="Sin temporadas registradas" />
                  ) : (
                    <div style={{ display: 'grid', gap: 14 }}>
                      {t.foto_emblema && (
                        <div style={{ height: 72, borderRadius: 'var(--radius-md)', overflow: 'hidden', position: 'relative' }}>
                          <img src={t.foto_emblema} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.55 }} />
                          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(4,7,15,.85) 0%, transparent 60%)' }} />
                          <div style={{ position: 'absolute', inset: 0, padding: '10px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <div className="nx-data" style={{ fontSize: 9, color: 'var(--txt-faint)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                              {fmtDate(t.periodo_inicio)} → {fmtDate(t.periodo_fin)}
                            </div>
                            {t.activa && (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#4ade80', fontSize: 9, fontFamily: 'var(--font-data)', letterSpacing: '0.12em', marginTop: 4 }}>
                                <span className="nx-live-dot" style={{ background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />EN CURSO
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {t.divide_por_rango ? (
                        /* Podio por rango — top 3 en 3 columnas */
                        <div style={{ display: 'grid', gap: 6 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr 1fr 1fr', gap: 4, paddingLeft: 10, paddingRight: 8 }}>
                            <div />
                            {[{ n: '1°', c: 'var(--holocron-oro)' }, { n: '2°', c: '#a0a0b0' }, { n: '3°', c: '#cd7f32' }].map(({ n, c }) => (
                              <div key={n} style={{ textAlign: 'center', fontSize: 8, color: c, fontFamily: 'var(--font-data)', letterSpacing: '0.1em' }}>{n}</div>
                            ))}
                          </div>
                          {(t.podios ?? []).filter(p => p.primer_lugar || p.segundo_lugar || p.tercer_lugar).map(p => {
                            const tierColor = TIER_COLOR[p.rango] ?? '#38cdf0';
                            const LUGARES = [
                              { key: 'primer_lugar',  mc: 'var(--holocron-oro)' },
                              { key: 'segundo_lugar', mc: '#a0a0b0' },
                              { key: 'tercer_lugar',  mc: '#cd7f32' },
                            ];
                            return (
                              <div key={p.rango} style={{
                                display: 'grid', gridTemplateColumns: '72px 1fr 1fr 1fr',
                                gap: 4, alignItems: 'center',
                                padding: '5px 8px', borderRadius: 'var(--radius-sm)',
                                background: 'rgba(255,255,255,.025)',
                                borderLeft: `2px solid ${tierColor}`,
                              }}>
                                <span className="nx-data" style={{ fontSize: 8, color: tierColor, textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {p.rango}
                                </span>
                                {LUGARES.map(({ key, mc }) => {
                                  const w = p[key];
                                  if (!w) return (
                                    <div key={key} style={{ display: 'flex', justifyContent: 'center', opacity: 0.3 }}>
                                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(255,255,255,.06)', border: '1px dashed rgba(255,255,255,.15)' }} />
                                    </div>
                                  );
                                  const avatarC = { initials: w.initials || (w.handle || '?').substring(0, 2).toUpperCase(), color: mc };
                                  return (
                                    <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                      <Avatar c={avatarC} size={20} />
                                      <span style={{ fontSize: 8, color: 'var(--txt-dim)', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', display: 'block' }}>
                                        {(w.name ?? w.handle ?? '').split(' ')[0]}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                          {(t.podios ?? []).filter(p => p.primer_lugar || p.segundo_lugar || p.tercer_lugar).length === 0 && (
                            <span style={{ fontSize: 11, color: 'var(--txt-faint)' }}>Sin campeones asignados aún</span>
                          )}
                        </div>
                      ) : (
                        /* Podio global */
                        <div style={{ display: 'grid', gap: 8 }}>
                          {PODIO_CMD.map(p => {
                            const w = t[p.key];
                            const avatarC = w
                              ? { initials: w.initials || (w.handle || '?').substring(0, 2).toUpperCase(), color: TIER_COLOR[w.tier] ?? '#38cdf0' }
                              : null;
                            return (
                              <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                <div style={{
                                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                                  display: 'grid', placeItems: 'center',
                                  background: `color-mix(in srgb, ${p.color} 18%, rgba(4,7,15,.8))`,
                                  border: `1px solid ${p.color}55`,
                                }}>
                                  <span className="nx-num" style={{ fontSize: 9, color: p.color }}>{p.num}</span>
                                </div>
                                {w ? (
                                  <>
                                    <Avatar c={avatarC} size={26} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.name}</div>
                                      <div className="nx-data" style={{ fontSize: 9, color: 'var(--txt-faint)' }}>@{w.handle}</div>
                                    </div>
                                    <TierBadge tier={w.tier} sm />
                                  </>
                                ) : (
                                  <span style={{ fontSize: 11, color: 'var(--txt-faint)' }}>Sin asignar</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </Panel>
              );
            })(),
            ranking: (
              <Panel title="Top Ranking" kicker="Temporada 3" icon="trophy"
                right={panelRight(<Btn sm onClick={() => go('ranking')}>Ladder</Btn>)}>
                <div style={{ display: 'grid', gap: 8 }}>
                  {S.ranking.slice(0, 4).map((c, i) => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="nx-num" style={{ fontSize: 15, width: 22, color: i === 0 ? 'var(--holocron-oro)' : 'var(--txt-faint)' }}>{i + 1}</span>
                      <Avatar c={c} size={28} />
                      <span style={{ flex: 1, fontSize: 13, fontWeight: c.id === 'you' ? 700 : 500, color: c.id === 'you' ? 'var(--holocron-naranja)' : 'var(--txt)' }}>{c.name}</span>
                      <span className="nx-num" style={{ fontSize: 13, color: 'var(--txt-dim)' }}>{c.wins}W</span>
                    </div>
                  ))}
                </div>
              </Panel>
            ),
            hitos: (
              <Panel title="Hitos" kicker="Logros y reconocimientos" icon="star"
                right={panelRight(<Btn sm onClick={() => setShowAllHitos(true)}>Ver todos</Btn>)}>
                <div style={{ display: 'grid', gap: 10 }}>
                  {hitos.length === 0 && <Empty label="Sin hitos obtenidos aún" />}
                  {hitos.slice(0, 4).map((h) => <HitoRow key={h.id} hito={h} />)}
                </div>
              </Panel>
            ),
            qr: <QrWidget url={publicProfileUrl} handle={ch.handle} right={panelRight(null)} />,
            carta: (
              <Panel title="Carta de Personaje" kicker="Imprimible · tamaño carta Magic" icon="sword" right={panelRight(null)}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '8px 0' }}>
                  <div style={{
                    width: 100, height: 140, borderRadius: 10, flexShrink: 0,
                    border: '1px solid var(--holo-line)', background: 'rgba(255,255,255,.03)',
                    display: 'grid', placeItems: 'center', color: 'var(--holo)',
                    position: 'relative', overflow: 'hidden',
                  }}>
                    {savedCardUrl
                      ? <img src={savedCardUrl} alt="Carta de personaje generada" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : (
                        <>
                          <Icon name="user" size={34} />
                          <img
                            src="/assets/esgrimaGemini.png" alt="" aria-hidden="true"
                            style={{
                              position: 'absolute', right: 3, bottom: 3, width: 20, height: 20,
                              objectFit: 'contain', pointerEvents: 'none',
                              filter: 'drop-shadow(0 0 2px rgba(0,0,0,.8))',
                            }}
                          />
                        </>
                      )}
                  </div>
                  {TIER_RANGO_IMG[myTier] && (
                    <img
                      src={TIER_RANGO_IMG[myTier]} alt={NX.TIERS[myTier]?.label ?? myTier}
                      title={NX.TIERS[myTier]?.label ?? myTier}
                      style={{ width: 36, height: 36, objectFit: 'contain' }}
                    />
                  )}
                  <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)', textAlign: 'center', maxWidth: 220 }}>
                    Genera una carta con tus datos y atributos de combate, lista para imprimir a 63×88mm.
                  </div>
                  <Btn kind="accent" icon="download" onClick={() => setShowCardModal(true)}>
                    {savedCardUrl ? 'Regenerar Carta' : 'Generar Carta'}
                  </Btn>
                </div>
              </Panel>
            ),
          })[id];

          return (
            <div
              key={id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', id);
                setDraggingId(id);
              }}
              onDragEnd={() => { setDraggingId(null); setOverIdx(null); }}
              onDragOver={(e) => { e.preventDefault(); if (overIdx !== idx) setOverIdx(idx); }}
              onDrop={(e) => { e.preventDefault(); applyDrop(idx); setOverIdx(null); }}
              style={{
                gridColumn: isMobile ? 'span 1' : `span ${cols}`,
                opacity: isDragging ? 0.4 : 1,
                outline: isOver ? '2px dashed rgba(56,205,240,.45)' : '2px dashed transparent',
                outlineOffset: 4,
                borderRadius: 'var(--radius-lg)',
                transition: 'opacity .15s',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {content ? cloneElement(content, { style: { flex: 1, ...(content.props?.style ?? {}) } }) : null}
            </div>
          );
        })}
      </div>

      <Modal open={showAllHitos} onClose={() => setShowAllHitos(false)} title="Todos los Hitos" kicker="Logros y reconocimientos">
        <div style={{ display: 'grid', gap: 10, maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
          {hitos.length === 0 && <Empty label="Sin hitos obtenidos aún" />}
          {hitos.map((h) => <HitoRow key={h.id} hito={h} />)}
        </div>
      </Modal>

      {showCardModal && (
        <CharacterCardModal character={ch} user={user} onClose={() => setShowCardModal(false)} onGenerated={handleCardGenerated} />
      )}
    </div>
  );
}

export function Empty({ label }) {
  return (
    <div style={{ textAlign: 'center', padding: 24, color: 'var(--txt-faint)' }}>
      <div style={{ opacity: 0.4, display: 'flex', justifyContent: 'center', marginBottom: 8 }}><Icon name="target" size={28} /></div>
      <div className="nx-data" style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

/* ===================== CREAR PERSONAJE ===================== */
function CharacterCreation({ user, S, onCharacterCreated }) {
  const isMobile = useWindowWidth() < 640;
  const DEFAULT_STATS = { fuerza: 50, velocidad: 50, tecnica: 50, defensa: 50, foco: 50 };
  const [form, setForm] = useState({
    name: user?.name ?? '',
    handle: '',
    bio: '',
    lore: '',
    cls: 'vanguardia',
    side: 'luminoso',
    saber: 'cian',
    stats: DEFAULT_STATS,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => {
    const next = { ...f, [k]: v };
    if (k === 'side') {
      if (v === 'oscuro') next.saber = 'rojo';
      else if (f.saber === 'rojo') next.saber = 'cian';
    }
    return next;
  });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('El nombre de combate es requerido.'); return; }
    if (!form.handle.trim()) { setError('El alias (handle) es requerido.'); return; }
    setSaving(true);
    try {
      const token = localStorage.getItem('nx-token');
      const res = await fetch('/api/character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: form.name.trim(),
          handle: form.handle.trim().toUpperCase(),
          bio: form.bio.trim(),
          lore: form.lore.trim(),
          cls: form.cls,
          side: form.side,
          saber_color: form.saber,
          stats: form.stats,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? 'Error al crear el personaje.'); return; }
      const savedCharacter = mapApiCharacterToStoreCharacter(data.character, user.character);
      if (savedCharacter) {
        S.setCharacter(savedCharacter);
      }
      toast('Personaje creado', { tone: 'success', icon: 'check', desc: `¡Bienvenido a la Academia, ${form.name.trim()}!` });
      onCharacterCreated?.(savedCharacter ?? data.character);
    } catch {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="nx-fade" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8 }}>
      <div style={{ width: '100%', maxWidth: 620 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div className="nx-kicker" style={{ marginBottom: 6 }}>Primera vez en la Academia</div>
          <h2 className="nx-display" style={{ fontSize: 22, color: 'var(--txt)', margin: 0 }}>Forja tu Identidad</h2>
          <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)', marginTop: 5 }}>Crea tu personaje de combate para empezar</div>
        </div>

        <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
          <Panel kicker="Identidad" title="Datos del Personaje" icon="user">
            {error && (
              <div style={{ padding: '8px 12px', marginBottom: 10, borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,107,0,0.4)', background: 'rgba(255,107,0,0.1)', color: 'var(--holocron-naranja)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
                <Icon name="x" size={13} />{error}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
              <div>
                <label className="nx-label">Nombre de combate *</label>
                <input className="nx-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Tu nombre en la Arena" required />
              </div>
              <div>
                <label className="nx-label">Alias (handle) *</label>
                <input className="nx-input" value={form.handle} onChange={e => set('handle', e.target.value.toUpperCase())} placeholder="ALIAS" required maxLength={20} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="nx-label">Grito de guerra</label>
                <textarea className="nx-textarea" value={form.bio} onChange={e => set('bio', e.target.value)} placeholder="Tu frase antes del duelo..." style={{ minHeight: 56 }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="nx-label">Lore del personaje</label>
                <textarea className="nx-textarea" value={form.lore} onChange={e => set('lore', e.target.value)} placeholder="Historia, origen, motivaciones..." style={{ minHeight: 80 }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="nx-label">Lado de la Fuerza</label>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
                  {Object.entries(SIDES).map(([key, s]) => {
                    const on = form.side === key;
                    return (
                      <button type="button" key={key} onClick={() => set('side', key)}
                        className="nx-panel solid" style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'stretch', borderColor: on ? s.color : undefined, boxShadow: on ? `0 0 16px -6px ${s.color}` : undefined, background: on ? `color-mix(in srgb, ${s.color} 8%, var(--space-panel-solid))` : undefined, transition: 'all .2s' }}>
                        <div style={{ width: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in srgb, ${s.color} 5%, rgba(4,9,18,0.9))`, borderRight: `1px solid ${on ? s.color + '55' : 'var(--holo-line)'}` }}>
                          <img src={s.img} alt={s.label} style={{ width: 38, height: 38, objectFit: 'contain', filter: on ? `drop-shadow(0 0 6px ${s.color})` : 'brightness(0.6) saturate(0.6)', transition: 'filter .2s' }} />
                        </div>
                        <div style={{ padding: '8px 11px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <div className="nx-display" style={{ fontSize: 12, color: on ? s.color : 'var(--txt)', lineHeight: 1.2 }}>{s.label}</div>
                          <div style={{ fontSize: 9, color: 'var(--txt-dim)', marginTop: 3 }}>{s.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Panel>

          <Panel kicker="Especialización" title="Forma de Combate" icon="sword">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 6 }}>
              {NX.CLASSES.map((c) => {
                const active = form.cls === c.id;
                return (
                  <button type="button" key={c.id} onClick={() => set('cls', c.id)}
                    className="nx-panel solid" style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'stretch', borderColor: active ? c.accent : undefined, boxShadow: active ? `0 0 18px -6px ${c.accent}` : undefined, background: active ? `color-mix(in srgb, ${c.accent} 8%, var(--space-panel-solid))` : undefined, transition: 'all .2s' }}>
                    <div style={{ width: 64, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in srgb, ${c.accent} 5%, rgba(4,9,18,0.9))`, borderRight: `1px solid ${active ? c.accent + '55' : 'var(--holo-line)'}` }}>
                      <img src={c.img} alt={c.name} style={{ width: 46, height: 46, objectFit: 'contain', filter: active ? `drop-shadow(0 0 7px ${c.accent})` : 'brightness(0.6) saturate(0.6)', transition: 'filter .2s' }} />
                    </div>
                    <div style={{ padding: '8px 11px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ fontFamily: 'var(--font-data)', fontSize: 8, letterSpacing: '0.16em', textTransform: 'uppercase', color: c.accent, marginBottom: 1 }}>{c.num}</div>
                      <div className="nx-display" style={{ fontSize: 12, color: active ? c.accent : 'var(--txt)', lineHeight: 1.2 }}>{c.name}</div>
                      <div style={{ fontSize: 9, color: 'var(--txt-dim)', marginTop: 3, lineHeight: 1.3 }}>{c.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel kicker="Cristal de poder" title="Color de Sable" icon="zap">
            {form.side === 'oscuro' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', border: `2px solid ${NX.SABERS.rojo}`, background: 'rgba(4,9,18,0.5)', boxShadow: `0 0 14px -3px ${NX.SABERS.rojo}` }}>
                  <span style={{ width: 15, height: 15, borderRadius: '50%', background: NX.SABERS.rojo, boxShadow: `0 0 8px ${NX.SABERS.rojo}` }} />
                </span>
                <div>
                  <div className="nx-data" style={{ fontSize: 11, color: NX.SABERS.rojo, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Cristal Rojo · Kyber corrompido</div>
                  <div style={{ fontSize: 9, color: 'var(--txt-faint)', marginTop: 3 }}>El Lado Oscuro impone su cristal. No hay elección.</div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                {Object.keys(NX.SABERS).filter(k => k !== 'rojo').map((key) => {
                  const col = NX.SABERS[key]; const on = form.saber === key;
                  return (
                    <button type="button" key={key} title={key} onClick={() => set('saber', key)}
                      style={{ width: 38, height: 38, borderRadius: '50%', cursor: 'pointer', display: 'grid', placeItems: 'center', border: on ? `2px solid ${col}` : '1px solid var(--holo-line)', background: 'rgba(4,9,18,0.5)', boxShadow: on ? `0 0 14px -3px ${col}` : 'none', transition: 'all .15s' }}>
                      <span style={{ width: 15, height: 15, borderRadius: '50%', background: col, boxShadow: `0 0 8px ${col}` }} />
                    </button>
                  );
                })}
                <span className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginLeft: 4 }}>Cristal: {form.saber}</span>
              </div>
            )}
          </Panel>

          <button type="submit" disabled={saving} className="nx-btn nx-btn-accent" style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 12 }}>
            {saving
              ? <><span className="nx-live-dot" style={{ background: '#fff', boxShadow: 'none' }} />Forjando personaje...</>
              : <><Icon name="shield" size={14} />Forjar Personaje</>}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ===================== MI PERSONAJE ===================== */
const CLASES_JEDI = [
  { id: 'Sentinela', label: 'Centinela', desc: 'Equilibrio entre combate y sabiduría', color: '#E6B325', img: '/assets/CENTINELA.png' },
  { id: 'Guardian',  label: 'Guardián',  desc: 'Maestros del combate con sable de luz', color: '#38cdf0', img: '/assets/GUARDIAN.png'  },
  { id: 'Consul',    label: 'Cónsul',    desc: 'Fuerza y diplomacia sobre la acción',   color: '#10b981', img: '/assets/CONSUL.png'    },
];

const RANGOS_JEDI = [
  { id: 'iniciado',  label: 'Iniciado',  img: '/assets/INITIATE.png'  },
  { id: 'padawan',   label: 'Padawan',   img: '/assets/PADAWAN.png'   },
  { id: 'caballero', label: 'Caballero', img: '/assets/KNIGHT.png'    },
  { id: 'maestro',   label: 'Maestro',   img: '/assets/MASTER.png'    },
];


/* ===================== HABILIDADES ===================== */
const FORMA_LABELS = ['Shii-Cho', 'Makashi', 'Soresu', 'Ataru', 'Shien / Djem So', 'Niman', 'Juyo / Vaapad'];
const FORMA_IMGS   = ['/assets/Forma1.png', '/assets/Forma2.png', '/assets/Forma3.png', '/assets/Forma4.png', '/assets/Forma5.png', '/assets/Forma6.png', '/assets/Forma7.png'];

function WeaponCard({ objeto, selected, onClick }) {
  const isUnarmed = !objeto;
  const img = objeto ? mediaUrl(objeto.imagen) : null;
  const dano = isUnarmed ? 3 : (objeto.dano ?? null);
  const danoPerforante = isUnarmed ? 0 : (objeto.dano_perforante ?? 0);
  const tipoAtaque = isUnarmed ? null : objeto.tipo_ataque;

  return (
    <button
      onClick={onClick}
      title={isUnarmed ? 'Sin arma (desarmado)' : objeto.nombre}
      className="nx-panel solid"
      style={{
        padding: 0, overflow: 'hidden', cursor: 'pointer', textAlign: 'left',
        display: 'flex', alignItems: 'stretch', width: '100%',
        borderColor: selected ? 'var(--holo)' : undefined,
        boxShadow: selected ? '0 0 16px -6px var(--holo)' : undefined,
        background: selected ? 'color-mix(in srgb, var(--holo) 8%, var(--space-panel-solid))' : undefined,
        transition: 'all .18s',
      }}
    >
      <div style={{
        width: 60, height: 60, flexShrink: 0, display: 'grid', placeItems: 'center',
        background: 'color-mix(in srgb, var(--holo) 5%, rgba(4,9,18,0.9))',
        borderRight: `1px solid ${selected ? 'var(--holo)' + '55' : 'var(--holo-line)'}`,
      }}>
        {img ? (
          <img src={img} alt={objeto.nombre} style={{
            width: 44, height: 44, objectFit: 'contain',
            filter: selected ? 'drop-shadow(0 0 6px var(--holo))' : 'brightness(0.75) saturate(0.8)',
            transition: 'filter .18s',
          }} />
        ) : (
          <Icon name="sword" size={26} style={{ color: 'var(--txt-faint)', opacity: isUnarmed ? 0.4 : 0.7 }} />
        )}
      </div>
      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5, minWidth: 0, flex: 1 }}>
        <div className="nx-display" style={{
          fontSize: 12, color: selected ? 'var(--holo)' : 'var(--txt)', lineHeight: 1.2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {isUnarmed ? 'Sin arma (desarmado)' : objeto.nombre}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {dano != null && (
            <span className="nx-data" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--txt-dim)' }}>
              <Icon name="flame" size={12} style={{ color: '#ff6b6b' }} /> {dano}
            </span>
          )}
          {danoPerforante > 0 && (
            <span className="nx-data" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--txt-dim)' }}>
              <Icon name="fire" size={12} style={{ color: '#8aa0c0' }} /> +{danoPerforante}P
            </span>
          )}
          {tipoAtaque && (
            <span className="nx-data" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--txt-dim)', textTransform: 'capitalize' }}>
              <Icon name={tipoAtaque === 'melee' ? 'sword' : 'target'} size={12} /> {tipoAtaque}
            </span>
          )}
        </div>
      </div>
      {selected && (
        <div style={{ display: 'flex', alignItems: 'center', paddingRight: 12 }}>
          <Icon name="check" size={16} style={{ color: 'var(--holo)' }} />
        </div>
      )}
    </button>
  );
}

/* ===================== INVENTARIO (pestañas por tipo) ===================== */
const ITEM_TYPES = [
  { value: 'arma',              label: 'Armas',                  icon: 'sword'    },
  { value: 'nucleo_energia',    label: 'Núcleos de Energía',     icon: 'zap'      },
  { value: 'cristal',           label: 'Cristales',              icon: 'star'     },
  { value: 'lente_enfoque',     label: 'Lentes de Enfoque',      icon: 'eye'      },
  { value: 'emisor',            label: 'Emisores',               icon: 'sword'    },
  { value: 'estabilizador',     label: 'Estabilizadores',        icon: 'shield'   },
  { value: 'empunadura',        label: 'Empuñaduras',            icon: 'anvil'    },
  { value: 'modulo_activacion', label: 'Módulos de Activación',  icon: 'tasks'    },
  { value: 'accesorio',         label: 'Accesorios',             icon: 'crown'    },
];

/* Pestañas del cajón lateral de Equipo */
const EQUIP_TABS = [
  { value: 'inventario', label: 'Inventario',   icon: 'roster' },
  { value: 'sable',      label: 'Sable de Luz', icon: 'sword'  },
  { value: 'nave',       label: 'Hangar',       icon: 'ship'   },
];

/* Tarjeta informativa para objetos que no son armas: no son equipables aquí,
   se instalan en «Armado de Sable» en su lugar. */
function InventoryItemCard({ objeto, icon = 'star' }) {
  const img = mediaUrl(objeto.imagen);
  const bonos = BONUS_FIELDS
    .filter((b) => objeto[b.key])
    .map((b) => `${objeto[b.key] > 0 ? '+' : ''}${objeto[b.key]} ${b.label}`);

  return (
    <div className="nx-panel solid" style={{ padding: 0, overflow: 'hidden', display: 'flex', alignItems: 'stretch' }}>
      <div style={{
        width: 60, height: 60, flexShrink: 0, display: 'grid', placeItems: 'center',
        background: 'color-mix(in srgb, var(--holo) 5%, rgba(4,9,18,0.9))',
        borderRight: '1px solid var(--holo-line)',
      }}>
        {img ? (
          <img src={img} alt={objeto.nombre} style={{ width: 44, height: 44, objectFit: 'contain', filter: 'brightness(0.85) saturate(0.85)' }} />
        ) : (
          <Icon name={icon} size={24} style={{ color: 'var(--txt-faint)', opacity: 0.6 }} />
        )}
      </div>
      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, minWidth: 0, flex: 1 }}>
        <div className="nx-display" style={{ fontSize: 12, color: 'var(--txt)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {objeto.nombre}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {objeto.rareza && (
            <span className="nx-data" style={{ fontSize: 9, color: 'var(--txt-faint)', textTransform: 'capitalize' }}>{objeto.rareza}</span>
          )}
          {objeto.tipo === 'nucleo_energia' && !!objeto.energia_maxima && (
            <span className="nx-data" style={{ fontSize: 10, color: '#ffb020' }}>Máx {objeto.energia_maxima} EN</span>
          )}
          {!!objeto.consumo_energia && (
            <span className="nx-data" style={{ fontSize: 10, color: '#ffb020' }}>Consumo {objeto.consumo_energia} EN</span>
          )}
          {objeto.tipo === 'cristal' && objeto.color_hoja && (
            <span className="nx-data" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--txt-dim)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: NX.SABERS[objeto.color_hoja] || '#38cdf0' }} />
              {objeto.color_hoja}
            </span>
          )}
        </div>
        {bonos.length > 0 && (
          <div className="nx-data" style={{ fontSize: 10, color: 'var(--txt-dim)' }}>{bonos.join(' · ')}</div>
        )}
      </div>
    </div>
  );
}

function HabilidadSlot({ slot, habilidad, onClick }) {
  const isEmpty = !habilidad;
  return (
    <button
      onClick={onClick}
      title={isEmpty ? `Asignar habilidad ${slot}` : habilidad.nombre}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        padding: 14, borderRadius: 'var(--radius-md)', cursor: 'pointer',
        background: isEmpty ? 'rgba(255,255,255,.025)' : 'color-mix(in srgb, var(--holo) 8%, rgba(255,255,255,.03))',
        border: `1px solid ${isEmpty ? 'var(--holo-line)' : 'var(--holo)'}`,
        boxShadow: isEmpty ? 'none' : '0 0 14px -6px var(--holo)',
        transition: 'all .18s', flex: 1, minWidth: 0,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--holo)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--holo) 10%, rgba(255,255,255,.03))'; }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = isEmpty ? 'var(--holo-line)' : 'var(--holo)';
        e.currentTarget.style.background = isEmpty ? 'rgba(255,255,255,.025)' : 'color-mix(in srgb, var(--holo) 8%, rgba(255,255,255,.03))';
      }}
    >
      {isEmpty ? (
        <>
          <div style={{ width: 44, height: 44, borderRadius: '50%', border: '1px dashed var(--holo-line)', display: 'grid', placeItems: 'center', opacity: 0.5 }}>
            <Icon name="plus" size={18} />
          </div>
          <div className="nx-data" style={{ fontSize: 9, color: 'var(--txt-faint)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Slot {slot}
          </div>
        </>
      ) : (
        <>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            display: 'grid', placeItems: 'center',
            background: 'color-mix(in srgb, var(--holo) 15%, rgba(4,9,18,.8))',
            border: '1px solid var(--holo)',
            boxShadow: '0 0 12px -4px var(--holo)',
            overflow: 'hidden',
          }}>
            {habilidad.icono_url
              ? <img src={habilidad.icono_url} alt={habilidad.nombre} style={{ width: 32, height: 32, objectFit: 'contain', filter: 'drop-shadow(0 0 4px var(--holo))' }} />
              : <span style={{ fontSize: 22 }}>⚡</span>
            }
          </div>
          <div style={{ textAlign: 'center', minWidth: 0 }}>
            <div className="nx-display" style={{ fontSize: 10, color: 'var(--holo)', lineHeight: 1.2, overflowWrap: 'break-word' }}>
              {habilidad.nombre}
            </div>
            <div className="nx-data" style={{ fontSize: 8, color: 'var(--txt-faint)', marginTop: 2 }}>
              {habilidad.forma > 0 ? FORMA_LABELS[habilidad.forma - 1] : 'Universal'}
            </div>
          </div>
        </>
      )}
    </button>
  );
}

function HabilidadPickerModal({ open, onClose, habilidades, onAssign, slotIndex }) {
  const [loading, setLoading] = useState(false);

  /* Bloquea el scroll de la página mientras el modal está abierto */
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [open]);

  if (!open) return null;

  const grouped = {};
  for (const h of habilidades) {
    const key = h.forma;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(h);
  }
  const formaKeys = Object.keys(grouped).map(Number).sort((a, b) => a - b);

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(4,7,15,0.85)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'rgba(5,10,22,0.98)', border: '1px solid var(--holo-line)',
        borderRadius: 'var(--radius-lg)', boxShadow: '0 24px 80px rgba(0,0,0,.7)',
        width: '100%', maxWidth: 560, maxHeight: '80vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--holo-line)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--holo)' }}><Icon name="zap" size={16} /></span>
          <div style={{ flex: 1 }}>
            <div className="nx-display" style={{ fontSize: 14 }}>Seleccionar Habilidad</div>
            <div className="nx-data" style={{ fontSize: 9, color: 'var(--txt-faint)', marginTop: 2 }}>SLOT {slotIndex} — Elige una técnica de combate</div>
          </div>
          <button className="nx-btn nx-btn-ghost" style={{ padding: 7 }} onClick={onClose}>
            <Icon name="x" size={15} />
          </button>
        </div>

        {/* Lista scrollable agrupada por forma */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {habilidades.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--txt-faint)' }}>
              <div className="nx-data" style={{ fontSize: 11, letterSpacing: '0.1em' }}>SIN HABILIDADES REGISTRADAS</div>
            </div>
          ) : formaKeys.map(forma => (
            <div key={forma} style={{ marginBottom: 18 }}>
              {/* Encabezado de forma */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <img
                  src={forma > 0 ? FORMA_IMGS[forma - 1] : undefined}
                  alt=""
                  style={{ width: 28, height: 28, objectFit: 'contain', filter: 'drop-shadow(0 0 4px var(--holo))' }}
                />
                <div>
                  <div className="nx-display" style={{ fontSize: 10, color: 'var(--holo)' }}>
                    {forma === 0 ? 'Universal' : `Forma ${forma} — ${FORMA_LABELS[forma - 1]}`}
                  </div>
                  <div className="nx-data" style={{ fontSize: 8, color: 'var(--txt-faint)' }}>{grouped[forma].length} habilidades</div>
                </div>
              </div>

              {/* Grid de habilidades */}
              <div style={{ display: 'grid', gap: 6 }}>
                {grouped[forma].map(h => (
                  <HabilidadPickerRow key={h.id} habilidad={h} onAssign={() => onAssign(h)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

const STAT_SHORT = { ataque: 'ATQ', defensa: 'DEF', punteria: 'PNT', movimiento: 'AGI', iniciativa: 'INI', escudo: 'ESC', vida: 'VID' };
const statShort = (s) => STAT_SHORT[s] ?? s.toUpperCase().slice(0, 3);

/* Agrupa array de stats y cuenta repetidos: ['ataque','ataque'] → [{stat:'ataque',n:2}] */
function groupStats(arr) {
  if (!Array.isArray(arr)) return [];
  const counts = {};
  for (const s of arr) counts[s] = (counts[s] ?? 0) + 1;
  return Object.entries(counts).map(([stat, n]) => ({ stat, n }));
}

function HabilidadPickerRow({ habilidad, onAssign }) {
  const isMelee  = habilidad.tipo === 'melee';
  const isSelf   = habilidad.objetivo === 'self';
  const buffs    = groupStats(habilidad.buff);
  const debuffs  = groupStats(habilidad.debuff);

  const Badge = ({ children, color, bg }) => (
    <span style={{
      fontSize: 8, fontFamily: 'var(--font-data)', letterSpacing: '0.06em',
      padding: '2px 6px', borderRadius: 3,
      background: bg ?? `${color}18`, border: `1px solid ${color}40`,
      color, whiteSpace: 'nowrap', lineHeight: 1.4,
    }}>{children}</span>
  );

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 11,
      padding: '10px 12px', borderRadius: 'var(--radius-md)',
      border: '1px solid var(--holo-line)', background: 'rgba(255,255,255,.02)',
      transition: 'all .15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--holo)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--holo) 8%, transparent)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--holo-line)'; e.currentTarget.style.background = 'rgba(255,255,255,.02)'; }}
    >
      {/* Icono de tipo */}
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        display: 'grid', placeItems: 'center',
        background: isMelee ? 'rgba(255,112,67,0.14)' : 'rgba(56,205,240,0.12)',
        border: `1px solid ${isMelee ? 'rgba(255,112,67,0.35)' : 'rgba(56,205,240,0.28)'}`,
        overflow: 'hidden',
      }}>
        {habilidad.icono_url
          ? <img src={habilidad.icono_url} alt={habilidad.nombre} style={{ width: 28, height: 28, objectFit: 'contain' }} />
          : <span style={{ fontSize: 20, lineHeight: 1 }}>{isMelee ? '⚔' : '◎'}</span>
        }
      </div>

      {/* Cuerpo */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Nombre */}
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--txt)', lineHeight: 1.2, marginBottom: 5 }}>
          {habilidad.nombre}
        </div>

        {/* Fila 1: stats principales */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
          {/* Tipo */}
          <Badge color={isMelee ? '#ff7043' : '#38cdf0'}>
            {isMelee ? '⚔ CUERPO A CUERPO' : '◎ DISTANCIA'}
          </Badge>
          {/* Objetivo */}
          <Badge color={isSelf ? '#10b981' : '#a78bfa'}>
            {isSelf ? '↩ PROPIO' : '→ OBJETIVO'}
          </Badge>
          {/* Fuerza */}
          {habilidad.costo_fuerza > 0 && (
            <Badge color="#38cdf0">⚡ {habilidad.costo_fuerza} FRZ</Badge>
          )}
          {/* Daño */}
          {habilidad.damage > 0 && (
            <Badge color="#ff6b6b">✦ {habilidad.damage} DMG</Badge>
          )}
          {habilidad.damage_perforante > 0 && (
            <Badge color="#8aa0c0">✦ {habilidad.damage_perforante} DMG PERF</Badge>
          )}
          {/* Cooldown */}
          {habilidad.cooldown > 0 && (
            <Badge color="#E6B325">⏱ {habilidad.cooldown} {habilidad.cooldown === 1 ? 'turno' : 'turnos'}</Badge>
          )}
        </div>

        {/* Fila 2: buffs y debuffs */}
        {(buffs.length > 0 || debuffs.length > 0) && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
            {buffs.map(({ stat, n }) => (
              <Badge key={`b-${stat}`} color="#10b981">
                ▲ {statShort(stat)}{n > 1 ? ` ×${n}` : ''}
              </Badge>
            ))}
            {debuffs.map(({ stat, n }) => (
              <Badge key={`d-${stat}`} color="#f87171">
                ▼ {statShort(stat)}{n > 1 ? ` ×${n}` : ''}
              </Badge>
            ))}
          </div>
        )}

        {/* Efecto */}
        {habilidad.efecto && (
          <div style={{ fontSize: 10, color: 'var(--txt-faint)', lineHeight: 1.45, fontStyle: 'italic' }}>
            {habilidad.efecto}
          </div>
        )}
      </div>

      {/* Botón */}
      <button
        className="nx-btn nx-btn-accent nx-btn-sm"
        onClick={onAssign}
        style={{ padding: '6px 14px', flexShrink: 0, fontSize: 11, marginTop: 2 }}
      >
        Asignar
      </button>
    </div>
  );
}

/* ===================== NAVE EQUIPADA (Mi Personaje) ===================== */
const fmtCr = (n) => `${Math.round(n ?? 0).toLocaleString('es-CL')} cr`;

function NaveMiniStatBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 9, fontFamily: 'var(--font-data)', color: 'var(--txt-faint)', width: 66, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 10, fontFamily: 'var(--font-data)', color: 'var(--txt-dim)', width: 44, textAlign: 'right', flexShrink: 0 }}>{value}/{max}</span>
    </div>
  );
}

/** Atributo de combate de una nave (Ataque/Velocidad/Maniobrabilidad) — muestra el valor
    efectivo y, si las mejoras instaladas le dan un bono, cuánto de ese valor es bono. */
function NaveCombatStat({ label, icon, color, base, efectivo }) {
  const baseVal = base ?? 0;
  const efectivoVal = efectivo ?? baseVal;
  const bono = efectivoVal - baseVal;
  return (
    <span className="nx-data" style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10,
      padding: '4px 9px', borderRadius: 4, background: `${color}14`, border: `1px solid ${color}40`, color,
    }}>
      <Icon name={icon} size={11} />
      {label} {efectivoVal}
      {bono > 0 && <span style={{ color: '#4ade80' }}>(+{bono})</span>}
    </span>
  );
}

/** 4 slots para instalar mejoras (rol_objetos tipo mejora_nave) en una nave poseída. */
/* Bonos de mejora de nave mostrados como badges — reutiliza las etiquetas/colores
   de los stats de combate ya definidos para el sable (BONUS_FIELDS) y agrega los
   propios de nave (carga, salto, costo de reparación). */
const NAVE_BONUS_FIELDS = [
  ...BONUS_FIELDS.filter(b => [
    'bono_ataque', 'bono_defensa', 'bono_punteria', 'bono_movimiento', 'bono_iniciativa', 'bono_vida', 'bono_escudo',
  ].includes(b.key)),
  { key: 'bono_capacidad_carga', label: 'CARGA', color: '#f59e0b', icon: 'box' },
  { key: 'bono_capacidad_salto', label: 'SALTO', color: '#a78bfa', icon: 'zap' },
  { key: 'bono_costo_reparacion', label: 'REPARO', color: '#22c55e', icon: 'shield' },
];

function MejoraSlot({ slot, mejora, onClick, disabled }) {
  const isEmpty = !mejora;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={isEmpty ? `Asignar mejora ${slot}` : mejora.nombre}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        padding: 14, borderRadius: 'var(--radius-md)', cursor: disabled ? 'wait' : 'pointer',
        background: isEmpty ? 'rgba(255,255,255,.025)' : 'color-mix(in srgb, var(--holo) 8%, rgba(255,255,255,.03))',
        border: `1px solid ${isEmpty ? 'var(--holo-line)' : 'var(--holo)'}`,
        boxShadow: isEmpty ? 'none' : '0 0 14px -6px var(--holo)',
        opacity: disabled ? 0.6 : 1, transition: 'all .18s', flex: 1, minWidth: 0,
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.borderColor = 'var(--holo)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--holo) 10%, rgba(255,255,255,.03))'; } }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = isEmpty ? 'var(--holo-line)' : 'var(--holo)';
        e.currentTarget.style.background = isEmpty ? 'rgba(255,255,255,.025)' : 'color-mix(in srgb, var(--holo) 8%, rgba(255,255,255,.03))';
      }}
    >
      {isEmpty ? (
        <>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '1px dashed var(--holo-line)', display: 'grid', placeItems: 'center', opacity: 0.5 }}>
            <Icon name="plus" size={16} />
          </div>
          <div className="nx-data" style={{ fontSize: 9, color: 'var(--txt-faint)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Slot {slot}
          </div>
        </>
      ) : (
        <>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            display: 'grid', placeItems: 'center',
            background: 'color-mix(in srgb, var(--holo) 15%, rgba(4,9,18,.8))',
            border: '1px solid var(--holo)',
            boxShadow: '0 0 12px -4px var(--holo)',
            overflow: 'hidden',
          }}>
            {mejora.imagen
              ? <img src={mediaUrl(mejora.imagen)} alt={mejora.nombre} style={{ width: 28, height: 28, objectFit: 'contain' }} />
              : <Icon name="box" size={18} style={{ color: 'var(--holo)' }} />
            }
          </div>
          <div style={{ textAlign: 'center', minWidth: 0 }}>
            <div className="nx-display" style={{ fontSize: 9, color: 'var(--holo)', lineHeight: 1.2, overflowWrap: 'break-word' }}>
              {mejora.nombre}
            </div>
          </div>
        </>
      )}
    </button>
  );
}

function MejoraBadges({ mejora }) {
  const badges = NAVE_BONUS_FIELDS.filter(b => mejora[b.key]);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {badges.map(b => (
        <span key={b.key} style={{
          fontSize: 8, fontFamily: 'var(--font-data)', letterSpacing: '0.06em',
          padding: '2px 6px', borderRadius: 3,
          background: `${b.color}18`, border: `1px solid ${b.color}40`,
          color: b.color, whiteSpace: 'nowrap', lineHeight: 1.4,
        }}>
          {mejora[b.key] > 0 ? '+' : ''}{mejora[b.key]} {b.label}
        </span>
      ))}
      {mejora.bono_cooldown ? (
        <span style={{
          fontSize: 8, fontFamily: 'var(--font-data)', letterSpacing: '0.06em',
          padding: '2px 6px', borderRadius: 3,
          background: '#f59e0b18', border: '1px solid #f59e0b40',
          color: '#f59e0b', whiteSpace: 'nowrap', lineHeight: 1.4,
        }}>
          {mejora.bono_cooldown} CD{mejora.mejora_habilidad ? `: ${mejora.mejora_habilidad.nombre}` : ''}
        </span>
      ) : null}
    </div>
  );
}

function MejoraPickerRow({ mejora, selected, onAssign }) {
  return (
    <div onClick={onAssign} style={{
      display: 'flex', alignItems: 'flex-start', gap: 11,
      padding: '10px 12px', borderRadius: 'var(--radius-md)',
      border: `1px solid ${selected ? 'var(--holo)' : 'var(--holo-line)'}`,
      background: selected ? 'color-mix(in srgb, var(--holo) 10%, rgba(255,255,255,.03))' : 'rgba(255,255,255,.02)',
      cursor: 'pointer', transition: 'all .15s',
    }}
      onMouseEnter={e => { if (!selected) { e.currentTarget.style.borderColor = 'var(--holo)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--holo) 8%, transparent)'; } }}
      onMouseLeave={e => { if (!selected) { e.currentTarget.style.borderColor = 'var(--holo-line)'; e.currentTarget.style.background = 'rgba(255,255,255,.02)'; } }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        display: 'grid', placeItems: 'center',
        background: 'rgba(56,205,240,0.12)', border: '1px solid rgba(56,205,240,0.28)',
        overflow: 'hidden',
      }}>
        {mejora.imagen
          ? <img src={mediaUrl(mejora.imagen)} alt={mejora.nombre} style={{ width: 28, height: 28, objectFit: 'contain' }} />
          : <Icon name="box" size={20} style={{ color: 'var(--holo)' }} />
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--txt)', lineHeight: 1.2 }}>{mejora.nombre}</div>
          {selected && <Chip tone="green" icon="check">Instalada</Chip>}
        </div>
        {mejora.efecto && (
          <div style={{ fontSize: 11, color: 'var(--txt-dim)', marginBottom: 6 }}>{mejora.efecto}</div>
        )}
        <MejoraBadges mejora={mejora} />
      </div>
    </div>
  );
}

function MejoraPickerModal({ open, onClose, mejoras, onAssign, onUnassign, slotIndex, currentId }) {
  /* Bloquea el scroll de la página mientras el modal está abierto */
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(4,7,15,0.85)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'rgba(5,10,22,0.98)', border: '1px solid var(--holo-line)',
        borderRadius: 'var(--radius-lg)', boxShadow: '0 24px 80px rgba(0,0,0,.7)',
        width: '100%', maxWidth: 520, maxHeight: '80vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--holo-line)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--holo)' }}><Icon name="box" size={16} /></span>
          <div style={{ flex: 1 }}>
            <div className="nx-display" style={{ fontSize: 14 }}>Seleccionar Mejora</div>
            <div className="nx-data" style={{ fontSize: 9, color: 'var(--txt-faint)', marginTop: 2 }}>SLOT {slotIndex} — Elige una mejora para tu nave</div>
          </div>
          <button className="nx-btn nx-btn-ghost" style={{ padding: 7 }} onClick={onClose}>
            <Icon name="x" size={15} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {currentId && (
            <button onClick={onUnassign} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 12px', marginBottom: 10, borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--holo-line)', background: 'rgba(255,255,255,.02)',
              color: 'var(--txt-dim)', cursor: 'pointer', fontSize: 12,
            }}>
              <Icon name="x" size={13} /> Quitar mejora de este slot
            </button>
          )}
          {mejoras.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--txt-faint)' }}>
              <div className="nx-data" style={{ fontSize: 11, letterSpacing: '0.1em' }}>NO POSEES MEJORAS DE NAVE</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {mejoras.map(m => (
                <MejoraPickerRow key={m.id} mejora={m} selected={m.id === currentId} onAssign={() => onAssign(m)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function NaveMejorasSlots({ owned, onChanged }) {
  const [mejoras, setMejoras] = useState([]);
  const [busySlot, setBusySlot] = useState(null);
  const [pickerSlot, setPickerSlot] = useState(null);

  const authHeaders = () => ({ Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('nx-token')}` });

  useEffect(() => {
    fetch(`/api/naves/${owned.id}/mejoras-options`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : { mejoras: [] })
      .then(d => setMejoras(d.mejoras ?? []))
      .catch(() => {});
  }, [owned.id]);

  const setSlot = async (slot, objetoId) => {
    setBusySlot(slot);
    try {
      const res = await fetch(`/api/naves/${owned.id}/mejoras/${slot}`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ objeto_id: objetoId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? data.error ?? 'No se pudo actualizar la mejora.');
      setPickerSlot(null);
      onChanged?.();
    } catch (err) {
      toast(err.message ?? 'No se pudo actualizar la mejora', { tone: 'error' });
    } finally {
      setBusySlot(null);
    }
  };

  return (
    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--holo-line)' }}>
      <div className="nx-kicker" style={{ fontSize: 9, marginBottom: 8 }}>Mejoras instaladas (4 slots)</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {[1, 2, 3, 4].map(slot => (
          <MejoraSlot
            key={slot} slot={slot} mejora={owned[`mejora${slot}`]}
            disabled={busySlot === slot}
            onClick={() => setPickerSlot(slot)}
          />
        ))}
      </div>
      {mejoras.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--txt-faint)', marginTop: 8 }}>
          No posees mejoras de nave en tu inventario. Consíguelas con un vendedor.
        </div>
      )}

      <MejoraPickerModal
        open={pickerSlot != null}
        onClose={() => setPickerSlot(null)}
        mejoras={mejoras}
        slotIndex={pickerSlot}
        currentId={pickerSlot ? (owned[`mejora${pickerSlot}`]?.id ?? null) : null}
        onAssign={(m) => setSlot(pickerSlot, m.id)}
        onUnassign={() => setSlot(pickerSlot, null)}
      />
    </div>
  );
}

function NaveEquipadaPanel() {
  const [naves, setNaves] = useState([]);
  const [naveEquipadaId, setNaveEquipadaId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const authHeaders = () => ({ Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('nx-token')}` });

  const load = () => {
    setLoading(true);
    fetch('/api/naves/mias', { headers: authHeaders() })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setNaves(d.naves ?? []); setNaveEquipadaId(d.nave_equipada_id ?? null); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const runAction = async (id, path, successMsg) => {
    setBusy(id);
    try {
      const res = await fetch(`/api${path}`, { method: 'POST', headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? 'No se pudo completar la acción.');
      if (successMsg) toast(successMsg, { tone: 'success', icon: 'check' });
      load();
    } catch (err) {
      toast(err.message ?? 'No se pudo completar la acción', { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const equipar     = (owned) => runAction(owned.id, `/naves/${owned.id}/equipar`, `${owned.nave?.nombre ?? 'Nave'} equipada`);
  const desequipar  = ()      => runAction('unequip', '/naves/desequipar');
  const reabastecer = (owned) => runAction(`fuel-${owned.id}`, `/naves/${owned.id}/reabastecer`, 'Combustible reabastecido');
  const reparar     = (owned) => runAction(`fix-${owned.id}`,  `/naves/${owned.id}/reparar`,     'Nave reparada');

  const equipada = naves.find(n => n.id === naveEquipadaId);
  const otras    = naves.filter(n => n.id !== naveEquipadaId);

  return (
    <Panel kicker="Equipo" title="Nave Equipada" icon="ship">
      {loading ? (
        <div style={{ fontSize: 12, color: 'var(--txt-faint)', padding: '6px 0' }}>Cargando naves...</div>
      ) : naves.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--txt-faint)', padding: '6px 0' }}>
          No posees ninguna nave. Consigue una hablando con un vendedor de naves en el Mapa Galáctico.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {equipada ? (
            <div className="nx-panel solid" style={{ padding: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center',
                  background: 'color-mix(in srgb, var(--holo) 18%, rgba(4,9,18,0.9))',
                  border: '1px solid var(--holo-line)', overflow: 'hidden',
                }}>
                  {equipada.nave?.imagen
                    ? <img src={mediaUrl(equipada.nave.imagen)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <Icon name="ship" size={22} style={{ color: 'var(--holo)' }} />}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="nx-display" style={{ fontSize: 13, color: 'var(--txt)' }}>{equipada.nave?.nombre}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    <Chip tone="green" icon="check">Equipada</Chip>
                    <Chip tone="dim">+{equipada.capacidad_carga_max ?? 0} carga</Chip>
                  </div>
                </div>
                <Btn kind="ghost" sm onClick={desequipar} disabled={busy === 'unequip'}>Desequipar</Btn>
              </div>
              <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
                <NaveMiniStatBar label="Vida"        value={equipada.vida_actual}        max={equipada.vida_max ?? 0}            color="#4ade80" />
                <NaveMiniStatBar label="Escudo"      value={equipada.escudo_actual}      max={equipada.escudo_max ?? 0}          color="#38cdf0" />
                <NaveMiniStatBar label="Combustible" value={equipada.combustible_actual} max={equipada.capacidad_salto_max ?? 0} color="var(--holocron-oro)" />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <NaveCombatStat label="Atq" icon="sword"  color="#ff7043" base={equipada.nave?.ataque}         efectivo={equipada.ataque_efectivo} />
                <NaveCombatStat label="Vel" icon="zap"    color="#E6B325" base={equipada.nave?.velocidad}      efectivo={equipada.velocidad_efectiva} />
                <NaveCombatStat label="Man" icon="target" color="#a78bfa" base={equipada.nave?.maniobrabilidad} efectivo={equipada.maniobrabilidad_efectiva} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <Btn kind="ghost" sm icon="fuel" onClick={() => reabastecer(equipada)}
                  disabled={busy === `fuel-${equipada.id}` || equipada.combustible_actual >= (equipada.capacidad_salto_max ?? 0)}>
                  Reabastecer ({fmtCr(equipada.nave?.costo_combustible)})
                </Btn>
                <Btn kind="ghost" sm icon="shield" onClick={() => reparar(equipada)}
                  disabled={busy === `fix-${equipada.id}` || (equipada.vida_actual >= (equipada.vida_max ?? 0) && equipada.escudo_actual >= (equipada.escudo_max ?? 0))}>
                  Reparar ({fmtCr(equipada.costo_reparacion_final)})
                </Btn>
              </div>
              <NaveMejorasSlots owned={equipada} onChanged={load} />
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--txt-faint)' }}>
              No tienes ninguna nave equipada. Elige una de tus naves abajo.
            </div>
          )}

          {otras.length > 0 && (
            <div style={{ display: 'grid', gap: 8 }}>
              <div className="nx-kicker" style={{ fontSize: 9 }}>Otras naves propias</div>
              {otras.map(owned => (
                <div key={owned.id} className="nx-panel" style={{ padding: 11, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 8, background: 'rgba(56,205,240,0.08)',
                    display: 'grid', placeItems: 'center', flexShrink: 0, overflow: 'hidden',
                  }}>
                    {owned.nave?.imagen
                      ? <img src={mediaUrl(owned.nave.imagen)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <Icon name="ship" size={16} style={{ color: 'var(--holo)' }} />}
                  </div>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--txt)' }}>{owned.nave?.nombre}</span>
                  <Btn kind="accent" sm onClick={() => equipar(owned)} disabled={busy === owned.id}>
                    {busy === owned.id ? '...' : 'Equipar'}
                  </Btn>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function TitulosPanel({ user, onCharacterCreated }) {
  const [busy, setBusy] = useState(null);
  const titulos = user?.character?.titulos ?? [];
  const activo = user?.character?.titulo_activo ?? null;

  if (titulos.length === 0) return null;

  const authHeaders = () => ({ Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('nx-token')}` });

  const activar = async (titulo) => {
    setBusy(titulo?.id ?? 'ninguno');
    try {
      const path = titulo ? `/titulos/${titulo.id}/activar` : '/titulos/desactivar';
      const res = await fetch(`/api${path}`, { method: 'POST', headers: authHeaders() });
      if (!res.ok) throw new Error();
      onCharacterCreated?.({
        ...user.character,
        titulo_activo: titulo ?? null,
        titulos: titulos.map(t => ({ ...t, activo: titulo ? t.id === titulo.id : false })),
      });
      toast(titulo ? `Mostrando "${titulo.nombre}"` : 'Título retirado', { tone: 'success', icon: 'check' });
    } catch {
      toast('No se pudo actualizar tu título', { tone: 'error', icon: 'x' });
    } finally {
      setBusy(null);
    }
  };

  const chipStyle = (on) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 12px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 11,
    fontFamily: 'var(--font-data)', letterSpacing: '0.03em',
    background: on ? 'color-mix(in srgb, var(--holocron-oro) 18%, rgba(255,255,255,.04))' : 'rgba(255,255,255,.04)',
    border: `1px solid ${on ? 'var(--holocron-oro)' : 'var(--holo-line)'}`,
    color: on ? 'var(--holocron-oro)' : 'var(--txt-faint)',
    transition: 'all .14s',
  });

  return (
    <Panel kicker="Reconocimientos" title="Títulos e Insignias" icon="medal">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button onClick={() => activar(null)} disabled={busy !== null} style={chipStyle(!activo)}>
          Ninguno
        </button>
        {titulos.map(t => (
          <button key={t.id} onClick={() => activar(t)} disabled={busy !== null} style={chipStyle(activo?.id === t.id)}>
            <Icon name={t.tipo === 'insignia' ? 'medal' : 'roster'} size={12} />
            {t.nombre}
          </button>
        ))}
      </div>
    </Panel>
  );
}

export function PersonajeView({ S, user, go, onCharacterCreated }) {
  const isMobile = useWindowWidth() < 640;
  const me = S.byId('you') ?? {};
  const myTier = user?.tier ?? me.tier ?? 'iniciado';
  const ch = S.character;
  const puntos_libres = ch.puntos_libres ?? 5;
  const [statCaps, setStatCaps] = useState({ asignacion: 10, items: 15 });
  const COMBAT_STATS = ['vida', 'escudo', 'defensa', 'ataque', 'movimiento', 'iniciativa', 'punteria'];
  const COMBAT_LABEL = { vida: 'Vida', escudo: 'Escudo', defensa: 'Defensa', ataque: 'Ataque', movimiento: 'Agilidad', iniciativa: 'Iniciativa', punteria: 'Puntería' };
  const COMBAT_DEFAULTS = { vida: 8, escudo: 4, defensa: 2, ataque: 2, movimiento: 2, iniciativa: 2, punteria: 2 };
  const baseCombat = ch.combat_base_stats ?? {};
  const itemBonuses = ch.sable_bonos ?? {};
  const sab = NX.SABERS[ch.saber] || NX.SABERS.azul;
  const [saving, setSaving] = useState(false);

  // Habilidades state (per-forma)
  const [habilidades, setHabilidades] = useState([]);
  const [slotPicker, setSlotPicker]   = useState(null); // 1..4
  const [selectedForma, setSelectedForma] = useState(() => user?.character?.current_forma ?? 1);
  const [formaSlots, setFormaSlots]   = useState(() => {
    const raw = user?.character?.habilidades_por_forma ?? {};
    const allHabs = user?.character?.all_habilidades_data ?? {};
    const resolved = {};
    for (const [f, ids] of Object.entries(raw)) {
      resolved[f] = (Array.isArray(ids) ? ids : [null, null, null, null]).map(id =>
        id && allHabs[String(id)] ? allHabs[String(id)] : null
      );
    }
    return resolved;
  });

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('nx-token');
    fetch('/api/admin/configuraciones?q=cap_stats_&per_page=10', {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        if (cancelled) return;
        const caps = { asignacion: 10, items: 15 };
        for (const row of d?.data ?? []) {
          if (row?.nombre === 'cap_stats_asignacion') caps.asignacion = Math.max(1, Number(row.valor_numerico ?? 10));
          if (row?.nombre === 'cap_stats_items') caps.items = Math.max(1, Number(row.valor_numerico ?? 15));
        }
        setStatCaps(caps);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!user?.character) return;
    const raw     = user.character.habilidades_por_forma ?? {};
    const allHabs = user.character.all_habilidades_data  ?? {};
    const resolved = {};
    for (const [f, ids] of Object.entries(raw)) {
      resolved[f] = (Array.isArray(ids) ? ids : [null, null, null, null]).map(id =>
        id && allHabs[String(id)] ? allHabs[String(id)] : null
      );
    }
    setFormaSlots(resolved);
    setSelectedForma(user.character.current_forma ?? 1);
  }, [
    user?.character?.id,
    user?.character?.current_forma,
    user?.character?.habilidades_por_forma,
    user?.character?.all_habilidades_data,
  ]);

  const currentSlots = formaSlots[String(selectedForma)] ?? [null, null, null, null];

  // Arma equipada
  const [armaEquipadaId, setArmaEquipadaId] = useState(() => user?.character?.arma_equipada?.id ?? '');
  const [equipandoArma, setEquipandoArma]   = useState(false);

  useEffect(() => {
    setArmaEquipadaId(user?.character?.arma_equipada?.id ?? '');
  }, [user?.character?.id, user?.character?.arma_equipada?.id]);

  const inventario = user?.character?.rol_objetos ?? [];
  const armasDisponibles = inventario.filter(o => o.tipo === 'arma');

  // Inventario clasificado por tipo (pestañas) — solo las armas son equipables
  const [invTab, setInvTab] = useState('arma');

  // Cajón lateral de Equipo (Inventario / Sable de luz / Nave)
  const [equipOpen, setEquipOpen] = useState(false);
  const [equipTab, setEquipTab]   = useState('inventario');
  const itemsDeTab = inventario.filter(o => o.tipo === invTab);

  /* Bloquea el scroll de la página mientras el cajón de equipo está abierto */
  useEffect(() => {
    if (!equipOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [equipOpen]);

  // Sable de luz armado (arma equipable prioritaria en combate)
  const sableActivo   = user?.character?.sable_activo ?? null;
  const sableColorHex = NX.SABERS[sableActivo?.color_hoja] || NX.SABERS.azul;

  const handleEquiparArma = async () => {
    setEquipandoArma(true);
    const token = localStorage.getItem('nx-token');
    try {
      const res = await fetch('/api/character/equipar-arma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rol_objeto_id: armaEquipadaId || null }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        toast(armaEquipadaId ? 'Arma equipada' : 'Arma desequipada', { tone: 'success', icon: 'check' });
        onCharacterCreated?.({ ...user.character, arma_equipada: data?.arma_equipada ?? null });
      } else {
        toast('Error al equipar el arma', { tone: 'error', icon: 'x' });
      }
    } catch {
      toast('Error de conexión', { tone: 'error', icon: 'x' });
    } finally {
      setEquipandoArma(false);
    }
  };

  const loadHabilidades = () => {
    if (habilidades.length > 0) return;
    const token = localStorage.getItem('nx-token');
    fetch('/api/rol-habilidades?aprendidas=1', {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    }).then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.habilidades) setHabilidades(d.habilidades); })
      .catch(() => {});
  };

  const handleOpenPicker = (slot) => {
    loadHabilidades();
    setSlotPicker(slot);
  };

  const handleAssignHabilidad = async (habilidad) => {
    const slot = slotPicker;
    setSlotPicker(null);
    void playClickHabilidad();
    const newCurrent = [...currentSlots];
    newCurrent[slot - 1] = habilidad;
    const newFormaSlots = { ...formaSlots, [String(selectedForma)]: newCurrent };
    setFormaSlots(newFormaSlots);
    const token = localStorage.getItem('nx-token');
    try {
      const slotPayload = {};
      newCurrent.forEach((h, i) => { slotPayload[i + 1] = h?.id ?? null; });
      const res = await fetch('/api/character/habilidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ forma: selectedForma, slots: slotPayload }),
      });
      if (res.ok) {
        toast('Habilidad asignada', { tone: 'success', icon: 'check', desc: `"${habilidad.nombre}" en Forma ${selectedForma}, slot ${slot}` });
        onCharacterCreated?.({
          ...user.character,
          current_forma: selectedForma,
          habilidades_por_forma: { ...(user.character.habilidades_por_forma ?? {}), [String(selectedForma)]: newCurrent.map(h => h?.id ?? null) },
          all_habilidades_data: { ...(user.character.all_habilidades_data ?? {}), [String(habilidad.id)]: habilidad },
        });
      }
    } catch {
      toast('Error al guardar habilidad', { tone: 'error', icon: 'x' });
      setFormaSlots(formaSlots);
    }
  };

  if (!user?.character) {
    return <CharacterCreation user={user} S={S} onCharacterCreated={onCharacterCreated} />;
  }

  const combatBump = (stat, d) => {
    const pts = ch.puntos_libres ?? 5;
    const cur = ch[stat] ?? COMBAT_DEFAULTS[stat];
    const cap = statCaps.asignacion ?? 10;
    if (d > 0 && (pts <= 0 || cur >= cap)) return;
    const nv = cur + d;
    if (nv < 1 || nv > cap) return;
    S.setCharacter({
      ...ch,
      [stat]: nv,
      combat_base_stats: { ...(ch.combat_base_stats ?? {}), [stat]: nv },
      puntos_libres: pts - d,
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('nx-token');
      const res = await fetch('/api/character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: ch.name, handle: ch.handle, bio: ch.bio || '', lore: ch.lore || '',
          cls: ch.cls, side: ch.side, saber_color: ch.saber, stats: ch.stats,
          vida: ch.vida ?? 8, escudo: ch.escudo ?? 4, defensa: ch.defensa ?? 2,
          ataque: ch.ataque ?? 2, movimiento: ch.movimiento ?? 2,
          iniciativa: ch.iniciativa ?? 2, punteria: ch.punteria ?? 2,
          puntos_libres: ch.puntos_libres ?? 5,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.message ?? 'Error al guardar', { tone: 'error', icon: 'x' }); return; }
      const savedCharacter = mapApiCharacterToStoreCharacter(data.character, ch);
      if (savedCharacter) {
        S.setCharacter(savedCharacter);
        onCharacterCreated?.(savedCharacter);
      }
      window.dispatchEvent(new CustomEvent('nx-mision-updated', {
        detail: { type: 'hitos-sync', source: 'character-save' },
      }));
      toast('Personaje guardado', { tone: 'success', icon: 'check', desc: 'Tu ficha de combate está actualizada' });
    } catch {
      toast('Error de conexión', { tone: 'error', icon: 'x' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <div className="nx-fade nx-personaje-grid" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '340px 1fr', gap: 18, alignItems: 'start' }}>
      {/* Retrato */}
      <div style={{ display: 'grid', gap: 18 }}>
        <Panel kicker="Retrato de combate" title="Identidad" icon="user" noBody>
          <div className="nx-panel-body" style={{ display: 'grid', placeItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ position: 'relative', width: 200, height: 220 }}>
                <ImageSlot src={ch.photo} onUpload={(url) => S.setCharacter({ ...ch, photo: url, photo_url: url })}
                  className="nx-hex" style={{ width: 200, height: 220, display: 'block' }}
                  shape="rect" placeholder="Sube tu retrato" />
                <div className="nx-hex" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', border: `1.5px solid ${sab}`, boxShadow: `0 0 26px -8px ${sab} inset` }} />
              </div>
              <SaberBlade color={sab} onClick={() => go?.('armado-sable')} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="nx-display" style={{ fontSize: 20 }}>{ch.name}</div>
              {user?.character?.titulo_activo && (
                <div className="nx-data" style={{ fontSize: 11, color: 'var(--holocron-oro)', marginTop: 2 }}>
                  {user.character.titulo_activo.nombre}
                </div>
              )}
              <div className="nx-data" style={{ fontSize: 12, color: 'var(--holo)', marginTop: 2 }}>@{ch.handle}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <TierBadge tier={myTier} />
              {(() => { const c = NX.CLASSES.find(x => x.id === ch.cls); return c ? <Chip icon={c.icon}>{c.num} · {c.name}</Chip> : null; })()}
              {ch.side && (() => { const s = SIDES[ch.side]; return (
                <span className="nx-data" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: s.color, padding: '3px 8px', border: `1px solid ${s.color}55`, borderRadius: 'var(--radius-sm)', background: `color-mix(in srgb, ${s.color} 12%, transparent)` }}>
                  <Icon name={s.icon} size={10} />{s.label}
                </span>
              ); })()}
            </div>
          </div>
        </Panel>

        <TitulosPanel user={user} onCharacterCreated={onCharacterCreated} />

        <Panel kicker="Cristal de poder" title="Color de Sable" icon="zap">
          {ch.side === 'oscuro' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center', border: `2px solid ${NX.SABERS.rojo}`, background: 'rgba(4,9,18,0.5)', boxShadow: `0 0 16px -3px ${NX.SABERS.rojo}` }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', background: NX.SABERS.rojo, boxShadow: `0 0 12px ${NX.SABERS.rojo}` }} />
              </span>
              <div>
                <div className="nx-data" style={{ fontSize: 11, color: NX.SABERS.rojo, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Cristal Rojo · Kyber corrompido</div>
                <div style={{ fontSize: 9, color: 'var(--txt-faint)', marginTop: 3 }}>El Lado Oscuro impone su cristal. No hay elección.</div>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {Object.keys(NX.SABERS).filter(k => k !== 'rojo').map((key) => {
                  const col = NX.SABERS[key]; const on = ch.saber === key;
                  return (
                    <button key={key} title={key} onClick={() => S.setCharacter({ ...ch, saber: key })}
                      style={{ width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', display: 'grid', placeItems: 'center',
                        border: on ? `2px solid ${col}` : '1px solid var(--holo-line)', background: 'rgba(4,9,18,0.5)',
                        boxShadow: on ? `0 0 16px -3px ${col}` : 'none', transition: 'all .15s' }}>
                      <span style={{ width: 18, height: 18, borderRadius: '50%', background: col, boxShadow: `0 0 12px ${col}` }} />
                    </button>
                  );
                })}
              </div>
              <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)', marginTop: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Cristal: {ch.saber}</div>
            </>
          )}
        </Panel>

        <Panel kicker="Logros" title="Medallas" icon="medal">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {(me.medals ?? []).map((m) => <MedalIcon key={m} id={m} size={40} />)}
          </div>
        </Panel>

        {/* Rango — read-only */}
        <Panel kicker="Orden Jedi" title="Rango" icon="shield">
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 6 }}>
            {RANGOS_JEDI.map(r => {
              const on = myTier === r.id;
              return (
                <div key={r.id} style={{
                  padding: '10px 6px 8px', borderRadius: 'var(--radius-md)', textAlign: 'center',
                  border: `1px solid ${on ? 'var(--holo)' : 'var(--holo-line)'}`,
                  background: on ? 'color-mix(in srgb, var(--holo) 10%, transparent)' : 'rgba(255,255,255,.02)',
                  boxShadow: on ? '0 0 14px -6px var(--holo)' : 'none',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                }}>
                  <img src={r.img} alt={r.label} style={{
                    width: 42, height: 42, objectFit: 'contain',
                    filter: on ? 'drop-shadow(0 0 6px var(--holo))' : 'brightness(0.45) saturate(0.3)',
                  }} />
                  <div className="nx-display" style={{ fontSize: 9, color: on ? 'var(--holo)' : 'var(--txt-faint)', lineHeight: 1.2 }}>{r.label}</div>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Clase y Grado — read-only */}
        <Panel kicker="Orden Jedi" title="Clase y Grado" icon="star">
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
              {CLASES_JEDI.map(c => {
                const on = user?.clase === c.id;
                return (
                  <div key={c.id} style={{
                    padding: '10px 6px 8px', borderRadius: 'var(--radius-md)', textAlign: 'center',
                    border: `1px solid ${on ? c.color : 'var(--holo-line)'}`,
                    background: on ? `color-mix(in srgb, ${c.color} 10%, transparent)` : 'rgba(255,255,255,.02)',
                    boxShadow: on ? `0 0 14px -6px ${c.color}` : 'none',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                  }}>
                    <img src={c.img} alt={c.label} style={{
                      width: 42, height: 42, objectFit: 'contain',
                      filter: on ? `drop-shadow(0 0 6px ${c.color})` : 'brightness(0.45) saturate(0.3)',
                    }} />
                    <div className="nx-display" style={{ fontSize: 9, color: on ? c.color : 'var(--txt-faint)', lineHeight: 1.2 }}>{c.label}</div>
                  </div>
                );
              })}
            </div>
            {myTier === 'caballero' && (
              <div>
                <div className="nx-kicker" style={{ marginBottom: 6 }}>Grado</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[1, 2, 3, 4, 5].map(n => {
                    const on = Number(user?.grado) === n;
                    return (
                      <div key={n} style={{
                        width: 36, height: 36, borderRadius: 'var(--radius-md)',
                        border: `1px solid ${on ? 'var(--holo)' : 'var(--holo-line)'}`,
                        background: on ? 'color-mix(in srgb, var(--holo) 18%, transparent)' : 'rgba(255,255,255,.02)',
                        color: on ? 'var(--holo)' : 'var(--txt-faint)',
                        fontFamily: 'var(--font-data)', fontSize: 13, fontWeight: 700,
                        display: 'grid', placeItems: 'center',
                        boxShadow: on ? '0 0 10px -4px var(--holo)' : 'none',
                      }}>{n}</div>
                    );
                  })}
                </div>
              </div>
            )}
            {!user?.clase && (
              <div style={{ fontSize: 10, color: 'var(--txt-faint)', fontStyle: 'italic', fontFamily: 'var(--font-data)' }}>
                Sin clase asignada.
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* Editor */}
      <div style={{ display: 'grid', gap: 18 }}>
        <Panel kicker="Ficha" title="Datos del Personaje" icon="edit"
          right={<Btn kind="accent" icon="check" sm disabled={saving} onClick={handleSave}>{saving ? 'Guardando...' : 'Guardar'}</Btn>}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
            <div>
              <label className="nx-label">Nombre de combate *</label>
              <input className="nx-input" value={ch.name} onChange={(e) => S.setCharacter({ ...ch, name: e.target.value })} />
            </div>
            <div>
              <label className="nx-label">Alias (handle) *</label>
              <input className="nx-input" value={ch.handle} onChange={(e) => S.setCharacter({ ...ch, handle: e.target.value.toUpperCase() })} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="nx-label">Grito de guerra</label>
              <textarea className="nx-textarea" value={ch.bio} onChange={(e) => S.setCharacter({ ...ch, bio: e.target.value })} placeholder="Tu frase antes del duelo..." />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="nx-label">Lore del personaje</label>
              <textarea className="nx-textarea" value={ch.lore ?? ''} onChange={(e) => S.setCharacter({ ...ch, lore: e.target.value })} placeholder="Historia, origen, motivaciones..." style={{ minHeight: 90 }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="nx-label">Lado de la Fuerza</label>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
                {Object.entries(SIDES).map(([key, s]) => {
                  const on = ch.side === key;
                  return (
                    <button key={key} onClick={() => S.setCharacter({ ...ch, side: key, ...(key === 'oscuro' ? { saber: 'rojo' } : ch.saber === 'rojo' ? { saber: 'azul' } : {}) })}
                      className="nx-panel solid" style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'stretch', borderColor: on ? s.color : undefined, boxShadow: on ? `0 0 16px -6px ${s.color}` : undefined, background: on ? `color-mix(in srgb, ${s.color} 8%, var(--space-panel-solid))` : undefined, transition: 'all .2s' }}>
                      <div style={{ width: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in srgb, ${s.color} 5%, rgba(4,9,18,0.9))`, borderRight: `1px solid ${on ? s.color + '55' : 'var(--holo-line)'}` }}>
                        <img src={s.img} alt={s.label} style={{ width: 38, height: 38, objectFit: 'contain', filter: on ? `drop-shadow(0 0 6px ${s.color})` : 'brightness(0.6) saturate(0.6)', transition: 'filter .2s' }} />
                      </div>
                      <div style={{ padding: '8px 11px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div className="nx-display" style={{ fontSize: 12, color: on ? s.color : 'var(--txt)', lineHeight: 1.2 }}>{s.label}</div>
                        <div style={{ fontSize: 9, color: 'var(--txt-dim)', marginTop: 3 }}>{s.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Panel>

        <Panel kicker="Especialización" title="Forma de Combate" icon="sword">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 6 }}>
            {NX.CLASSES.map((c) => {
              const active = ch.cls === c.id;
              return (
                <button key={c.id} onClick={() => S.setCharacter({ ...ch, cls: c.id })}
                  className="nx-panel solid" style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'stretch', borderColor: active ? c.accent : undefined, boxShadow: active ? `0 0 20px -6px ${c.accent}` : undefined, background: active ? `color-mix(in srgb, ${c.accent} 8%, var(--space-panel-solid))` : undefined, transition: 'all .2s' }}>
                  <div style={{ width: 68, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in srgb, ${c.accent} 5%, rgba(4,9,18,0.9))`, borderRight: `1px solid ${active ? c.accent + '55' : 'var(--holo-line)'}` }}>
                    <img src={c.img} alt={c.name} style={{ width: 50, height: 50, objectFit: 'contain', filter: active ? `drop-shadow(0 0 8px ${c.accent}) drop-shadow(0 0 3px ${c.accent})` : 'brightness(0.6) saturate(0.6)', transition: 'filter .2s' }} />
                  </div>
                  <div style={{ padding: '9px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-data)', fontSize: 8, letterSpacing: '0.16em', textTransform: 'uppercase', color: c.accent, marginBottom: 1 }}>{c.num}</div>
                    <div className="nx-display" style={{ fontSize: 12, color: active ? c.accent : 'var(--txt)', lineHeight: 1.2 }}>{c.name}</div>
                    <div style={{ fontSize: 9, color: 'var(--txt-dim)', marginTop: 3, lineHeight: 1.3 }}>{c.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </Panel>

        {/* Habilidades */}
        <Panel kicker="Técnicas de Combate" title="Habilidades" icon="zap">
          {/* Forma selector */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {FORMA_LABELS.map((label, i) => {
              const f = i + 1;
              const active = f === selectedForma;
              return (
                <button key={f} onClick={() => { void playClickOpcion(); setSelectedForma(f); }} title={label} style={{
                  padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 10,
                  fontFamily: 'var(--font-data)', letterSpacing: '0.08em',
                  background: active ? 'color-mix(in srgb, var(--holo) 18%, rgba(255,255,255,.04))' : 'rgba(255,255,255,.04)',
                  border: `1px solid ${active ? 'var(--holo)' : 'var(--holo-line)'}`,
                  color: active ? 'var(--holo)' : 'var(--txt-faint)',
                  boxShadow: active ? '0 0 10px -4px var(--holo)' : 'none',
                  transition: 'all .14s',
                }}>
                  {label}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 9, color: 'var(--txt-faint)', fontFamily: 'var(--font-data)', marginBottom: 10, letterSpacing: '0.06em' }}>
            {FORMA_LABELS[selectedForma - 1]} — 4 slots
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 10 }}>
            {[1, 2, 3, 4].map(slot => (
              <HabilidadSlot key={slot} slot={slot} habilidad={currentSlots[slot - 1] ?? null} onClick={() => { void playClickOpcion(); handleOpenPicker(slot); }} />
            ))}
          </div>
        </Panel>

        <HabilidadPickerModal
          open={slotPicker !== null}
          onClose={() => setSlotPicker(null)}
          habilidades={habilidades.filter(h => h.forma === 0 || h.forma === selectedForma)}
          onAssign={handleAssignHabilidad}
          slotIndex={slotPicker}
        />

        <Panel kicker="Atributos" title="Distribución de Stats" icon="trending"
          right={<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Chip tone={puntos_libres > 0 ? 'green' : 'dim'} icon="zap">{puntos_libres} pts libres</Chip><Btn kind="accent" icon="check" sm disabled={saving} onClick={handleSave}>Asignar</Btn></div>}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {COMBAT_STATS.map((s) => {
              const base = baseCombat[s] ?? ch[s] ?? COMBAT_DEFAULTS[s];
              const bonus = itemBonuses[s] ?? 0;
              const total = base + bonus;
              const atCap = base >= (statCaps.asignacion ?? 10);
              return (
                <div key={s} style={{
                  display: 'grid', gridTemplateColumns: 'minmax(88px, 1fr) auto auto auto auto auto', alignItems: 'center', gap: 8,
                  padding: '10px 12px', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--holo-line)', background: 'rgba(255,255,255,0.02)',
                }}>
                  <span className="nx-data" style={{ fontSize: 11, color: 'var(--txt-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 0 }}>
                    {COMBAT_LABEL[s]}
                  </span>
                  <span className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)' }}>x</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <button className="nx-btn nx-btn-ghost nx-btn-sm" style={{ padding: '4px 8px' }}
                      onClick={() => combatBump(s, -1)} disabled={base <= 1}>
                      <span style={{ fontSize: 12, lineHeight: 1 }}>-</span>
                    </button>
                    <span className="nx-num" style={{ minWidth: 24, textAlign: 'center', fontSize: 15, color: atCap ? 'var(--holocron-oro)' : 'var(--txt)' }}>{base}</span>
                    <button className="nx-btn nx-btn-ghost nx-btn-sm" style={{ padding: '4px 8px' }}
                      onClick={() => combatBump(s, +1)} disabled={puntos_libres <= 0 || base >= statCaps.asignacion}>
                      <Icon name="plus" size={11} />
                    </button>
                  </div>
                  <span className="nx-data" style={{ fontSize: 11, color: bonus >= 0 ? '#10b981' : '#ff6b6b', whiteSpace: 'nowrap' }}>
                    {bonus >= 0 ? '+' : ''}{bonus}
                  </span>
                  <span className="nx-data" style={{ fontSize: 12, color: 'var(--txt-faint)' }}>=</span>
                  <span className="nx-num" style={{ fontSize: 19, color: atCap ? 'var(--holocron-oro)' : 'var(--txt)', minWidth: 28, textAlign: 'right' }}>
                    {total}
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>

    {/* ── Cajón lateral de Equipo (Inventario / Sable de luz / Nave) ── */}
    {createPortal(<>
    <button
      onClick={() => setEquipOpen(o => !o)}
      style={{
        position: 'fixed', top: '50%', right: equipOpen ? 400 : 0, transform: 'translateY(-50%)',
        zIndex: 41, cursor: 'pointer',
        background: 'rgba(5,10,22,0.92)', backdropFilter: 'blur(6px)',
        border: '1px solid var(--holo-line)', borderRight: equipOpen ? '1px solid var(--holo-line)' : 'none',
        borderRadius: '8px 0 0 8px',
        padding: '16px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        color: 'var(--holo)', transition: 'right 0.28s var(--ease-standard)',
      }}
    >
      <Icon name="chevron" size={13} style={{ transform: equipOpen ? 'rotate(0deg)' : 'rotate(180deg)' }} />
      <span style={{ writingMode: 'vertical-rl', fontFamily: 'var(--font-data)', fontSize: 10, letterSpacing: '0.14em' }}>EQUIPO</span>
    </button>

    <div onClick={() => setEquipOpen(false)} style={{
      position: 'fixed', inset: 0, zIndex: 39,
      background: 'rgba(4,7,15,0.55)', backdropFilter: 'blur(2px)',
      opacity: equipOpen ? 1 : 0, pointerEvents: equipOpen ? 'auto' : 'none',
      transition: 'opacity 0.25s',
    }} />

    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 40,
      width: 400, maxWidth: '100vw',
      background: 'rgba(5,10,22,0.97)',
      borderLeft: '1px solid var(--holo-line)',
      backdropFilter: 'blur(14px)',
      display: 'flex', flexDirection: 'column',
      transform: equipOpen ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 0.28s var(--ease-standard)',
      boxShadow: equipOpen ? '-20px 0 60px -10px rgba(0,0,0,0.7)' : 'none',
    }}>
      <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--holo-line)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <div className="nx-kicker">EQUIPO</div>
          <div className="nx-display" style={{ fontSize: 15 }}>{ch.name}</div>
        </div>
        <button className="nx-btn nx-btn-ghost nx-btn-sm" onClick={() => setEquipOpen(false)} style={{ padding: 6 }}>
          <Icon name="x" size={14} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, padding: '14px 20px 0', flexShrink: 0 }}>
        {EQUIP_TABS.map(t => {
          const active = equipTab === t.value;
          return (
            <button key={t.value} onClick={() => setEquipTab(t.value)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center',
              padding: '7px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 10,
              fontFamily: 'var(--font-data)', letterSpacing: '0.05em',
              background: active ? 'color-mix(in srgb, var(--holo) 18%, rgba(255,255,255,.04))' : 'rgba(255,255,255,.04)',
              border: `1px solid ${active ? 'var(--holo)' : 'var(--holo-line)'}`,
              color: active ? 'var(--holo)' : 'var(--txt-faint)',
              boxShadow: active ? '0 0 10px -4px var(--holo)' : 'none',
              transition: 'all .14s',
            }}>
              <Icon name={t.icon} size={12} />
              {t.label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'grid', gap: 18 }}>
        {equipTab === 'sable' && (
          <Panel kicker="Equipo" title="Sable de Luz" icon="sword"
            right={<Btn kind="ghost" icon="sword" sm onClick={() => { setEquipOpen(false); go?.('armado-sable'); }}>Gestionar sable</Btn>}>
            {sableActivo ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center',
                  background: `color-mix(in srgb, ${sableColorHex} 18%, rgba(4,9,18,0.9))`,
                  border: `1px solid color-mix(in srgb, ${sableColorHex} 55%, transparent)`,
                }}>
                  <Icon name="sword" size={22} style={{ color: sableColorHex, filter: `drop-shadow(0 0 6px ${sableColorHex})` }} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="nx-display" style={{ fontSize: 13, color: 'var(--txt)' }}>{sableActivo.nombre}</div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                    <Chip tone="green" icon="check">Armado</Chip>
                    <span className="nx-data" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--txt-dim)' }}>
                      <Icon name="flame" size={12} style={{ color: '#ff6b6b' }} /> {sableActivo.dano} DMG melee
                    </span>
                    {sableActivo.dano_perforante > 0 && (
                      <span className="nx-data" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--txt-dim)' }}>
                        <Icon name="fire" size={12} style={{ color: '#8aa0c0' }} /> +{sableActivo.dano_perforante}P
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--txt-faint)', flexBasis: '100%' }}>
                  Tu sable armado ataca cuerpo a cuerpo en combate y tiene prioridad sobre cualquier arma equipada.
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--txt-faint)', padding: '6px 0' }}>
                No tienes ningún sable de luz armado. Ensambla y activa uno en «Armado de Sable» para usarlo en combate.
              </div>
            )}
          </Panel>
        )}

        {equipTab === 'nave' && <NaveEquipadaPanel />}

        {equipTab === 'inventario' && (
          <Panel kicker="Equipo" title="Inventario" icon="roster"
            right={invTab === 'arma' ? (
              <Btn kind="accent" icon="check" sm disabled={equipandoArma || (armaEquipadaId ?? '') === (user?.character?.arma_equipada?.id ?? '')} onClick={handleEquiparArma}>
                {equipandoArma ? 'Equipando...' : 'Equipar'}
              </Btn>
            ) : null}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {ITEM_TYPES.map(t => {
                const count = inventario.filter(o => o.tipo === t.value).length;
                const active = invTab === t.value;
                return (
                  <button key={t.value} onClick={() => setInvTab(t.value)} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 10,
                    fontFamily: 'var(--font-data)', letterSpacing: '0.06em',
                    background: active ? 'color-mix(in srgb, var(--holo) 18%, rgba(255,255,255,.04))' : 'rgba(255,255,255,.04)',
                    border: `1px solid ${active ? 'var(--holo)' : 'var(--holo-line)'}`,
                    color: active ? 'var(--holo)' : 'var(--txt-faint)',
                    boxShadow: active ? '0 0 10px -4px var(--holo)' : 'none',
                    transition: 'all .14s',
                  }}>
                    <Icon name={t.icon} size={12} />
                    {t.label}
                    <span style={{ opacity: 0.7 }}>({count})</span>
                  </button>
                );
              })}
            </div>

            {invTab === 'arma' ? (
              <>
                {sableActivo && (
                  <div style={{ fontSize: 11, color: 'var(--txt-faint)', padding: '0 0 10px' }}>
                    Tienes un sable de luz armado — se usará en combate en lugar de esta arma mientras esté activo.
                  </div>
                )}
                {armasDisponibles.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--txt-faint)', padding: '6px 0' }}>
                    No posees armas en tu inventario. Sin arma equipada, tus ataques básicos hacen 3 de daño.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                    <WeaponCard objeto={null} selected={!armaEquipadaId} onClick={() => setArmaEquipadaId('')} />
                    {armasDisponibles.map(o => (
                      <WeaponCard key={o.id} objeto={o} selected={armaEquipadaId === o.id} onClick={() => setArmaEquipadaId(o.id)} />
                    ))}
                  </div>
                )}
              </>
            ) : itemsDeTab.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--txt-faint)', padding: '6px 0' }}>
                No posees objetos de este tipo. Los componentes de sable se instalan desde «Armado de Sable».
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                {itemsDeTab.map(o => (
                  <InventoryItemCard key={o.id} objeto={o} icon={ITEM_TYPES.find(t => t.value === invTab)?.icon} />
                ))}
              </div>
            )}
          </Panel>
        )}
      </div>
    </div>
    </>, document.body)}
    </>
  );
}

export function SaberBlade({ color, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => onClick && setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={onClick ? 'Ir a Armado de Sable' : undefined}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', height: 220, justifyContent: 'flex-end',
        cursor: onClick ? 'pointer' : 'default',
        transform: hover ? 'scale(1.05)' : 'scale(1)',
        filter: hover ? 'brightness(1.25)' : 'none',
        transition: 'transform 0.15s ease, filter 0.15s ease',
      }}
    >
      <div style={{ width: 11, flex: 1, marginBottom: 2, borderRadius: 6, position: 'relative',
        background: color, boxShadow: `0 0 16px 1px ${color}, 0 0 38px 6px ${color}55` }}>
        <div style={{ position: 'absolute', top: 3, bottom: 3, left: '50%', transform: 'translateX(-50%)', width: 4, borderRadius: 3, background: 'rgba(255,255,255,0.92)' }} />
      </div>
      <div style={{ width: 19, height: 56, borderRadius: 4, background: 'linear-gradient(90deg,#2c3445,#a9b8cf 42%,#2c3445)', border: '1px solid #161d29', boxShadow: '0 3px 8px rgba(0,0,0,.55)' }}>
        <div style={{ height: 6, margin: '9px 2px 0', background: '#161d29', borderRadius: 2 }} />
        <div style={{ height: 4, margin: '6px 2px 0', background: color, borderRadius: 2, boxShadow: `0 0 7px ${color}` }} />
        <div style={{ height: 6, margin: '6px 2px 0', background: '#161d29', borderRadius: 2 }} />
      </div>
    </div>
  );
}
