import { useState, useEffect, useCallback } from 'react';
import { NX } from '../data/seed.js';
import { Icon, Panel, Btn, Chip, Avatar, TierBadge, Modal, toast, NumberInput } from '../components/ui.jsx';
import { Empty, mediaUrl } from './Comando.jsx';

const TASK_STATUS = {
  pendiente:  { label: 'Pendiente',   tone: 'dim',    color: 'var(--txt-dim)' },
  'en-curso': { label: 'En curso',    tone: '',       color: 'var(--holo)' },
  revision:   { label: 'En revisión', tone: 'orange', color: 'var(--holocron-naranja)' },
  completada: { label: 'Completada',  tone: 'green',  color: 'var(--green-500)' },
};

// ---------- helpers ----------
const HASH_COLORS = ['#FF6B00','#38cdf0','#8b5cf6','#10b981','#ec4899','#f97316','#E6B325','#3aa0ff'];
function hashColor(str) {
  let h = 5381;
  for (const c of (str ?? '?')) h = ((h << 5) + h) ^ c.charCodeAt(0);
  return HASH_COLORS[Math.abs(h) % HASH_COLORS.length];
}

function buildAvatar(u) {
  if (!u) return null;
  const char = u.character ?? {};
  const name = char.name ?? u.name ?? '?';
  return {
    userId: u.id,
    id: `u${u.id}`,
    name,
    handle: char.handle ?? '',
    initials: name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join(''),
    color: hashColor(char.handle ?? String(u.id)),
    tier: u.tier ?? 'iniciado',
    side: char.side ?? 'luminoso',
    saber: NX.SABERS[char.saber_color ?? 'azul'] ?? NX.SABERS.azul,
    saberName: char.saber_color ?? 'azul',
    wins: char.wins ?? 0,
    losses: char.losses ?? 0,
    total: (char.wins ?? 0) + (char.losses ?? 0),
    medals: [],
    lastTraining: u.training_days_max_date ?? null,
    photo: char.photo ?? null,
  };
}

