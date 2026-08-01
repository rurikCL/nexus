import { useState, useEffect, useCallback } from 'react';
import { NX } from '../data/seed.js';
import { Icon, Panel, Btn, Chip, Modal, toast, NumberInput } from '../components/ui.jsx';
import { Empty, FORMA_LABELS } from './Comando.jsx';

const RECOMPENSA_TIPOS = [
  { value: 'creditos',        label: 'Créditos' },
  { value: 'objeto',          label: 'Objeto' },
  { value: 'habilidad',       label: 'Habilidad' },
  { value: 'punto_habilidad', label: 'Punto Habilidad' },
  { value: 'titulo',          label: 'Título' },
  { value: 'insignia',        label: 'Insignia' },
];
const EMPTY_RECOMPENSA = { nombre: '', tipo: 'creditos', valor: 0, habilidad_id: null, objeto_id: null, medalla_id: null };
const habilidadLabel = (h) => h.forma > 0 ? `[Forma ${h.forma} — ${FORMA_LABELS[h.forma - 1]}] ${h.label}` : h.label;

function recompensaResumen(r) {
  if (r.tipo === 'habilidad') return r.habilidad?.nombre ?? r.nombre;
  if (r.tipo === 'objeto') return r.objeto?.nombre ?? r.nombre;
  if (r.tipo === 'insignia') return r.medalla?.nombre ?? r.nombre;
  if (r.tipo === 'titulo') return r.nombre;
  return `${r.nombre}${r.valor > 0 ? ` (${r.valor})` : ''}`;
}
const RECOMPENSA_ICON = { creditos: 'coin', objeto: 'box', habilidad: 'zap', punto_habilidad: 'zap', titulo: 'crown', insignia: 'medal' };

const EVENT_TYPES = {
  'EXHIBICIÓN':   { banner: '#FF6B00', icon: 'zap' },
  'CEREMONIA':    { banner: '#E6B325', icon: 'crown' },
  'DEMOSTRACIÓN': { banner: '#38cdf0', icon: 'eye' },
  'TALLER':       { banner: '#8b5cf6', icon: 'tasks' },
  'GALA':         { banner: '#E6B325', icon: 'star' },
  'CHARLA':       { banner: '#10b981', icon: 'user' },
};
const EVENT_ADMIN_TIERS = ['maestro', 'granmaestro'];

const EVENT_STATUS = {
  'ABIERTO':   { tone: 'green', label: 'Inscripción abierta' },
  'PRÓXIMO':   { tone: 'dim',   label: 'Próximamente' },
  'REALIZADO': { tone: 'dim',   label: 'Finalizado' },
};

function mapEvent(e) {
  const date = e.event_date
    ? new Date(e.event_date + 'T00:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : 'Por definir';
  return {
    id:          e.id,
    name:        e.name,
    type:        e.type,
    status:      e.status,
    date,
    location:    e.location ?? 'Por definir',
    sedeId:      e.sede_id ?? null,
    sedeNombre:  e.sede_nombre ?? null,
    recompensas: e.recompensas ?? [],
    capacity:    e.capacity ?? 0,
    banner:      e.banner ?? null,
    desc:        e.description ?? '',
    registered:  e.registered_count ?? 0,
    mine:        !!e.mine,
    claimed:     !!e.claimed,
  };
}

function apiCall(method, path, body) {
  const token = localStorage.getItem('nx-token');
  return fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }).then(r => r.json().then(d => (r.ok ? d : Promise.reject(d))));
}

