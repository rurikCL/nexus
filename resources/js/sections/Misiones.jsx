import { useState, useEffect, useCallback } from 'react';
import { Icon, Panel, Btn, Chip, Avatar, Modal, toast } from '../components/ui.jsx';
import { Empty } from './Comando.jsx';

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
  comunidad:   { label: 'Comunidad',  color: '#10b981' },
  individual:  { label: 'Individual', color: '#38cdf0' },
};

const TIPO_OBJ = {
  general:       'General',
  entrenamiento: 'Entrenamiento',
  combate:       'Combate',
  tarea:         'Tarea',
  viaje:         'Viaje',
  dialogo:       'Diálogo',
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

// ─────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────
export function MisionesView({ S, user }) {
  const [misiones, setMisiones] = useState({ comunidad: [], individual: [] });
  const [loading, setLoading]   = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [comunidad, individual] = await Promise.all([
        apiCall('GET', '/api/misiones/comunidad'),
        apiCall('GET', '/api/misiones/individual'),
      ]);
      setMisiones({
        comunidad:  comunidad.misiones  ?? [],
        individual: individual.misiones ?? [],
      });
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

  return (
    <div className="nx-fade" style={{ display: 'grid', gap: 24 }}>
      <ComunidadSection misiones={misiones.comunidad} onReload={reload} user={user} />
      <IndividualSection misiones={misiones.individual} onReload={reload} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MISIONES DE COMUNIDAD
// ─────────────────────────────────────────────────────────────
function ComunidadSection({ misiones, onReload, user }) {
  return (
    <Panel kicker="Global" title="Misiones de Comunidad" icon="roster">
      {misiones.length === 0 && <Empty label="No hay misiones de comunidad activas" />}
      <div style={{ display: 'grid', gap: 18 }}>
        {misiones.map(m => (
          <ComunidadCard key={m.id} mision={m} userId={user?.id} />
        ))}
      </div>
    </Panel>
  );
}

function ComunidadCard({ mision, userId }) {
  const [open, setOpen] = useState(false);
  const totalPuntos = mision.total_progreso ?? 0;
  const requeridos  = mision.puntos_requeridos ?? 100;
  const progresoPct = pct(totalPuntos, requeridos);
  const completada  = progresoPct >= 100;
  const yoParticipo = mision.participantes?.some(p => p.id === userId);

  return (
    <div className="nx-panel solid" style={{
      overflow: 'hidden',
      border: completada ? '1px solid rgba(16,185,129,0.4)' : '1px solid var(--holo-line)',
    }}>
      {mision.foto_mision && (
        <div style={{
          height: 120, background: `url(${mediaUrl(mision.foto_mision)}) center/cover no-repeat`,
          opacity: 0.65, borderBottom: '1px solid var(--holo-line)',
        }} />
      )}
      <div style={{ padding: '14px 16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{mision.nombre}</span>
              <Chip tone={completada ? 'green' : ''}>{completada ? '✓ Completada' : 'En curso'}</Chip>
              {mision.activa === false && <Chip tone="dim">Inactiva</Chip>}
            </div>
            <div style={{ fontSize: 13, color: 'var(--txt-dim)' }}>{mision.mision}</div>
          </div>
          {mision.fecha_termino && (
            <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)', flexShrink: 0 }}>
              <Icon name="clock" size={10} /> {fmtDate(mision.fecha_termino)}
            </div>
          )}
        </div>

        {/* Barra de progreso global */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)' }}>PROGRESO COMUNIDAD</span>
            <span className="nx-num" style={{ fontSize: 11, color: completada ? '#10b981' : 'var(--holo)' }}>
              {totalPuntos} / {requeridos} pts
            </span>
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${progresoPct}%`,
              background: completada ? '#10b981' : 'var(--holo)',
              borderRadius: 4, transition: 'width 0.5s ease',
              boxShadow: completada ? '0 0 8px rgba(16,185,129,0.5)' : '0 0 8px rgba(56,205,240,0.4)',
            }} />
          </div>
        </div>

        {/* Objetivos */}
        {(mision.objetivos ?? []).length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div className="nx-kicker" style={{ fontSize: 9, marginBottom: 6 }}>OBJETIVOS</div>
            <div style={{ display: 'grid', gap: 5 }}>
              {mision.objetivos.map(obj => (
                <div key={obj.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', borderRadius: 6,
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--holo)', boxShadow: '0 0 4px var(--holo)',
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

        {/* Recompensas */}
        {(mision.recompensas ?? []).length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div className="nx-kicker" style={{ fontSize: 9, marginBottom: 6 }}>RECOMPENSAS</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {mision.recompensas.map((r, i) => (
                <div key={r.id ?? i} style={{
                  padding: '5px 10px', borderRadius: 6,
                  background: 'rgba(230,179,37,0.08)', border: '1px solid rgba(230,179,37,0.25)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{ fontSize: 13 }}>
                    {r.tipo === 'creditos' ? '💰' : r.tipo === 'titulo' ? '🏷️' : r.tipo === 'insignia' ? '🏅' : r.tipo === 'habilidad' ? '⚡' : '📦'}
                  </span>
                  <span style={{ fontSize: 12, color: r.tipo === 'habilidad' ? '#a78bfa' : '#E6B325' }}>
                    {r.tipo === 'habilidad' && r.habilidad ? r.habilidad.nombre : r.nombre}
                    {r.tipo !== 'habilidad' && r.valor > 0 ? ` (${r.valor})` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Participantes */}
        <div>
          <button
            className="nx-data"
            style={{ fontSize: 11, color: 'var(--holo)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, letterSpacing: '.08em', marginBottom: open ? 10 : 0 }}
            onClick={() => setOpen(o => !o)}
          >
            <Icon name={open ? 'chevdown' : 'chevron'} size={11} />{' '}
            {(mision.participantes ?? []).length} participante{mision.participantes?.length !== 1 ? 's' : ''}
            {yoParticipo && <span style={{ color: '#10b981', marginLeft: 6 }}>· Participando</span>}
          </button>

          {open && (
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
                    <span style={{ fontSize: 12, color: 'var(--txt-dim)', width: 130, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.name}
                    </span>
                    <div className="nx-bar" style={{ flex: 1 }}>
                      <i style={{ width: `${pp}%`, background: pp >= 100 ? '#10b981' : 'var(--holo)' }} />
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
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MISIONES INDIVIDUALES (dadas por NPC)
// ─────────────────────────────────────────────────────────────
function IndividualSection({ misiones, onReload }) {
  const activas    = misiones.filter(m => m.status !== 'completada');
  const completadas = misiones.filter(m => m.status === 'completada');

  return (
    <Panel kicker="NPC" title="Misiones Individuales" icon="target">
      {misiones.length === 0 && (
        <Empty label="No tienes misiones individuales asignadas — habla con los NPC del mapa" />
      )}
      {activas.length > 0 && (
        <div style={{ display: 'grid', gap: 12, marginBottom: completadas.length ? 18 : 0 }}>
          {activas.map(m => (
            <IndividualCard key={m.id} mision={m} onReload={onReload} />
          ))}
        </div>
      )}
      {completadas.length > 0 && (
        <>
          <div className="nx-kicker" style={{ marginBottom: 10, marginTop: activas.length ? 8 : 0 }}>
            COMPLETADAS
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {completadas.map(m => (
              <IndividualCard key={m.id} mision={m} completed onReload={onReload} />
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}

function IndividualCard({ mision, completed, onReload }) {
  const npc = mision.npc;

  return (
    <div className="nx-panel solid" style={{
      padding: '14px 16px',
      opacity: completed ? 0.7 : 1,
      border: completed
        ? '1px solid rgba(16,185,129,0.3)'
        : '1px solid var(--holo-line)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
        {npc?.imagen_mini && (
          <img src={npc.imagen_mini} alt={npc.nombre}
            style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--holo-line)', flexShrink: 0 }} />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{mision.nombre}</span>
            {completed
              ? <Chip tone="green">✓ Completada</Chip>
              : mision.mi_status === 'en-curso'
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
      </div>

      {/* Objetivos */}
      {(mision.objetivos ?? []).length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div className="nx-kicker" style={{ fontSize: 9, marginBottom: 6 }}>OBJETIVOS</div>
          <div style={{ display: 'grid', gap: 5 }}>
            {mision.objetivos.map(obj => {
              const progreso = mision.progreso_json?.[obj.id] ?? 0;
              const objPct   = pct(progreso, obj.meta);
              const done     = objPct >= 100 || completed;
              return (
                <div key={obj.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', borderRadius: 6,
                  background: done ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${done ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)'}`,
                }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                    background: done ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)',
                    border: `1px solid ${done ? '#10b981' : 'rgba(255,255,255,0.15)'}`,
                    display: 'grid', placeItems: 'center',
                  }}>
                    {done && <Icon name="check" size={9} style={{ color: '#10b981' }} />}
                  </div>
                  <span style={{ flex: 1, fontSize: 12, color: done ? '#10b981' : 'var(--txt-dim)' }}>{obj.nombre}</span>
                  <span className="nx-num" style={{ fontSize: 10, color: 'var(--txt-faint)' }}>
                    {progreso} / {obj.meta} {obj.unidad ?? ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recompensas */}
      {(mision.recompensas ?? []).length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {mision.recompensas.map((r, i) => (
            <div key={r.id ?? i} style={{
              padding: '4px 10px', borderRadius: 6,
              background: 'rgba(230,179,37,0.08)', border: '1px solid rgba(230,179,37,0.25)',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span style={{ fontSize: 12 }}>
                {r.tipo === 'creditos' ? '💰' : r.tipo === 'titulo' ? '🏷️' : r.tipo === 'habilidad' ? '⚡' : '📦'}
              </span>
              <span style={{ fontSize: 11, color: '#E6B325' }}>
                {r.nombre}{r.valor > 0 ? ` (${r.valor})` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
