import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './ui.jsx';
import { NX } from '../data/seed.js';

/* ============================================================
   NÉXUS — Combate RAID (varios jugadores vs 1 NPC jefe, cupos configurables)
   Controlador y estado 100% en el servidor (RaidCombatController) — este
   archivo es solo presentación + polling, sin lógica de combate propia,
   deliberadamente separado de PvpCombatScreen.jsx/NpcCombatScreen.jsx.
   ============================================================ */

const AUTH = () => ({ Accept: 'application/json', Authorization: `Bearer ${localStorage.getItem('nx-token')}` });
const apiGet = (path) => fetch(`/api${path}`, { headers: AUTH() }).then(r => r.json().then(d => (r.ok ? d : Promise.reject(d))));
const apiPost = (path, body) => fetch(`/api${path}`, {
  method: 'POST', headers: { ...AUTH(), 'Content-Type': 'application/json' },
  body: body !== undefined ? JSON.stringify(body) : undefined,
}).then(r => r.json().then(d => (r.ok ? d : Promise.reject(d))));

const mediaUrl = (path) => {
  if (!path) return null;
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:') || path.startsWith('blob:')) return path;
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (clean.startsWith('/storage/')) return clean;
  return `/storage${clean}`;
};

const FORMA_LABELS = ['Shii-Cho', 'Makashi', 'Soresu', 'Ataru', 'Shien/DjSo', 'Niman', 'Juyo/Vaapad'];
const formaLabel = (f) => f > 0 ? FORMA_LABELS[f - 1] : 'Universal';

function StatBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontSize: 8, color, fontFamily: 'var(--font-data)' }}>{label}</span>
        <span style={{ fontSize: 8, color, fontFamily: 'var(--font-data)' }}>{value}/{max}</span>
      </div>
      <div style={{ height: 6, background: `${color}22`, borderRadius: 3 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.3s ease' }} />
      </div>
    </div>
  );
}

