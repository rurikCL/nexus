import { useState, useEffect, useRef } from 'react';
import { NX } from '../data/seed.js';
import { Icon, Panel, Btn, Chip, Avatar, TierBadge, Stat, MedalIcon, Modal, toast, ImageSlot } from '../components/ui.jsx';
import { Empty } from './Comando.jsx';

/* NÉXUS — Tareas tutor↔pupilo */

const TASK_STATUS = {
  pendiente:  { label: 'Pendiente', tone: 'dim',    color: 'var(--txt-dim)' },
  'en-curso': { label: 'En curso',  tone: '',       color: 'var(--holo)' },
  revision:   { label: 'En revisión', tone: 'orange', color: 'var(--pompeyo-naranja)' },
  completada: { label: 'Completada', tone: 'green',  color: 'var(--green-500)' },
};

export function TareasView({ S }) {
  return S.role === 'tutor' ? <TareasTutor S={S} /> : <TareasPupilo S={S} />;
}

/* -------- Vista PUPILO -------- */
export function TareasPupilo({ S }) {
  const tasks = S.tasks.filter(t => t.pupil === 'you');
  const tutor = NX.byId('c4');
  const active = tasks.filter(t => t.status === 'en-curso' || t.status === 'pendiente');
  const done = tasks.filter(t => t.status === 'completada' || t.status === 'revision');

  return (
    <div className="nx-fade" style={{ display: 'grid', gap: 18 }}>
      <Panel kicker="Tu tutor asignado" title="Plan de Entrenamiento" icon="tasks"
        right={<div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><Avatar c={tutor} size={32} /><div><div style={{ fontSize: 13, fontWeight: 600 }}>{tutor.name}</div><div className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)' }}>Oráculo · Leyenda</div></div></div>}>
        <div style={{ display: 'grid', gap: 12 }}>
          {active.length === 0 && <Empty label="Sin Tareas Activas" />}
          {active.map((t) => <PupilTaskCard key={t.id} t={t} S={S} />)}
        </div>
      </Panel>

      {done.length > 0 && (
        <Panel kicker="Historial" title="Enviadas y Completadas" icon="check">
          <div style={{ display: 'grid', gap: 12 }}>
            {done.map((t) => <PupilTaskCard key={t.id} t={t} S={S} />)}
          </div>
        </Panel>
      )}
    </div>
  );
}

export function PupilTaskCard({ t, S }) {
  const st = TASK_STATUS[t.status];
  const setProg = (v) => S.updateTask(t.id, { progress: v, status: v > 0 && t.status === 'pendiente' ? 'en-curso' : t.status });
  return (
    <div className="nx-panel solid" style={{ padding: 15 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{t.title}</span>
            <Chip tone={st.tone}>{st.label}</Chip>
          </div>
          <p style={{ fontSize: 13, color: 'var(--txt-dim)', margin: '6px 0 0' }}>{t.detail}</p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <Chip tone="gold" icon="coin">+{t.reward}</Chip>
          <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)', marginTop: 6 }}><Icon name="clock" size={10} style={{ verticalAlign: -1 }} /> {t.due}</div>
        </div>
      </div>

      {t.status === 'completada' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, color: 'var(--green-500)' }}>
          <Icon name="check" size={15} /><span className="nx-data" style={{ fontSize: 12 }}>Aprobada · +{t.reward} créditos abonados</span>
        </div>
      ) : t.status === 'revision' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, color: 'var(--pompeyo-naranja)' }}>
          <Icon name="clock" size={15} /><span className="nx-data" style={{ fontSize: 12 }}>Esperando aprobación del tutor</span>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
            <input type="range" min="0" max="100" step="5" value={t.progress} onChange={(e) => setProg(+e.target.value)}
              style={{ flex: 1, accentColor: 'var(--holo)' }} />
            <span className="nx-num" style={{ fontSize: 15, width: 44, textAlign: 'right', color: 'var(--holo)' }}>{t.progress}%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <Btn kind={t.progress === 100 ? 'accent' : 'ghost'} icon="upload" sm disabled={t.progress < 100}
              onClick={() => { S.updateTask(t.id, { status: 'revision' }); toast('Avance enviado', { tone: 'success', icon: 'check', desc: 'Tu tutor revisará el progreso' }); }}>
              Enviar a revisión
            </Btn>
          </div>
        </>
      )}
    </div>
  );
}