function TaskTitleButton({ t, onOpenDetail, style }) {
  return (
    <button onClick={() => onOpenDetail(t)} style={{
      background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
      fontSize: 12, color: 'var(--txt-dim)', flex: 1, minWidth: 0,
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      textDecoration: 'underline', textDecorationColor: 'transparent',
      ...style,
    }}
      onMouseEnter={e => { e.currentTarget.style.textDecorationColor = 'var(--holo)'; }}
      onMouseLeave={e => { e.currentTarget.style.textDecorationColor = 'transparent'; }}>
      {t.title}
    </button>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr.slice(0, 10) + 'T00:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function mapTask(t, myUserId) {
  const due = t.due_date
    ? new Date(t.due_date + 'T00:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })
    : '—';
  const pupilAvatar = t.pupil ? buildAvatar(t.pupil) : null;
  const tutorAvatar = t.tutor ? buildAvatar(t.tutor) : null;
  if (pupilAvatar && t.pupil_id === myUserId) pupilAvatar.id = 'you';
  return {
    id: t.id, pupilId: t.pupil_id, tutorId: t.tutor_id,
    title: t.title, detail: t.detail ?? '',
    due, reward: t.reward ?? 0, progress: t.progress ?? 0,
    status: t.status ?? 'pendiente',
    pupilObj: pupilAvatar, tutorObj: tutorAvatar,
  };
}

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

// ---------- main view ----------
const CAN_TUTOR_TIERS = ['caballero', 'maestro', 'granmaestro'];

export function TareasView({ user }) {
  const [pupilTasks, setPupilTasks] = useState([]);
  const [tutorTasks, setTutorTasks] = useState([]);
  const [pupils, setPupils] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailTask, setDetailTask] = useState(null);
  const canTutor = CAN_TUTOR_TIERS.includes(user?.tier ?? '');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const pData = await apiCall('GET', '/api/tasks?perspective=pupil');
      setPupilTasks((pData.tasks ?? []).map(t => mapTask(t, user?.id)));

      if (canTutor) {
        const tData = await apiCall('GET', '/api/tasks?perspective=tutor');
        setTutorTasks((tData.tasks ?? []).map(t => mapTask(t, user?.id)));
        const puData = await apiCall('GET', '/api/tasks/pupils');
        setPupils((puData.pupils ?? []).map(buildAvatar));
      }
    } catch {}
    setLoading(false);
  }, [canTutor, user?.id]);

  useEffect(() => { reload(); }, [reload]);

  return (
    <div className="nx-fade" style={{ display: 'grid', gap: 18 }}>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <span className="nx-data" style={{ color: 'var(--holo)', letterSpacing: '.15em', animation: 'nx-pulse 1.4s infinite' }}>CARGANDO TAREAS...</span>
        </div>
      ) : (
        <>
          <TareasPupilo tasks={pupilTasks} setTasks={setPupilTasks} user={user} onOpenDetail={setDetailTask} />
          {canTutor && (
            <TareasTutor tasks={tutorTasks} setTasks={setTutorTasks} pupils={pupils} user={user} onReload={reload} onOpenDetail={setDetailTask} />
          )}
        </>
      )}

      <TaskDetailModal
        task={detailTask}
        viewerId={user?.id}
        onClose={() => setDetailTask(null)}
        onTaskUpdated={(updated) => {
          const mapped = mapTask(updated, user?.id);
          setPupilTasks(prev => prev.some(t => t.id === mapped.id) ? prev.map(t => t.id === mapped.id ? mapped : t) : prev);
          setTutorTasks(prev => prev.some(t => t.id === mapped.id) ? prev.map(t => t.id === mapped.id ? mapped : t) : prev);
          setDetailTask(mapped);
        }}
      />
    </div>
  );
}

// ---------- vista PUPILO ----------
function TareasPupilo({ tasks, setTasks, user, onOpenDetail }) {
  const active = tasks.filter(t => t.status === 'en-curso' || t.status === 'pendiente');
  const done   = tasks.filter(t => t.status === 'completada' || t.status === 'revision');
  const tutor  = tasks[0]?.tutorObj ?? null;

  const updateTask = async (id, patch) => {
    try {
      const data = await apiCall('PATCH', `/api/tasks/${id}`, patch);
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...mapTask(data.task, user?.id) } : t));
    } catch {
      toast('Error al actualizar la tarea', { tone: 'error', icon: 'x' });
    }
  };

  const sendToReview = async (id) => {
    await updateTask(id, { status: 'revision', progress: 100 });
    toast('Avance enviado', { tone: 'success', icon: 'check', desc: 'Tu tutor revisará el progreso' });
  };

  return (
    <>
      <Panel kicker="Tu tutor asignado" title="Tareas Pendientes" icon="tasks"
        right={tutor ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Avatar c={tutor} size={32} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{tutor.name}</div>
              <div className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)' }}>
                {NX.TIERS[tutor.tier]?.label ?? tutor.tier}
              </div>
            </div>
          </div>
        ) : null}>
        <div style={{ display: 'grid', gap: 12 }}>
          {active.length === 0 && <Empty label="Sin Tareas Activas" />}
          {active.map(t => (
            <PupilTaskCard key={t.id} t={t}
              onUpdateProgress={v => updateTask(t.id, { progress: v, status: v > 0 && t.status === 'pendiente' ? 'en-curso' : t.status })}
              onSendToReview={() => sendToReview(t.id)}
              onOpenDetail={() => onOpenDetail(t)} />
          ))}
        </div>
      </Panel>

      {done.length > 0 && (
        <Panel kicker="Historial" title="Enviadas y Completadas" icon="check">
          <div style={{ display: 'grid', gap: 12 }}>
            {done.map(t => <PupilTaskCard key={t.id} t={t} onOpenDetail={() => onOpenDetail(t)} />)}
          </div>
        </Panel>
      )}
    </>
  );
}