/* ── COLA DE ESPERA (cupos configurables por el NPC jefe) ─── */
export function RaidQueueModal({ npcId, onClose, onStarted }) {
  const [raid, setRaid] = useState(null);
  const [error, setError] = useState('');
  const [leaving, setLeaving] = useState(false);
  const [togglingReady, setTogglingReady] = useState(false);
  const pollRef = useRef(null);

  const join = useCallback(async () => {
    try {
      const d = await apiPost(`/raid/join/${npcId}`, {});
      setRaid(d.raid);
    } catch (e) {
      setError(e?.error || e?.message || 'No se pudo unir a la cola.');
    }
  }, [npcId]);

  useEffect(() => { join(); }, [join]);

  useEffect(() => {
    if (!raid || raid.status !== 'esperando') return;
    pollRef.current = setInterval(async () => {
      try {
        const d = await apiGet(`/raid/${raid.id}`);
        setRaid(d.raid);
      } catch { /* ignore */ }
    }, 2500);
    return () => clearInterval(pollRef.current);
  }, [raid?.id, raid?.status]);

  useEffect(() => {
    if (raid?.status === 'activo') onStarted(raid.id);
  }, [raid?.status]);

  const leave = async () => {
    if (!raid) { onClose(); return; }
    setLeaving(true);
    try { await apiPost(`/raid/${raid.id}/leave`, {}); } catch { /* ignore */ }
    onClose();
  };

  const toggleReady = async () => {
    if (!raid || togglingReady) return;
    setTogglingReady(true);
    setError('');
    try {
      const d = await apiPost(`/raid/${raid.id}/ready`, {});
      setRaid(d.raid);
    } catch (e) {
      setError(e?.error || e?.message || 'No se pudo actualizar tu estado.');
    } finally {
      setTogglingReady(false);
    }
  };

  const cupos = raid?.cupos_totales ?? 4;
  const minimo = raid?.minimo_jugadores ?? 2;
  const jugadores = raid?.jugadores ?? [];
  const me = jugadores.find(j => j.es_yo);
  const listosCount = raid?.listos_count ?? 0;
  const puedeIniciar = jugadores.length >= minimo;

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9400, background: 'rgba(2,5,12,0.82)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div className="nx-panel solid nx-panel-glow" style={{ width: '100%', maxWidth: 520, padding: 24, textAlign: 'center' }}>
        <div className="nx-kicker" style={{ marginBottom: 6 }}>COMBATE RAID</div>
        <div className="nx-display" style={{ fontSize: 20, marginBottom: 4 }}>Esperando combatientes</div>
        <div style={{ fontSize: 12, color: 'var(--txt-dim)', marginBottom: 22 }}>
          Mínimo {minimo} jugadores — hasta {cupos} cupos. El combate arranca cuando todos marquen "Estoy listo".
        </div>

        {error && (
          <div style={{ color: '#ff6b6b', fontSize: 12, marginBottom: 16 }}>{error}</div>
        )}

        <div style={{
          display: 'grid', gridTemplateColumns: `repeat(${Math.min(cupos, 4)}, 1fr)`, gap: 10, marginBottom: 18,
        }}>
          {Array.from({ length: cupos }, (_, i) => i + 1).map(slot => {
            const jugador = jugadores.find(j => j.slot === slot);
            return (
              <div key={slot} style={{
                position: 'relative', aspectRatio: '1', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                border: `1.5px solid ${jugador ? (jugador.listo ? '#10b981' : 'var(--holo)') : 'var(--holo-line)'}`,
                background: jugador ? (jugador.listo ? 'rgba(16,185,129,0.10)' : 'color-mix(in srgb, var(--holo) 10%, transparent)') : 'rgba(255,255,255,0.02)',
              }}>
                {jugador ? (
                  <>
                    {jugador.listo && (
                      <span style={{ position: 'absolute', top: 4, right: 4, color: '#10b981' }}>
                        <Icon name="check" size={12} />
                      </span>
                    )}
                    <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', background: 'rgba(56,205,240,0.15)', display: 'grid', placeItems: 'center' }}>
                      {jugador.photo_url
                        ? <img src={jugador.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <Icon name="user" size={18} style={{ color: 'var(--holo)' }} />}
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--txt)', fontWeight: 600 }}>{jugador.name}</span>
                    <span style={{ fontSize: 8, color: jugador.listo ? '#10b981' : 'var(--txt-faint)', fontFamily: 'var(--font-data)', letterSpacing: '0.06em' }}>
                      {jugador.listo ? 'LISTO' : 'esperando'}
                    </span>
                  </>
                ) : (
                  <>
                    <Icon name="user" size={20} style={{ color: 'var(--txt-faint)', opacity: 0.4 }} />
                    <span style={{ fontSize: 9, color: 'var(--txt-faint)' }}>Vacío</span>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ fontSize: 11, color: 'var(--txt-faint)', marginBottom: 18 }}>
          {jugadores.length}/{cupos} combatientes · {listosCount} listo{listosCount === 1 ? '' : 's'}
          {!puedeIniciar && ` · faltan al menos ${minimo - jugadores.length} jugador${minimo - jugadores.length === 1 ? '' : 'es'} más`}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={leave} disabled={leaving} style={{
            padding: '9px 20px', borderRadius: 7, cursor: 'pointer',
            background: 'rgba(255,255,255,0.05)', border: '1px solid var(--holo-line)', color: 'var(--txt-dim)',
            fontFamily: 'var(--font-data)', fontSize: 11, letterSpacing: '0.1em',
          }}>
            {leaving ? '...' : 'ABANDONAR COLA'}
          </button>
          <button onClick={toggleReady} disabled={togglingReady || !me} style={{
            padding: '9px 24px', borderRadius: 7, cursor: 'pointer',
            background: me?.listo ? 'rgba(16,185,129,0.16)' : 'rgba(56,205,240,0.14)',
            border: `1px solid ${me?.listo ? 'rgba(16,185,129,0.5)' : 'var(--holo)'}`,
            color: me?.listo ? '#10b981' : 'var(--holo)',
            fontFamily: 'var(--font-data)', fontSize: 11, letterSpacing: '0.1em', fontWeight: 700,
            opacity: togglingReady ? 0.6 : 1,
          }}>
            {me?.listo ? '✓ LISTO (cancelar)' : 'ESTOY LISTO'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ── PICKER DE OBJETIVO (habilidades "self" — elige a cuál de los 4 afecta) ── */
function TargetPickerModal({ jugadores, onPick, onCancel }) {
  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9700, background: 'rgba(2,5,12,0.85)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onMouseDown={onCancel}>
      <div className="nx-panel solid nx-panel-glow" style={{ width: '100%', maxWidth: 420, padding: 20 }} onMouseDown={e => e.stopPropagation()}>
        <div className="nx-kicker" style={{ marginBottom: 4 }}>ELEGIR OBJETIVO</div>
        <div className="nx-display" style={{ fontSize: 15, marginBottom: 14 }}>¿A quién afecta esta habilidad?</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {jugadores.map(j => (
            <button key={j.user_id} onClick={() => onPick(j.user_id)} disabled={j.status !== 'activo'}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', textAlign: 'left',
                borderRadius: 8, cursor: j.status === 'activo' ? 'pointer' : 'not-allowed',
                border: '1px solid var(--holo-line)', background: 'rgba(255,255,255,0.03)',
                opacity: j.status === 'activo' ? 1 : 0.4,
              }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', background: 'rgba(56,205,240,0.15)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                {j.photo_url
                  ? <img src={j.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Icon name="user" size={14} style={{ color: 'var(--holo)' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt)' }}>{j.es_yo ? `${j.name} (tú)` : j.name}</div>
                <div style={{ fontSize: 9, color: 'var(--txt-faint)', fontFamily: 'var(--font-data)' }}>{j.hp}/{j.max_hp} VID</div>
              </div>
            </button>
          ))}
        </div>
        <button onClick={onCancel} style={{
          marginTop: 14, width: '100%', padding: '8px', borderRadius: 7, cursor: 'pointer',
          background: 'transparent', border: '1px solid var(--holo-line)', color: 'var(--txt-dim)',
          fontFamily: 'var(--font-data)', fontSize: 11, letterSpacing: '0.1em',
        }}>CANCELAR</button>
      </div>
    </div>,
    document.body
  );
}

/* ── COMBATE RAID ACTIVO ───────────────────────────────────── */
export default function RaidCombatScreen({ raidId, lugarImagen, onClose }) {
  const [raid, setRaid] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stancePicker, setStancePicker] = useState(false);
  const [pendingSelfHab, setPendingSelfHab] = useState(null); // {id} — a la espera de elegir objetivo
  const [logCollapsed, setLogCollapsed] = useState(false);
  const pollRef = useRef(null);
  const logRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const d = await apiGet(`/raid/${raidId}`);
      setRaid(d.raid);
    } catch (e) {
      setError(e?.error || e?.message || 'No se pudo cargar el combate.');
    }
  }, [raidId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!raid || raid.status !== 'activo') { clearInterval(pollRef.current); return; }
    pollRef.current = setInterval(load, 3000);
    return () => clearInterval(pollRef.current);
  }, [raid?.status, load]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [raid?.log]);

  if (!raid) {
    return createPortal(
      <div style={{ position: 'fixed', inset: 0, zIndex: 9500, background: 'rgba(2,5,12,0.9)', display: 'grid', placeItems: 'center' }}>
        <div className="nx-kicker" style={{ animation: 'nx-pulse 1.4s infinite' }}>CARGANDO COMBATE RAID...</div>
      </div>,
      document.body
    );
  }

  const me = raid.jugadores.find(j => j.es_yo);
  const isMyTurn = !!me?.es_mi_turno && raid.status === 'activo';
  const finished = raid.status === 'ganado' || raid.status === 'perdido';

  const doAction = async (payload) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const d = await apiPost(`/raid/${raid.id}/action`, payload);
      setRaid(d.raid);
    } catch (e) {
      setError(e?.error || e?.message || 'No se pudo realizar la acción.');
    } finally {
      setBusy(false);
      setStancePicker(false);
      setPendingSelfHab(null);
    }
  };

  const clickHabilidad = (hab) => {
    if (hab.objetivo === 'self') {
      setPendingSelfHab(hab);
    } else {
      doAction({ skill: String(hab.id) });
    }
  };

  /* Agrupa el log en tarjetas de ronda, usando el aviso "Ronda N — ..." como separador */
  const rounds = [];
  {
    let currentRonda = 1;
    (raid.log ?? []).forEach(entry => {
      const roundMsg = (entry.messages ?? []).find(m => /^Ronda \d+ —/.test(m));
      if (roundMsg) {
        const match = roundMsg.match(/^Ronda (\d+)/);
        currentRonda = match ? parseInt(match[1], 10) : currentRonda;
      }
      let group = rounds[rounds.length - 1];
      if (!group || group.ronda !== currentRonda) { group = { ronda: currentRonda, entries: [] }; rounds.push(group); }
      group.entries.push(entry);
    });
  }

  const actorLabel = (entry) => {
    if (entry.actor === 'npc') return raid.npc.nombre;
    if (entry.actor === 'sistema') return null;
    const j = raid.jugadores.find(j => j.user_id === entry.actor_id);
    return j ? (j.es_yo ? `${j.name} (tú)` : j.name) : 'Jugador';
  };
  const actorColor = (entry) => entry.actor === 'npc' ? 'rgba(255,45,69,0.85)' : entry.actor === 'sistema' ? 'rgba(150,200,255,0.6)' : 'rgba(56,205,240,0.85)';

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9500, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12,
    }}>
      <div style={{
        position: 'relative', width: '100%', maxWidth: 980, height: '100%', maxHeight: 720,
        borderRadius: 18, overflow: 'hidden', boxShadow: '0 0 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(56,205,240,0.18)',
      }}>
        {lugarImagen
          ? <img src={lugarImagen} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 30%, #2a0c14, #020810)' }} />}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(2,6,16,0.76)' }} />

        <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>

          {/* ── Barra superior: orden de turnos ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(4,9,20,0.6)', borderBottom: '1px solid rgba(56,205,240,0.16)' }}>
            <span className="nx-kicker" style={{ fontSize: 8, flexShrink: 0 }}>RONDA {raid.ronda}</span>
            <div style={{ display: 'flex', gap: 8, flex: 1, overflowX: 'auto' }}>
              {raid.turn_order.map((t, i) => {
                const active = i === raid.turn_index;
                const isNpc = t.type === 'npc';
                const j = isNpc ? null : raid.jugadores.find(jj => jj.user_id === t.user_id);
                const img = isNpc ? raid.npc.imagen_mini || raid.npc.imagen : j?.photo_url;
                const nombre = isNpc ? raid.npc.nombre : (j?.name ?? '?');
                const dead = isNpc ? raid.npc.hp <= 0 : (j && (j.hp <= 0 || j.status !== 'activo'));
                return (
                  <div key={i} title={nombre} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0,
                    opacity: dead ? 0.35 : 1,
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                      border: `2px solid ${active ? (isNpc ? '#ff2d45' : 'var(--holo)') : 'rgba(255,255,255,0.15)'}`,
                      boxShadow: active ? `0 0 12px ${isNpc ? '#ff2d45' : 'var(--holo)'}` : 'none',
                      background: isNpc ? 'rgba(255,45,69,0.15)' : 'rgba(56,205,240,0.15)', display: 'grid', placeItems: 'center',
                    }}>
                      {img ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name={isNpc ? 'flame' : 'user'} size={14} style={{ color: isNpc ? '#ff2d45' : 'var(--holo)' }} />}
                    </div>
                    <span style={{ fontSize: 7, color: active ? 'var(--txt)' : 'var(--txt-faint)', fontFamily: 'var(--font-data)', maxWidth: 42, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre}</span>
                  </div>
                );
              })}
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt-faint)', flexShrink: 0 }}>
              <Icon name="x" size={16} />
            </button>
          </div>

          {/* ── Centro: jefe + registro ── */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 10, padding: 12 }}>
            <div style={{ flex: '1 1 55%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div style={{
                width: 140, height: 140, borderRadius: 16, overflow: 'hidden', border: '2px solid rgba(255,45,69,0.4)',
                background: 'rgba(255,45,69,0.08)', display: 'grid', placeItems: 'center', boxShadow: '0 0 40px rgba(255,45,69,0.25)',
              }}>
                {raid.npc.imagen
                  ? <img src={raid.npc.imagen} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Icon name="flame" size={48} style={{ color: '#ff2d45', opacity: 0.6 }} />}
              </div>
              <div style={{ width: '100%', maxWidth: 320 }}>
                <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 16, color: '#fff', marginBottom: 8 }}>{raid.npc.nombre}</div>
                {raid.npc.max_escudo > 0 && <StatBar label="ESCUDO" value={raid.npc.escudo} max={raid.npc.max_escudo} color="#38cdf0" />}
                <StatBar label="VIDA" value={raid.npc.hp} max={raid.npc.max_hp} color="#ff2d45" />
              </div>
              {raid.es_turno_del_jefe && (
                <div style={{ fontSize: 11, color: '#ff6b6b', fontFamily: 'var(--font-data)', letterSpacing: '0.1em' }}>⚔ TURNO DEL JEFE</div>
              )}
            </div>

            {/* Registro */}
            <div style={{
              flex: '1 1 45%', display: logCollapsed ? 'none' : 'flex', flexDirection: 'column', minHeight: 0,
              background: 'rgba(4,9,20,0.55)', backdropFilter: 'blur(10px)', borderRadius: 10, border: '1px solid rgba(56,205,240,0.14)', overflow: 'hidden',
            }}>
              <div style={{ padding: '7px 10px', borderBottom: '1px solid rgba(56,205,240,0.12)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="tasks" size={12} style={{ color: 'var(--holo)' }} />
                <span style={{ fontSize: 8, color: 'rgba(150,200,255,0.6)', fontFamily: 'var(--font-data)', letterSpacing: '0.1em' }}>REGISTRO DE RONDAS</span>
              </div>
              <div ref={logRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {rounds.map(group => (
                  <div key={group.ronda} style={{ border: '1px solid rgba(56,205,240,0.16)', borderRadius: 8, background: 'rgba(56,205,240,0.035)', padding: '5px 6px' }}>
                    <div style={{ fontSize: 8, color: '#38cdf0', fontFamily: 'var(--font-data)', letterSpacing: '0.12em', fontWeight: 700, marginBottom: 3 }}>RONDA {group.ronda}</div>
                    {group.entries.map((entry, i) => {
                      const label = actorLabel(entry);
                      const color = actorColor(entry);
                      return (
                        <div key={i} style={{ marginBottom: 4 }}>
                          {label && <div style={{ fontSize: 7, color, fontFamily: 'var(--font-data)', fontWeight: 700, letterSpacing: '0.06em' }}>{label.toUpperCase()}</div>}
                          {entry.messages.map((m, mi) => (
                            <div key={mi} style={{ fontSize: 10, color: 'rgba(200,225,255,0.8)', fontFamily: 'var(--font-data)', lineHeight: 1.4, paddingLeft: label ? 0 : 6, borderLeft: label ? 'none' : '2px solid #38cdf0' }}>{m}</div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Barra inferior: vida/escudo de los jugadores (cantidad configurable por jefe) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(2, raid.jugadores.length)}, 1fr)`, gap: 8, padding: '10px 14px', background: 'rgba(4,9,20,0.6)', borderTop: '1px solid rgba(56,205,240,0.16)' }}>
            {raid.jugadores.map(j => (
              <div key={j.user_id} style={{
                display: 'flex', gap: 8, alignItems: 'center', padding: '6px 8px', borderRadius: 8,
                border: `1px solid ${j.es_mi_turno ? 'var(--holo)' : j.es_yo ? 'rgba(230,179,37,0.4)' : 'rgba(255,255,255,0.1)'}`,
                background: j.es_mi_turno ? 'color-mix(in srgb, var(--holo) 10%, transparent)' : 'rgba(255,255,255,0.02)',
                opacity: j.status !== 'activo' ? 0.4 : 1,
              }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'rgba(56,205,240,0.15)', display: 'grid', placeItems: 'center' }}>
                  {j.photo_url ? <img src={j.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="user" size={14} style={{ color: 'var(--holo)' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: j.es_yo ? 'var(--holocron-oro)' : '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {j.name}{j.status === 'huido' && ' (huyó)'}{j.status === 'derrotado' && ' (caído)'}
                  </div>
                  {j.max_escudo > 0 && <StatBar label="ESC" value={j.escudo} max={j.max_escudo} color="#38cdf0" />}
                  <StatBar label="VID" value={j.hp} max={j.max_hp} color={j.hp / j.max_hp > 0.5 ? '#10b981' : j.hp / j.max_hp > 0.25 ? '#E6B325' : '#ff2d45'} />
                </div>
              </div>
            ))}
          </div>

          {/* ── Barra de acciones ── */}
          {!finished && me && (
            <div style={{ padding: '10px 14px', background: 'rgba(4,9,20,0.7)', borderTop: '1px solid rgba(56,205,240,0.16)' }}>
              {error && <div style={{ color: '#ff6b6b', fontSize: 11, marginBottom: 8 }}>{error}</div>}
              {!isMyTurn ? (
                <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--txt-faint)', fontFamily: 'var(--font-data)', letterSpacing: '0.1em', padding: '10px 0' }}>
                  {me.status !== 'activo' ? 'Ya no participas activamente en este combate.' : 'Esperando el turno de otro combatiente...'}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 6 }}>
                    <span style={{ fontSize: 8, color: '#38cdf0', fontFamily: 'var(--font-data)' }}>FUERZA</span>
                    <div style={{ display: 'flex', gap: 2 }}>
                      {Array.from({ length: me.fuerza_max }, (_, i) => (
                        <div key={i} style={{ width: 8, height: 14, borderRadius: 2, background: i < me.fuerza ? '#38cdf0' : 'rgba(56,205,240,0.15)' }} />
                      ))}
                    </div>
                  </div>

                  <button onClick={() => doAction({ skill: 'unarmed' })} disabled={busy} style={actionBtnStyle('#ff7043')}>
                    <Icon name="sword" size={13} /> Atacar
                  </button>

                  {(me.habilidades ?? []).map(hab => {
                    const cd = me.cooldowns?.[String(hab.id)] ?? 0;
                    const noFuerza = me.fuerza < hab.costo_fuerza;
                    const disabled = busy || cd > 0 || noFuerza;
                    return (
                      <button key={hab.id} onClick={() => clickHabilidad(hab)} disabled={disabled}
                        title={hab.efecto} style={{ ...actionBtnStyle('#38cdf0'), opacity: disabled ? 0.4 : 1 }}>
                        <Icon name="zap" size={13} /> {hab.nombre} {cd > 0 ? `(CD ${cd})` : `⚡${hab.costo_fuerza}`}
                      </button>
                    );
                  })}

                  <button onClick={() => setStancePicker(true)} disabled={busy} style={actionBtnStyle('#a78bfa')}>
                    <Icon name="star" size={13} /> Forma ({formaLabel(me.current_forma)})
                  </button>

                  <button onClick={() => doAction({ skill: 'flee' })} disabled={busy} style={{ ...actionBtnStyle('#8aa0c0'), marginLeft: 'auto' }}>
                    <Icon name="logout" size={13} /> Huir
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Pantalla de fin ── */}
          {finished && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(2,5,12,0.9)', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 5,
            }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: raid.status === 'ganado' ? '#10b981' : '#ff6b6b' }}>
                {raid.status === 'ganado' ? '¡Victoria del grupo!' : 'El grupo ha sido derrotado'}
              </div>
              <button onClick={onClose} style={{
                padding: '10px 28px', borderRadius: 7, cursor: 'pointer',
                background: raid.status === 'ganado' ? 'rgba(16,185,129,0.18)' : 'rgba(255,45,69,0.14)',
                border: `1px solid ${raid.status === 'ganado' ? 'rgba(16,185,129,0.5)' : 'rgba(255,45,69,0.45)'}`,
                color: raid.status === 'ganado' ? '#10b981' : '#ff6b6b',
                fontFamily: 'var(--font-data)', fontSize: 11, letterSpacing: '0.12em',
              }}>CONTINUAR →</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Selector de forma ── */}
      {stancePicker && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9600, background: 'rgba(2,5,12,0.85)', display: 'grid', placeItems: 'center' }}
          onMouseDown={() => setStancePicker(false)}>
          <div className="nx-panel solid nx-panel-glow" style={{ padding: 18, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }} onMouseDown={e => e.stopPropagation()}>
            {NX.CLASSES.map((c, i) => (
              <button key={c.id} onClick={() => doAction({ skill: 'stance', forma: i + 1 })} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 10, borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${me?.current_forma === i + 1 ? c.accent : 'var(--holo-line)'}`,
                background: me?.current_forma === i + 1 ? `color-mix(in srgb, ${c.accent} 14%, transparent)` : 'rgba(255,255,255,0.02)',
              }}>
                <img src={c.img} alt="" style={{ width: 34, height: 34, objectFit: 'contain' }} />
                <span style={{ fontSize: 9, color: c.accent, fontFamily: 'var(--font-data)' }}>{c.num}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Selector de objetivo para habilidad "self" ── */}
      {pendingSelfHab && (
        <TargetPickerModal
          jugadores={raid.jugadores}
          onCancel={() => setPendingSelfHab(null)}
          onPick={(targetUserId) => doAction({ skill: String(pendingSelfHab.id), target_user_id: targetUserId })}
        />
      )}
    </div>,
    document.body
  );
}

function actionBtnStyle(color) {
  return {
    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 7, cursor: 'pointer',
    background: `${color}18`, border: `1px solid ${color}55`, color,
    fontFamily: 'var(--font-data)', fontSize: 11, letterSpacing: '0.04em',
  };
}
