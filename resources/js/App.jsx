import { useState, useEffect } from 'react';
import { NX } from './data/seed.js';
import { Icon, Avatar, Btn, ToastHost, toast } from './components/ui.jsx';
import { useStore } from './store/useStore.js';

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

const NAV = [
  { id: 'comando', label: 'Comando', icon: 'command' },
  { id: 'personaje', label: 'Mi Personaje', icon: 'user' },
  { id: 'entrenamiento', label: 'Entrenamiento', icon: 'calendar' },
  { id: 'tareas', label: 'Tareas', icon: 'tasks' },
  { id: 'eventos', label: 'Eventos', icon: 'star' },
  { id: 'ranking', label: 'Ranking', icon: 'trophy' },
  { id: 'combates', label: 'Combates', icon: 'swords' },
  { id: 'combatientes', label: 'Combatientes', icon: 'roster' },
];
const TITLES = {
  comando: ['Centro de Comando', 'Tu operación de un vistazo'],
  personaje: ['Mi Personaje', 'Ficha de combate e identidad'],
  entrenamiento: ['Entrenamiento', 'Asistencia y bitácora diaria'],
  tareas: ['Tareas', 'Plan de entrenamiento dirigido'],
  eventos: ['Eventos', 'Presentaciones y recompensas'],
  ranking: ['Ranking', 'Escalera de la liga orbital'],
  combates: ['Combates', 'Arena, apuestas y desafíos'],
  combatientes: ['Combatientes', 'Directorio y perfiles públicos'],
};

export default function App({ user, onLogout }) {
  const S = useStore();
  const [view, setView] = useState(() => location.hash.slice(1) || 'comando');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const me = NX.byId('you');
  // Usa tier del usuario autenticado si está disponible, si no cae al de seed
  const canTutor = ['caballero', 'maestro', 'granmaestro'].includes(user?.tier ?? me.tier);
  const unread = notifications.filter(n => !n.read).length;

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

  // Carga notificaciones y suscribe al canal privado de Pusher
  useEffect(() => {
    const token = localStorage.getItem('nx-token');
    const headers = { Accept: 'application/json', Authorization: `Bearer ${token}` };
    fetch('/api/notifications', { headers })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.data) setNotifications(data.data); })
      .catch(() => {});
  }, []);

  // Sincroniza tiers reales desde la DB (sobrescribe los tiers calculados del seed)
  useEffect(() => {
    const token = localStorage.getItem('nx-token');
    const headers = { Accept: 'application/json', Authorization: `Bearer ${token}` };
    fetch('/api/combatants', { headers })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.combatants) return;
        const tierMap = Object.fromEntries(data.combatants.map(c => [c.handle, c.tier]));
        S.setCombatants(prev => prev.map(c => tierMap[c.handle] ? { ...c, tier: tierMap[c.handle] } : c));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.id || !window.Echo) return;
    const channel = window.Echo.private(`App.Models.User.${user.id}`);
    channel.notification((notif) => {
      setNotifications(prev => [{ id: notif.id ?? Date.now(), data: notif, read: false, created_at: new Date().toISOString() }, ...prev]);
      toast(notif.title, { tone: notif.tone ?? 'info', icon: notif.icon ?? 'bell', desc: notif.body });
    });
    return () => window.Echo.leave(`private-App.Models.User.${user.id}`);
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

  const VIEWS = {
    comando: <ComandoView S={S} go={go} user={user} />,
    personaje: <PersonajeView S={S} user={user} />,
    entrenamiento: <TrainingView S={S} />,
    tareas: <TareasView S={S} />,
    eventos: <EventosView S={S} go={go} />,
    ranking: <RankingView S={S} />,
    combates: <CombatesView S={S} />,
    combatientes: <CombatientesView S={S} />,
  };
  const [title, sub] = TITLES[view];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', position: 'relative', zIndex: 1 }}>
      <div className="nx-bg-grid" />
      <div className="nx-scanlines" />

      {/* Mobile overlay */}
      <div className={`nx-sidebar-overlay${sidebarOpen ? ' open' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* Sidebar */}
      <aside className={`nx-sidebar${sidebarOpen ? ' open' : ''}`} style={{ width: 210, flexShrink: 0, borderRight: '1px solid var(--holo-line)', background: 'rgba(4,7,15,0.6)', backdropFilter: 'blur(8px)', position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column', zIndex: 5 }}>
        <div style={{ padding: '14px 14px', borderBottom: '1px solid var(--holo-line)', display: 'flex', alignItems: 'center', gap: 9 }}>
          <img src="/assets/isotipo.png" alt="" style={{ width: 28, height: 28, filter: 'drop-shadow(0 0 10px rgba(230,179,37,.4))' }} />
          <div>
            <div className="nx-display" style={{ fontSize: 15, letterSpacing: '0.08em', color: 'var(--txt)' }}>NÉXUS</div>
            <div className="nx-data" style={{ fontSize: 8, color: 'var(--holo)', letterSpacing: '0.22em' }}>HOLOCRON DE COMBATE</div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: 8, display: 'grid', gap: 2, alignContent: 'start' }}>
          {NAV.map((n) => {
            const active = view === n.id;
            return (
              <button key={n.id} onClick={() => go(n.id)} style={{
                display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 'var(--radius-md)',
                border: '1px solid', borderColor: active ? 'var(--holo-line)' : 'transparent', cursor: 'pointer', textAlign: 'left',
                background: active ? 'color-mix(in srgb, var(--holo) 12%, transparent)' : 'transparent',
                color: active ? 'var(--txt)' : 'var(--txt-dim)', fontFamily: 'var(--font-data)', fontSize: 12,
                letterSpacing: '0.04em', transition: 'all .15s', position: 'relative' }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--txt)'; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--txt-dim)'; }}>
                {active && <span style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 2, borderRadius: 2, background: 'var(--holo)', boxShadow: '0 0 8px var(--holo)' }} />}
                <span style={{ color: active ? 'var(--holo)' : 'inherit' }}><Icon name={n.icon} size={15} /></span>
                {n.label}
              </button>
            );
          })}
        </nav>

        {/* Rol — solo visible para caballero, maestro y gran maestro */}
        {canTutor && (
          <div style={{ padding: 8, borderTop: '1px solid var(--holo-line)' }}>
            <div className="nx-kicker" style={{ fontSize: 8, marginBottom: 5, paddingLeft: 2 }}>Modo de vista</div>
            <div style={{ display: 'flex', gap: 3, background: 'rgba(4,7,15,0.6)', padding: 3, borderRadius: 'var(--radius-md)', border: '1px solid var(--holo-line)' }}>
              {['pupilo', 'tutor'].map(r => (
                <button key={r} onClick={() => S.setRole(r)} style={{
                  flex: 1, padding: '5px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-data)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
                  background: S.role === r ? 'var(--pompeyo-naranja)' : 'transparent', color: S.role === r ? '#fff' : 'var(--txt-dim)', fontWeight: 700 }}>
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ padding: 8, borderTop: '1px solid var(--holo-line)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar c={me} size={30} ring />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name ?? S.character.name}</div>
            <div className="nx-data" style={{ fontSize: 9, color: 'var(--holo)' }}>{S.role === 'tutor' ? 'Tutor' : '@' + S.character.handle}</div>
          </div>
          <button
            onClick={onLogout}
            title="Cerrar sesión"
            className="nx-btn nx-btn-ghost"
            style={{ padding: 7, color: 'var(--txt-faint)', flexShrink: 0 }}
            onMouseEnter={e => e.currentTarget.style.color = '#ff6b6b'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--txt-faint)'}>
            <Icon name="logout" size={15} />
          </button>
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