// ---------- main view ----------
export function EventosView({ S, go, user }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null); // null = crear · objeto = editar
  const [detailId, setDetailId] = useState(null);
  const [filter, setFilter] = useState('todos');
  const [sedes, setSedes] = useState([]);
  const [activeSede, setActiveSede] = useState(user?.sede?.id ?? null);
  const [habilidades, setHabilidades] = useState([]);
  const [objetos, setObjetos] = useState([]);
  const [medallas, setMedallas] = useState([]);
  const canManage = EVENT_ADMIN_TIERS.includes(user?.tier);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiCall('GET', '/api/events');
      setEvents((data.events ?? []).map(mapEvent));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    apiCall('GET', '/api/public/sedes').then(d => setSedes(d.sedes ?? [])).catch(() => {});
  }, []);

  /* Catálogos para el editor de recompensas — solo hacen falta si el usuario puede gestionar eventos */
  useEffect(() => {
    if (!canManage) return;
    apiCall('GET', '/api/admin/rol_habilidades/options').then(d => setHabilidades(d.options ?? [])).catch(() => {});
    apiCall('GET', '/api/admin/rol_objetos/options').then(d => setObjetos(d.options ?? [])).catch(() => {});
    apiCall('GET', '/api/admin/medallas/options').then(d => setMedallas(d.options ?? [])).catch(() => {});
  }, [canManage]);

  const toggleReg = async (e) => {
    if (e.mine) {
      try {
        await apiCall('DELETE', `/api/events/${e.id}/register`);
        setEvents(prev => prev.map(x => x.id === e.id ? { ...x, mine: false, registered: x.registered - 1 } : x));
        toast('Inscripción cancelada', { tone: 'warning', icon: 'x', desc: e.name });
      } catch (err) {
        toast(err?.message ?? 'Error al cancelar', { tone: 'error', icon: 'x' });
      }
    } else {
      try {
        await apiCall('POST', `/api/events/${e.id}/register`);
        setEvents(prev => prev.map(x => x.id === e.id ? { ...x, mine: true, registered: x.registered + 1 } : x));
        toast('Inscripción confirmada', { tone: 'success', icon: 'check', desc: `${e.name} · recompensa al cerrarse el evento` });
      } catch (err) {
        toast(err?.message ?? 'Error al inscribir', { tone: 'error', icon: 'x' });
      }
    }
  };

  const openCreate = () => { setEditingEvent(null); setFormOpen(true); };
  const openEdit = async (e) => {
    try {
      const d = await apiCall('GET', `/api/events/${e.id}`);
      setEditingEvent(d.event);
      setFormOpen(true);
    } catch (err) {
      toast(err?.message ?? 'No se pudo cargar el evento', { tone: 'error', icon: 'x' });
    }
  };

  const closeEvent = async (e) => {
    if (!window.confirm(`¿Cerrar "${e.name}"? Se otorgarán las recompensas a todos los inscritos y no podrá editarse más.`)) return;
    try {
      const data = await apiCall('POST', `/api/events/${e.id}/close`);
      toast(data.message ?? 'Evento cerrado', { tone: 'success', icon: 'check' });
      reload();
    } catch (err) {
      toast(err?.message ?? 'Error al cerrar el evento', { tone: 'error', icon: 'x' });
    }
  };

  const list = events
    .filter(e => activeSede == null || e.sedeId == null || e.sedeId === activeSede)
    .filter(e => {
      if (filter === 'mis') return e.mine;
      if (filter === 'abiertos') return e.status === 'ABIERTO' || e.status === 'PRÓXIMO';
      if (filter === 'realizados') return e.status === 'REALIZADO';
      return true;
    });
  const misCount = events.filter(e => e.mine).length;

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <span className="nx-data" style={{ color: 'var(--holo)', letterSpacing: '.15em', animation: 'nx-pulse 1.4s infinite' }}>CARGANDO EVENTOS...</span>
    </div>
  );

  return (
    <div className="nx-fade" style={{ display: 'grid', gap: 18 }}>
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
        {canManage && (
          <Btn kind="accent" icon="plus" onClick={openCreate}>Agregar evento</Btn>
        )}
      </div>

      {sedes.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setActiveSede(null)} className={`nx-chip ${activeSede === null ? '' : 'dim'}`}
            style={{ cursor: 'pointer', borderColor: activeSede === null ? 'var(--holo)' : undefined }}>Todas las sedes</button>
          {sedes.map(s => (
            <button key={s.id} onClick={() => setActiveSede(s.id)} className={`nx-chip ${activeSede === s.id ? '' : 'dim'}`}
              style={{ cursor: 'pointer', borderColor: activeSede === s.id ? 'var(--holo)' : undefined }}>{s.nombre}</button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[['todos','Todos'],['abiertos','Abiertos'],['mis','Mis eventos'],['realizados','Finalizados']].map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} className={`nx-chip ${filter === k ? '' : 'dim'}`}
            style={{ cursor: 'pointer', borderColor: filter === k ? 'var(--holo)' : undefined }}>{label}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px,1fr))', gap: 16 }}>
        {list.length === 0 && <Empty label="Sin eventos" />}
        {list.map(e => (
          <EventCard
            key={e.id}
            e={e}
            canManage={canManage}
            onToggleReg={() => toggleReg(e)}
            onViewDetail={() => setDetailId(e.id)}
            onEdit={() => openEdit(e)}
            onCloseEvent={() => closeEvent(e)}
          />
        ))}
      </div>

      <EventFormModal
        open={formOpen}
        editing={editingEvent}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); reload(); }}
        sedes={sedes}
        habilidades={habilidades}
        objetos={objetos}
        medallas={medallas}
      />

      <EventDetailModal eventId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}