/* -------- Vista TUTOR -------- */
export function TareasTutor({ S }) {
  const [assignFor, setAssignFor] = useState(null);
  const pupils = ['you', 'c6', 'c7', 'c8'].map(NX.byId);
  const tasksByPupil = (id) => S.tasks.filter(t => t.pupil === id);
  const reviewQueue = S.tasks.filter(t => t.status === 'revision');

  return (
    <div className="nx-fade" style={{ display: 'grid', gap: 18 }}>
      {reviewQueue.length > 0 && (
        <Panel kicker="Requiere tu acción" title="Cola de Revisión" icon="bell"
          right={<Chip tone="orange">{reviewQueue.length} pendientes</Chip>}>
          <div style={{ display: 'grid', gap: 10 }}>
            {reviewQueue.map((t) => {
              const p = NX.byId(t.pupil);
              return (
                <div key={t.id} className="nx-panel solid" style={{ padding: 13, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar c={p} size={36} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{t.title}</div>
                    <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)' }}>{p.name} · completó al 100%</div>
                  </div>
                  <Btn sm icon="x" onClick={() => { S.updateTask(t.id, { status: 'en-curso', progress: 80 }); toast('Devuelta al pupilo', { tone: 'warning', icon: 'x' }); }}>Rechazar</Btn>
                  <Btn kind="green" sm icon="check" onClick={() => { S.approveTask(t.id); toast('Tarea aprobada', { tone: 'success', icon: 'check', desc: `${p.name} recibió +${t.reward} créditos` }); }} style={{ background: 'var(--green-500)', borderColor: 'var(--green-500)', color: '#04210f' }}>Aprobar</Btn>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      <Panel kicker="4 pupilos a cargo" title="Mis Pupilos" icon="roster">
        <div style={{ display: 'grid', gap: 14 }}>
          {pupils.map((p) => {
            const ts = tasksByPupil(p.id);
            const avg = ts.length ? Math.round(ts.reduce((a, t) => a + t.progress, 0) / ts.length) : 0;
            return (
              <div key={p.id} className="nx-panel solid" style={{ padding: 15 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar c={p} size={42} ring />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</span>
                      <TierBadge tier={p.tier} sm />
                    </div>
                    <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)', marginTop: 2 }}>{ts.length} tareas · avance medio {avg}%</div>
                  </div>
                  <Btn kind="accent" sm icon="plus" onClick={() => setAssignFor(p)}>Asignar</Btn>
                </div>
                {ts.length > 0 && (
                  <div style={{ display: 'grid', gap: 7, marginTop: 13 }}>
                    {ts.map((t) => {
                      const st = TASK_STATUS[t.status];
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

      <AssignModal pupil={assignFor} onClose={() => setAssignFor(null)} S={S} />
    </div>
  );
}

export function AssignModal({ pupil, onClose, S }) {
  const [f, setF] = useState({ title: '', detail: '', due: '', reward: 150, notify: true });
  useEffect(() => { if (pupil) setF({ title: '', detail: '', due: '', reward: 150, notify: true }); }, [pupil]);
  if (!pupil) return null;
  const submit = () => {
    if (!f.title.trim()) { toast('Falta el título', { tone: 'error', icon: 'x' }); return; }
    S.addTask({ pupil: pupil.id, tutor: 'c4', title: f.title, detail: f.detail || '—', due: f.due || '—', reward: +f.reward, progress: 0, status: 'pendiente' });
    onClose();
    toast(f.notify ? `Tarea enviada a ${pupil.name}` : 'Tarea creada', { tone: 'success', icon: f.notify ? 'bell' : 'check', desc: f.notify ? 'Pupilo notificado' : undefined });
  };
  return (
    <Modal open={!!pupil} onClose={onClose} kicker={`Para ${pupil.name}`} title="Asignar Tarea">
      <div style={{ display: 'grid', gap: 14 }}>
        <div><label className="nx-label">Título de la tarea *</label><input className="nx-input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Ej: 3 sesiones de footwork" autoFocus /></div>
        <div><label className="nx-label">Instrucciones</label><textarea className="nx-textarea" value={f.detail} onChange={(e) => setF({ ...f, detail: e.target.value })} placeholder="Detalle de lo que debe lograr..." /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div><label className="nx-label">Fecha límite</label><input className="nx-input" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} placeholder="DD/MM" /></div>
          <div><label className="nx-label">Recompensa (créditos)</label><input className="nx-input nx-data" type="number" value={f.reward} onChange={(e) => setF({ ...f, reward: e.target.value })} /></div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', fontSize: 13, color: 'var(--txt-dim)' }}>
          <input type="checkbox" checked={f.notify} onChange={(e) => setF({ ...f, notify: e.target.checked })} style={{ accentColor: 'var(--pompeyo-naranja)', width: 16, height: 16 }} />
          <Icon name="bell" size={14} /> Notificar al pupilo al asignar
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn kind="accent" icon="check" onClick={submit}>Asignar tarea</Btn>
        </div>
      </div>
    </Modal>
  );
}

