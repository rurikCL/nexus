import { useState, useEffect, useCallback } from 'react';
import { NX } from '../data/seed.js';
import { Icon, Panel, Btn, Chip, Avatar, TierBadge, Modal, toast } from '../components/ui.jsx';
import { Empty } from './Comando.jsx';

const TASK_STATUS = {
  pendiente:  { label: 'Pendiente',   tone: 'dim',    color: 'var(--txt-dim)' },
  'en-curso': { label: 'En curso',    tone: '',       color: 'var(--holo)' },
  revision:   { label: 'En revisión', tone: 'orange', color: 'var(--pompeyo-naranja)' },
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
  };
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

// ---------- main view ----------
export function TareasView({ S, user }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const perspective = S.role === 'tutor' ? 'tutor' : 'pupil';
      const data = await apiCall('GET', `/api/tasks?perspective=${perspective}`);
      setTasks((data.tasks ?? []).map(t => mapTask(t, user?.id)));
    } catch {}
    setLoading(false);
  }, [S.role, user?.id]);

  useEffect(() => { reload(); }, [reload]);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <span className="nx-data" style={{ color: 'var(--holo)', letterSpacing: '.15em', animation: 'nx-pulse 1.4s infinite' }}>CARGANDO TAREAS...</span>
    </div>
  );

  return S.role === 'tutor'
    ? <TareasTutor tasks={tasks} setTasks={setTasks} S={S} user={user} onReload={reload} />
    : <TareasPupilo tasks={tasks} setTasks={setTasks} S={S} user={user} />;
}

// ---------- vista PUPILO ----------
function TareasPupilo({ tasks, setTasks, user }) {
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
    <div className="nx-fade" style={{ display: 'grid', gap: 18 }}>
      <Panel kicker="Tu tutor asignado" title="Plan de Entrenamiento" icon="tasks"
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
              onSendToReview={() => sendToReview(t.id)} />
          ))}
        </div>
      </Panel>

      {done.length > 0 && (
        <Panel kicker="Historial" title="Enviadas y Completadas" icon="check">
          <div style={{ display: 'grid', gap: 12 }}>
            {done.map(t => <PupilTaskCard key={t.id} t={t} />)}
          </div>
        </Panel>
      )}
    </div>
  );
}

