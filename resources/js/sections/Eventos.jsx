import { useState, useEffect, useRef } from 'react';
import { NX } from '../data/seed.js';
import { Icon, Panel, Btn, Chip, Avatar, TierBadge, Stat, MedalIcon, Modal, toast, ImageSlot } from '../components/ui.jsx';
import { Empty } from './Comando.jsx';

/* NÉXUS — Eventos: presentaciones a las que se asiste (todo el año) */

const EVENT_TYPES = {
  'EXHIBICIÓN':   { banner: '#FF6B00', icon: 'zap' },
  'CEREMONIA':    { banner: '#E6B325', icon: 'crown' },
  'DEMOSTRACIÓN': { banner: '#38cdf0', icon: 'eye' },
  'TALLER':       { banner: '#8b5cf6', icon: 'tasks' },
  'GALA':         { banner: '#E6B325', icon: 'star' },
  'CHARLA':       { banner: '#10b981', icon: 'user' },
};
const EVENT_STATUS = {
  'ABIERTO':   { tone: 'green', label: 'Inscripción abierta' },
  'PRÓXIMO':   { tone: 'dim',   label: 'Próximamente' },
  'REALIZADO': { tone: 'dim',   label: 'Finalizado' },
};

export function EventosView({ S }) {
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState('todos');

  const list = S.events.filter(e => {
    if (filter === 'mis') return e.mine;
    if (filter === 'abiertos') return e.status === 'ABIERTO' || e.status === 'PRÓXIMO';
    if (filter === 'realizados') return e.status === 'REALIZADO';
    return true;
  });
  const misCount = S.events.filter(e => e.mine).length;

  return (
    <div className="nx-fade" style={{ display: 'grid', gap: 18 }}>
      {/* Barra de acción */}
      <div className="nx-panel" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--holo)' }}><Icon name="star" size={22} /></span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="nx-display" style={{ fontSize: 15 }}>Agenda de Presentaciones</div>
          <div style={{ fontSize: 12, color: 'var(--txt-dim)' }}>Inscríbete a exhibiciones, ceremonias y demos durante todo el año. Cada evento define su recompensa.</div>
        </div>
        <div className="nx-panel solid" style={{ padding: '8px 13px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--holo)' }}><Icon name="check" size={15} /></span>
          <span className="nx-num" style={{ fontSize: 15, color: 'var(--txt)' }}>{misCount}</span>
          <span className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>inscritos</span>
        </div>
        <Btn kind="accent" icon="plus" onClick={() => setCreating(true)}>Agregar evento</Btn>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[['todos', 'Todos'], ['abiertos', 'Abiertos'], ['mis', 'Mis eventos'], ['realizados', 'Finalizados']].map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} className={`nx-chip ${filter === k ? '' : 'dim'}`}
            style={{ cursor: 'pointer', borderColor: filter === k ? 'var(--holo)' : undefined }}>{label}</button>
        ))}
      </div>

      {/* Grid de eventos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px,1fr))', gap: 16 }}>
        {list.length === 0 && <Empty label="Sin eventos" />}
        {list.map((e) => <EventCard key={e.id} e={e} S={S} />)}
      </div>

      <CreateEventModal open={creating} onClose={() => setCreating(false)} S={S} />
    </div>
  );
}

export function EventCard({ e, S }) {
  const meta = EVENT_TYPES[e.type] || { banner: e.banner || 'var(--holo)', icon: 'star' };
  const banner = e.banner || meta.banner;
  const st = EVENT_STATUS[e.status] || { tone: 'dim', label: e.status };
  const full = e.registered >= e.capacity && !e.mine;
  const pct = Math.min(100, Math.round(e.registered / e.capacity * 100));

  let action;
  if (e.status === 'REALIZADO') {
    if (e.mine && !e.claimed) action = <Btn kind="gold" icon="coin" sm style={{ width: '100%', justifyContent: 'center' }}
      onClick={() => { S.claimEvent(e.id); toast('Recompensa reclamada', { tone: 'success', icon: 'coin', desc: `+${e.reward} créditos por ${e.name}` }); }}>Reclamar +{e.reward}</Btn>;
    else if (e.claimed) action = <Chip tone="green" icon="check" style={{ width: '100%', justifyContent: 'center', padding: '8px' }}>Recompensa reclamada</Chip>;
    else action = <Chip tone="dim" style={{ width: '100%', justifyContent: 'center', padding: '8px' }}>Evento finalizado</Chip>;
  } else if (e.mine) {
    action = <Btn icon="x" sm style={{ width: '100%', justifyContent: 'center' }}
      onClick={() => { S.toggleEventReg(e.id); toast('Inscripción cancelada', { tone: 'warning', icon: 'x', desc: e.name }); }}>Cancelar inscripción</Btn>;
  } else if (full) {
    action = <Btn sm disabled style={{ width: '100%', justifyContent: 'center' }}>Cupo lleno</Btn>;
  } else {
    action = <Btn kind="accent" icon="check" sm style={{ width: '100%', justifyContent: 'center' }}
      onClick={() => { S.toggleEventReg(e.id); toast('Inscripción confirmada', { tone: 'success', icon: 'check', desc: `${e.name} · recompensa al asistir` }); }}>Inscribirme</Btn>;
  }

  return (
    <div className="nx-panel solid" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 4, background: banner }} />
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 11, flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <Chip icon={meta.icon} style={{ color: banner, borderColor: `${banner}66`, background: `color-mix(in srgb, ${banner} 14%, transparent)` }}>{e.type}</Chip>
          {e.mine && e.status !== 'REALIZADO'
            ? <Chip tone="green" icon="check">Inscrito</Chip>
            : <Chip tone={st.tone}>{st.label}</Chip>}
        </div>

        <div>
          <div className="nx-display" style={{ fontSize: 16, lineHeight: 1.25 }}>{e.name}</div>
          <p style={{ fontSize: 12, color: 'var(--txt-dim)', margin: '6px 0 0', minHeight: 32 }}>{e.desc}</p>
        </div>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <span className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)', display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="calendar" size={12} /> {e.date}</span>
          <span className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)', display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="target" size={12} /> {e.location}</span>
        </div>

        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          <Chip tone="gold" icon="coin">+{e.reward} créditos</Chip>
          {e.rewardBadge && <Chip tone="gold" icon="medal">{e.rewardBadge}</Chip>}
        </div>

        <div style={{ marginTop: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Cupos</span>
            <span className="nx-num" style={{ fontSize: 12, color: 'var(--txt-dim)' }}>{e.registered}/{e.capacity}</span>
          </div>
          <div className="nx-bar" style={{ marginBottom: 12 }}><i style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--pompeyo-naranja)' : `linear-gradient(90deg, ${banner}88, ${banner})` }} /></div>
          {action}
        </div>
      </div>
    </div>
  );
}

export function CreateEventModal({ open, onClose, S }) {
  const empty = { name: '', type: 'EXHIBICIÓN', date: '', location: '', capacity: 30, reward: 300, rewardBadge: '', desc: '' };
  const [f, setF] = useState(empty);
  useEffect(() => { if (open) setF(empty); }, [open]);
  if (!open) return null;
  const submit = () => {
    if (!f.name.trim()) { toast('Falta el nombre del evento', { tone: 'error', icon: 'x' }); return; }
    S.addEvent({
      name: f.name, type: f.type, status: 'ABIERTO', date: f.date || 'Por definir',
      location: f.location || 'Por definir', reward: +f.reward || 0, rewardBadge: f.rewardBadge.trim() || null,
      capacity: +f.capacity || 1, banner: (EVENT_TYPES[f.type] || {}).banner, desc: f.desc || 'Presentación abierta a la Orden.',
    });
    onClose();
    toast('Evento creado', { tone: 'success', icon: 'star', desc: `${f.name} · inscripción abierta` });
  };
  return (
    <Modal open={open} onClose={onClose} kicker="Nueva presentación" title="Agregar Evento" width={540}>
      <div style={{ display: 'grid', gap: 14 }}>
        <div>
          <label className="nx-label">Nombre del evento *</label>
          <input className="nx-input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ej: Exhibición de Formas · Invierno" autoFocus />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label className="nx-label">Tipo</label>
            <select className="nx-select" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
              {Object.keys(EVENT_TYPES).map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="nx-label">Fecha</label>
            <input className="nx-input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} placeholder="DD/MM/AAAA" />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label className="nx-label">Lugar</label>
            <input className="nx-input" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="Domo Central" />
          </div>
          <div>
            <label className="nx-label">Cupos</label>
            <input className="nx-input nx-data" type="number" value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label className="nx-label">Recompensa (créditos)</label>
            <input className="nx-input nx-data" type="number" value={f.reward} onChange={(e) => setF({ ...f, reward: e.target.value })} />
          </div>
          <div>
            <label className="nx-label">Insignia / medalla (opcional)</label>
            <input className="nx-input" value={f.rewardBadge} onChange={(e) => setF({ ...f, rewardBadge: e.target.value })} placeholder="Ej: Insignia Exhibición" />
          </div>
        </div>
        <div>
          <label className="nx-label">Descripción</label>
          <textarea className="nx-textarea" value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} placeholder="Qué se presenta, requisitos, a quién está dirigido..." />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn kind="accent" icon="check" onClick={submit}>Crear evento</Btn>
        </div>
      </div>
    </Modal>
  );
}

