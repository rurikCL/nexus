import { useState, useEffect, useRef, useCallback } from 'react';
import { NX } from '../data/seed.js';
import { Icon, Panel, Btn, Chip, Avatar, TierBadge, Stat, MedalIcon, Modal, toast, ImageSlot } from '../components/ui.jsx';

/* NÉXUS — Entrenamiento: calendario de asistencia + bitácora del día */

const NX_FOCUS = ['Técnica', 'Cardio', 'Sparring', 'Footwork', 'Fuerza', 'Estudio', 'Recuperación'];
const NX_TAGS  = ['técnica', 'cardio', 'sparring', 'defensa', 'estudio', 'fuerza', 'flexibilidad'];

function getNxToday() {
  const today = new Date();
  return today.getDate();
}
function getCurrentMonth() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
}

async function apiGet(path) {
  const res = await fetch(`/api${path}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${localStorage.getItem('nx-token')}` },
  });
  return res.ok ? res.json() : Promise.reject();
}

async function apiPatch(path, body) {
  const res = await fetch(`/api${path}`, {
    method: 'PATCH',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('nx-token')}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message ?? `Error ${res.status}`);
  return json;
}

export function TrainingView({ S, user, go }) {
  const NX_TODAY = getNxToday();
  const month = getCurrentMonth();
  const [yr, mo] = month.split('-').map(Number);

  const [sel, setSel] = useState(NX_TODAY);
  const [sesionesDisp, setSesionesDisp] = useState([]); // [{id, fecha, titulo, closed}]
  const [loggedByDay, setLoggedByDay] = useState({});   // { [día]: training_day real del backend }

  // Carga la asistencia/bitácora real (creada por auto-asistencia o por el escaneo QR del encargado)
  const loadLog = useCallback(() => {
    apiGet(`/training?month=${month}`)
      .then(r => {
        const byDay = {};
        Object.entries(r.logged ?? {}).forEach(([dateStr, rec]) => {
          byDay[parseInt(dateStr.split('-')[2], 10)] = rec;
        });
        setLoggedByDay(byDay);
      })
      .catch(() => {});
  }, [month]);

  useEffect(() => { loadLog(); }, [loadLog]);

  const days = Object.keys(loggedByDay).map(Number);
  const creditsEarned = days.length * 75;

  // racha de asistencia (días consecutivos terminando en el último marcado)
  const streak = (() => {
    const sorted = [...days].sort((a, b) => b - a);
    if (!sorted.length) return 0;
    let s = 1; for (let i = 1; i < sorted.length; i++) { if (sorted[i] === sorted[i - 1] - 1) s++; else break; }
    return s;
  })();

  // Cargar sesiones disponibles del mes
  useEffect(() => {
    apiGet(`/sesiones/disponibles?month=${month}`)
      .then(r => setSesionesDisp(r.sesiones ?? []))
      .catch(() => {});
  }, [month]);

  // Map día → sesion
  const sesionPorDia = {};
  sesionesDisp.forEach(s => {
    const d = parseInt(s.fecha.split('-')[2], 10);
    sesionPorDia[d] = s;
  });

  // grid del mes
  const firstDow  = new Date(yr, mo - 1, 1).getDay();
  const daysInMonth = new Date(yr, mo, 0).getDate();
  const offset = (firstDow + 6) % 7;
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const entry = loggedByDay[sel];
  const sesionSel = sesionPorDia[sel];
  const dateKey = (d) => `${yr}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  return (
    <div className="nx-fade nx-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: 18, alignItems: 'start' }}>
      {/* Calendario */}
      <div style={{ display: 'grid', gap: 18 }}>
        <Panel kicker={month} title="Registro de Asistencia" icon="calendar"
          right={<Chip tone="green" icon="flame">{streak} días seguidos</Chip>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
              <div key={i} className="nx-data" style={{ textAlign: 'center', fontSize: 10, color: 'var(--txt-faint)', letterSpacing: '0.1em' }}>{d}</div>
            ))}
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const isLogged   = !!loggedByDay[d];
              const isToday    = d === NX_TODAY;
              const isFuture   = d > NX_TODAY;
              const isSel      = d === sel;
              const hasSesion  = !!sesionPorDia[d];
              const sesion     = sesionPorDia[d];
              const isClosed   = sesion?.closed;
              const disabled   = isFuture || (!hasSesion);
              return (
                <button key={i} disabled={disabled} onClick={() => setSel(d)}
                  title={hasSesion ? sesion.titulo : undefined}
                  style={{
                    aspectRatio: '1', borderRadius: 'var(--radius-md)', cursor: disabled ? 'not-allowed' : 'pointer',
                    border: isSel ? '1.5px solid var(--holo)' : `1px solid ${hasSesion ? 'color-mix(in srgb, var(--holo) 35%, transparent)' : 'var(--holo-line)'}`,
                    background: isLogged
                      ? 'color-mix(in srgb, var(--green-500) 22%, transparent)'
                      : hasSesion ? 'rgba(56,205,240,0.06)' : 'rgba(255,255,255,0.02)',
                    color: disabled ? 'var(--txt-faint)' : 'var(--txt)', position: 'relative',
                    display: 'grid', placeItems: 'center', opacity: disabled ? 0.3 : 1,
                    boxShadow: isSel ? '0 0 16px -6px var(--holo)' : 'none', transition: 'all .15s',
                  }}>
                  <span className="nx-num" style={{ fontSize: 14 }}>{d}</span>
                  {isLogged && <span style={{ position: 'absolute', bottom: 5, width: 5, height: 5, borderRadius: '50%', background: 'var(--green-500)', boxShadow: '0 0 6px var(--green-500)' }} />}
                  {hasSesion && !isLogged && <span style={{ position: 'absolute', bottom: 5, width: 5, height: 5, borderRadius: '50%', background: 'var(--holo)', boxShadow: '0 0 6px var(--holo)', opacity: isClosed ? 0.4 : 1 }} />}
                  {isToday && !isLogged && <span style={{ position: 'absolute', top: 3, right: 3, width: 5, height: 5, borderRadius: '50%', border: '1.5px solid var(--holocron-naranja)' }} />}
                </button>
              );
            })}
          </div>
          <hr className="nx-divider" style={{ margin: '16px 0' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {[
              { k: 'Días', v: days.length, icon: 'calendar', tone: 'var(--holo)' },
              { k: 'Racha', v: streak, icon: 'flame', tone: 'var(--green-500)' },
              { k: 'Créditos', v: NX.fmtCLP(creditsEarned), icon: 'coin', tone: 'var(--holocron-oro)' },
            ].map((s) => (
              <div key={s.k} style={{ textAlign: 'center' }}>
                <span style={{ color: s.tone }}><Icon name={s.icon} size={16} /></span>
                <div className="nx-num" style={{ fontSize: 18, color: s.tone, marginTop: 3 }}>{s.v}</div>
                <div className="nx-kicker" style={{ fontSize: 9 }}>{s.k}</div>
              </div>
            ))}
          </div>
        </Panel>

        <div className="nx-panel" style={{ padding: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ color: 'var(--holo)' }}><Icon name="zap" size={18} /></span>
          <div style={{ fontSize: 12, color: 'var(--txt-dim)' }}>
            El encargado registra tu asistencia escaneando tu <b style={{ color: 'var(--holo)' }}>código QR</b> en la página Sesiones. Una vez marcada, tu bitácora de ese día se desbloquea aquí.
          </div>
        </div>
      </div>

      {/* Bitácora del día */}
      <Panel icon="edit" kicker={`Día ${sel} · ${month}`} title={sesionSel ? sesionSel.titulo : 'Bitácora de Entrenamiento'}
        right={entry ? <Chip tone="green" icon="check">Asistencia registrada</Chip> : sesionSel ? <Chip tone="dim">Sesión programada</Chip> : null}>
        {!sesionSel ? (
          <div style={{ textAlign: 'center', padding: '34px 18px' }}>
            <div style={{ color: 'var(--txt-faint)', display: 'flex', justifyContent: 'center', marginBottom: 14 }}><Icon name="calendar" size={36} /></div>
            <div className="nx-display" style={{ fontSize: 16, marginBottom: 6 }}>Sin sesión programada</div>
            <p style={{ fontSize: 13, color: 'var(--txt-dim)', maxWidth: 320, margin: '0 auto' }}>
              Este día no tiene sesión de entrenamiento. Los encargados publicarán el calendario de sesiones.
            </p>
          </div>
        ) : !entry ? (
          <div style={{ textAlign: 'center', padding: '34px 18px' }}>
            <div style={{ color: 'var(--txt-faint)', display: 'flex', justifyContent: 'center', marginBottom: 14 }}><Icon name="camera" size={36} /></div>
            <div className="nx-display" style={{ fontSize: 16, marginBottom: 6 }}>Bitácora bloqueada</div>
            <p style={{ fontSize: 13, color: 'var(--txt-dim)', maxWidth: 320, margin: '0 auto 18px' }}>
              {sesionSel.closed
                ? 'Esta sesión ya está cerrada y no registra asistencia.'
                : 'Aún no tienes asistencia registrada. Pide al encargado que escanee tu código QR (widget «Mi Código QR» en Comando) en la página Sesiones.'}
            </p>
            {!sesionSel.closed && go && (
              <Btn kind="accent" icon="camera" onClick={() => go('sesiones')} style={{ margin: '0 auto' }}>
                Ir a Sesiones
              </Btn>
            )}
          </div>
        ) : (
          <BitacoraEditor S={S} day={sel} dateStr={dateKey(sel)} entry={entry}
            onSaved={(updated) => setLoggedByDay(p => ({ ...p, [sel]: updated }))}
          />
        )}
      </Panel>
    </div>
  );
}

export function BitacoraEditor({ S, day, dateStr, entry, onSaved }) {
  const [form, setForm] = useState({
    focus:  entry.focus  ?? NX_FOCUS[0],
    effort: entry.effort ?? 6,
    note:   entry.note   ?? '',
    tags:   entry.tags   ?? [],
    tasks:  entry.tasks  ?? [],
  });
  const [saving, setSaving] = useState(false);
  const upd = (patch) => setForm(f => ({ ...f, ...patch }));

  useEffect(() => {
    setForm({
      focus:  entry.focus  ?? NX_FOCUS[0],
      effort: entry.effort ?? 6,
      note:   entry.note   ?? '',
      tags:   entry.tags   ?? [],
      tasks:  entry.tasks  ?? [],
    });
  }, [entry.id]);

  const myTasks = S.tasks.filter(t => t.pupil === 'you');

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiPatch(`/training/${dateStr}`, {
        focus: form.focus, effort: form.effort, note: form.note, tags: form.tags,
      });
      toast('Bitácora guardada', { tone: 'success', icon: 'check', desc: `Día ${day} actualizado` });
      onSaved?.(res.training_day ?? { ...entry, ...form });
    } catch (err) {
      toast(err.message, { tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label className="nx-label">Foco de la sesión</label>
          <select className="nx-select" value={form.focus} onChange={(e) => upd({ focus: e.target.value })}>
            {NX_FOCUS.map((f) => <option key={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className="nx-label">Esfuerzo · {form.effort}/10</label>
          <input type="range" min="1" max="10" value={form.effort} onChange={(e) => upd({ effort: +e.target.value })}
            style={{ width: '100%', accentColor: 'var(--holocron-naranja)', marginTop: 8 }} />
        </div>
      </div>

      <div>
        <label className="nx-label">¿Qué hiciste hoy?</label>
        <textarea className="nx-textarea" value={form.note} placeholder="Describe la sesión, qué funcionó, qué corregir..."
          onChange={(e) => upd({ note: e.target.value })} />
      </div>

      <div>
        <label className="nx-label">Etiquetas</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {NX_TAGS.map((tag) => {
            const on = form.tags.includes(tag);
            return (
              <button key={tag} onClick={() => upd({ tags: on ? form.tags.filter(t => t !== tag) : [...form.tags, tag] })}
                className={`nx-chip ${on ? '' : 'dim'}`} style={{ cursor: 'pointer', borderColor: on ? 'var(--holo)' : undefined }}>
                {on && <Icon name="check" size={10} />}{tag}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="nx-label">Evidencia · fotos y video</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          <ImageSlot id={`nx-train-${day}-1`} style={{ width: '100%', aspectRatio: '1', display: 'block' }} shape="rounded" radius="8" placeholder="Foto"></ImageSlot>
          <ImageSlot id={`nx-train-${day}-2`} style={{ width: '100%', aspectRatio: '1', display: 'block' }} shape="rounded" radius="8" placeholder="Foto"></ImageSlot>
          <div className="nx-panel solid" style={{ aspectRatio: '1', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--txt-dim)' }}
            onClick={() => toast('Subir video', { tone: 'info', icon: 'video', desc: 'Arrastra un clip de la sesión' })}>
            <div style={{ textAlign: 'center' }}>
              <Icon name="video" size={22} />
              <div className="nx-data" style={{ fontSize: 10, marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>+ Video</div>
            </div>
          </div>
        </div>
      </div>

      {myTasks.length > 0 && (
        <div>
          <label className="nx-label">Vincular tareas trabajadas</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {myTasks.map((t) => {
              const on = form.tasks.includes(t.id);
              return (
                <button key={t.id} onClick={() => upd({ tasks: on ? form.tasks.filter(x => x !== t.id) : [...form.tasks, t.id] })}
                  className={`nx-chip ${on ? 'orange' : 'dim'}`} style={{ cursor: 'pointer' }}>
                  <Icon name="tasks" size={10} />{t.title}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn kind="accent" icon="check" onClick={save} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar bitácora'}
        </Btn>
      </div>
    </div>
  );
}

