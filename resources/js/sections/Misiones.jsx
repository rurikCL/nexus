import { useState, useEffect, useCallback } from 'react';
import { Icon, Panel, Btn, Chip, Avatar, TierBadge, Modal, toast } from '../components/ui.jsx';
import { Empty } from './Comando.jsx';

const ADMIN_TIERS = ['caballero', 'maestro', 'granmaestro'];

const STATUS = {
  pendiente:  { label: 'Pendiente',   tone: 'dim' },
  'en-curso': { label: 'En curso',    tone: '' },
  completada: { label: 'Completada',  tone: 'green' },
};

const HASH_COLORS = ['#FF6B00','#38cdf0','#8b5cf6','#10b981','#ec4899','#f97316','#E6B325','#3aa0ff'];
function hashColor(str) {
  let h = 5381;
  for (const c of (str ?? '?')) h = ((h << 5) + h) ^ c.charCodeAt(0);
  return HASH_COLORS[Math.abs(h) % HASH_COLORS.length];
}

function fmtDate(d) {
  return d ? new Date(d + 'T00:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }) : null;
}

function apiCall(method, path, body) {
  const token = localStorage.getItem('nx-token');
  return fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }).then(r => r.json().then(d => (r.ok ? d : Promise.reject(d))));
}

// ─────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────
export function MisionesView({ S, user }) {
  const isAdmin = ADMIN_TIERS.includes(user?.tier ?? '');
  const [misiones, setMisiones] = useState([]);
  const [loading, setLoading]   = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiCall('GET', '/api/misiones');
      setMisiones(data.misiones ?? []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <span className="nx-data" style={{ color: 'var(--holo)', letterSpacing: '.15em', animation: 'nx-pulse 1.4s infinite' }}>
        CARGANDO MISIONES...
      </span>
    </div>
  );

  return isAdmin
    ? <AdminView misiones={misiones} setMisiones={setMisiones} S={S} />
    : <UserView  misiones={misiones} setMisiones={setMisiones} />;
}

// ─────────────────────────────────────────────────────────────
// Admin view (caballero / maestro / granmaestro)
// ─────────────────────────────────────────────────────────────
function AdminView({ misiones, setMisiones, S }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [assignFor,  setAssignFor]  = useState(null);

  // Any user who has a character (excluding self)
  const allUsers = S.combatants.filter(c => c.userId && c.id !== 'you');

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta misión?')) return;
    try {
      await apiCall('DELETE', `/api/misiones/${id}`);
      setMisiones(prev => prev.filter(m => m.id !== id));
      toast('Misión eliminada', { tone: 'success', icon: 'check' });
    } catch {
      toast('Error al eliminar', { tone: 'error', icon: 'x' });
    }
  };

  const handleUnassign = async (misionId, userId) => {
    try {
      await apiCall('DELETE', `/api/misiones/${misionId}/users/${userId}`);
      setMisiones(prev => prev.map(m =>
        m.id === misionId ? { ...m, users: m.users.filter(u => u.id !== userId) } : m
      ));
    } catch {
      toast('Error al desasignar', { tone: 'error', icon: 'x' });
    }
  };

  return (
    <div className="nx-fade" style={{ display: 'grid', gap: 18 }}>
      <Panel kicker="Administración" title="Misiones" icon="target"
        right={
          <Btn sm icon="plus" kind="accent" onClick={() => setCreateOpen(true)}>
            Nueva misión
          </Btn>
        }>
        {misiones.length === 0 && <Empty label="Sin misiones — crea la primera con el botón" />}
        <div style={{ display: 'grid', gap: 14 }}>
          {misiones.map(m => (
            <MisionCard key={m.id} mision={m}
              onEdit={() => setEditTarget(m)}
              onDelete={() => handleDelete(m.id)}
              onAssign={() => setAssignFor(m.id)}
              onUnassign={uid => handleUnassign(m.id, uid)}
            />
          ))}
        </div>
      </Panel>

      <MisionFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={m => { setMisiones(prev => [m, ...prev]); setCreateOpen(false); }}
      />

      <MisionFormModal
        mision={editTarget}
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={m => { setMisiones(prev => prev.map(x => x.id === m.id ? m : x)); setEditTarget(null); }}
      />

      <AssignModal
        misionId={assignFor}
        mision={misiones.find(m => m.id === assignFor)}
        allUsers={allUsers}
        onClose={() => setAssignFor(null)}
        onAssigned={m => { setMisiones(prev => prev.map(x => x.id === m.id ? m : x)); setAssignFor(null); }}
      />
    </div>
  );
}

