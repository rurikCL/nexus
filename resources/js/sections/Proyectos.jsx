import { useState, useEffect, useCallback } from 'react';
import { Icon, Panel, Btn, Chip, Modal, toast } from '../components/ui.jsx';
import { Empty, mediaUrl } from './Comando.jsx';

function apiCall(method, path, body) {
  const token = localStorage.getItem('nx-token');
  return fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }).then(r => r.json().then(d => (r.ok ? d : Promise.reject(d))));
}

function apiCallForm(method, path, formData) {
  const token = localStorage.getItem('nx-token');
  return fetch(path, {
    method,
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    body: formData,
  }).then(r => r.json().then(d => (r.ok ? d : Promise.reject(d))));
}

function fmtDate(d) {
  return d ? new Date(d + (d.length <= 10 ? 'T00:00:00' : '')).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
}

const STATUS_META = {
  pendiente: { label: 'Pendiente', tone: 'gold' },
  en_curso: { label: 'En curso', tone: '' },
  completado: { label: 'Completado', tone: 'green' },
  cancelado: { label: 'Cancelado', tone: 'dim' },
  rechazada: { label: 'Rechazada', tone: 'red' },
};

export function ProyectosView({ user }) {
  const [proyectos, setProyectos] = useState([]);
  const [esGestor, setEsGestor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNueva, setShowNueva] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const reload = useCallback(async () => {
    try {
      const d = await apiCall('GET', '/api/proyectos');
      setProyectos(d?.proyectos ?? []);
      setEsGestor(!!d?.es_gestor);
    } catch {
      toast('No se pudieron cargar los proyectos', { tone: 'error', icon: 'x' });
    }
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const selected = proyectos.find(p => p.id === selectedId) ?? null;

  const pendientes = proyectos.filter(p => p.status === 'pendiente');
  const enCurso = proyectos.filter(p => p.status === 'en_curso');
  const cerrados = proyectos.filter(p => ['completado', 'cancelado', 'rechazada'].includes(p.status));

  return (
    <div className="nx-fade" style={{ display: 'grid', gap: 24 }}>
      <Panel
        kicker={esGestor ? 'Sentinelas · vista completa' : 'Mis peticiones'}
        title="Peticiones de Proyecto"
        icon="tasks"
        right={<Btn kind="accent" icon="plus" onClick={() => setShowNueva(true)}>Nueva petición</Btn>}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <span className="nx-data" style={{ color: 'var(--holo)', letterSpacing: '.15em', animation: 'nx-pulse 1.4s infinite' }}>
              CARGANDO PROYECTOS...
            </span>
          </div>
        ) : proyectos.length === 0 ? (
          <Empty label="No hay peticiones todavía" />
        ) : (
          <div style={{ display: 'grid', gap: 20 }}>
            {pendientes.length > 0 && (
              <ProyectoGroup label="Pendientes" items={pendientes} onOpen={setSelectedId} />
            )}
            {enCurso.length > 0 && (
              <ProyectoGroup label="En curso" items={enCurso} onOpen={setSelectedId} />
            )}
            {cerrados.length > 0 && (
              <ProyectoGroup label="Cerradas" items={cerrados} onOpen={setSelectedId} />
            )}
          </div>
        )}
      </Panel>

      {showNueva && (
        <NuevaPeticionModal
          onClose={() => setShowNueva(false)}
          onCreated={() => { setShowNueva(false); reload(); }}
        />
      )}

      {selected && (
        <ProyectoDetailModal
          proyecto={selected}
          esGestor={esGestor}
          myUserId={user?.id}
          onClose={() => setSelectedId(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
}

function ProyectoGroup({ label, items, onOpen }) {
  return (
    <div>
      <div className="nx-kicker" style={{ marginBottom: 10 }}>{label.toUpperCase()} — {items.length}</div>
      <div style={{ display: 'grid', gap: 10 }}>
        {items.map(p => <ProyectoRow key={p.id} proyecto={p} onOpen={() => onOpen(p.id)} />)}
      </div>
    </div>
  );
}

function ProyectoRow({ proyecto, onOpen }) {
  const meta = STATUS_META[proyecto.status] ?? { label: proyecto.status, tone: 'dim' };
  return (
    <button onClick={onOpen} className="nx-panel solid" style={{
      display: 'flex', gap: 14, textAlign: 'left', width: '100%', cursor: 'pointer',
      color: 'inherit', font: 'inherit', padding: '14px 16px', alignItems: 'center',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{proyecto.titulo}</span>
          <Chip tone={meta.tone}>{meta.label}</Chip>
        </div>
        <div style={{ fontSize: 12, color: 'var(--txt-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {proyecto.descripcion}
        </div>
        <div className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)', marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span><Icon name="user" size={10} /> {proyecto.solicitante?.name ?? '—'}</span>
          {proyecto.responsable && <span><Icon name="target" size={10} /> Responsable: {proyecto.responsable.name}</span>}
          {proyecto.eta && <span><Icon name="clock" size={10} /> ETA {fmtDate(proyecto.eta)}</span>}
          {proyecto.mensajes_count > 0 && <span><Icon name="message" size={10} /> {proyecto.mensajes_count}</span>}
        </div>
      </div>
    </button>
  );
}

function NuevaPeticionModal({ onClose, onCreated }) {
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [imagen, setImagen] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    if (!titulo.trim() || !descripcion.trim()) {
      toast('Completa el título y la descripción', { tone: 'error', icon: 'x' });
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('titulo', titulo.trim());
      fd.append('descripcion', descripcion.trim());
      if (imagen) fd.append('imagen', imagen);
      await apiCallForm('POST', '/api/proyectos', fd);
      toast('Petición enviada a los Sentinelas', { tone: 'success', icon: 'check' });
      onCreated();
    } catch (e) {
      toast(e?.message || 'No se pudo enviar la petición', { tone: 'error', icon: 'x' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} kicker="Nueva petición" title="Solicitar proyecto a los Sentinelas" zIndex={1100}>
      <div style={{ display: 'grid', gap: 14 }}>
        <div>
          <label className="nx-label">Título *</label>
          <input className="nx-input" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Nombre del proyecto propuesto" maxLength={255} />
        </div>
        <div>
          <label className="nx-label">Descripción *</label>
          <textarea className="nx-input" style={{ minHeight: 120, resize: 'vertical' }} value={descripcion}
            onChange={e => setDescripcion(e.target.value)} placeholder="Explica en qué consiste el proyecto y por qué debería aprobarse..." />
        </div>
        <div>
          <label className="nx-label">Imagen (opcional)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label className="nx-btn nx-btn-sm" style={{ cursor: 'pointer' }}>
              <Icon name="camera" size={12} /> Adjuntar imagen
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setImagen(e.target.files?.[0] ?? null)} />
            </label>
            {imagen && <span style={{ fontSize: 12, color: 'var(--txt-dim)' }}>{imagen.name}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn kind="accent" icon="check" onClick={handleSubmit} disabled={busy}>
            {busy ? 'Enviando...' : 'Enviar petición'}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

function ProyectoDetailModal({ proyecto, esGestor, myUserId, onClose, onChanged }) {
  const [mensajes, setMensajes] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [imagenMensaje, setImagenMensaje] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showAprobar, setShowAprobar] = useState(false);

  const meta = STATUS_META[proyecto.status] ?? { label: proyecto.status, tone: 'dim' };
  const esResponsable = proyecto.responsable?.id === myUserId;
  const puedeCerrar = esGestor || esResponsable;

  const loadMensajes = useCallback(async () => {
    setLoadingMsgs(true);
    try {
      const d = await apiCall('GET', `/api/proyectos/${proyecto.id}/mensajes`);
      setMensajes(d?.mensajes ?? []);
    } catch { /* silencioso */ }
    setLoadingMsgs(false);
  }, [proyecto.id]);

  useEffect(() => { loadMensajes(); }, [loadMensajes]);

  const enviarMensaje = async () => {
    if (!nuevoMensaje.trim() || busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('mensaje', nuevoMensaje.trim());
      if (imagenMensaje) fd.append('imagen', imagenMensaje);
      await apiCallForm('POST', `/api/proyectos/${proyecto.id}/mensajes`, fd);
      setNuevoMensaje('');
      setImagenMensaje(null);
      loadMensajes();
    } catch (e) {
      toast(e?.message || 'No se pudo enviar el mensaje', { tone: 'error', icon: 'x' });
    } finally {
      setBusy(false);
    }
  };

  const rechazar = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await apiCall('POST', `/api/proyectos/${proyecto.id}/rechazar`);
      toast('Petición rechazada', { tone: 'success', icon: 'check' });
      onChanged();
      onClose();
    } catch (e) {
      toast(e?.message || 'No se pudo rechazar', { tone: 'error', icon: 'x' });
    } finally {
      setBusy(false);
    }
  };

  const cerrarComo = async (accion) => {
    if (busy) return;
    setBusy(true);
    try {
      await apiCall('POST', `/api/proyectos/${proyecto.id}/${accion}`);
      toast(accion === 'completar' ? 'Proyecto marcado como completado' : 'Proyecto cancelado', { tone: 'success', icon: 'check' });
      onChanged();
      onClose();
    } catch (e) {
      toast(e?.message || 'No se pudo actualizar el proyecto', { tone: 'error', icon: 'x' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} kicker="Petición de Proyecto" title={proyecto.titulo} zIndex={1150} width={620}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip tone={meta.tone}>{meta.label}</Chip>
          {proyecto.solicitante && <span className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)' }}>Solicitado por {proyecto.solicitante.name}</span>}
        </div>

        <p style={{ fontSize: 13, color: 'var(--txt-dim)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{proyecto.descripcion}</p>

        {proyecto.imagen_url && (
          <a href={mediaUrl(proyecto.imagen_url)} target="_blank" rel="noreferrer">
            <img src={mediaUrl(proyecto.imagen_url)} alt="" style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8, border: '1px solid var(--holo-line)', display: 'block' }} />
          </a>
        )}

        {(proyecto.responsable || proyecto.eta) && (
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {proyecto.responsable && (
              <div>
                <div className="nx-kicker" style={{ marginBottom: 3 }}>Responsable</div>
                <div style={{ fontSize: 13, color: 'var(--txt)' }}>{proyecto.responsable.name}</div>
              </div>
            )}
            {proyecto.eta && (
              <div>
                <div className="nx-kicker" style={{ marginBottom: 3 }}>ETA</div>
                <div style={{ fontSize: 13, color: 'var(--txt)' }}>{fmtDate(proyecto.eta)}</div>
              </div>
            )}
            {proyecto.aprobado_por && (
              <div>
                <div className="nx-kicker" style={{ marginBottom: 3 }}>Aprobado por</div>
                <div style={{ fontSize: 13, color: 'var(--txt)' }}>{proyecto.aprobado_por.name}</div>
              </div>
            )}
          </div>
        )}

        {esGestor && proyecto.status === 'pendiente' && !showAprobar && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn kind="ghost" onClick={rechazar} disabled={busy}>Rechazar</Btn>
            <Btn kind="accent" icon="check" onClick={() => setShowAprobar(true)} disabled={busy}>Aprobar…</Btn>
          </div>
        )}

        {esGestor && proyecto.status === 'pendiente' && showAprobar && (
          <AprobarForm
            proyecto={proyecto}
            busy={busy}
            setBusy={setBusy}
            onCancel={() => setShowAprobar(false)}
            onAprobado={() => { onChanged(); onClose(); }}
          />
        )}

        {puedeCerrar && proyecto.status === 'en_curso' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn kind="ghost" onClick={() => cerrarComo('cancelar')} disabled={busy}>Cancelar proyecto</Btn>
            <Btn kind="accent" icon="check" onClick={() => cerrarComo('completar')} disabled={busy}>Marcar completado</Btn>
          </div>
        )}

        <div>
          <div className="nx-kicker" style={{ marginBottom: 8 }}>BITÁCORA</div>
          <div style={{ display: 'grid', gap: 8, maxHeight: 260, overflowY: 'auto', marginBottom: 10 }}>
            {loadingMsgs ? (
              <span className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)' }}>Cargando…</span>
            ) : mensajes.length === 0 ? (
              <span className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)' }}>Sin mensajes todavía.</span>
            ) : mensajes.map(m => (
              <div key={m.id} style={{ padding: '8px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt)' }}>{m.user?.name ?? 'Usuario'}</span>
                  <span className="nx-data" style={{ fontSize: 9, color: 'var(--txt-faint)' }}>{m.created_at}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--txt-dim)', whiteSpace: 'pre-wrap' }}>{m.mensaje}</div>
                {m.imagen_url && (
                  <a href={mediaUrl(m.imagen_url)} target="_blank" rel="noreferrer">
                    <img src={mediaUrl(m.imagen_url)} alt="" style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 6, border: '1px solid var(--holo-line)', display: 'block', marginTop: 6 }} />
                  </a>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="nx-input" style={{ flex: 1 }} placeholder="Agregar un mensaje a la bitácora..."
                value={nuevoMensaje} onChange={e => setNuevoMensaje(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') enviarMensaje(); }}
              />
              <Btn kind="accent" icon="check" onClick={enviarMensaje} disabled={busy || !nuevoMensaje.trim()}>Enviar</Btn>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label className="nx-btn nx-btn-sm" style={{ cursor: 'pointer' }}>
                <Icon name="camera" size={12} /> Adjuntar imagen (opcional)
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setImagenMensaje(e.target.files?.[0] ?? null)} />
              </label>
              {imagenMensaje && <span style={{ fontSize: 12, color: 'var(--txt-dim)' }}>{imagenMensaje.name}</span>}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function AprobarForm({ proyecto, busy, setBusy, onCancel, onAprobado }) {
  const [usuarios, setUsuarios] = useState([]);
  const [responsableId, setResponsableId] = useState('');
  const [eta, setEta] = useState('');
  const [loadingUsuarios, setLoadingUsuarios] = useState(true);

  useEffect(() => {
    apiCall('GET', '/api/proyectos/usuarios')
      .then(d => setUsuarios(d?.usuarios ?? []))
      .catch(() => toast('No se pudo cargar la lista de usuarios', { tone: 'error', icon: 'x' }))
      .finally(() => setLoadingUsuarios(false));
  }, []);

  const confirmar = async () => {
    if (!responsableId || !eta) {
      toast('Elige un responsable y una ETA', { tone: 'error', icon: 'x' });
      return;
    }
    setBusy(true);
    try {
      await apiCall('POST', `/api/proyectos/${proyecto.id}/aprobar`, { responsable_id: Number(responsableId), eta });
      toast('Proyecto aprobado — ahora está en curso', { tone: 'success', icon: 'check' });
      onAprobado();
    } catch (e) {
      toast(e?.message || 'No se pudo aprobar', { tone: 'error', icon: 'x' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 12, padding: '12px 14px', borderRadius: 8, background: 'rgba(230,179,37,0.05)', border: '1px solid rgba(230,179,37,0.2)' }}>
      <div>
        <label className="nx-label">Responsable *</label>
        <select className="nx-select" value={responsableId} onChange={e => setResponsableId(e.target.value)} disabled={loadingUsuarios} style={{ width: '100%' }}>
          <option value="">{loadingUsuarios ? 'Cargando usuarios...' : '— Seleccionar responsable —'}</option>
          {usuarios.map(u => (
            <option key={u.id} value={u.id}>{u.name}{u.handle ? ` (${u.handle})` : ''}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="nx-label">ETA (fecha estimada de término) *</label>
        <input className="nx-input" type="date" value={eta} onChange={e => setEta(e.target.value)} style={{ width: '100%' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn onClick={onCancel} disabled={busy}>Cancelar</Btn>
        <Btn kind="accent" icon="check" onClick={confirmar} disabled={busy}>
          {busy ? 'Aprobando...' : 'Confirmar aprobación'}
        </Btn>
      </div>
    </div>
  );
}