function PupilTaskCard({ t, onUpdateProgress, onSendToReview, onOpenDetail }) {
  const st = TASK_STATUS[t.status] ?? TASK_STATUS.pendiente;
  return (
    <div className="nx-panel solid" style={{ padding: 15 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={onOpenDetail} style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              fontWeight: 700, fontSize: 15, color: 'var(--txt)', textDecoration: 'underline', textDecorationColor: 'transparent',
            }}
              onMouseEnter={e => { e.currentTarget.style.textDecorationColor = 'var(--holo)'; }}
              onMouseLeave={e => { e.currentTarget.style.textDecorationColor = 'transparent'; }}>
              {t.title}
            </button>
            <Chip tone={st.tone}>{st.label}</Chip>
          </div>
          {t.detail && <p style={{ fontSize: 13, color: 'var(--txt-dim)', margin: '6px 0 0' }}>{t.detail}</p>}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <Chip tone="gold" icon="coin">+{t.reward}</Chip>
          {t.due !== '—' && (
            <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)', marginTop: 6 }}>
              <Icon name="clock" size={10} style={{ verticalAlign: -1 }} /> {t.due}
            </div>
          )}
        </div>
      </div>

      {t.status === 'completada' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, color: 'var(--green-500)' }}>
          <Icon name="check" size={15} />
          <span className="nx-data" style={{ fontSize: 12 }}>Aprobada · +{t.reward} créditos abonados</span>
        </div>
      ) : t.status === 'revision' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, color: 'var(--holocron-naranja)' }}>
          <Icon name="clock" size={15} />
          <span className="nx-data" style={{ fontSize: 12 }}>Esperando aprobación del tutor</span>
        </div>
      ) : onUpdateProgress ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
            <input type="range" min="0" max="100" step="5" value={t.progress}
              onChange={e => onUpdateProgress(+e.target.value)}
              style={{ flex: 1, accentColor: 'var(--holo)' }} />
            <span className="nx-num" style={{ fontSize: 15, width: 44, textAlign: 'right', color: 'var(--holo)' }}>{t.progress}%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <Btn kind={t.progress === 100 ? 'accent' : 'ghost'} icon="upload" sm
              disabled={t.progress < 100} onClick={onSendToReview}>
              Enviar a revisión
            </Btn>
          </div>
        </>
      ) : null}
    </div>
  );
}

