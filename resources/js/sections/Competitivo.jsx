import { useState, useEffect, useCallback } from 'react';
import { Icon, Panel, Btn, Chip, Modal, toast } from '../components/ui.jsx';
import { Empty } from './Comando.jsx';

/* NÉXUS — Competitivo (torneos con árbol de eliminación) */

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

function apiCall(method, path, body) {
  const token = localStorage.getItem('nx-token');
  return fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }).then(r => r.json().then(d => (r.ok ? d : Promise.reject(d))));
}

const HASH_COLORS = ['#FF6B00', '#38cdf0', '#8b5cf6', '#10b981', '#ec4899', '#E6B325', '#3aa0ff'];
function hashColor(str) {
  let h = 5381;
  for (const c of (str ?? '?')) h = ((h << 5) + h) ^ c.charCodeAt(0);
  return HASH_COLORS[Math.abs(h) % HASH_COLORS.length];
}

const ESTADO_TORNEO = {
  inscripcion: { label: 'Inscripción abierta', tone: 'green' },
  en_curso:    { label: 'En curso',            tone: '' },
  finalizado:  { label: 'Finalizado',          tone: 'gold' },
};

function MiniAvatar({ name, photoUrl, size = 36, ring }) {
  const initials = (name ?? '?').trim().slice(0, 2).toUpperCase();
  const color = hashColor(name ?? '?');
  const ringStyle = ring
    ? { border: '2px solid var(--pompeyo-oro)', boxShadow: '0 0 12px -2px var(--pompeyo-oro)' }
    : { border: '1px solid var(--holo-line)' };
  if (photoUrl) {
    return (
      <img src={photoUrl} alt={name ?? ''} style={{
        width: size, height: size, borderRadius: '50%', objectFit: 'cover',
        flexShrink: 0, ...ringStyle,
      }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      display: 'grid', placeItems: 'center', fontSize: size * 0.38, fontWeight: 700, color: '#fff',
      background: `linear-gradient(135deg, ${color}, ${color}99)`,
      ...(ring ? ringStyle : {}),
    }}>
      {initials}
    </div>
  );
}

function Stepper({ value, onChange, min = 0, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button className="nx-btn nx-btn-sm" onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <span className="nx-num" style={{ fontSize: 18, minWidth: 24, textAlign: 'center', color }}>{value}</span>
      <button className="nx-btn nx-btn-sm" onClick={() => onChange(value + 1)}>+</button>
    </div>
  );
}

/* ===================== LISTA DE TORNEOS ===================== */

export function CompetitivoView({ S, user }) {
  const [torneos, setTorneos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  const reload = useCallback(() => {
    setLoading(true);
    apiCall('GET', '/api/torneos')
      .then(d => setTorneos(d.torneos ?? []))
      .catch(() => toast('Error al cargar torneos', { tone: 'error', icon: 'x' }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  if (selectedId) {
    return <TorneoDetalle torneoId={selectedId} user={user} onBack={() => { setSelectedId(null); reload(); }} />;
  }

  return (
    <div className="nx-fade" style={{ display: 'grid', gap: 18 }}>
      <Panel kicker="Liga competitiva" title="Torneos" icon="trophy"
        right={<Chip tone="dim" icon="trophy">{torneos.length} torneos</Chip>}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <span className="nx-data" style={{ color: 'var(--holo)', animation: 'nx-pulse 1.4s infinite' }}>CARGANDO...</span>
          </div>
        )}
        {!loading && torneos.length === 0 && <Empty label="Sin torneos activos" />}
        {!loading && torneos.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 14 }}>
            {torneos.map(t => <TorneoCard key={t.id} t={t} onClick={() => setSelectedId(t.id)} />)}
          </div>
        )}
      </Panel>
    </div>
  );
}

