import { useState, useEffect, useCallback } from 'react';
import { Icon, Panel, Btn, Chip, Avatar, Modal, toast } from '../components/ui.jsx';
import { Empty } from './Comando.jsx';
import { buildMissionCompletionTransmision } from '../utils/missionTransmission.js';

const ADMIN_TIERS = ['caballero', 'maestro', 'granmaestro'];

const mediaUrl = (path) => {
  if (!path) return null;
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:') || path.startsWith('blob:')) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (cleanPath.startsWith('/storage/')) return cleanPath;
  if (cleanPath.startsWith('/admin/')) return `/storage${cleanPath}`;
  if (cleanPath.startsWith('/public/')) return cleanPath.replace('/public/', '/storage/');
  return `/storage${cleanPath}`;
};

const TIPO_LABELS = {
  temporada:   { label: 'Temporada',  color: '#E6B325' },
  comunidad:   { label: 'Comunidad',  color: '#E6B325' },
  individual:  { label: 'Individual', color: '#38cdf0' },
};

const TIPO_OBJ = {
  general:       'General',
  entrenamiento: 'Entrenamiento',
  combate:       'Combate',
  tarea:         'Tarea',
  viaje:         'Viaje',
  dialogo:       'Diálogo',
  menu:          'Menú',
  hito:          'Hito',
  automatico:    'Automático',
};

function apiCall(method, path, body) {
  const token = localStorage.getItem('nx-token');
  return fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }).then(r => r.json().then(d => (r.ok ? d : Promise.reject(d))));
}

function fmtDate(d) {
  return d ? new Date(d + 'T00:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }) : null;
}

function pct(v, max) {
  return max > 0 ? Math.round(Math.min(100, (v / max) * 100)) : 0;
}

const HASH_COLORS = ['#FF6B00','#38cdf0','#8b5cf6','#10b981','#ec4899','#E6B325','#3aa0ff'];
function hashColor(str) {
  let h = 5381;
  for (const c of (str ?? '?')) h = ((h << 5) + h) ^ c.charCodeAt(0);
  return HASH_COLORS[Math.abs(h) % HASH_COLORS.length];
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

// ─────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────
export function MisionesView({ S, user, onUserUpdate, onTransmision }) {
  const [misiones, setMisiones] = useState({ comunidad: [], individual: [], global: [] });
  const [loading, setLoading]   = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [comunidad, individual, global] = await Promise.allSettled([
        apiCall('GET', '/api/misiones/comunidad'),
        apiCall('GET', '/api/misiones/individual'),
        apiCall('GET', '/api/misiones/global'),
      ]);
      setMisiones({
        comunidad:  comunidad.status === 'fulfilled' ? (comunidad.value?.misiones ?? []) : [],
        individual: individual.status === 'fulfilled' ? (individual.value?.misiones ?? []) : [],
        global:     global.status === 'fulfilled' ? (global.value?.misiones ?? []) : [],
      });
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    const handler = () => reload();
    window.addEventListener('nx-mision-updated', handler);
    return () => window.removeEventListener('nx-mision-updated', handler);
  }, [reload]);

  const updateGlobalMision = useCallback((id, patch) => {
    setMisiones(prev => ({
      ...prev,
      global: prev.global.map(m => m.id === id ? { ...m, ...patch } : m),
    }));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <span className="nx-data" style={{ color: 'var(--holo)', letterSpacing: '.15em', animation: 'nx-pulse 1.4s infinite' }}>
        CARGANDO MISIONES...
      </span>
    </div>
  );

  return (
    <div className="nx-fade" style={{ display: 'grid', gap: 24 }}>
      <GlobalSection misiones={misiones.global} onUpdate={updateGlobalMision} onUserUpdate={onUserUpdate} onTransmision={onTransmision} />
      <ComunidadSection misiones={misiones.comunidad} onReload={reload} user={user} />
      <IndividualSection misiones={misiones.individual} onReload={reload} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MISIONES GLOBALES (disponibles para todos, requieren aceptación)
// ─────────────────────────────────────────────────────────────
function GlobalSection({ misiones, onUpdate, onUserUpdate, onTransmision }) {
  const isMobile = useIsMobile();
  const [selectedId, setSelectedId] = useState(null);
  const activas     = misiones.filter(m => m.status !== 'completada');
  const completadas = misiones.filter(m => m.status === 'completada');
  const gridCols = isMobile ? '1fr' : 'repeat(2, 1fr)';
  const selected = misiones.find(m => m.id === selectedId) ?? null;

  return (
    <Panel kicker="Global" title="Misiones Globales" icon="target">
      {misiones.length === 0 && <Empty label="No hay misiones globales activas" />}
      {activas.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: gridCols, gap: 14,
          marginBottom: completadas.length ? 18 : 0,
        }}>
          {activas.map(m => (
            <GlobalCard key={m.id} mision={m} onOpen={() => setSelectedId(m.id)} />
          ))}
        </div>
      )}
      {completadas.length > 0 && (
        <>
          <div className="nx-kicker" style={{ marginBottom: 10, marginTop: activas.length ? 8 : 0 }}>
            COMPLETADAS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 14 }}>
            {completadas.map(m => (
              <GlobalCard key={m.id} mision={m} completed onOpen={() => setSelectedId(m.id)} />
            ))}
          </div>
        </>
      )}

      {selected && (
        <GlobalMisionPopup
          mision={selected}
          onClose={() => setSelectedId(null)}
          onUpdate={onUpdate}
          onUserUpdate={onUserUpdate}
          onTransmision={onTransmision}
        />
      )}
    </Panel>
  );
}

