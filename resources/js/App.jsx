import { useState, useEffect } from 'react';
import { NX } from './data/seed.js';
import { Icon, Avatar, Btn, ToastHost, toast } from './components/ui.jsx';
import { useStore } from './store/useStore.js';

const HUD_COLORS = ['#FF6B00', '#38cdf0', '#8b5cf6', '#10b981', '#ec4899', '#f97316', '#E6B325', '#3aa0ff'];
function hashColor(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return HUD_COLORS[Math.abs(h) % HUD_COLORS.length];
}

// Construye la lista de combatientes exclusivamente desde la API.
function mergeApiCombatants(apiList, currentUserId) {
  return apiList.map(api => {
    const isMe     = api.id === currentUserId;
    const color    = hashColor(api.handle);
    const initials = api.name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');

    return {
      medals:    [],
      id:        isMe ? 'you' : `u${api.id}`,
      userId:    api.id,
      handle:    api.handle,
      name:      api.name,
      bio:       api.bio        ?? '',
      cls:       api.cls        ?? 'forma1',
      side:      api.side       ?? 'luminoso',
      saberName: api.saber_color ?? 'azul',
      saber:     NX.SABERS[api.saber_color] ?? NX.SABERS.azul,
      wins:      api.wins       ?? 0,
      losses:    api.losses     ?? 0,
      streak:    api.streak     ?? 0,
      total:    (api.wins ?? 0) + (api.losses ?? 0),
      credits:   api.credits    ?? 0,
      stats:     api.stats      ?? { fuerza: 50, velocidad: 50, tecnica: 50, defensa: 50, foco: 50 },
      gold:      api.gold       ?? false,
      tier:      api.tier       ?? 'iniciado',
      winrate:   api.winrate    ?? 0,
      sector:    api.sector     ?? '',
      sponsor:   api.sponsor    ?? '',
      joined:    api.joined_year ? String(api.joined_year) : '',
      photo_url: api.photo_url  ?? null,
      initials, color,
    };
  });
}