function TorneoCard({ t, onClick }) {
  const estado = ESTADO_TORNEO[t.estado] ?? ESTADO_TORNEO.inscripcion;
  const img = mediaUrl(t.imagen);
  return (
    <button onClick={onClick} className="nx-panel solid" style={{ padding: 0, overflow: 'hidden', textAlign: 'left', cursor: 'pointer' }}>
      <div style={{
        height: 120, position: 'relative',
        background: img ? `url(${img}) center/cover no-repeat` : 'linear-gradient(160deg, rgba(56,205,240,0.15), rgba(4,7,15,0.9))',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent, rgba(4,7,15,0.92))' }} />
        <div style={{ position: 'absolute', top: 8, right: 8 }}>
          <Chip tone={estado.tone}>{estado.label}</Chip>
        </div>
        <div style={{ position: 'absolute', bottom: 8, left: 10, right: 10 }}>
          <div className="nx-display" style={{ fontSize: 14, color: '#fff' }}>{t.nombre}</div>
        </div>
      </div>
      <div style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)' }}>Cupos {t.inscritos_count}/{t.cupos}</span>
        {t.ganador && <Chip tone="gold" icon="crown">{t.ganador.name}</Chip>}
      </div>
    </button>
  );
}

/* ===================== DETALLE DE TORNEO ===================== */

function TorneoDetalle({ torneoId, user, onBack }) {
  const [torneo, setTorneo]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('resumen');
  const [scoringCombate, setScoringCombate] = useState(null);
  const [starting, setStarting] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    apiCall('GET', `/api/torneos/${torneoId}`)
      .then(d => setTorneo(d.torneo))
      .catch(() => toast('Error al cargar el torneo', { tone: 'error', icon: 'x' }))
      .finally(() => setLoading(false));
  }, [torneoId]);

  useEffect(() => { reload(); }, [reload]);

  const isTutorUser = ADMIN_TIERS.includes(user?.tier);

  const iniciarTorneo = async () => {
    setStarting(true);
    try {
      await apiCall('POST', `/api/torneos/${torneoId}/iniciar`);
      toast('Árbol generado', { tone: 'success', icon: 'trophy' });
      reload();
    } catch (e) {
      toast(e?.message ?? 'Error al generar el árbol', { tone: 'error', icon: 'x' });
    }
    setStarting(false);
  };

  if (loading || !torneo) {
    return (
      <div className="nx-fade" style={{ textAlign: 'center', padding: 60 }}>
        <span className="nx-data" style={{ color: 'var(--holo)', animation: 'nx-pulse 1.4s infinite' }}>CARGANDO...</span>
      </div>
    );
  }

  const TABS = [
    { id: 'resumen',     label: 'Resumen',     icon: 'target' },
    { id: 'inscripcion', label: 'Inscripción', icon: 'tasks' },
    { id: 'arbol',       label: 'Árbol',       icon: 'crown' },
  ];

  return (
    <div className="nx-fade" style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button className="nx-btn" onClick={onBack} style={{ gap: 7, padding: '7px 12px' }}>
          <Icon name="chevron" size={14} style={{ transform: 'rotate(180deg)' }} />
          <span style={{ fontSize: 12 }}>Volver</span>
        </button>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div className="nx-kicker" style={{ fontSize: 9 }}>Competitivo</div>
          <div className="nx-display" style={{ fontSize: 16 }}>{torneo.nombre}</div>
        </div>
        {isTutorUser && torneo.estado === 'inscripcion' && (
          <Btn kind="accent" icon="crown" onClick={iniciarTorneo} disabled={starting || torneo.participantes.length < 2}>
            Generar Árbol
          </Btn>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className="nx-btn" style={{
            gap: 7,
            background: tab === t.id ? 'color-mix(in srgb, var(--holo) 15%, transparent)' : undefined,
            borderColor: tab === t.id ? 'var(--holo)' : undefined,
            color: tab === t.id ? 'var(--txt)' : 'var(--txt-dim)',
          }}>
            <Icon name={t.icon} size={13} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'resumen' && (
        <ResumenTab torneo={torneo} isTutorUser={isTutorUser} onOpenCombate={setScoringCombate} />
      )}
      {tab === 'inscripcion' && (
        <InscripcionTab torneo={torneo} user={user} onChanged={reload} />
      )}
      {tab === 'arbol' && (
        torneo.combates.length === 0
          ? <Empty label="El árbol de este torneo aún no ha sido generado" />
          : (
            <div className="nx-panel solid" style={{
              position: 'relative', padding: 20, overflow: 'hidden', borderRadius: 'var(--radius-lg)',
              backgroundImage: [
                'radial-gradient(ellipse at 60% 25%, rgba(56,205,240,0.12) 0%, rgba(4,10,30,0.55) 70%)',
                'linear-gradient(rgba(56,205,240,0.07) 1px, transparent 1px)',
                'linear-gradient(90deg, rgba(56,205,240,0.07) 1px, transparent 1px)',
              ].join(', '),
              backgroundSize: 'auto, 48px 48px, 48px 48px',
            }}>
              <BracketTab combatesPorRonda={torneo.combates} isTutor={isTutorUser} onOpenCombate={setScoringCombate} />
            </div>
          )
      )}

      <Modal open={!!scoringCombate} onClose={() => setScoringCombate(null)}
        title="Resolver Combate" kicker={scoringCombate ? `Ronda ${scoringCombate.ronda}` : ''} width={680}>
        {scoringCombate && (
          <ScoringForm
            combate={scoringCombate}
            torneoId={torneoId}
            onResolved={() => { setScoringCombate(null); reload(); }}
            onCancel={() => setScoringCombate(null)}
          />
        )}
      </Modal>
    </div>
  );
}

