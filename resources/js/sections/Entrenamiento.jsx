import { useState, useEffect, useRef } from 'react';
import { NX } from '../data/seed.js';
import { Icon, Panel, Btn, Chip, Avatar, TierBadge, Stat, MedalIcon, Modal, toast, ImageSlot } from '../components/ui.jsx';

/* NÉXUS — Entrenamiento: calendario de asistencia + bitácora del día */

const NX_TODAY = 11; // 11 de Junio 2026
const NX_FOCUS = ['Técnica', 'Cardio', 'Sparring', 'Footwork', 'Fuerza', 'Estudio', 'Recuperación'];
const NX_TAGS = ['técnica', 'cardio', 'sparring', 'defensa', 'estudio', 'fuerza', 'flexibilidad'];

export function TrainingView({ S }) {
  const [sel, setSel] = useState(NX_TODAY);
  const logged = S.training.logged;
  const days = Object.keys(logged).map(Number);
  const creditsEarned = days.length * S.training.creditsPerSession;

  // racha de asistencia (días consecutivos terminando en el último marcado)
  const streak = (() => {
    const sorted = [...days].sort((a, b) => b - a);
    if (!sorted.length) return 0;
    let s = 1; for (let i = 1; i < sorted.length; i++) { if (sorted[i] === sorted[i - 1] - 1) s++; else break; }
    return s;
  })();

  // grid del mes
  const firstDow = new Date(2026, 5, 1).getDay(); // 0=Dom
  const daysInMonth = 30;
  const offset = (firstDow + 6) % 7; // semana inicia lunes
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const entry = logged[sel];

  return (
    <div className="nx-fade nx-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: 18, alignItems: 'start' }}>
      {/* Calendario */}
      <div style={{ display: 'grid', gap: 18 }}>
        <Panel kicker={S.training.month} title="Registro de Asistencia" icon="calendar"
          right={<Chip tone="green" icon="flame">{streak} días seguidos</Chip>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
              <div key={i} className="nx-data" style={{ textAlign: 'center', fontSize: 10, color: 'var(--txt-faint)', letterSpacing: '0.1em' }}>{d}</div>
            ))}
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const isLogged = !!logged[d];
              const isToday = d === NX_TODAY;
              const isFuture = d > NX_TODAY;
              const isSel = d === sel;
              return (
                <button key={i} disabled={isFuture} onClick={() => setSel(d)}
                  style={{
                    aspectRatio: '1', borderRadius: 'var(--radius-md)', cursor: isFuture ? 'not-allowed' : 'pointer',
                    border: isSel ? '1.5px solid var(--holo)' : '1px solid var(--holo-line)',
                    background: isLogged ? 'color-mix(in srgb, var(--green-500) 22%, transparent)' : 'rgba(255,255,255,0.02)',
                    color: isFuture ? 'var(--txt-faint)' : 'var(--txt)', position: 'relative',
                    display: 'grid', placeItems: 'center', opacity: isFuture ? 0.35 : 1,
                    boxShadow: isSel ? '0 0 16px -6px var(--holo)' : 'none', transition: 'all .15s',
                  }}>
                  <span className="nx-num" style={{ fontSize: 14 }}>{d}</span>
                  {isLogged && <span style={{ position: 'absolute', bottom: 5, width: 5, height: 5, borderRadius: '50%', background: 'var(--green-500)', boxShadow: '0 0 6px var(--green-500)' }} />}
                  {isToday && !isLogged && <span style={{ position: 'absolute', top: 4, right: 4, width: 6, height: 6, borderRadius: '50%', border: '1.5px solid var(--pompeyo-naranja)' }} />}
                </button>
              );
            })}
          </div>
          <hr className="nx-divider" style={{ margin: '16px 0' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {[
              { k: 'Días', v: days.length, icon: 'calendar', tone: 'var(--holo)' },
              { k: 'Racha', v: streak, icon: 'flame', tone: 'var(--green-500)' },
              { k: 'Créditos', v: NX.fmtCLP(creditsEarned), icon: 'coin', tone: 'var(--pompeyo-oro)' },
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
            Marca un día para ganar <b style={{ color: 'var(--pompeyo-oro)' }}>+{S.training.creditsPerSession} créditos</b> y desbloquear su bitácora.
          </div>
        </div>
      </div>

      {/* Bitácora del día */}
      <Panel icon="edit" kicker={`Día ${sel} · ${S.training.month}`} title="Bitácora de Entrenamiento"
        right={entry ? <Chip tone="green" icon="check">Asistencia registrada</Chip> : null}>
        {!entry ? (
          <div style={{ textAlign: 'center', padding: '34px 18px' }}>
            <div style={{ color: 'var(--txt-faint)', display: 'flex', justifyContent: 'center', marginBottom: 14 }}><Icon name="calendar" size={36} /></div>
            <div className="nx-display" style={{ fontSize: 16, marginBottom: 6 }}>Día sin marcar</div>
            <p style={{ fontSize: 13, color: 'var(--txt-dim)', maxWidth: 320, margin: '0 auto 18px' }}>
              {sel > NX_TODAY ? 'Este día aún no llega.' : 'Marca tu asistencia para abrir la bitácora y registrar lo que hiciste.'}
            </p>
            {sel <= NX_TODAY && (
              <Btn kind="accent" icon="check" onClick={() => { S.logDay(sel); toast('Asistencia registrada', { tone: 'success', icon: 'check', desc: `+${S.training.creditsPerSession} créditos · bitácora desbloqueada` }); }} style={{ margin: '0 auto' }}>
                Marcar asistencia
              </Btn>
            )}
          </div>
        ) : (
          <BitacoraEditor S={S} day={sel} entry={entry} />
        )}
      </Panel>
    </div>
  );
}

export function BitacoraEditor({ S, day, entry }) {
  const upd = (patch) => S.updateLog(day, patch);
  const myTasks = S.tasks.filter(t => t.pupil === 'you');
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label className="nx-label">Foco de la sesión</label>
          <select className="nx-select" value={entry.focus} onChange={(e) => upd({ focus: e.target.value })}>
            {NX_FOCUS.map((f) => <option key={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className="nx-label">Esfuerzo · {entry.effort}/10</label>
          <input type="range" min="1" max="10" value={entry.effort} onChange={(e) => upd({ effort: +e.target.value })}
            style={{ width: '100%', accentColor: 'var(--pompeyo-naranja)', marginTop: 8 }} />
        </div>
      </div>

      <div>
        <label className="nx-label">¿Qué hiciste hoy?</label>
        <textarea className="nx-textarea" value={entry.note} placeholder="Describe la sesión, qué funcionó, qué corregir..."
          onChange={(e) => upd({ note: e.target.value })} />
      </div>

      <div>
        <label className="nx-label">Etiquetas</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {NX_TAGS.map((tag) => {
            const on = entry.tags.includes(tag);
            return (
              <button key={tag} onClick={() => upd({ tags: on ? entry.tags.filter(t => t !== tag) : [...entry.tags, tag] })}
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
              const on = (entry.tasks || []).includes(t.id);
              return (
                <button key={t.id} onClick={() => upd({ tasks: on ? entry.tasks.filter(x => x !== t.id) : [...(entry.tasks || []), t.id] })}
                  className={`nx-chip ${on ? 'orange' : 'dim'}`} style={{ cursor: 'pointer' }}>
                  <Icon name="tasks" size={10} />{t.title}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn kind="accent" icon="check" onClick={() => toast('Bitácora guardada', { tone: 'success', icon: 'check', desc: `Día ${day} actualizado` })}>Guardar bitácora</Btn>
      </div>
    </div>
  );
}

