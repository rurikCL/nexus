import { useState, useEffect } from 'react';
import { NX } from './data/seed.js';
import { Icon, Avatar, Btn, ToastHost, toast } from './components/ui.jsx';
import { useStore } from './store/useStore.js';
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

export default function App() {
  const S = useStore();
  const [view, setView] = useState(() => location.hash.slice(1) || 'comando');
  const me = NX.byId('you');

  const go = (v) => { setView(v); location.hash = v; window.scrollTo({ top: 0 }); };
  useEffect(() => {
    const h = () => setView(location.hash.slice(1) || 'comando');
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);

  const VIEWS = {
    comando: <ComandoView S={S} go={go} />,
    personaje: <PersonajeView S={S} />,
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

      {/* Sidebar */}
      <aside style={{ width: 236, flexShrink: 0, borderRight: '1px solid var(--holo-line)', background: 'rgba(4,7,15,0.6)', backdropFilter: 'blur(8px)', position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column', zIndex: 5 }}>
        <div style={{ padding: '20px 18px', borderBottom: '1px solid var(--holo-line)', display: 'flex', alignItems: 'center', gap: 11 }}>
          <img src="/assets/isotipo-gold.png" alt="" style={{ width: 34, height: 34, filter: 'drop-shadow(0 0 10px rgba(230,179,37,.4))' }} />
          <div>
            <div className="nx-display" style={{ fontSize: 17, letterSpacing: '0.08em', color: 'var(--txt)' }}>NÉXUS</div>
            <div className="nx-data" style={{ fontSize: 9, color: 'var(--holo)', letterSpacing: '0.22em' }}>ACADEMIA ORBITAL</div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: 12, display: 'grid', gap: 3, alignContent: 'start' }}>
          {NAV.map((n) => {
            const active = view === n.id;
            return (
              <button key={n.id} onClick={() => go(n.id)} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 13px', borderRadius: 'var(--radius-md)',
                border: '1px solid', borderColor: active ? 'var(--holo-line)' : 'transparent', cursor: 'pointer', textAlign: 'left',
                background: active ? 'color-mix(in srgb, var(--holo) 12%, transparent)' : 'transparent',
                color: active ? 'var(--txt)' : 'var(--txt-dim)', fontFamily: 'var(--font-data)', fontSize: 13,
                letterSpacing: '0.04em', transition: 'all .15s', position: 'relative' }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--txt)'; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--txt-dim)'; }}>
                {active && <span style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 2, borderRadius: 2, background: 'var(--holo)', boxShadow: '0 0 8px var(--holo)' }} />}
                <span style={{ color: active ? 'var(--holo)' : 'inherit' }}><Icon name={n.icon} size={17} /></span>
                {n.label}
              </button>
            );
          })}
        </nav>

        {/* Rol */}
        <div style={{ padding: 12, borderTop: '1px solid var(--holo-line)' }}>
          <div className="nx-kicker" style={{ fontSize: 9, marginBottom: 7, paddingLeft: 2 }}>Modo de vista</div>
          <div style={{ display: 'flex', gap: 4, background: 'rgba(4,7,15,0.6)', padding: 4, borderRadius: 'var(--radius-md)', border: '1px solid var(--holo-line)' }}>
            {['pupilo', 'tutor'].map(r => (
              <button key={r} onClick={() => S.setRole(r)} style={{
                flex: 1, padding: '7px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-data)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
                background: S.role === r ? 'var(--pompeyo-naranja)' : 'transparent', color: S.role === r ? '#fff' : 'var(--txt-dim)', fontWeight: 700 }}>
                {r}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: 12, borderTop: '1px solid var(--holo-line)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar c={me} size={36} ring />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{S.character.name}</div>
            <div className="nx-data" style={{ fontSize: 10, color: 'var(--holo)' }}>{S.role === 'tutor' ? 'Tutor · Diego F.' : '@' + S.character.handle}</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 4, display: 'flex', alignItems: 'center', gap: 16, padding: '16px 26px', borderBottom: '1px solid var(--holo-line)', background: 'rgba(4,7,15,0.55)', backdropFilter: 'blur(8px)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="nx-display" style={{ fontSize: 19, color: 'var(--txt)' }}>{title}</h1>
            <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)', letterSpacing: '0.04em' }}>{sub}</div>
          </div>
          <div className="nx-panel" style={{ padding: '8px 13px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--pompeyo-oro)' }}><Icon name="coin" size={16} /></span>
            <span className="nx-num" style={{ fontSize: 16, color: 'var(--pompeyo-oro)' }}>{NX.fmtCLP(S.credits)}</span>
          </div>
          <button className="nx-btn nx-btn-ghost" style={{ padding: 9, position: 'relative' }} onClick={() => toast('3 notificaciones nuevas', { tone: 'info', icon: 'bell' })}>
            <Icon name="bell" size={17} />
            <span style={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: '50%', background: 'var(--pompeyo-naranja)', boxShadow: '0 0 6px var(--pompeyo-naranja)' }} />
          </button>
          <Btn kind="accent" icon="plus" onClick={() => go('combates')}>Nuevo combate</Btn>
        </header>

        <main style={{ flex: 1, padding: '24px 26px 60px', maxWidth: 1280, width: '100%', margin: '0 auto' }}>
          {VIEWS[view]}
        </main>
      </div>

      <ToastHost />
    </div>
  );
}