function GlobalCard({ mision, completed, onOpen }) {
  const isMobile = useIsMobile();

  return (
    <button onClick={onOpen} className="nx-panel solid" style={{
      display: 'flex', gap: 12, textAlign: 'left', width: '100%', cursor: 'pointer',
      color: 'inherit', font: 'inherit', padding: '14px 16px',
      opacity: completed ? 0.7 : 1,
      filter: completed ? 'grayscale(1)' : 'none',
      border: completed ? '1px solid rgba(120,120,120,0.35)' : '1px solid rgba(139,92,246,0.35)',
    }}>
      {mision.foto_mision && (
        <img src={mediaUrl(mision.foto_mision)} alt={mision.nombre} style={{
          width: isMobile ? 56 : 84, height: isMobile ? 56 : 84, objectFit: 'cover', borderRadius: 10,
          border: '1px solid rgba(139,92,246,0.35)', flexShrink: 0,
        }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{mision.nombre}</span>
          {completed && <Chip tone="green">✓ Completada</Chip>}
          {!completed && mision.aceptada && mision.status === 'en-curso' && <Chip>En curso</Chip>}
          {!completed && mision.aceptada && mision.status !== 'en-curso' && <Chip tone="dim">Aceptada</Chip>}
          {!completed && !mision.aceptada && <Chip tone="gold">Disponible</Chip>}
        </div>
        <div style={{ fontSize: 13, color: 'var(--txt-dim)' }}>{mision.mision}</div>
      </div>
      {mision.fecha_termino && (
        <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)', flexShrink: 0 }}>
          <Icon name="clock" size={10} /> {fmtDate(mision.fecha_termino)}
        </div>
      )}
    </button>
  );
}

export function GlobalMisionPopup({ mision, onClose, onUpdate, onUserUpdate, onTransmision }) {
  const [busy, setBusy] = useState(false);
  const done = mision.status === 'completada';
  const hitosReq = mision.hito_requerimiento
    ? mision.hito_requerimiento.split(',').map(h => h.trim()).filter(Boolean)
    : [];

  const handleAceptar = async () => {
    setBusy(true);
    try {
      const d = await apiCall('POST', `/api/misiones/${mision.id}/accept`);
      toast('Misión aceptada', { tone: 'success', icon: 'check' });
      onUpdate(mision.id, {
        ...(d?.mision ?? {}),
        aceptada: true,
      });
      window.dispatchEvent(new CustomEvent('nx-mision-updated', {
        detail: { missionId: mision.id, status: 'aceptada' },
      }));
      onClose();
    } catch (e) {
      toast(e?.message || 'No se pudo aceptar la misión', { tone: 'error', icon: 'x' });
    } finally {
      setBusy(false);
    }
  };

  const handleCompletar = async () => {
    setBusy(true);
    try {
      const token = localStorage.getItem('nx-token');
      const res = await fetch(`/api/misiones/${mision.id}/completar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || 'No se pudo completar la misión');

      toast('¡Misión completada!', { tone: 'success', icon: 'check' });
      (data?.hitos_otorgados ?? []).forEach((hito) => {
        toast(`🏆 Hito obtenido: "${hito}"`, { tone: 'success', icon: 'star' });
      });
      onUpdate(mision.id, { status: 'completada', progreso: 100, puede_completar: false });
      const transmision = buildMissionCompletionTransmision(data);
      if (transmision) {
        onTransmision?.(transmision);
      }

      if (onUserUpdate) {
        fetch('/api/me', { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } })
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d) onUserUpdate(d); })
          .catch(() => {});
      }
      onClose();
      window.dispatchEvent(new CustomEvent('nx-mision-updated', {
        detail: { missionId: mision.id, status: 'completada' },
      }));
    } catch (e) {
      toast(e.message || 'Error al completar la misión', { tone: 'error', icon: 'x' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal open onClose={onClose} kicker={done ? 'Misión completada' : 'Misión Global'} title={mision.nombre} zIndex={1100}>
        <div style={{ display: 'grid', gap: 16 }}>
        {mision.foto_mision && (
          <div style={{ height: 140, borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <img src={mediaUrl(mision.foto_mision)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}

        {mision.mision && (
          <p style={{ fontSize: 13, color: 'var(--txt)', fontWeight: 600, margin: 0 }}>{mision.mision}</p>
        )}
        {mision.descripcion && (
          <p style={{ fontSize: 12.5, color: 'var(--txt-dim)', lineHeight: 1.6, margin: 0 }}>{mision.descripcion}</p>
        )}

        {!mision.aceptada && !done && (
          <div style={{ fontSize: 12, color: 'var(--txt-faint)' }}>
            Acepta esta misión para empezar a registrar tu progreso.
          </div>
        )}

        {(mision.objetivos ?? []).length > 0 && (
          <div>
            <div className="nx-kicker" style={{ marginBottom: 8 }}>OBJETIVOS</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {mision.objetivos.map(o => {
                const actual = o.progreso_actual ?? 0;
                const p = o.meta > 0 ? Math.min(100, Math.round((actual / o.meta) * 100)) : 100;
                return (
                  <div key={o.id} style={{
                    padding: '8px 10px', borderRadius: 7,
                    background: o.completado ? 'rgba(16,185,129,0.06)' : 'rgba(139,92,246,0.05)',
                    border: `1px solid ${o.completado ? 'rgba(16,185,129,0.25)' : 'rgba(139,92,246,0.25)'}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icon name={o.completado ? 'check' : 'target'} size={13} style={{ color: o.completado ? '#10b981' : '#8b5cf6', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--txt)', fontWeight: 600 }}>{o.nombre}</div>
                      <span className="nx-data" style={{ fontSize: 10, color: o.completado ? '#10b981' : 'var(--txt-faint)' }}>
                        {actual}/{o.meta}{o.unidad ? ` ${o.unidad}` : ''}
                      </span>
                    </div>
                    {o.descripcion && <div style={{ fontSize: 11, color: 'var(--txt-faint)', marginTop: 3, marginLeft: 21 }}>{o.descripcion}</div>}
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, marginTop: 6 }}>
                      <div style={{
                        height: '100%', width: `${p}%`, borderRadius: 2, transition: 'width 0.4s ease',
                        background: o.completado ? '#10b981' : '#8b5cf6',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!mision.aceptada && !done && (mision.objetivos ?? []).length > 0 && (
          <div style={{ fontSize: 11.5, color: 'var(--txt-faint)', lineHeight: 1.5 }}>
            Puedes revisar los objetivos antes de aceptarla. Los objetivos de tipo menú se marcan al visitar su vista; el resto empieza a contar cuando la misión esté aceptada.
          </div>
        )}

        {hitosReq.length > 0 && (
          <div>
            <div className="nx-kicker" style={{ marginBottom: 8 }}>HITOS REQUERIDOS</div>
            <div style={{ fontSize: 11, color: mision.cumple_hitos ? '#10b981' : 'var(--txt-faint)' }}>
              {hitosReq.join(', ')}
            </div>
          </div>
        )}

        {(mision.recompensas ?? []).length > 0 && (
          <div>
            <div className="nx-kicker" style={{ marginBottom: 8 }}>RECOMPENSAS</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {mision.recompensas.map((r, i) => (
                <span key={r.id ?? i} style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 4,
                  background: 'rgba(230,179,37,0.1)', border: '1px solid rgba(230,179,37,0.25)', color: '#E6B325',
                }}>
                  {r.tipo === 'creditos' ? '💰' : r.tipo === 'titulo' ? '🏷️' : r.tipo === 'insignia' ? '🏅' : r.tipo === 'hito' ? '⭐' : r.tipo === 'habilidad' ? '⚡' : '📦'}{' '}
                  {r.tipo === 'habilidad' && r.habilidad ? r.habilidad.nombre : r.tipo === 'hito' ? (r.hito || r.nombre) : r.nombre}
                  {r.tipo !== 'habilidad' && r.valor > 0 ? ` ×${r.valor}` : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        {done ? (
          <div style={{ fontSize: 12, color: '#10b981', textAlign: 'right' }}>Ya completaste esta misión.</div>
        ) : !mision.aceptada ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
            <Btn kind="accent" icon="check" onClick={handleAceptar} disabled={busy}>
              {busy ? 'Aceptando...' : 'Aceptar misión'}
            </Btn>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, paddingTop: 4 }}>
            {!mision.puede_completar && (
              <div style={{ fontSize: 11, color: 'var(--txt-faint)' }}>
                {!mision.cumple_hitos ? 'Aún no cumples los hitos requeridos.' : 'Aún no completas todos los objetivos.'}
              </div>
            )}
            <Btn kind="accent" icon="check" onClick={handleCompletar} disabled={busy || !mision.puede_completar}>
              {busy ? 'Completando...' : 'Completar misión'}
            </Btn>
          </div>
        )}
        </div>
      </Modal>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// MISIONES DE COMUNIDAD
// ─────────────────────────────────────────────────────────────
function ComunidadSection({ misiones, onReload, user }) {
  const [selectedId, setSelectedId] = useState(null);
  const selected = misiones.find(m => m.id === selectedId) ?? null;

  return (
    <Panel kicker="Global" title="Misiones de Comunidad" icon="roster">
      {misiones.length === 0 && <Empty label="No hay misiones de comunidad activas" />}
      <div style={{ display: 'grid', gap: 14 }}>
        {misiones.map(m => (
          <ComunidadCard key={m.id} mision={m} userId={user?.id} onOpen={() => setSelectedId(m.id)} />
        ))}
      </div>

      {selected && (
        <ComunidadMisionPopup mision={selected} userId={user?.id} onClose={() => setSelectedId(null)} />
      )}
    </Panel>
  );
}

function ComunidadCard({ mision, userId, onOpen }) {
  const isMobile = useIsMobile();
  const totalPuntos = mision.total_progreso ?? 0;
  const requeridos  = mision.puntos_requeridos ?? 100;
  const progresoPct = pct(totalPuntos, requeridos);
  const completada  = progresoPct >= 100;
  const yoParticipo = mision.participantes?.some(p => p.id === userId);

  return (
    <button onClick={onOpen} className="nx-panel solid" style={{
      display: 'flex', gap: 14, textAlign: 'left', width: '100%', cursor: 'pointer',
      color: 'inherit', font: 'inherit', padding: '14px 16px',
      opacity: completada ? 0.75 : 1,
      filter: completada ? 'grayscale(1)' : 'none',
      border: completada ? '1px solid rgba(120,120,120,0.4)' : '1px solid rgba(230,179,37,0.3)',
    }}>
      {mision.foto_mision && (
        <img src={mediaUrl(mision.foto_mision)} alt={mision.nombre} style={{
          width: isMobile ? 56 : 84, height: isMobile ? 56 : 84, objectFit: 'cover', borderRadius: 10,
          border: '1px solid rgba(230,179,37,0.35)', flexShrink: 0,
        }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{mision.nombre}</span>
          <Chip tone={completada ? 'green' : ''}>{completada ? '✓ Completada' : 'En curso'}</Chip>
          {mision.activa === false && <Chip tone="dim">Inactiva</Chip>}
          {yoParticipo && <Chip tone="dim">Participando</Chip>}
        </div>
        <div style={{ fontSize: 13, color: 'var(--txt-dim)', marginBottom: 8 }}>{mision.mision}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)' }}>PROGRESO COMUNIDAD</span>
          <span className="nx-num" style={{ fontSize: 11, color: completada ? '#10b981' : '#E6B325' }}>
            {totalPuntos} / {requeridos} pts
          </span>
        </div>
        <div style={{ height: 8, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${progresoPct}%`,
            background: completada ? '#10b981' : '#E6B325',
            borderRadius: 4, transition: 'width 0.5s ease',
            boxShadow: completada ? '0 0 8px rgba(16,185,129,0.5)' : '0 0 8px rgba(230,179,37,0.5)',
          }} />
        </div>
      </div>
      {mision.fecha_termino && (
        <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)', flexShrink: 0 }}>
          <Icon name="clock" size={10} /> {fmtDate(mision.fecha_termino)}
        </div>
      )}
    </button>
  );
}

function ComunidadMisionPopup({ mision, userId, onClose }) {
  const isMobile = useIsMobile();
  const totalPuntos = mision.total_progreso ?? 0;
  const requeridos  = mision.puntos_requeridos ?? 100;
  const progresoPct = pct(totalPuntos, requeridos);
  const completada  = progresoPct >= 100;

  return (
    <Modal open onClose={onClose} kicker="Misión de Comunidad" title={mision.nombre} zIndex={1100}>
      <div style={{ display: 'grid', gap: 16 }}>
        {mision.foto_mision && (
          <div style={{ height: 140, borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <img src={mediaUrl(mision.foto_mision)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}

        {mision.mision && (
          <p style={{ fontSize: 13, color: 'var(--txt)', fontWeight: 600, margin: 0 }}>{mision.mision}</p>
        )}
        {mision.descripcion && (
          <p style={{ fontSize: 12.5, color: 'var(--txt-dim)', lineHeight: 1.6, margin: 0 }}>{mision.descripcion}</p>
        )}

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)' }}>PROGRESO COMUNIDAD</span>
            <span className="nx-num" style={{ fontSize: 11, color: completada ? '#10b981' : '#E6B325' }}>
              {totalPuntos} / {requeridos} pts
            </span>
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${progresoPct}%`,
              background: completada ? '#10b981' : '#E6B325',
              borderRadius: 4, transition: 'width 0.5s ease',
            }} />
          </div>
        </div>

        {(mision.objetivos ?? []).length > 0 && (
          <div>
            <div className="nx-kicker" style={{ marginBottom: 8 }}>OBJETIVOS</div>
            <div style={{ display: 'grid', gap: 5 }}>
              {mision.objetivos.map(obj => (
                <div key={obj.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', borderRadius: 6,
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: '#E6B325', boxShadow: '0 0 4px #E6B325',
                  }} />
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--txt-dim)' }}>{obj.nombre}</span>
                  <span className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)' }}>
                    {obj.tipo ? TIPO_OBJ[obj.tipo] ?? obj.tipo : ''} · meta {obj.meta} {obj.unidad ?? ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(mision.recompensas ?? []).length > 0 && (
          <div>
            <div className="nx-kicker" style={{ marginBottom: 8 }}>RECOMPENSAS</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {mision.recompensas.map((r, i) => (
                <div key={r.id ?? i} style={{
                  padding: '5px 10px', borderRadius: 6,
                  background: 'rgba(230,179,37,0.08)', border: '1px solid rgba(230,179,37,0.25)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{ fontSize: 13 }}>
                    {r.tipo === 'creditos' ? '💰' : r.tipo === 'titulo' ? '🏷️' : r.tipo === 'insignia' ? '🏅' : r.tipo === 'hito' ? '⭐' : r.tipo === 'habilidad' ? '⚡' : '📦'}
                  </span>
                  <span style={{ fontSize: 12, color: r.tipo === 'habilidad' ? '#a78bfa' : '#E6B325' }}>
                    {r.tipo === 'habilidad' && r.habilidad ? r.habilidad.nombre : r.tipo === 'hito' ? (r.hito || r.nombre) : r.nombre}
                    {r.tipo !== 'habilidad' && r.valor > 0 ? ` (${r.valor})` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="nx-kicker" style={{ marginBottom: 8 }}>
            {(mision.participantes ?? []).length} participante{mision.participantes?.length !== 1 ? 's' : ''}
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {(mision.participantes ?? []).map(p => {
              const av = {
                initials: (p.name ?? '?').split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase(),
                color: hashColor(p.handle ?? String(p.id)),
                name: p.name, tier: p.tier,
              };
              const pp = pct(p.progreso ?? 0, requeridos);
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar c={av} size={26} />
                  <span style={{ fontSize: 12, color: p.id === userId ? '#10b981' : 'var(--txt-dim)', width: isMobile ? 90 : 140, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.name}
                  </span>
                  <div className="nx-bar" style={{ flex: 1 }}>
                    <i style={{ width: `${pp}%`, background: pp >= 100 ? '#10b981' : '#E6B325' }} />
                  </div>
                  <span className="nx-num" style={{ fontSize: 10, width: 38, textAlign: 'right', color: 'var(--txt-faint)' }}>
                    {p.progreso ?? 0} pt
                  </span>
                </div>
              );
            })}
            {(mision.participantes ?? []).length === 0 && (
              <span style={{ fontSize: 12, color: 'var(--txt-faint)' }}>Aún sin participantes</span>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// MISIONES INDIVIDUALES (dadas por NPC)
// ─────────────────────────────────────────────────────────────
function IndividualSection({ misiones, onReload }) {
  const isMobile = useIsMobile();
  const [selectedId, setSelectedId] = useState(null);
  const misionesNpc = misiones.filter(m => m.npc);
  const activas      = misionesNpc.filter(m => m.status !== 'completada');
  const completadas  = misionesNpc.filter(m => m.status === 'completada');
  const gridCols = isMobile ? '1fr' : 'repeat(3, 1fr)';
  const selected = misionesNpc.find(m => m.id === selectedId) ?? null;

  return (
    <Panel kicker="NPC" title="Misiones Individuales" icon="target">
      {misionesNpc.length === 0 && (
        <Empty label="No tienes misiones individuales asignadas — habla con los NPC del mapa" />
      )}
      {activas.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: gridCols, gap: 14,
          marginBottom: completadas.length ? 18 : 0,
        }}>
          {activas.map(m => (
            <IndividualCard key={m.id} mision={m} onOpen={() => setSelectedId(m.id)} />
          ))}
        </div>
      )}
      {completadas.length > 0 && (
        <>
          <div className="nx-kicker" style={{ marginBottom: 10, marginTop: activas.length ? 8 : 0 }}>
            COMPLETADAS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 14 }}>
            {completadas.map(m => (
              <IndividualCard key={m.id} mision={m} completed onOpen={() => setSelectedId(m.id)} />
            ))}
          </div>
        </>
      )}

      {selected && (
        <IndividualMisionPopup mision={selected} onClose={() => setSelectedId(null)} />
      )}
    </Panel>
  );
}

function IndividualCard({ mision, completed, onOpen }) {
  const isMobile = useIsMobile();
  const npc = mision.npc;

  return (
    <button onClick={onOpen} className="nx-panel solid" style={{
      display: 'flex', gap: 12, textAlign: 'left', width: '100%', cursor: 'pointer',
      color: 'inherit', font: 'inherit', padding: '14px 16px',
      opacity: completed ? 0.7 : 1,
      filter: completed ? 'grayscale(1)' : 'none',
      border: completed
        ? '1px solid rgba(120,120,120,0.35)'
        : '1px solid var(--holo-line)',
    }}>
      {(mision.foto_mision || npc?.imagen_mini) && (
        <img
          src={mision.foto_mision ? mediaUrl(mision.foto_mision) : mediaUrl(npc.imagen_mini)}
          alt={mision.nombre}
          style={{ width: isMobile ? 56 : 84, height: isMobile ? 56 : 84, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--holo-line)', flexShrink: 0 }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{mision.nombre}</span>
          {completed
            ? <Chip tone="green">✓ Completada</Chip>
            : mision.status === 'en-curso'
              ? <Chip>En curso</Chip>
              : <Chip tone="dim">Pendiente</Chip>
          }
        </div>
        {npc && (
          <div className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)', marginBottom: 4 }}>
            <Icon name="user" size={10} /> {npc.nombre} · {npc.lugar ?? ''}
          </div>
        )}
        <div style={{ fontSize: 13, color: 'var(--txt-dim)' }}>{mision.mision}</div>
      </div>
      {mision.fecha_termino && (
        <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)', flexShrink: 0 }}>
          <Icon name="clock" size={10} /> {fmtDate(mision.fecha_termino)}
        </div>
      )}
    </button>
  );
}

function IndividualMisionPopup({ mision, onClose }) {
  const npc = mision.npc;
  const done = mision.status === 'completada';

  return (
    <Modal open onClose={onClose} kicker={done ? 'Misión completada' : 'Misión Individual'} title={mision.nombre} zIndex={1100}>
      <div style={{ display: 'grid', gap: 16 }}>
        {(mision.foto_mision || npc?.imagen_mini) && (
          <div style={{ height: 140, borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <img
              src={mision.foto_mision ? mediaUrl(mision.foto_mision) : mediaUrl(npc.imagen_mini)}
              alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        )}

        {npc && (
          <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)' }}>
            <Icon name="user" size={11} /> {npc.nombre} · {npc.lugar ?? ''}
          </div>
        )}

        {mision.mision && (
          <p style={{ fontSize: 13, color: 'var(--txt)', fontWeight: 600, margin: 0 }}>{mision.mision}</p>
        )}
        {mision.descripcion && (
          <p style={{ fontSize: 12.5, color: 'var(--txt-dim)', lineHeight: 1.6, margin: 0 }}>{mision.descripcion}</p>
        )}

        {(mision.objetivos ?? []).length > 0 && (
          <div>
            <div className="nx-kicker" style={{ marginBottom: 8 }}>OBJETIVOS</div>
            <div style={{ display: 'grid', gap: 5 }}>
              {mision.objetivos.map(obj => {
                const progreso = mision.progreso_json?.[obj.id] ?? 0;
                const objPct   = pct(progreso, obj.meta);
                const objDone  = objPct >= 100 || done;
                return (
                  <div key={obj.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px', borderRadius: 6,
                    background: objDone ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${objDone ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)'}`,
                  }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                      background: objDone ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)',
                      border: `1px solid ${objDone ? '#10b981' : 'rgba(255,255,255,0.15)'}`,
                      display: 'grid', placeItems: 'center',
                    }}>
                      {objDone && <Icon name="check" size={9} style={{ color: '#10b981' }} />}
                    </div>
                    <span style={{ flex: 1, fontSize: 12, color: objDone ? '#10b981' : 'var(--txt-dim)' }}>{obj.nombre}</span>
                    <span className="nx-num" style={{ fontSize: 10, color: 'var(--txt-faint)' }}>
                      {progreso} / {obj.meta} {obj.unidad ?? ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(mision.recompensas ?? []).length > 0 && (
          <div>
            <div className="nx-kicker" style={{ marginBottom: 8 }}>RECOMPENSAS</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {mision.recompensas.map((r, i) => (
                <div key={r.id ?? i} style={{
                  padding: '4px 10px', borderRadius: 6,
                  background: 'rgba(230,179,37,0.08)', border: '1px solid rgba(230,179,37,0.25)',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <span style={{ fontSize: 12 }}>
                    {r.tipo === 'creditos' ? '💰' : r.tipo === 'titulo' ? '🏷️' : r.tipo === 'hito' ? '⭐' : r.tipo === 'habilidad' ? '⚡' : '📦'}
                  </span>
                  <span style={{ fontSize: 11, color: '#E6B325' }}>
                    {r.tipo === 'hito' ? (r.hito || r.nombre) : r.nombre}{r.valor > 0 ? ` (${r.valor})` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