function EventCard({ e, canManage, onToggleReg, onViewDetail, onEdit, onCloseEvent }) {
  const meta = EVENT_TYPES[e.type] ?? { banner: 'var(--holo)', icon: 'star' };
  const banner = e.banner ?? meta.banner;
  const st = EVENT_STATUS[e.status] ?? { tone: 'dim', label: e.status };
  const full = e.capacity > 0 && e.registered >= e.capacity && !e.mine;
  const pct = e.capacity > 0 ? Math.min(100, Math.round(e.registered / e.capacity * 100)) : 0;
  const realizado = e.status === 'REALIZADO';

  let action;
  if (realizado) {
    if (e.mine && e.claimed)
      action = <Chip tone="green" icon="check" style={{ width: '100%', justifyContent: 'center', padding: '8px' }}>Recompensa recibida</Chip>;
    else
      action = <Chip tone="dim" style={{ width: '100%', justifyContent: 'center', padding: '8px' }}>Evento finalizado</Chip>;
  } else if (e.mine) {
    action = <Btn icon="x" sm style={{ width: '100%', justifyContent: 'center' }}
      onClick={onToggleReg}>Cancelar inscripción</Btn>;
  } else if (full) {
    action = <Btn sm disabled style={{ width: '100%', justifyContent: 'center' }}>Cupo lleno</Btn>;
  } else {
    action = <Btn kind="accent" icon="check" sm style={{ width: '100%', justifyContent: 'center' }}
      onClick={onToggleReg}>Inscribirme</Btn>;
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
          <span className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icon name="calendar" size={12} /> {e.date}
          </span>
          <span className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icon name="target" size={12} /> {e.location}
          </span>
          {e.sedeNombre && (
            <span className="nx-data" style={{ fontSize: 11, color: 'var(--holo)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Icon name="shield" size={12} /> Sede {e.sedeNombre}
            </span>
          )}
        </div>

        {e.recompensas.length > 0 && (
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {e.recompensas.map(r => (
              <Chip key={r.id} tone="gold" icon={RECOMPENSA_ICON[r.tipo] ?? 'star'}>{recompensaResumen(r)}</Chip>
            ))}
          </div>
        )}

        <div style={{ marginTop: 'auto' }}>
          {e.capacity > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Cupos</span>
                <span className="nx-num" style={{ fontSize: 12, color: 'var(--txt-dim)' }}>{e.registered}/{e.capacity}</span>
              </div>
              <div className="nx-bar" style={{ marginBottom: 12 }}>
                <i style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--holocron-naranja)' : `linear-gradient(90deg, ${banner}88, ${banner})` }} />
              </div>
            </>
          )}
          {action}
          {canManage && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <Btn sm icon="eye" style={{ flex: 1, justifyContent: 'center' }} onClick={onViewDetail}>Detalle</Btn>
              {!realizado && (
                <>
                  <Btn sm icon="edit" style={{ flex: 1, justifyContent: 'center' }} onClick={onEdit}>Editar</Btn>
                  <Btn sm icon="x" style={{ flex: 1, justifyContent: 'center' }} onClick={onCloseEvent}>Cerrar</Btn>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EventFormModal({ open, onClose, onSaved, sedes, habilidades = [], objetos = [], medallas = [], editing }) {
  const isEdit = !!editing;
  const buildForm = () => editing ? {
    name: editing.name ?? '',
    type: editing.type ?? 'EXHIBICIÓN',
    date: editing.event_date ?? '',
    location: editing.location ?? '',
    sedeId: editing.sede_id ?? '',
    capacity: editing.capacity ?? '',
    desc: editing.description ?? '',
  } : { name: '', type: 'EXHIBICIÓN', date: '', location: '', sedeId: '', capacity: 30, desc: '' };
  const buildRecompensas = () => (editing?.recompensas ?? []).map(r => ({
    id: r.id, nombre: r.nombre, tipo: r.tipo, valor: r.valor ?? 0,
    habilidad_id: r.habilidad_id, objeto_id: r.objeto_id, medalla_id: r.medalla_id,
  }));

  const [f, setF] = useState(buildForm);
  const [recompensas, setRecompensas] = useState([]);
  const [sending, setSending] = useState(false);
  useEffect(() => { if (open) { setF(buildForm()); setRecompensas(buildRecompensas()); } }, [open, editing]);
  if (!open) return null;

  const addRecompensa = () => setRecompensas(prev => [...prev, { ...EMPTY_RECOMPENSA }]);
  const setRecompensa = (i, key, val) => setRecompensas(prev => prev.map((r, x) => x === i ? { ...r, [key]: val } : r));
  const removeRecompensa = (i) => setRecompensas(prev => prev.filter((_, x) => x !== i));

  const submit = async () => {
    if (!f.name.trim()) { toast('Falta el nombre del evento', { tone: 'error', icon: 'x' }); return; }
    setSending(true);
    try {
      const body = {
        name:         f.name,
        type:         f.type,
        event_date:   f.date || null,
        location:     f.location || null,
        sede_id:      f.sedeId || null,
        capacity:     +f.capacity || null,
        description:  f.desc || null,
        banner:       EVENT_TYPES[f.type]?.banner ?? null,
        recompensas:  recompensas.map(r => ({ ...r, nombre: r.nombre || (RECOMPENSA_TIPOS.find(t => t.value === r.tipo)?.label ?? r.tipo) })),
      };
      if (isEdit) {
        await apiCall('PATCH', `/api/events/${editing.id}`, body);
        toast('Evento actualizado', { tone: 'success', icon: 'check', desc: f.name });
      } else {
        await apiCall('POST', '/api/events', body);
        toast('Evento creado', { tone: 'success', icon: 'star', desc: `${f.name} · inscripción abierta` });
      }
      onSaved();
    } catch (e) {
      toast(e?.message ?? 'Error al guardar el evento', { tone: 'error', icon: 'x' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} kicker={isEdit ? 'Editar presentación' : 'Nueva presentación'} title={isEdit ? 'Editar Evento' : 'Agregar Evento'} width={540}>
      <div style={{ display: 'grid', gap: 14 }}>
        <div>
          <label className="nx-label">Nombre del evento *</label>
          <input className="nx-input" value={f.name} onChange={e => setF({ ...f, name: e.target.value })}
            placeholder="Ej: Exhibición de Formas · Invierno" autoFocus />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label className="nx-label">Tipo</label>
            <select className="nx-select" value={f.type} onChange={e => setF({ ...f, type: e.target.value })}>
              {Object.keys(EVENT_TYPES).map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="nx-label">Fecha</label>
            <input className="nx-input" type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label className="nx-label">Lugar</label>
            <input className="nx-input" value={f.location} onChange={e => setF({ ...f, location: e.target.value })} placeholder="Domo Central" />
          </div>
          <div>
            <label className="nx-label">Cupos</label>
            <NumberInput className="nx-input nx-data" value={f.capacity} onChange={e => setF({ ...f, capacity: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="nx-label">Sede</label>
          <select className="nx-select" value={f.sedeId} onChange={e => setF({ ...f, sedeId: e.target.value })}>
            <option value="">Todas las sedes</option>
            {(sedes ?? []).map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label className="nx-label" style={{ margin: 0 }}>Recompensas</label>
            <Btn sm icon="plus" onClick={addRecompensa}>Agregar</Btn>
          </div>
          {recompensas.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--txt-faint)' }}>
              Créditos, título, insignia real, habilidad u objeto — se otorgan a todos los inscritos cuando se cierra el evento.
            </div>
          )}
          <div style={{ display: 'grid', gap: 10 }}>
            {recompensas.map((r, i) => (
              <div key={i} className="nx-panel" style={{ padding: 12, position: 'relative' }}>
                <button onClick={() => removeRecompensa(i)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt-faint)', padding: 4 }}>
                  <Icon name="x" size={12} />
                </button>
                <div style={{ display: 'grid', gridTemplateColumns: (r.tipo === 'habilidad' || r.tipo === 'objeto' || r.tipo === 'insignia') ? '1fr 130px' : '1fr 130px 90px', gap: 10, paddingRight: 28 }}>
                  <div>
                    <label className="nx-label">Nombre</label>
                    <input className="nx-input" value={r.nombre} onChange={e => setRecompensa(i, 'nombre', e.target.value)} placeholder="Ej: Título Exhibición" />
                  </div>
                  <div>
                    <label className="nx-label">Tipo</label>
                    <select className="nx-select" value={r.tipo} onChange={e => setRecompensa(i, 'tipo', e.target.value)}>
                      {RECOMPENSA_TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  {r.tipo !== 'habilidad' && r.tipo !== 'objeto' && r.tipo !== 'insignia' && (
                    <div>
                      <label className="nx-label">Valor</label>
                      <NumberInput className="nx-input" min="0" value={r.valor ?? 0} onChange={e => setRecompensa(i, 'valor', +e.target.value)} />
                    </div>
                  )}
                </div>
                {r.tipo === 'habilidad' && (
                  <div style={{ marginTop: 10 }}>
                    <label className="nx-label">Habilidad a otorgar *</label>
                    <select className="nx-select" value={r.habilidad_id ?? ''} onChange={e => setRecompensa(i, 'habilidad_id', e.target.value ? +e.target.value : null)}>
                      <option value="">— Seleccionar habilidad —</option>
                      {habilidades.map(h => <option key={h.id} value={h.id}>{habilidadLabel(h)}</option>)}
                    </select>
                  </div>
                )}
                {r.tipo === 'objeto' && (
                  <div style={{ marginTop: 10 }}>
                    <label className="nx-label">Objeto a otorgar *</label>
                    <select className="nx-select" value={r.objeto_id ?? ''} onChange={e => setRecompensa(i, 'objeto_id', e.target.value ? +e.target.value : null)}>
                      <option value="">— Seleccionar objeto —</option>
                      {objetos.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                  </div>
                )}
                {r.tipo === 'insignia' && (
                  <div style={{ marginTop: 10 }}>
                    <label className="nx-label">Medalla a otorgar *</label>
                    <select className="nx-select" value={r.medalla_id ?? ''} onChange={e => setRecompensa(i, 'medalla_id', e.target.value ? +e.target.value : null)}>
                      <option value="">— Seleccionar medalla —</option>
                      {medallas.map(m => <option key={m.id} value={m.id}>{m.label} ({m.rareza})</option>)}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="nx-label">Descripción</label>
          <textarea className="nx-textarea" value={f.desc} onChange={e => setF({ ...f, desc: e.target.value })}
            placeholder="Qué se presenta, requisitos, a quién está dirigido..." />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn kind="accent" icon="check" onClick={submit} disabled={sending}>
            {sending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear evento'}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

function EventDetailModal({ eventId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!eventId) { setData(null); return; }
    setLoading(true);
    apiCall('GET', `/api/events/${eventId}`)
      .then(d => setData(d))
      .catch(err => toast(err?.message ?? 'No se pudo cargar el detalle', { tone: 'error', icon: 'x' }))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (!eventId) return null;
  const e = data?.event;
  const st = e ? (EVENT_STATUS[e.status] ?? { tone: 'dim', label: e.status }) : null;

  return (
    <Modal open onClose={onClose} kicker="Detalle del evento" title={e?.name ?? 'Evento'} width={520}>
      {loading || !e ? (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--txt-faint)', fontSize: 12 }}>Cargando...</div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Chip tone={st.tone}>{st.label}</Chip>
            {e.sede_nombre && <Chip tone="dim" icon="shield">Sede {e.sede_nombre}</Chip>}
          </div>

          {e.description && <p style={{ fontSize: 13, color: 'var(--txt)', margin: 0, lineHeight: 1.6 }}>{e.description}</p>}

          {e.recompensas.length > 0 && (
            <div>
              <div className="nx-kicker" style={{ marginBottom: 8 }}>RECOMPENSAS</div>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {e.recompensas.map(r => (
                  <Chip key={r.id} tone="gold" icon={RECOMPENSA_ICON[r.tipo] ?? 'star'}>{recompensaResumen(r)}</Chip>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="nx-kicker" style={{ marginBottom: 8 }}>INSCRITOS · {data.registrations.length}</div>
            {data.registrations.length === 0 ? (
              <Empty label="Sin inscritos aún" />
            ) : (
              <div style={{ display: 'grid', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
                {data.registrations.map(r => (
                  <div key={r.user_id} className="nx-panel" style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 12 }}>{r.name}{r.handle ? ` · @${r.handle}` : ''}</span>
                    {r.claimed
                      ? <Chip tone="green" icon="check">Recompensado</Chip>
                      : <Chip tone="dim">Pendiente</Chip>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Btn onClick={onClose}>Cerrar</Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}