function MisionCard({ mision, onEdit, onDelete, onAssign, onUnassign }) {
  const [open, setOpen] = useState(false);
  const assigned = mision.users ?? [];
  const avgPct   = assigned.length
    ? Math.round(assigned.reduce((s, u) => s + u.progreso, 0) / assigned.length)
    : null;

  return (
    <div className="nx-panel solid" style={{ overflow: 'hidden' }}>
      {/* Cover photo */}
      {mision.foto_mision && (
        <div style={{
          height: 110, background: `url(${mision.foto_mision}) center/cover no-repeat`,
          opacity: 0.72, borderBottom: '1px solid var(--holo-line)',
        }} />
      )}

      <div style={{ padding: 15 }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{mision.nombre}</div>
            <div style={{ fontSize: 13, color: 'var(--txt-dim)', marginTop: 3 }}>{mision.mision}</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <Btn sm icon="edit" onClick={onEdit} />
            <Btn sm icon="x"    onClick={onDelete} />
          </div>
        </div>

        {/* Meta chips */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {mision.fecha_inicio && (
            <span className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)' }}>
              <Icon name="calendar" size={10} />{' '}
              {fmtDate(mision.fecha_inicio)}{mision.fecha_termino ? ` → ${fmtDate(mision.fecha_termino)}` : ''}
            </span>
          )}
          {avgPct !== null && (
            <Chip tone={avgPct >= 100 ? 'green' : ''}>{avgPct}% avance global</Chip>
          )}
        </div>

        {/* Assigned users */}
        {assigned.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <button
              className="nx-data"
              style={{ fontSize: 11, color: 'var(--holo)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, letterSpacing: '.08em' }}
              onClick={() => setOpen(o => !o)}
            >
              <Icon name={open ? 'chevdown' : 'chevron'} size={11} />{' '}
              {assigned.length} asignado{assigned.length !== 1 ? 's' : ''}
            </button>

            {open && (
              <div style={{ display: 'grid', gap: 7, marginTop: 9 }}>
                {assigned.map(u => {
                  const st  = STATUS[u.status] ?? STATUS.pendiente;
                  const av  = { initials: (u.name ?? '?').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase(), color: hashColor(u.handle ?? String(u.id)), name: u.name, tier: u.tier };
                  return (
                    <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <Avatar c={av} size={26} />
                      <span style={{ fontSize: 12, color: 'var(--txt-dim)', width: 130, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</span>
                      <div className="nx-bar" style={{ flex: 1 }}>
                        <i style={{ width: `${u.progreso}%`, background: u.progreso >= 100 ? 'var(--green-500)' : 'var(--holo)' }} />
                      </div>
                      <Chip tone={st.tone} style={{ width: 84, justifyContent: 'center', fontSize: 10 }}>{st.label}</Chip>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt-faint)', padding: 2 }}
                        title="Desasignar" onClick={() => onUnassign(u.id)}>
                        <Icon name="x" size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <Btn sm icon="plus" onClick={onAssign}>Asignar usuario</Btn>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// User view (padawan / iniciado)
// ─────────────────────────────────────────────────────────────
function UserView({ misiones, setMisiones }) {
  const active = misiones.filter(m => m.status !== 'completada');
  const done   = misiones.filter(m => m.status === 'completada');

  const handleProgress = async (id, progreso) => {
    const status = progreso >= 100 ? 'completada' : progreso > 0 ? 'en-curso' : 'pendiente';
    try {
      await apiCall('PATCH', `/api/misiones/${id}/progress`, { progreso, status });
      setMisiones(prev => prev.map(m => m.id === id ? { ...m, progreso, status } : m));
    } catch {
      toast('Error al actualizar progreso', { tone: 'error', icon: 'x' });
    }
  };

  return (
    <div className="nx-fade" style={{ display: 'grid', gap: 18 }}>
      <Panel kicker="Misiones activas" title="Mis Misiones" icon="target">
        {active.length === 0 && <Empty label="Sin misiones asignadas" />}
        <div style={{ display: 'grid', gap: 12 }}>
          {active.map(m => (
            <UserMisionCard key={m.id} mision={m} onProgress={v => handleProgress(m.id, v)} />
          ))}
        </div>
      </Panel>

      {done.length > 0 && (
        <Panel kicker="Historial" title="Misiones Completadas" icon="check">
          <div style={{ display: 'grid', gap: 12 }}>
            {done.map(m => <UserMisionCard key={m.id} mision={m} />)}
          </div>
        </Panel>
      )}
    </div>
  );
}

function UserMisionCard({ mision, onProgress }) {
  const st = STATUS[mision.status] ?? STATUS.pendiente;

  return (
    <div className="nx-panel solid" style={{ padding: 15 }}>
      {mision.foto_mision && (
        <div style={{ height: 80, borderRadius: 6, marginBottom: 12, background: `url(${mision.foto_mision}) center/cover no-repeat`, opacity: 0.65 }} />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{mision.nombre}</span>
            <Chip tone={st.tone}>{st.label}</Chip>
          </div>
          <div style={{ fontSize: 13, color: 'var(--txt-dim)', marginTop: 4 }}>{mision.mision}</div>
          {mision.descripcion && (
            <div style={{ fontSize: 12, color: 'var(--txt-faint)', marginTop: 4 }}>{mision.descripcion}</div>
          )}
        </div>
        {mision.fecha_termino && (
          <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)', flexShrink: 0 }}>
            <Icon name="clock" size={10} /> {fmtDate(mision.fecha_termino)}
          </div>
        )}
      </div>

      {mision.status === 'completada' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, color: 'var(--green-500)' }}>
          <Icon name="check" size={15} />
          <span className="nx-data" style={{ fontSize: 12 }}>Misión completada</span>
        </div>
      ) : onProgress ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
          <input type="range" min="0" max="100" step="5" value={mision.progreso}
            onChange={e => onProgress(+e.target.value)}
            style={{ flex: 1, accentColor: 'var(--holo)' }} />
          <span className="nx-num" style={{ fontSize: 15, width: 44, textAlign: 'right', color: 'var(--holo)' }}>
            {mision.progreso}%
          </span>
        </div>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Shared form modal (create + edit)
// ─────────────────────────────────────────────────────────────
const EMPTY = { nombre: '', mision: '', descripcion: '', foto_mision: '', fecha_inicio: '', fecha_termino: '' };

function MisionFormModal({ open, mision, onClose, onSaved }) {
  const isEdit = !!mision;
  const [f, setF]         = useState(EMPTY);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setF(mision ? {
        nombre:        mision.nombre        ?? '',
        mision:        mision.mision        ?? '',
        descripcion:   mision.descripcion   ?? '',
        foto_mision:   mision.foto_mision   ?? '',
        fecha_inicio:  mision.fecha_inicio  ?? '',
        fecha_termino: mision.fecha_termino ?? '',
      } : EMPTY);
    }
  }, [open, mision?.id]);

  const submit = async () => {
    if (!f.nombre.trim() || !f.mision.trim()) {
      toast('Nombre y misión son obligatorios', { tone: 'error', icon: 'x' });
      return;
    }
    setSending(true);
    const payload = {
      nombre: f.nombre, mision: f.mision,
      descripcion:   f.descripcion   || null,
      foto_mision:   f.foto_mision   || null,
      fecha_inicio:  f.fecha_inicio  || null,
      fecha_termino: f.fecha_termino || null,
    };
    try {
      const data = isEdit
        ? await apiCall('PATCH', `/api/misiones/${mision.id}`, payload)
        : await apiCall('POST',  '/api/misiones',               payload);
      onSaved(data.mision);
      toast(isEdit ? 'Misión actualizada' : 'Misión creada', { tone: 'success', icon: 'check' });
    } catch (e) {
      toast(e?.message ?? 'Error', { tone: 'error', icon: 'x' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}
      kicker={isEdit ? 'Editar misión' : 'Nueva entrada'}
      title={isEdit ? f.nombre || 'Editar misión' : 'Crear Misión'}>
      <div style={{ display: 'grid', gap: 14, marginBottom: 16 }}>
        <div>
          <label className="nx-label">Nombre *</label>
          <input className="nx-input" autoFocus value={f.nombre}
            onChange={e => setF({ ...f, nombre: e.target.value })}
            placeholder="Ej: Dominio del Soresu" />
        </div>
        <div>
          <label className="nx-label">
            Misión *{' '}
            <span style={{ color: 'var(--txt-faint)', fontWeight: 400 }}>(objetivo breve)</span>
          </label>
          <input className="nx-input" value={f.mision}
            onChange={e => setF({ ...f, mision: e.target.value })}
            placeholder="Ej: Completar 10 sesiones de defensa forma III" />
        </div>
        <div>
          <label className="nx-label">Descripción</label>
          <textarea className="nx-textarea" value={f.descripcion}
            onChange={e => setF({ ...f, descripcion: e.target.value })}
            placeholder="Instrucciones detalladas, contexto de la misión..." />
        </div>
        <div>
          <label className="nx-label">URL de imagen de portada</label>
          <input className="nx-input" value={f.foto_mision}
            onChange={e => setF({ ...f, foto_mision: e.target.value })}
            placeholder="https://..." />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label className="nx-label">Fecha de inicio</label>
            <input className="nx-input" type="date" value={f.fecha_inicio}
              onChange={e => setF({ ...f, fecha_inicio: e.target.value })} />
          </div>
          <div>
            <label className="nx-label">Fecha de término</label>
            <input className="nx-input" type="date" value={f.fecha_termino}
              onChange={e => setF({ ...f, fecha_termino: e.target.value })} />
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn onClick={onClose}>Cancelar</Btn>
        <Btn kind="accent" icon="check" onClick={submit} disabled={sending}>
          {sending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear misión'}
        </Btn>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// Assign user modal
// ─────────────────────────────────────────────────────────────
function AssignModal({ misionId, mision, allUsers, onClose, onAssigned }) {
  const [selected, setSelected] = useState(null);
  const [sending,  setSending]  = useState(false);

  const available = misionId && mision
    ? allUsers.filter(c => !(mision.users ?? []).some(u => u.id === c.userId))
    : [];

  useEffect(() => {
    if (misionId) setSelected(available[0] ?? null);
  }, [misionId]);

  if (!misionId || !mision) return null;

  const submit = async () => {
    if (!selected?.userId) { toast('Selecciona un usuario', { tone: 'error', icon: 'x' }); return; }
    setSending(true);
    try {
      const data = await apiCall('POST', `/api/misiones/${misionId}/assign`, { user_id: selected.userId });
      onAssigned(data.mision);
      toast(`${selected.name} asignado a la misión`, { tone: 'success', icon: 'check' });
    } catch (e) {
      toast(e?.message ?? 'Error al asignar', { tone: 'error', icon: 'x' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal open={!!misionId} onClose={onClose} kicker={mision.nombre} title="Asignar Usuario">
      <div style={{ display: 'grid', gap: 14 }}>
        {available.length === 0 ? (
          <>
            <p style={{ color: 'var(--txt-dim)', fontSize: 13, margin: 0 }}>
              Todos los usuarios disponibles ya están asignados a esta misión.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Btn onClick={onClose}>Cerrar</Btn>
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="nx-label">Usuario</label>
              <select className="nx-select" value={selected?.userId ?? ''}
                onChange={e => setSelected(available.find(c => c.userId === +e.target.value))}>
                {available.map(c => (
                  <option key={c.userId} value={c.userId}>{c.name} · @{c.handle}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Btn onClick={onClose}>Cancelar</Btn>
              <Btn kind="accent" icon="check" onClick={submit} disabled={sending || !selected}>
                {sending ? 'Asignando...' : 'Asignar'}
              </Btn>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