// Convierte un combat de la API al shape que espera el frontend.
// Embebe los objetos combatant resueltos en _a / _b para que CombatCard
// y ScoringScreen puedan usarlos directamente sin necesitar buscar en el store.
function normalizeApiCombat(c, combatants, currentUserId) {
  const find = (userId) => {
    if (!userId) return null;
    return combatants.find(x => x.userId === userId)
      ?? combatants.find(x => x.id === (userId === currentUserId ? 'you' : `u${userId}`))
      ?? null;
  };

  const ca = find(c.combatant_a?.user_id);
  const cb = find(c.combatant_b?.user_id);

  // Si no hay match en combatants (usuario sin personaje), construimos un stub mínimo
  const stub = (raw, userId) => raw ? {
    id: userId === currentUserId ? 'you' : `u${userId}`,
    userId,
    name:     raw.name ?? 'Combatiente',
    handle:   raw.handle ?? `u${userId}`,
    initials: (raw.name ?? 'CB').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase(),
    color:    '#38cdf0',
    cls:      raw.cls ?? 'forma1',
    side:     raw.side ?? 'luminoso',
    saber:    NX.SABERS[raw.saber_color] ?? NX.SABERS.azul,
    saberName: raw.saber_color ?? 'azul',
    tier:     raw.tier ?? 'iniciado',
    wins:     raw.wins ?? 0,
    losses:   raw.losses ?? 0,
    winrate:  raw.winrate ?? 0,
    streak:   raw.streak ?? 0,
    credits:  raw.credits ?? 0,
  } : null;

  const fighterA = ca ?? stub(c.combatant_a, c.combatant_a?.user_id);
  const fighterB = cb ?? stub(c.combatant_b, c.combatant_b?.user_id);

  const when = c.scheduled_at
    ? new Date(c.scheduled_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : 'Por agendar';

  return {
    id:       c.id,              // número — indica que es un combate real de la BD
    a:        fighterA?.id ?? `u${c.combatant_a?.user_id}`,
    b:        fighterB?.id ?? `u${c.combatant_b?.user_id}`,
    _a:       fighterA,          // objeto completo pre-resuelto
    _b:       fighterB,
    oddsA:    c.odds_a,
    oddsB:    c.odds_b,
    when,
    live:     c.live,
    event:    c.event_name ?? 'Combate Oficial',
    round:    c.round ?? '—',
    resolved: c.resolved,
    winner:   c.winner,
  };
}

const SABER_THEME = {
  azul:    { holo: '#3aa0ff', dim: '#2575cc' },
  verde:   { holo: '#34d36a', dim: '#23a04e' },
  ambar:   { holo: '#ffb01f', dim: '#cc8800' },
  purpura: { holo: '#b15cff', dim: '#8533e0' },
  cian:    { holo: '#26e3e3', dim: '#18a8a8' },
  blanco:  { holo: '#c8deff', dim: '#8899bb' },
  rojo:    { holo: '#ff2d45', dim: '#cc1030' },
};

function applySaberTheme(saberName) {
  const t = SABER_THEME[saberName] || SABER_THEME.cian;
  const root = document.documentElement;
  root.style.setProperty('--holo', t.holo);
  root.style.setProperty('--holo-dim', t.dim);
  root.style.setProperty('--holo-faint', `color-mix(in srgb, ${t.holo} 18%, transparent)`);
  root.style.setProperty('--holo-line', `color-mix(in srgb, ${t.holo} 32%, transparent)`);
}
import { ComandoView, PersonajeView } from './sections/Comando.jsx';
import { TrainingView } from './sections/Entrenamiento.jsx';
import { TareasView } from './sections/Tareas.jsx';
import { RankingView, CombatesView } from './sections/Combates.jsx';
import { EventosView } from './sections/Eventos.jsx';
import { CombatientesView } from './sections/Combatientes.jsx';
import MapaView from './sections/Mapa.jsx';
import AdminView from './sections/Admin.jsx';

const NAV = [
  { id: 'comando', label: 'Comando', icon: 'command' },
  { id: 'personaje', label: 'Mi Personaje', icon: 'user' },
  { id: 'entrenamiento', label: 'Entrenamiento', icon: 'calendar' },
  { id: 'tareas', label: 'Tareas', icon: 'tasks' },
  { id: 'eventos', label: 'Eventos', icon: 'star' },
  { id: 'ranking', label: 'Ranking', icon: 'trophy' },
  { id: 'combates', label: 'Combates', icon: 'swords' },
  { id: 'combatientes', label: 'Combatientes', icon: 'roster' },
  { id: 'mapa', label: 'Mapa Galáctico', icon: 'target' },
];
const TITLES = {
  comando: ['Centro de Comando', 'Estadisticas y misiones'],
  personaje: ['Mi Personaje', 'Ficha de combate e identidad'],
  entrenamiento: ['Entrenamiento', 'Asistencia y bitácora diaria'],
  tareas: ['Tareas', 'Plan de entrenamiento dirigido'],
  eventos: ['Eventos', 'Presentaciones y recompensas'],
  ranking: ['Ranking', 'Escalera de la liga orbital'],
  combates: ['Combates', 'Arena, apuestas y desafíos'],
  combatientes: ['Combatientes', 'Directorio y perfiles públicos'],
  mapa: ['Mapa Galáctico', 'Navegación entre sistemas y planetas'],
  configuracion: ['Configuración', 'Gestión de tablas del sistema'],
};

export default function App({ user, onLogout, onUserUpdate, onTransmision }) {
  const S = useStore();
  const [view, setView] = useState(() => location.hash.slice(1) || 'comando');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [testOpen, setTestOpen] = useState(false);
  const canTutor = ['caballero', 'maestro', 'granmaestro'].includes(user?.tier ?? '');
  const unread = notifications.filter(n => !n.read).length;
  const me = S.byId('you') ?? { initials: (user?.name ?? '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase(), color: '#38cdf0' };

  const go = (v) => {
    setView(v);
    location.hash = v;
    window.scrollTo({ top: 0 });
    setSidebarOpen(false);
  };
  useEffect(() => {
    const h = () => setView(location.hash.slice(1) || 'comando');
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);

  useEffect(() => {
    applySaberTheme(S.character.saber);
  }, [S.character.saber]);

  // Sincroniza photo_url del usuario autenticado al store (no persiste en localStorage)
  useEffect(() => {
    const photoUrl = user?.character?.photo_url;
    if (photoUrl && !S.character.photo) {
      S.setCharacter(ch => ({ ...ch, photo: photoUrl }));
    }
  }, [user?.character?.photo_url]);

  // Carga notificaciones y suscribe al canal privado de Pusher
  useEffect(() => {
    const token = localStorage.getItem('nx-token');
    const headers = { Accept: 'application/json', Authorization: `Bearer ${token}` };
    fetch('/api/notifications', { headers })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.data) return;
        setNotifications(data.data);
        // Show transmissions for recent unread notifications (offline delivery)
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        data.data
          .filter(n => !n.read && new Date(n.created_at).getTime() > cutoff)
          .forEach(n => onTransmision?.({ ...n.data, _notifId: n.id }));
      })
      .catch(() => {});
  }, []);

  // Carga combatientes y combates reales; los fusiona con el seed
  useEffect(() => {
    const token = localStorage.getItem('nx-token');
    if (!token) return;
    const headers = { Accept: 'application/json', Authorization: `Bearer ${token}` };
    Promise.all([
      fetch('/api/combatants', { headers }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/combats',    { headers }).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([cbData, cmData]) => {
      let merged = S.combatants;
      if (cbData?.combatants) {
        merged = mergeApiCombatants(cbData.combatants, user?.id);
        S.setCombatants(merged);
      }
      if (cmData?.combats?.length) {
        const normalized = cmData.combats.map(c => normalizeApiCombat(c, merged, user?.id));
        S.setCombats(prev => {
          const local = prev.filter(c => typeof c.id === 'string');
          return [...normalized, ...local];
        });
      }
    });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !window.Echo) return;
    window.Echo.private(`App.Models.User.${user.id}`)
      .notification((notif) => {
        setNotifications(prev => [{ id: notif.id ?? Date.now(), data: notif, read: false, created_at: new Date().toISOString() }, ...prev]);
        onTransmision?.({ ...notif, _notifId: notif.id });
      });
    return () => window.Echo.leave(`App.Models.User.${user.id}`);
  }, [user?.id]);

  const authHeaders = () => {
    const token = localStorage.getItem('nx-token');
    return { Accept: 'application/json', Authorization: `Bearer ${token}` };
  };

  const markRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    fetch(`/api/notifications/${id}/read`, { method: 'POST', headers: authHeaders() }).catch(() => {});
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    fetch('/api/notifications/read-all', { method: 'POST', headers: authHeaders() }).catch(() => {});
  };

  const fireTestTransmision = (type) => {
    setTestOpen(false);
    fetch('/api/notifications/test', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    }).catch(() => {});
  };

  const VIEWS = {
    comando: <ComandoView S={S} go={go} user={user} />,
    personaje: <PersonajeView S={S} user={user} onCharacterCreated={(char) => onUserUpdate?.({ ...user, character: char })} />,
    entrenamiento: <TrainingView S={S} />,
    tareas: <TareasView S={S} user={user} />,
    eventos: <EventosView S={S} go={go} user={user} />,
    ranking: <RankingView S={S} />,
    combates: <CombatesView S={S} user={user} />,
    combatientes: <CombatientesView S={S} />,
    mapa: <MapaView />,
    configuracion: <AdminView />,
  };
  const [title, sub] = TITLES[view] ?? ['', ''];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', position: 'relative', zIndex: 1 }}>
      <div className="nx-bg-grid" />
      <div className="nx-scanlines" />

      {/* Mobile overlay */}
      <div className={`nx-sidebar-overlay${sidebarOpen ? ' open' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* Sidebar */}
      <aside
        className={`nx-sidebar${sidebarOpen ? ' open' : ''}`}
        style={{
          width: sidebarCollapsed ? 52 : 210, flexShrink: 0,
          borderRight: '1px solid var(--holo-line)',
          background: 'rgba(4,7,15,0.6)', backdropFilter: 'blur(8px)',
          position: 'sticky', top: 0, height: '100vh',
          display: 'flex', flexDirection: 'column', zIndex: 5,
          overflow: 'hidden', transition: 'width .22s cubic-bezier(.4,0,.2,1)',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '14px', borderBottom: '1px solid var(--holo-line)', display: 'flex', alignItems: 'center', gap: 9, minHeight: 57, flexShrink: 0 }}>
          <img src="/assets/isotipo.png" alt="" style={{ width: 28, height: 28, flexShrink: 0, filter: 'drop-shadow(0 0 10px rgba(230,179,37,.4))' }} />
          <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', opacity: sidebarCollapsed ? 0 : 1, transition: 'opacity .15s' }}>
            <div className="nx-display" style={{ fontSize: 15, letterSpacing: '0.08em', color: 'var(--txt)' }}>NÉXUS</div>
            <div className="nx-data" style={{ fontSize: 8, color: 'var(--holo)', letterSpacing: '0.22em' }}>HOLOCRON DE COMBATE</div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: 8, display: 'grid', gap: 2, alignContent: 'start' }}>
          {NAV.map((n) => {
            const active = view === n.id;
            return (
              <button
                key={n.id}
                onClick={() => go(n.id)}
                title={sidebarCollapsed ? n.label : undefined}
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: sidebarCollapsed ? 0 : 9,
                  justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                  padding: sidebarCollapsed ? '8px' : '8px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid', borderColor: active ? 'var(--holo-line)' : 'transparent',
                  cursor: 'pointer', textAlign: 'left',
                  background: active ? 'color-mix(in srgb, var(--holo) 12%, transparent)' : 'transparent',
                  color: active ? 'var(--txt)' : 'var(--txt-dim)',
                  fontFamily: 'var(--font-data)', fontSize: 12, letterSpacing: '0.04em',
                  transition: 'all .15s', position: 'relative',
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--txt)'; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--txt-dim)'; }}
              >
                {active && <span style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 2, borderRadius: 2, background: 'var(--holo)', boxShadow: '0 0 8px var(--holo)' }} />}
                <span style={{ color: active ? 'var(--holo)' : 'inherit', flexShrink: 0 }}><Icon name={n.icon} size={15} /></span>
                <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', opacity: sidebarCollapsed ? 0 : 1, maxWidth: sidebarCollapsed ? 0 : 200, transition: 'opacity .15s, max-width .22s' }}>
                  {n.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Botón colapsar */}
        <div style={{ padding: '6px 8px', borderTop: '1px solid var(--holo-line)' }}>
          <button
            onClick={() => setSidebarCollapsed(c => !c)}
            title={sidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
            className="nx-sidebar-collapse-btn"
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-end',
              gap: 6, padding: '6px 4px',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--txt-faint)', borderRadius: 'var(--radius-sm)',
              transition: 'color .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--txt)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--txt-faint)'; }}
          >
            {!sidebarCollapsed && <span className="nx-data" style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Colapsar</span>}
            <span style={{ transform: sidebarCollapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform .22s', display: 'flex' }}>
              <Icon name="chevron" size={14} />
            </span>
          </button>
        </div>

        {/* Rol — solo visible para caballero, maestro y gran maestro */}
        {canTutor && (
          <div style={{ padding: 8, borderTop: '1px solid var(--holo-line)', overflow: 'hidden' }}>
            {!sidebarCollapsed && <div className="nx-kicker" style={{ fontSize: 8, marginBottom: 5, paddingLeft: 2, whiteSpace: 'nowrap' }}>Modo de vista</div>}
            <div style={{ display: 'flex', gap: 3, background: 'rgba(4,7,15,0.6)', padding: 3, borderRadius: 'var(--radius-md)', border: '1px solid var(--holo-line)' }}>
              {['pupilo', 'tutor'].map(r => (
                <button key={r} onClick={() => S.setRole(r)} title={sidebarCollapsed ? r : undefined} style={{
                  flex: 1, padding: '5px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-data)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
                  background: S.role === r ? 'var(--pompeyo-naranja)' : 'transparent',
                  color: S.role === r ? '#fff' : 'var(--txt-dim)', fontWeight: 700,
                  whiteSpace: 'nowrap', overflow: 'hidden',
                }}>
                  {sidebarCollapsed ? r[0].toUpperCase() : r}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Botón Configuración */}
        <div style={{ padding: '4px 8px', borderTop: '1px solid var(--holo-line)' }}>
          <button
            onClick={() => go('configuracion')}
            title={sidebarCollapsed ? 'Configuración' : undefined}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              gap: sidebarCollapsed ? 0 : 8,
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              padding: sidebarCollapsed ? '8px' : '8px 10px',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${view === 'configuracion' ? 'var(--holo-line)' : 'transparent'}`,
              background: view === 'configuracion' ? 'color-mix(in srgb, var(--holo) 10%, transparent)' : 'transparent',
              color: view === 'configuracion' ? 'var(--txt)' : 'var(--txt-faint)',
              cursor: 'pointer', transition: 'all .15s',
              fontFamily: 'var(--font-data)', fontSize: 11, letterSpacing: '0.06em',
            }}
            onMouseEnter={e => { if (view !== 'configuracion') e.currentTarget.style.color = 'var(--txt)'; }}
            onMouseLeave={e => { if (view !== 'configuracion') e.currentTarget.style.color = 'var(--txt-faint)'; }}
          >
            <span style={{ color: view === 'configuracion' ? 'var(--holo)' : 'inherit', flexShrink: 0 }}>
              <Icon name="filter" size={14} />
            </span>
            <span style={{
              overflow: 'hidden', whiteSpace: 'nowrap',
              opacity: sidebarCollapsed ? 0 : 1, maxWidth: sidebarCollapsed ? 0 : 200,
              transition: 'opacity .15s, max-width .22s',
            }}>
              Configuración
            </span>
          </button>
        </div>

        {/* Usuario + logout */}
        <div style={{ padding: 8, borderTop: '1px solid var(--holo-line)', display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
          <Avatar c={me} size={30} ring style={{ flexShrink: 0 }} />
          <div style={{ minWidth: 0, flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', opacity: sidebarCollapsed ? 0 : 1, transition: 'opacity .15s' }}>
            <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name ?? S.character.name}</div>
            <div className="nx-data" style={{ fontSize: 9, color: 'var(--holo)' }}>{S.role === 'tutor' ? 'Tutor' : '@' + S.character.handle}</div>
          </div>
          {!sidebarCollapsed && (
            <button
              onClick={onLogout}
              title="Cerrar sesión"
              className="nx-btn nx-btn-ghost"
              style={{ padding: 7, color: 'var(--txt-faint)', flexShrink: 0 }}
              onMouseEnter={e => e.currentTarget.style.color = '#ff6b6b'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--txt-faint)'}>
              <Icon name="logout" size={15} />
            </button>
          )}
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header className="nx-header" style={{ position: 'sticky', top: 0, zIndex: 4, display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px', borderBottom: '1px solid var(--holo-line)', background: 'rgba(4,7,15,0.55)', backdropFilter: 'blur(8px)' }}>
          <button className="nx-hamburger" onClick={() => setSidebarOpen(o => !o)} aria-label="Abrir menú">
            <Icon name="menu" size={18} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="nx-display" style={{ fontSize: 16, color: 'var(--txt)' }}>{title}</h1>
            <div className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)', letterSpacing: '0.04em' }}>{sub}</div>
          </div>
          <div className="nx-panel" style={{ padding: '6px 11px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--pompeyo-oro)' }}><Icon name="coin" size={14} /></span>
            <span className="nx-num" style={{ fontSize: 14, color: 'var(--pompeyo-oro)' }}>{NX.fmtCLP(S.credits)}</span>
          </div>
          <button className="nx-btn nx-btn-ghost" style={{ padding: 7, position: 'relative' }} onClick={() => setNotifOpen(o => !o)}>
            <Icon name="bell" size={15} />
            {unread > 0 && (
              <span style={{ position: 'absolute', top: 5, right: 5, minWidth: 16, height: 16, borderRadius: 8, background: 'var(--pompeyo-naranja)', boxShadow: '0 0 6px var(--pompeyo-naranja)', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'var(--font-data)', padding: '0 3px' }}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {/* Widget de prueba de transmisiones */}
          <div style={{ position: 'relative' }}>
            <button
              className="nx-btn nx-btn-ghost"
              title="Probar Transmisión"
              style={{ padding: 7, color: testOpen ? 'var(--holo)' : 'var(--txt-faint)' }}
              onClick={() => setTestOpen(o => !o)}
            >
              <Icon name="video" size={15} />
            </button>
            {testOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                background: 'rgba(6,10,20,.97)', border: '1px solid var(--holo-line)',
                boxShadow: '0 8px 32px rgba(0,0,0,.6)',
                padding: 12, minWidth: 200, zIndex: 50,
              }}>
                <div style={{ fontFamily: 'var(--font-hud)', fontSize: 9, letterSpacing: '.2em', color: 'var(--holo)', marginBottom: 10 }}>
                  TEST TRANSMISIÓN
                </div>
                {[
                  { type: 'desafio', label: 'Reto de combate',  color: '#FF6B00' },
                  { type: 'victoria', label: 'Combate ganado',  color: '#10b981' },
                  { type: 'derrota',  label: 'Combate perdido', color: '#ff2d45' },
                  { type: 'tarea',    label: 'Tarea asignada',  color: '#E6B325' },
                  { type: 'sistema',  label: 'Mensaje sistema', color: '#3aa0ff' },
                ].map(({ type, label, color }) => (
                  <button
                    key={type}
                    onClick={() => fireTestTransmision(type)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '7px 10px', marginBottom: 2,
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      fontFamily: 'var(--font-hud)', fontSize: 11, color: 'var(--txt-dim)',
                      letterSpacing: '.05em',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${color}18`; e.currentTarget.style.color = color; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--txt-dim)'; }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        <main className="nx-main" style={{ flex: 1, padding: '18px 20px 48px', maxWidth: 1280, width: '100%', margin: '0 auto' }}>
          {VIEWS[view]}
        </main>
      </div>

      {/* Overlay notificaciones */}
      <div
        onClick={() => setNotifOpen(false)}
        style={{
          position: 'fixed', inset: 0, zIndex: 29,
          background: 'rgba(4,7,15,0.55)', backdropFilter: 'blur(2px)',
          opacity: notifOpen ? 1 : 0, pointerEvents: notifOpen ? 'auto' : 'none',
          transition: 'opacity 0.25s',
        }}
      />

      {/* Drawer de notificaciones */}
      <NotifDrawer
        open={notifOpen}
        notifications={notifications}
        unread={unread}
        onMarkRead={markRead}
        onMarkAllRead={markAllRead}
        onClose={() => setNotifOpen(false)}
      />

      <ToastHost />
    </div>
  );
}

/* ---- Drawer lateral de notificaciones ---- */
const TONE_COLOR = {
  orange: 'var(--pompeyo-naranja)', green: 'var(--green-500)',
  red: '#ff6b6b', holo: 'var(--holo)', info: 'var(--holo)', gold: 'var(--pompeyo-oro)',
};

function groupByDate(notifications) {
  const today = new Date().toDateString();
  const groups = { hoy: [], antes: [] };
  notifications.forEach(n => {
    const d = new Date(n.created_at).toDateString();
    (d === today ? groups.hoy : groups.antes).push(n);
  });
  return groups;
}

function NotifDrawer({ open, notifications, unread, onMarkRead, onMarkAllRead, onClose }) {
  const hasUnread = unread > 0;
  const groups = groupByDate(notifications);

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 30,
      width: 380, maxWidth: '100vw',
      background: 'rgba(5,10,22,0.97)',
      borderLeft: '1px solid var(--holo-line)',
      backdropFilter: 'blur(14px)',
      display: 'flex', flexDirection: 'column',
      transform: open ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 0.28s var(--ease-standard)',
      boxShadow: open ? '-20px 0 60px -10px rgba(0,0,0,0.7)' : 'none',
    }}>

      {/* Cabecera */}
      <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--holo-line)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: hasUnread ? 14 : 0 }}>
          <span style={{ color: 'var(--holo)' }}><Icon name="bell" size={18} /></span>
          <div style={{ flex: 1 }}>
            <div className="nx-display" style={{ fontSize: 15 }}>Notificaciones</div>
            <div className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)', marginTop: 1 }}>
              {hasUnread ? `${unread} sin leer` : 'Todo al día'}
            </div>
          </div>
          <button className="nx-btn nx-btn-ghost" style={{ padding: 8 }} onClick={onClose} aria-label="Cerrar">
            <Icon name="x" size={16} />
          </button>
        </div>
        {hasUnread && (
          <button onClick={onMarkAllRead} style={{
            width: '100%', padding: '8px', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--holo-line)', background: 'color-mix(in srgb, var(--holo) 6%, transparent)',
            color: 'var(--holo)', cursor: 'pointer', fontFamily: 'var(--font-data)',
            fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700,
            transition: 'all .15s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--holo) 14%, transparent)'}
            onMouseLeave={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--holo) 6%, transparent)'}>
            Marcar todo como leído
          </button>
        )}
      </div>

      {/* Lista scrollable */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {notifications.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--txt-faint)' }}>
            <span style={{ opacity: 0.3 }}><Icon name="bell" size={40} /></span>
            <div className="nx-data" style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Sin notificaciones</div>
          </div>
        ) : (
          <>
            {groups.hoy.length > 0 && (
              <NotifGroup label="Hoy" items={groups.hoy} onMarkRead={onMarkRead} />
            )}
            {groups.antes.length > 0 && (
              <NotifGroup label="Anteriores" items={groups.antes} onMarkRead={onMarkRead} />
            )}
          </>
        )}
      </div>

      {/* Pie */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--holo-line)', flexShrink: 0 }}>
        <div className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)', textAlign: 'center', letterSpacing: '0.08em' }}>
          {notifications.length} notificación{notifications.length !== 1 ? 'es' : ''} · últimas 24 h
        </div>
      </div>
    </div>
  );
}

function NotifGroup({ label, items, onMarkRead }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div>
      {/* Encabezado del grupo */}
      <button onClick={() => setCollapsed(c => !c)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 20px 8px', background: 'none', border: 'none', cursor: 'pointer',
        borderBottom: '1px solid var(--holo-line)',
      }}>
        <span className="nx-kicker" style={{ flex: 1, textAlign: 'left', fontSize: 9 }}>{label}</span>
        <span style={{ color: 'var(--txt-faint)', transform: collapsed ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform .2s' }}>
          <Icon name="chevron" size={13} />
        </span>
      </button>

      {/* Ítems */}
      {!collapsed && items.map(n => <NotifItem key={n.id} n={n} onMarkRead={onMarkRead} />)}
    </div>
  );
}

function NotifItem({ n, onMarkRead }) {
  const [expanded, setExpanded] = useState(false);
  const d = n.data ?? {};
  const color = TONE_COLOR[d.tone] ?? 'var(--holo)';

  const handleClick = () => {
    onMarkRead(n.id);
    setExpanded(e => !e);
  };

  return (
    <div style={{
      borderBottom: '1px solid var(--holo-line)',
      background: n.read ? 'transparent' : 'color-mix(in srgb, var(--holo) 4%, transparent)',
      transition: 'background .2s',
    }}>
      {/* Fila principal */}
      <button onClick={handleClick} style={{
        width: '100%', textAlign: 'left', padding: '14px 20px', border: 'none', cursor: 'pointer',
        background: 'transparent', display: 'flex', gap: 13, alignItems: 'flex-start',
      }}
        onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--holo) 7%, transparent)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

        {/* Ícono con borde del tono */}
        <span style={{
          width: 36, height: 36, borderRadius: 'var(--radius-md)', flexShrink: 0,
          display: 'grid', placeItems: 'center', color,
          background: `color-mix(in srgb, ${color} 12%, transparent)`,
          border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
        }}>
          <Icon name={d.icon ?? 'bell'} size={16} />
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: n.read ? 500 : 700, color: 'var(--txt)', lineHeight: 1.35 }}>
            {d.title ?? 'Notificación'}
          </div>
          <div className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)', marginTop: 3 }}>
            {new Date(n.created_at).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          {!n.read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />}
          <span style={{ color: 'var(--txt-faint)', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>
            <Icon name="chevron" size={13} />
          </span>
        </div>
      </button>

      {/* Detalle expandible */}
      {expanded && d.body && (
        <div style={{ padding: '0 20px 14px 69px' }}>
          <div style={{ fontSize: 13, color: 'var(--txt-dim)', lineHeight: 1.5 }}>{d.body}</div>
          {d.action_label && (
            <a href={d.action_url ?? '#'} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, color, fontSize: 12, fontFamily: 'var(--font-data)', textDecoration: 'none', fontWeight: 700, letterSpacing: '0.08em' }}>
              {d.action_label} <Icon name="arrow" size={13} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