/* ── Tab: Resumen ── */
function ResumenTab({ torneo, isTutorUser, onOpenCombate }) {
  const img = mediaUrl(torneo.imagen);
  const proximos = (torneo.combates ?? [])
    .flatMap(r => r.combates)
    .filter(c => c.estado === 'pendiente' && c.user_a && c.user_b);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {img && (
        <img src={img} alt={torneo.nombre} style={{
          width: '100%', maxHeight: 220, objectFit: 'cover',
          borderRadius: 'var(--radius)', border: '1px solid var(--holo-line)',
        }} />
      )}
      {torneo.descripcion && (
        <p style={{ fontSize: 13, color: 'var(--txt-dim)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{torneo.descripcion}</p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {torneo.premios && (
          <Panel kicker="Recompensas" title="Premios" icon="medal">
            <div style={{ fontSize: 12, color: 'var(--txt-dim)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{torneo.premios}</div>
          </Panel>
        )}
        {torneo.requisitos && (
          <Panel kicker="Condiciones" title="Requisitos" icon="shield">
            <div style={{ fontSize: 12, color: 'var(--txt-dim)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{torneo.requisitos}</div>
          </Panel>
        )}
      </div>

      <Panel kicker={`${torneo.participantes.length} inscritos`} title="Participantes" icon="roster">
        {torneo.participantes.length === 0 ? <Empty label="Sin inscritos todavía" /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 8 }}>
            {[...torneo.participantes]
              .sort((a, b) => (a.estado === 'campeon' ? -1 : b.estado === 'campeon' ? 1 : 0))
              .map(p => {
                const esCampeon = p.estado === 'campeon';
                return (
                  <div key={p.user_id} className="nx-panel solid" style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: esCampeon ? '10px 12px' : '8px 10px',
                    borderColor: esCampeon ? 'var(--pompeyo-oro)' : undefined,
                    background: esCampeon ? 'linear-gradient(135deg, rgba(230,179,37,0.16), rgba(230,179,37,0.03))' : undefined,
                    boxShadow: esCampeon ? '0 0 18px -6px var(--pompeyo-oro)' : undefined,
                  }}>
                    <MiniAvatar name={p.name} photoUrl={p.photo_url} size={esCampeon ? 42 : 30} ring={esCampeon} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{
                          fontSize: esCampeon ? 13 : 12, fontWeight: esCampeon ? 700 : 600,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{p.name}</span>
                        {esCampeon && <Icon name="star" size={12} fill style={{ color: 'var(--pompeyo-oro)', flexShrink: 0 }} />}
                      </div>
                      {p.handle && <div className="nx-data" style={{ fontSize: 9, color: 'var(--txt-faint)' }}>@{p.handle}</div>}
                    </div>
                    <Chip tone={esCampeon ? 'gold' : p.estado === 'eliminado' ? 'red' : 'green'} icon={esCampeon ? 'crown' : undefined}>
                      {esCampeon ? 'Campeón' : p.estado === 'eliminado' ? 'Eliminado' : 'Activo'}
                    </Chip>
                  </div>
                );
              })}
          </div>
        )}
      </Panel>

      <Panel kicker="Por resolver" title="Próximos Combates" icon="swords">
        {proximos.length === 0 ? <Empty label="No hay combates pendientes" /> : (
          <div style={{ display: 'grid', gap: 8 }}>
            {proximos.map(c => (
              <button key={c.id} onClick={() => isTutorUser && onOpenCombate(c)} className="nx-panel solid" style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                textAlign: 'left', cursor: isTutorUser ? 'pointer' : 'default', width: '100%', flexWrap: 'wrap',
              }}>
                <Chip tone="dim">Ronda {c.ronda}</Chip>
                <MiniAvatar name={c.user_a.name} photoUrl={c.user_a.photo_url} size={26} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>{c.user_a.name}</span>
                <span className="nx-data" style={{ color: 'var(--txt-faint)' }}>VS</span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{c.user_b.name}</span>
                <MiniAvatar name={c.user_b.name} photoUrl={c.user_b.photo_url} size={26} />
                {isTutorUser && <span style={{ marginLeft: 'auto' }}><Chip icon="target">Resolver</Chip></span>}
              </button>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ── Tab: Inscripción ── */
function InscripcionTab({ torneo, user, onChanged }) {
  const [busy, setBusy] = useState(false);
  const miInscripcion = torneo.mi_inscripcion;
  const cerrada = torneo.estado !== 'inscripcion';
  const sinPersonaje = !user?.character;
  const sinCupo = torneo.participantes.length >= torneo.cupos;

  const inscribirse = async () => {
    setBusy(true);
    try {
      await apiCall('POST', `/api/torneos/${torneo.id}/inscribir`);
      toast('Inscripción realizada', { tone: 'success', icon: 'check' });
      onChanged();
    } catch (e) {
      toast(e?.message ?? 'Error al inscribirse', { tone: 'error', icon: 'x' });
    }
    setBusy(false);
  };

  const retirarse = async () => {
    setBusy(true);
    try {
      await apiCall('DELETE', `/api/torneos/${torneo.id}/inscribir`);
      toast('Inscripción retirada', { tone: 'dim', icon: 'x' });
      onChanged();
    } catch (e) {
      toast(e?.message ?? 'Error al retirar la inscripción', { tone: 'error', icon: 'x' });
    }
    setBusy(false);
  };

  return (
    <Panel kicker={cerrada ? 'Cerrada' : 'Abierta'} title="Inscripción" icon="tasks">
      {cerrada ? (
        <div className="nx-data" style={{ fontSize: 12, color: 'var(--txt-faint)' }}>
          La inscripción de este torneo ya está cerrada.
        </div>
      ) : sinPersonaje ? (
        <div className="nx-data" style={{ fontSize: 12, color: 'var(--txt-faint)' }}>
          Necesitas crear tu personaje antes de poder inscribirte como combatiente.
        </div>
      ) : miInscripcion ? (
        <div style={{ display: 'grid', gap: 10, justifyItems: 'start' }}>
          <Chip tone="green" icon="check">Ya estás inscrito en este torneo</Chip>
          <Btn kind="ghost" onClick={retirarse} disabled={busy}>Retirar inscripción</Btn>
        </div>
      ) : sinCupo ? (
        <Chip tone="red">No quedan cupos disponibles</Chip>
      ) : (
        <Btn kind="accent" icon="swords" onClick={inscribirse} disabled={busy}>Inscribirme como combatiente</Btn>
      )}
    </Panel>
  );
}

/* ── Tab: Árbol ── */
function BracketTab({ combatesPorRonda, isTutor, onOpenCombate }) {
  const totalRondas = combatesPorRonda.length;
  const nombreRonda = (ronda) => {
    if (ronda === totalRondas) return 'FINAL';
    if (ronda === totalRondas - 1) return 'SEMIFINAL';
    return `RONDA ${ronda}`;
  };

  return (
    <div style={{ display: 'flex', gap: 28, overflowX: 'auto', padding: '8px 4px 16px' }}>
      {combatesPorRonda.map(r => (
        <div key={r.ronda} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', minWidth: 230, gap: 16 }}>
          <div className="nx-kicker" style={{ textAlign: 'center', marginBottom: 4 }}>{nombreRonda(r.ronda)}</div>
          {r.combates.map(c => (
            <BracketMatch
              key={c.id}
              c={c}
              clickable={isTutor && c.estado === 'pendiente' && !!c.user_a && !!c.user_b}
              onClick={() => onOpenCombate(c)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function BracketMatch({ c, clickable, onClick }) {
  const row = (user, puntos, isWinner) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
      background: isWinner ? 'rgba(230,179,37,0.10)' : 'transparent',
      opacity: c.estado === 'resuelto' && !isWinner ? 0.55 : 1,
    }}>
      <MiniAvatar name={user?.name} photoUrl={user?.photo_url} size={22} />
      <span style={{
        flex: 1, fontSize: 11, fontWeight: isWinner ? 700 : 500,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        color: user ? 'var(--txt)' : 'var(--txt-faint)',
      }}>
        {user?.name ?? (c.estado === 'bye' ? '— (bye)' : 'Por definir')}
      </span>
      {c.estado !== 'pendiente' && user && (
        <span className="nx-num" style={{ fontSize: 12, color: isWinner ? 'var(--pompeyo-oro)' : 'var(--txt-faint)' }}>
          {puntos}
        </span>
      )}
    </div>
  );

  return (
    <div onClick={clickable ? onClick : undefined} className="nx-panel solid" style={{
      padding: 0, overflow: 'hidden',
      cursor: clickable ? 'pointer' : 'default',
      borderColor: clickable ? 'var(--holo)' : undefined,
    }}>
      {row(c.user_a, c.puntos_a, c.ganador_id != null && c.user_a?.user_id === c.ganador_id)}
      <div style={{ height: 1, background: 'var(--holo-line)' }} />
      {row(c.user_b, c.puntos_b, c.ganador_id != null && c.user_b?.user_id === c.ganador_id)}
    </div>
  );
}

/* ── Formulario de scoring por puntos y faltas ── */
function ScoringForm({ combate, torneoId, onResolved, onCancel }) {
  const [puntosA, setPuntosA] = useState(0);
  const [puntosB, setPuntosB] = useState(0);
  const [levesA, setLevesA]   = useState(0);
  const [levesB, setLevesB]   = useState(0);
  const [gravesA, setGravesA] = useState(0);
  const [gravesB, setGravesB] = useState(0);
  const [saving, setSaving]   = useState(false);

  const faltasA = levesA + gravesA, faltasB = levesB + gravesB;
  const graveA = gravesA > 0, graveB = gravesB > 0;
  const autoA = faltasA >= 3 || graveA;
  const autoB = faltasB >= 3 || graveB;
  const netoA = puntosA - faltasA, netoB = puntosB - faltasB;

  let winner = null;
  if (autoA && !autoB) winner = 'b';
  else if (autoB && !autoA) winner = 'a';
  else if (!autoA && !autoB) {
    if (netoA > netoB) winner = 'a';
    else if (netoB > netoA) winner = 'b';
  }
  const bothOut = autoA && autoB;
  const canSubmit = winner !== null && !bothOut;

  const submit = async () => {
    setSaving(true);
    try {
      await apiCall('POST', `/api/torneos/${torneoId}/combates/${combate.id}/resolver`, {
        puntos_a: puntosA, puntos_b: puntosB,
        faltas_a: faltasA, faltas_b: faltasB,
        falta_grave_a: graveA, falta_grave_b: graveB,
        ganador: winner,
      });
      toast('Combate resuelto', {
        tone: 'success', icon: 'trophy',
        desc: `Ganó ${(winner === 'a' ? combate.user_a : combate.user_b).name}`,
      });
      onResolved();
    } catch (e) {
      toast(e?.message ?? 'Error al resolver el combate', { tone: 'error', icon: 'x' });
    }
    setSaving(false);
  };

  const Side = ({ user, puntos, setPuntos, leves, setLeves, graves, setGraves, neto, auto, isWinner }) => (
    <div className="nx-panel solid" style={{ padding: 14, borderColor: isWinner ? 'var(--pompeyo-oro)' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <MiniAvatar name={user.name} photoUrl={user.photo_url} size={38} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
          {user.handle && <div className="nx-data" style={{ fontSize: 9, color: 'var(--txt-faint)' }}>@{user.handle}</div>}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        <div>
          <div className="nx-label">Puntos</div>
          <Stepper value={puntos} onChange={setPuntos} color="var(--holo)" />
        </div>
        <div>
          <div className="nx-label">Faltas leves (−1 c/u)</div>
          <Stepper value={leves} onChange={setLeves} color="#E6B325" />
        </div>
        <div>
          <div className="nx-label">Faltas graves (−1 c/u · pierde con 1)</div>
          <Stepper value={graves} onChange={setGraves} color="#ff6b6b" />
        </div>
      </div>

      <hr className="nx-divider" style={{ margin: '12px 0' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="nx-kicker" style={{ fontSize: 9 }}>NETO</span>
        <span className="nx-num" style={{ fontSize: 22, color: isWinner ? 'var(--pompeyo-oro)' : 'var(--txt)' }}>{neto}</span>
      </div>
      {auto && <div style={{ marginTop: 8 }}><Chip tone="red">Pierde por faltas</Chip></div>}
      {isWinner && <div style={{ marginTop: 8 }}><Chip tone="gold" icon="trophy">Ganador</Chip></div>}
    </div>
  );

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Side user={combate.user_a} puntos={puntosA} setPuntos={setPuntosA}
          leves={levesA} setLeves={setLevesA} graves={gravesA} setGraves={setGravesA}
          neto={netoA} auto={autoA} isWinner={winner === 'a'} />
        <Side user={combate.user_b} puntos={puntosB} setPuntos={setPuntosB}
          leves={levesB} setLeves={setLevesB} graves={gravesB} setGraves={setGravesB}
          neto={netoB} auto={autoB} isWinner={winner === 'b'} />
      </div>

      {bothOut && (
        <div className="nx-data" style={{ fontSize: 11, color: '#ff6b6b' }}>
          Ambos combatientes quedan descalificados — ajusta las faltas antes de continuar.
        </div>
      )}
      {!bothOut && winner === null && (
        <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)' }}>
          Empate — ajusta el puntaje para determinar un ganador.
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn onClick={onCancel}>Cancelar</Btn>
        <Btn kind="accent" icon="trophy" onClick={submit} disabled={!canSubmit || saving}>
          {winner ? `Registrar — gana ${(winner === 'a' ? combate.user_a : combate.user_b).name}` : 'Registrar Resultado'}
        </Btn>
      </div>
    </div>
  );
}