function PupilTaskCard({ t, onUpdateProgress, onSendToReview }) {
  const st = TASK_STATUS[t.status] ?? TASK_STATUS.pendiente;
  return (
    <div className="nx-panel solid" style={{ padding: 15 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{t.title}</span>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, color: 'var(--pompeyo-naranja)' }}>
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
function TareasTutor({ tasks, setTasks, S, user, onReload }) {
  const [assignFor, setAssignFor] = useState(null);

  const pupilMap = new Map();
  tasks.forEach(t => { if (t.pupilObj && !pupilMap.has(t.pupilId)) pupilMap.set(t.pupilId, t.pupilObj); });
  const pupils = [...pupilMap.values()];
  const reviewQueue = tasks.filter(t => t.status === 'revision');

  const approveTask = async (t) => {
    try {
      await apiCall('POST', `/api/tasks/${t.id}/approve`);
      setTasks(prev => prev.map(x => x.id === t.id ? { ...x, status: 'completada', progress: 100 } : x));
      toast('Tarea aprobada', { tone: 'success', icon: 'check', desc: `${t.pupilObj?.name} recibió +${t.reward} créditos` });
    } catch {
      toast('Error al aprobar', { tone: 'error', icon: 'x' });
    }
  };

  const rejectTask = async (t) => {
    try {
      await apiCall('PATCH', `/api/tasks/${t.id}`, { status: 'en-curso', progress: 80 });
      setTasks(prev => prev.map(x => x.id === t.id ? { ...x, status: 'en-curso', progress: 80 } : x));
      toast('Devuelta al pupilo', { tone: 'warning', icon: 'x' });
    } catch {
      toast('Error', { tone: 'error', icon: 'x' });
    }
  };

  const allCombatants = S.combatants.filter(c => c.id !== 'you' && c.userId);

  return (
    <div className="nx-fade" style={{ display: 'grid', gap: 18 }}>
      {reviewQueue.length > 0 && (
        <Panel kicker="Requiere tu acción" title="Cola de Revisión" icon="bell"
          right={<Chip tone="orange">{reviewQueue.length} pendientes</Chip>}>
          <div style={{ display: 'grid', gap: 10 }}>
            {reviewQueue.map(t => (
              <div key={t.id} className="nx-panel solid" style={{ padding: 13, display: 'flex', alignItems: 'center', gap: 12 }}>
                {t.pupilObj && <Avatar c={t.pupilObj} size={36} />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{t.title}</div>
                  <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)' }}>
                    {t.pupilObj?.name ?? '—'} · completó al 100%
                  </div>
                </div>
                <Btn sm icon="x" onClick={() => rejectTask(t)}>Rechazar</Btn>
                <Btn sm icon="check" onClick={() => approveTask(t)}
                  style={{ background: 'var(--green-500)', borderColor: 'var(--green-500)', color: '#04210f' }}>
                  Aprobar
                </Btn>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel kicker="Pupilos a cargo" title="Mis Pupilos" icon="roster"
        right={
          <Btn sm icon="plus" kind="accent" onClick={() => setAssignFor(allCombatants[0] ?? null)}>
            Asignar tarea
          </Btn>
        }>
        {pupils.length === 0 && <Empty label="Sin tareas asignadas — usa el botón para crear la primera" />}
        <div style={{ display: 'grid', gap: 14 }}>
          {pupils.map(p => {
            const ts = tasks.filter(t => t.pupilId === p.userId);
            const avg = ts.length ? Math.round(ts.reduce((a, t) => a + t.progress, 0) / ts.length) : 0;
            return (
              <div key={p.userId} className="nx-panel solid" style={{ padding: 15 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar c={p} size={42} ring />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</span>
                      <TierBadge tier={p.tier} sm />
                    </div>
                    <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)', marginTop: 2 }}>
                      {ts.length} tareas · avance medio {avg}%
                    </div>
                  </div>
                  <Btn kind="accent" sm icon="plus" onClick={() => setAssignFor(p)}>Asignar</Btn>
                </div>
                {ts.length > 0 && (
                  <div style={{ display: 'grid', gap: 7, marginTop: 13 }}>
                    {ts.map(t => {
                      const st = TASK_STATUS[t.status] ?? TASK_STATUS.pendiente;
                      return (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 12, color: 'var(--txt-dim)', width: 170, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
                          <div className="nx-bar" style={{ flex: 1 }}><i style={{ width: `${t.progress}%`, background: st.color }} /></div>
                          <Chip tone={st.tone} style={{ width: 92, justifyContent: 'center' }}>{st.label}</Chip>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      <AssignModal
        pupil={assignFor}
        allCombatants={allCombatants}
        onClose={() => setAssignFor(null)}
        onCreated={(newTask) => { setTasks(prev => [...prev, newTask]); setAssignFor(null); }}
        user={user}
      />
    </div>
  );
}

function AssignModal({ pupil, allCombatants, onClose, onCreated, user }) {
  const empty = { title: '', detail: '', due_date: '', reward: 150, notify: true };
  const [f, setF] = useState(empty);
  const [selectedPupil, setSelectedPupil] = useState(pupil);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (pupil) { setF(empty); setSelectedPupil(pupil); }
  }, [pupil]);

  if (!pupil) return null;

  const submit = async () => {
    if (!f.title.trim()) { toast('Falta el título', { tone: 'error', icon: 'x' }); return; }
    if (!selectedPupil?.userId) { toast('Selecciona un pupilo', { tone: 'error', icon: 'x' }); return; }
    setSending(true);
    try {
      const data = await apiCall('POST', '/api/tasks', {
        pupil_id: selectedPupil.userId,
        title:    f.title,
        detail:   f.detail || null,
        due_date: f.due_date || null,
        reward:   +f.reward || 0,
      });
      onCreated(mapTask(data.task, user?.id));
      toast(f.notify ? `Tarea enviada a ${selectedPupil.name}` : 'Tarea creada', {
        tone: 'success', icon: f.notify ? 'bell' : 'check',
        desc: f.notify ? 'Pupilo notificado' : undefined,
      });
    } catch (e) {
      toast(e?.message ?? 'Error al crear la tarea', { tone: 'error', icon: 'x' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal open={!!pupil} onClose={onClose} kicker={`Para ${selectedPupil?.name ?? '—'}`} title="Asignar Tarea">
      <div style={{ display: 'grid', gap: 14 }}>
        {allCombatants.length > 1 && (
          <div>
            <label className="nx-label">Pupilo</label>
            <select className="nx-select" value={selectedPupil?.userId ?? ''}
              onChange={e => setSelectedPupil(allCombatants.find(c => c.userId === +e.target.value))}>
              {allCombatants.map(c => <option key={c.userId} value={c.userId}>{c.name} · @{c.handle}</option>)}
            </select>
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
            <input className="nx-input nx-data" type="number" value={f.reward} onChange={e => setF({ ...f, reward: e.target.value })} />
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', fontSize: 13, color: 'var(--txt-dim)' }}>
          <input type="checkbox" checked={f.notify} onChange={e => setF({ ...f, notify: e.target.checked })}
            style={{ accentColor: 'var(--pompeyo-naranja)', width: 16, height: 16 }} />
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