// ---------- vista TUTOR ----------
function TareasTutor({ tasks, setTasks, pupils, user, onReload, onOpenDetail }) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [preselectedIds, setPreselectedIds] = useState([]);
  const [reviewFor, setReviewFor] = useState(null);

  const openAssign = (ids = []) => { setPreselectedIds(ids); setAssignOpen(true); };

  const approveTask = async (t) => {
    if (!window.confirm(`¿Aprobar "${t.title}"? Se abonarán +${t.reward} créditos a ${t.pupilObj?.name ?? 'el pupilo'}.`)) return;
    try {
      await apiCall('POST', `/api/tasks/${t.id}/approve`);
      setTasks(prev => prev.map(x => x.id === t.id ? { ...x, status: 'completada', progress: 100 } : x));
      toast('Tarea aprobada', { tone: 'success', icon: 'check', desc: `${t.pupilObj?.name} recibió +${t.reward} créditos` });
    } catch {
      toast('Error al aprobar', { tone: 'error', icon: 'x' });
    }
  };

  const rejectTask = async (t) => {
    if (!window.confirm(`¿Rechazar "${t.title}"? Volverá a "en curso" y ${t.pupilObj?.name ?? 'el pupilo'} deberá volver a enviarla a revisión.`)) return;
    try {
      await apiCall('PATCH', `/api/tasks/${t.id}`, { status: 'en-curso', progress: 80 });
      setTasks(prev => prev.map(x => x.id === t.id ? { ...x, status: 'en-curso', progress: 80 } : x));
      toast('Devuelta al pupilo', { tone: 'warning', icon: 'x' });
    } catch {
      toast('Error', { tone: 'error', icon: 'x' });
    }
  };

  return (
    <>
      <Panel kicker="Pupilos a cargo" title="Mis Pupilos" icon="roster"
        right={
          <Btn sm icon="plus" kind="accent" disabled={pupils.length === 0} onClick={() => openAssign(pupils.map(p => p.userId))}>
            Asignar tarea
          </Btn>
        }>
        {pupils.length === 0 && <Empty label="Aún no tienes pupilos asignados" />}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
          {pupils.map(p => {
            const ts = tasks.filter(t => t.pupilId === p.userId);
            const finalizadas = ts.filter(t => t.status === 'completada').length;
            const pendientes = ts.length - finalizadas;
            const tsPendientes = ts.filter(t => t.status !== 'completada');
            return (
              <div key={p.userId} className="nx-panel solid" style={{ padding: 0, display: 'flex', overflow: 'hidden' }}>
                {/* Retrato — franja lateral */}
                <div style={{
                  width: 116, flexShrink: 0, position: 'relative', alignSelf: 'stretch', minHeight: 190,
                  background: p.photo
                    ? `url(${mediaUrl(p.photo)}) center/cover no-repeat`
                    : `linear-gradient(160deg, ${p.color}44, rgba(4,7,15,0.95))`,
                  borderRight: `1px solid ${p.color}55`,
                }}>
                  {!p.photo && (
                    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                      <span className="nx-display" style={{ fontSize: 32, color: p.color, opacity: 0.85 }}>{p.initials}</span>
                    </div>
                  )}
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(4,7,15,0) 55%, rgba(4,7,15,0.85) 100%)' }} />
                  <div style={{ position: 'absolute', top: 8, left: 8, width: 14, height: 14, borderTop: `2px solid ${p.color}`, borderLeft: `2px solid ${p.color}`, opacity: 0.9 }} />
                  <div style={{ position: 'absolute', bottom: 8, right: 8, width: 14, height: 14, borderBottom: `2px solid ${p.color}`, borderRight: `2px solid ${p.color}`, opacity: 0.9 }} />
                  <div className="nx-data" style={{
                    position: 'absolute', bottom: 8, left: 8, right: 8, fontSize: 9, letterSpacing: '.1em',
                    color: p.color, textTransform: 'uppercase', textShadow: '0 1px 4px rgba(0,0,0,.9)',
                  }}>@{p.handle}</div>
                </div>

                {/* Contenido */}
                <div style={{ flex: 1, minWidth: 0, padding: 15 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                    <TierBadge tier={p.tier} sm />
                    <Btn sm icon="eye" disabled={ts.length === 0} onClick={() => setReviewFor(p)}>Revisar</Btn>
                  </div>

                  <div style={{ display: 'flex', gap: 18, marginTop: 13, paddingTop: 12, borderTop: '1px solid var(--holo-line)' }}>
                    <div>
                      <div className="nx-data" style={{ fontSize: 9, color: 'var(--txt-faint)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Pendientes</div>
                      <div className="nx-num" style={{ fontSize: 17, color: 'var(--holocron-naranja)' }}>{pendientes}</div>
                    </div>
                    <div>
                      <div className="nx-data" style={{ fontSize: 9, color: 'var(--txt-faint)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Finalizadas</div>
                      <div className="nx-num" style={{ fontSize: 17, color: 'var(--green-500)' }}>{finalizadas}</div>
                    </div>
                    <div>
                      <div className="nx-data" style={{ fontSize: 9, color: 'var(--txt-faint)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Último entrenamiento</div>
                      <div style={{ fontSize: 13, marginTop: 3 }}>{formatDate(p.lastTraining)}</div>
                    </div>
                  </div>

                  {tsPendientes.length > 0 ? (
                    <div style={{ display: 'grid', gap: 7, marginTop: 13 }}>
                      {tsPendientes.map(t => {
                        const st = TASK_STATUS[t.status] ?? TASK_STATUS.pendiente;
                        if (t.status === 'revision') {
                          return (
                            <div key={t.id} style={{ padding: '7px 0', borderTop: '1px dashed var(--holo-line)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                <TaskTitleButton t={t} onOpenDetail={onOpenDetail} style={{ fontWeight: 600 }} />
                                <Chip tone={st.tone} style={{ flexShrink: 0 }}>{st.label}</Chip>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 6 }}>
                                <Btn sm icon="x" onClick={() => rejectTask(t)}>Rechazar</Btn>
                                <Btn sm icon="check" onClick={() => approveTask(t)}
                                  style={{ background: 'var(--green-500)', borderColor: 'var(--green-500)', color: '#04210f' }}>
                                  Aprobar
                                </Btn>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <TaskTitleButton t={t} onOpenDetail={onOpenDetail} />
                            <div className="nx-bar" style={{ width: 60, flexShrink: 0 }}><i style={{ width: `${t.progress}%`, background: st.color }} /></div>
                            <Chip tone={st.tone} style={{ width: 82, flexShrink: 0, justifyContent: 'center' }}>{st.label}</Chip>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ marginTop: 13, fontSize: 12, color: 'var(--txt-faint)' }}>Sin tareas pendientes</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <AssignModal
        open={assignOpen}
        pupils={pupils}
        preselectedIds={preselectedIds}
        onClose={() => setAssignOpen(false)}
        onCreated={(newTasks) => { setTasks(prev => [...prev, ...newTasks]); setAssignOpen(false); }}
        user={user}
      />

      <PupilTasksModal
        pupil={reviewFor}
        tasks={tasks.filter(t => t.pupilId === reviewFor?.userId)}
        onClose={() => setReviewFor(null)}
        onOpenDetail={onOpenDetail}
        onApprove={approveTask}
        onReject={rejectTask}
      />
    </>
  );
}

const TASK_FILTERS = [
  { key: 'todas', label: 'Todas' },
  { key: 'pendiente', label: 'Pendiente' },
  { key: 'en-curso', label: 'En curso' },
  { key: 'revision', label: 'En revisión' },
  { key: 'completada', label: 'Completada' },
];

function PupilTasksModal({ pupil, tasks, onClose, onOpenDetail, onApprove, onReject }) {
  const [filter, setFilter] = useState('todas');

  useEffect(() => { if (pupil) setFilter('todas'); }, [pupil]);

  if (!pupil) return null;

  const filtered = filter === 'todas' ? tasks : tasks.filter(t => t.status === filter);

  return (
    <Modal open={!!pupil} onClose={onClose} kicker={`Historial de ${pupil.name}`} title="Tareas del Pupilo">
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TASK_FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} className="nx-btn nx-btn-sm" style={{
              background: filter === f.key ? 'var(--holocron-naranja)' : 'transparent',
              borderColor: filter === f.key ? 'var(--holocron-naranja)' : 'var(--holo-line)',
              color: filter === f.key ? '#fff' : 'var(--txt-dim)',
            }}>
              {f.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <Empty label="No hay tareas con este filtro" />
        ) : (
          <div style={{ display: 'grid', gap: 10, maxHeight: 440, overflowY: 'auto' }}>
            {filtered.map(t => {
              const st = TASK_STATUS[t.status] ?? TASK_STATUS.pendiente;
              return (
                <div key={t.id} className="nx-panel solid" style={{ padding: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <TaskTitleButton t={t} onOpenDetail={onOpenDetail} style={{ fontWeight: 700, fontSize: 14, color: 'var(--txt)' }} />
                      {t.detail && <div style={{ fontSize: 12, color: 'var(--txt-dim)', marginTop: 3 }}>{t.detail}</div>}
                    </div>
                    <Chip tone={st.tone} style={{ flexShrink: 0 }}>{st.label}</Chip>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 9 }}>
                    <div className="nx-bar" style={{ flex: 1 }}><i style={{ width: `${t.progress}%`, background: st.color }} /></div>
                    <span className="nx-num" style={{ fontSize: 12, color: 'var(--holo)', width: 34, textAlign: 'right' }}>{t.progress}%</span>
                    <Chip tone="gold" icon="coin" style={{ flexShrink: 0 }}>+{t.reward}</Chip>
                    {t.due !== '—' && (
                      <span className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)', flexShrink: 0 }}>
                        <Icon name="clock" size={10} style={{ verticalAlign: -1 }} /> {t.due}
                      </span>
                    )}
                  </div>
                  {t.status === 'revision' && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                      <Btn sm icon="x" onClick={() => onReject(t)}>Rechazar</Btn>
                      <Btn sm icon="check" onClick={() => onApprove(t)}
                        style={{ background: 'var(--green-500)', borderColor: 'var(--green-500)', color: '#04210f' }}>
                        Aprobar
                      </Btn>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}

function EvidenceThumb({ file }) {
  const url = mediaUrl(file.path);
  if (file.type === 'photo') {
    return (
      <a href={url} target="_blank" rel="noreferrer" title={file.original_name ?? ''}>
        <img src={url} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--holo-line)' }} />
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" title={file.original_name ?? ''} style={{
      width: 64, height: 64, display: 'grid', placeItems: 'center', borderRadius: 6,
      border: '1px solid var(--holo-line)', background: 'rgba(255,255,255,0.03)', color: 'var(--holo)',
    }}>
      <Icon name={file.type === 'video' ? 'video' : 'link'} size={20} />
    </a>
  );
}

function TaskDetailModal({ task, viewerId, onClose, onTaskUpdated }) {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [progress, setProgress] = useState(0);
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);

  const isPupilViewer = Boolean(task) && task.pupilId === viewerId;
  const canEditProgress = isPupilViewer && task?.status !== 'completada';

  const load = useCallback(async (taskId) => {
    setLoading(true);
    try {
      const data = await apiCall('GET', `/api/tasks/${taskId}/updates`);
      setUpdates(data.updates ?? []);
    } catch {
      setUpdates([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (task) {
      setComment('');
      setFiles([]);
      setProgress(task.progress ?? 0);
      load(task.id);
    }
  }, [task?.id, load]);

  if (!task) return null;

  const st = TASK_STATUS[task.status] ?? TASK_STATUS.pendiente;
  const hasProgressChange = canEditProgress && progress !== task.progress;

  const submit = async () => {
    if (!comment.trim() && files.length === 0 && !hasProgressChange) {
      toast('Agrega un comentario, un avance o evidencia', { tone: 'error', icon: 'x' });
      return;
    }
    setSending(true);
    try {
      const fd = new FormData();
      if (comment.trim()) fd.append('comment', comment.trim());
      if (hasProgressChange) fd.append('progress', String(progress));
      files.forEach(f => fd.append('files[]', f));

      const data = await apiCallForm('POST', `/api/tasks/${task.id}/updates`, fd);
      setUpdates(prev => [data.update, ...prev]);
      setComment('');
      setFiles([]);
      onTaskUpdated?.(data.task);
      toast('Actualización agregada', { tone: 'success', icon: 'check' });
    } catch (e) {
      toast(e?.message ?? 'Error al agregar la actualización', { tone: 'error', icon: 'x' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal open={!!task} onClose={onClose}
      kicker={task.pupilObj?.name ? `Pupilo: ${task.pupilObj.name}` : undefined}
      title={task.title} width={640}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div>
          {task.detail && <p style={{ fontSize: 13, color: 'var(--txt-dim)', margin: '0 0 10px' }}>{task.detail}</p>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Chip tone={st.tone}>{st.label}</Chip>
            <Chip tone="gold" icon="coin">+{task.reward}</Chip>
            {task.due !== '—' && (
              <span className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)' }}>
                <Icon name="clock" size={10} style={{ verticalAlign: -1 }} /> {task.due}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <div className="nx-bar" style={{ flex: 1 }}><i style={{ width: `${task.progress}%`, background: st.color }} /></div>
            <span className="nx-num" style={{ fontSize: 13, color: 'var(--holo)', width: 40, textAlign: 'right' }}>{task.progress}%</span>
          </div>
        </div>

        {task.status !== 'completada' && (
          <div className="nx-panel solid" style={{ padding: 13 }}>
            <div className="nx-kicker" style={{ marginBottom: 9 }}>Agregar actualización</div>
            {canEditProgress && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <span className="nx-data" style={{ fontSize: 11, color: 'var(--txt-dim)' }}>Avance</span>
                <input type="range" min="0" max="100" step="5" value={progress}
                  onChange={e => setProgress(+e.target.value)}
                  style={{ flex: 1, accentColor: 'var(--holo)' }} />
                <span className="nx-num" style={{ fontSize: 14, width: 40, textAlign: 'right', color: 'var(--holo)' }}>{progress}%</span>
              </div>
            )}
            <textarea className="nx-textarea" value={comment} onChange={e => setComment(e.target.value)}
              placeholder="Comentario sobre el avance..." style={{ minHeight: 60 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 9, flexWrap: 'wrap' }}>
              <label className="nx-btn nx-btn-sm" style={{ cursor: 'pointer' }}>
                <Icon name="camera" size={12} /> Adjuntar evidencia
                <input type="file" multiple accept="image/*,video/*,.pdf" style={{ display: 'none' }}
                  onChange={e => setFiles(Array.from(e.target.files ?? []))} />
              </label>
              {files.length > 0 && (
                <span style={{ fontSize: 12, color: 'var(--txt-dim)' }}>{files.length} archivo{files.length > 1 ? 's' : ''} seleccionado{files.length > 1 ? 's' : ''}</span>
              )}
              <div style={{ flex: 1 }} />
              <Btn kind="accent" sm icon="check" onClick={submit} disabled={sending}>
                {sending ? 'Enviando...' : 'Publicar'}
              </Btn>
            </div>
          </div>
        )}

        <div>
          <div className="nx-kicker" style={{ marginBottom: 9 }}>Registro de avance</div>
          {loading ? (
            <div style={{ fontSize: 12, color: 'var(--txt-faint)' }}>Cargando...</div>
          ) : updates.length === 0 ? (
            <Empty label="Sin actividad registrada todavía" />
          ) : (
            <div style={{ display: 'grid', gap: 10, maxHeight: 340, overflowY: 'auto' }}>
              {updates.map(u => (
                <div key={u.id} className="nx-panel solid" style={{ padding: 11 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 700, fontSize: 12 }}>{u.user?.name ?? '—'}</span>
                    <span className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)', flexShrink: 0 }}>
                      {new Date(u.created_at).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {u.progress !== null && (
                    <div style={{ marginTop: 6 }}>
                      <Chip tone="dim">Avance actualizado a {u.progress}%</Chip>
                    </div>
                  )}
                  {u.comment && <p style={{ fontSize: 13, margin: '7px 0 0', color: 'var(--txt)' }}>{u.comment}</p>}
                  {u.files?.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 9 }}>
                      {u.files.map(f => <EvidenceThumb key={f.id} file={f} />)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function AssignModal({ open, pupils, preselectedIds, onClose, onCreated, user }) {
  const empty = { title: '', detail: '', due_date: '', reward: 150, notify: true };
  const [f, setF] = useState(empty);
  const [selectedIds, setSelectedIds] = useState(preselectedIds ?? []);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) { setF(empty); setSelectedIds(preselectedIds ?? []); }
  }, [open]);

  if (!open) return null;

  const toggleId = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const submit = async () => {
    if (!f.title.trim()) { toast('Falta el título', { tone: 'error', icon: 'x' }); return; }
    if (selectedIds.length === 0) { toast('Selecciona al menos un pupilo', { tone: 'error', icon: 'x' }); return; }
    setSending(true);
    try {
      const data = await apiCall('POST', '/api/tasks', {
        pupil_ids: selectedIds,
        title:     f.title,
        detail:    f.detail || null,
        due_date:  f.due_date || null,
        reward:    +f.reward || 0,
      });
      onCreated((data.tasks ?? []).map(t => mapTask(t, user?.id)));
      const n = selectedIds.length;
      toast(f.notify ? `Tarea enviada a ${n} pupilo${n > 1 ? 's' : ''}` : 'Tarea creada', {
        tone: 'success', icon: f.notify ? 'bell' : 'check',
        desc: f.notify ? 'Pupilo(s) notificado(s)' : undefined,
      });
    } catch (e) {
      toast(e?.message ?? 'Error al crear la tarea', { tone: 'error', icon: 'x' });
    } finally {
      setSending(false);
    }
  };

  const kicker = selectedIds.length === 1
    ? `Para ${pupils.find(p => p.userId === selectedIds[0])?.name ?? '—'}`
    : `Para ${selectedIds.length} pupilos`;

  return (
    <Modal open={open} onClose={onClose} kicker={kicker} title="Asignar Tarea">
      <div style={{ display: 'grid', gap: 14 }}>
        {pupils.length > 1 && (
          <div>
            <label className="nx-label">Pupilos ({selectedIds.length}/{pupils.length})</label>
            <div style={{
              display: 'grid', gap: 6, maxHeight: 180, overflowY: 'auto',
              border: '1px solid var(--holo-line)', borderRadius: 'var(--radius-md)', padding: 8,
            }}>
              {pupils.map(p => (
                <label key={p.userId} style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={selectedIds.includes(p.userId)} onChange={() => toggleId(p.userId)}
                    style={{ accentColor: 'var(--holocron-naranja)', width: 16, height: 16 }} />
                  <Avatar c={p} size={22} />
                  {p.name} <span style={{ color: 'var(--txt-faint)' }}>· @{p.handle}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <div>
          <label className="nx-label">Título de la tarea *</label>
          <input className="nx-input" value={f.title} onChange={e => setF({ ...f, title: e.target.value })}
            placeholder="Ej: 3 sesiones de footwork" autoFocus />
        </div>
        <div>
          <label className="nx-label">Instrucciones</label>
          <textarea className="nx-textarea" value={f.detail} onChange={e => setF({ ...f, detail: e.target.value })}
            placeholder="Detalle de lo que debe lograr..." />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label className="nx-label">Fecha límite</label>
            <input className="nx-input" type="date" value={f.due_date} onChange={e => setF({ ...f, due_date: e.target.value })} />
          </div>
          <div>
            <label className="nx-label">Recompensa (créditos)</label>
            <NumberInput className="nx-input nx-data" value={f.reward} onChange={e => setF({ ...f, reward: e.target.value })} />
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', fontSize: 13, color: 'var(--txt-dim)' }}>
          <input type="checkbox" checked={f.notify} onChange={e => setF({ ...f, notify: e.target.checked })}
            style={{ accentColor: 'var(--holocron-naranja)', width: 16, height: 16 }} />
          <Icon name="bell" size={14} /> Notificar al pupilo al asignar
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn kind="accent" icon="check" onClick={submit} disabled={sending}>
            {sending ? 'Asignando...' : 'Asignar tarea'}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
