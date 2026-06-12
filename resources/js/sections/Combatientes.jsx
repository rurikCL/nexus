import { useState, useEffect, useRef } from 'react';
import { NX } from '../data/seed.js';
import { Icon, Panel, Btn, Chip, Avatar, TierBadge, Stat, MedalIcon, Modal, toast, ImageSlot } from '../components/ui.jsx';
import { Empty, classIcon } from './Comando.jsx';

/* NÉXUS — Combatientes (roster) + perfil público compartible */

export function CombatientesView({ S }) {
  const [q, setQ] = useState('');
  const [tierF, setTierF] = useState('todos');
  const [profile, setProfile] = useState(null);

  const list = NX.combatants.filter(c => {
    if (tierF !== 'todos' && c.tier !== tierF) return false;
    if (q && !(`${c.name} ${c.handle} ${c.sector || ''}`.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });

  return (
    <div className="nx-fade" style={{ display: 'grid', gap: 18 }}>
      <Panel kicker="Directorio de la academia" title="Combatientes" icon="roster"
        right={<Chip tone="dim" icon="roster">{NX.combatants.length} registrados</Chip>}>
        {/* Filtros */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <span style={{ position: 'absolute', left: 11, top: 11, color: 'var(--txt-faint)' }}><Icon name="filter" size={15} /></span>
            <input className="nx-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, alias o sector..." style={{ paddingLeft: 34 }} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['todos', ...Object.keys(NX.TIERS)].map(k => (
              <button key={k} onClick={() => setTierF(k)} className={`nx-chip ${tierF === k ? '' : 'dim'}`}
                style={{ cursor: 'pointer', borderColor: tierF === k ? 'var(--holo)' : undefined }}>
                {k === 'todos' ? 'Todos' : NX.TIERS[k].label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))', gap: 14 }}>
          {list.map((c) => (
            <button key={c.id} onClick={() => setProfile(c)} className="nx-panel solid" style={{ padding: 15, textAlign: 'left', cursor: 'pointer', transition: 'all .15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--holo)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.transform = ''; }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar c={c} size={48} ring />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                    {c.id === 'you' && <Chip tone="orange">Tú</Chip>}
                  </div>
                  <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)' }}>@{c.handle}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 7, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <TierBadge tier={c.tier} sm />
                <Chip tone="dim" icon={classIcon(c.cls)}>{NX.CLASSES.find(x => x.id === c.cls)?.name}</Chip>
                <span title={`Sable ${c.saberName}`} style={{ width: 11, height: 11, borderRadius: '50%', background: c.saber, boxShadow: `0 0 8px ${c.saber}`, marginLeft: 'auto' }} />
              </div>
              <hr className="nx-divider" style={{ margin: '12px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Mini label="Victorias" value={c.wins} tone="var(--pompeyo-naranja)" />
                <Mini label="Efic." value={`${c.winrate}%`} tone="var(--holo)" />
                <Mini label="Medallas" value={c.medals.length} tone="var(--pompeyo-oro)" />
              </div>
            </button>
          ))}
        </div>
      </Panel>

      {profile && <PublicProfile c={profile} S={S} onClose={() => setProfile(null)} />}
    </div>
  );
}

export function Mini({ label, value, tone }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div className="nx-num" style={{ fontSize: 17, color: tone }}>{value}</div>
      <div className="nx-kicker" style={{ fontSize: 8 }}>{label}</div>
    </div>
  );
}

/* ---- Perfil público (vista externa compartible) ---- */
export function PublicProfile({ c, S, onClose }) {
  const cls = NX.CLASSES.find(x => x.id === c.cls);
  const tasks = NX.tasks.filter(t => t.pupil === c.id && t.status !== 'completada');
  const recent = NX.combats.filter(m => m.a === c.id || m.b === c.id);
  const STAT_LABEL = { fuerza: 'Fuerza', velocidad: 'Velocidad', tecnica: 'Técnica', defensa: 'Defensa', foco: 'Foco' };

  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div onMouseDown={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(2,5,12,0.78)', backdropFilter: 'blur(5px)', display: 'grid', placeItems: 'start center', padding: 24, overflow: 'auto' }}>
      <div className="nx-panel solid nx-fade" onMouseDown={(e) => e.stopPropagation()} style={{ width: 720, maxWidth: '100%', overflow: 'hidden' }}>
        {/* Banner vista pública */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 16px', background: 'color-mix(in srgb, var(--holo) 12%, transparent)', borderBottom: '1px solid var(--holo-line)' }}>
          <span className="nx-kicker" style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Icon name="link" size={13} /> Vista pública · perfil externo</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn sm icon="link" onClick={() => toast('Link público copiado', { tone: 'success', icon: 'link', desc: `nexus.orbital/c/${c.handle}` })}>Copiar link</Btn>
            <button className="nx-btn nx-btn-ghost nx-btn-sm" onClick={onClose} style={{ padding: 7 }}><Icon name="x" size={14} /></button>
          </div>
        </div>

        {/* Hero */}
        <div style={{ padding: 24, display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'center', background: `radial-gradient(600px 200px at 80% -40%, ${c.color}22, transparent)` }}>
          <div style={{ position: 'relative' }}>
            <div className="nx-avatar nx-hex" style={{ width: 110, height: 122, background: `linear-gradient(135deg, ${c.color}, ${c.color}88)`, fontSize: 40, border: 'none' }}>{c.initials}</div>
            <div className="nx-hex" style={{ position: 'absolute', inset: -2, border: `1.5px solid ${c.saber}`, boxShadow: `0 0 22px -6px ${c.saber}`, pointerEvents: 'none' }} />
            {c.gold && <img src="/assets/isotipo-gold.png" alt="" style={{ position: 'absolute', bottom: -6, right: -10, width: 40, height: 40, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.6))' }} />}
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="nx-kicker">{c.sector || 'Academia Orbital'}{c.sponsor ? ` · ${c.sponsor}` : ''}</div>
            <h1 className="nx-display" style={{ fontSize: 28, margin: '4px 0 8px' }}>{c.name}</h1>
            <p style={{ fontSize: 13, color: 'var(--txt-dim)', margin: '0 0 12px', maxWidth: 380, fontStyle: 'italic' }}>"{c.bio}"</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <TierBadge tier={c.tier} />
              <Chip icon={classIcon(c.cls)} style={{ color: cls.accent, borderColor: `${cls.accent}66`, background: `color-mix(in srgb, ${cls.accent} 12%, transparent)` }}>{cls.name}</Chip>
              <Chip tone="dim" icon="user">@{c.handle}</Chip>
              <span className="nx-chip dim" style={{ borderColor: `${c.saber}66` }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: c.saber, boxShadow: `0 0 8px ${c.saber}` }} />Sable {c.saberName}</span>
            </div>
          </div>
        </div>

        <div className="nx-panel-body" style={{ display: 'grid', gap: 18 }}>
          {/* Récord */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {[
              { k: 'Victorias', v: c.wins, t: 'var(--pompeyo-naranja)', i: 'trophy' },
              { k: 'Derrotas', v: c.losses, t: 'var(--txt-dim)', i: 'x' },
              { k: 'Efectividad', v: `${c.winrate}%`, t: 'var(--holo)', i: 'trending' },
              { k: 'Racha', v: `${c.streak}W`, t: 'var(--green-500)', i: 'flame' },
            ].map(s => (
              <div key={s.k} className="nx-panel" style={{ padding: 13, textAlign: 'center' }}>
                <span style={{ color: s.t }}><Icon name={s.i} size={15} /></span>
                <div className="nx-num" style={{ fontSize: 24, color: s.t, marginTop: 3 }}>{s.v}</div>
                <div className="nx-kicker" style={{ fontSize: 8 }}>{s.k}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            {/* Atributos */}
            <div>
              <div className="nx-kicker" style={{ marginBottom: 12 }}>Atributos de combate</div>
              <div style={{ display: 'grid', gap: 11 }}>
                {Object.keys(c.stats).map(s => <Stat key={s} label={STAT_LABEL[s]} value={c.stats[s]} color={cls.accent} />)}
              </div>
            </div>
            {/* Medallas */}
            <div>
              <div className="nx-kicker" style={{ marginBottom: 12 }}>Medallas · {c.medals.length}</div>
              {c.medals.length ? (
                <div style={{ display: 'grid', gap: 9 }}>
                  {c.medals.map(m => (
                    <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <MedalIcon id={m} size={32} />
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{NX.MEDALS[m].name}</span>
                    </div>
                  ))}
                </div>
              ) : <Empty label="Sin medallas aún" />}
            </div>
          </div>

          {/* Tareas en curso (públicas) */}
          <div>
            <div className="nx-kicker" style={{ marginBottom: 12 }}>Entrenamiento en curso</div>
            {tasks.length ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {tasks.map(t => (
                  <div key={t.id} className="nx-panel" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ color: 'var(--holo)' }}><Icon name="tasks" size={16} /></span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{t.title}</span>
                    <div className="nx-bar" style={{ width: 90 }}><i style={{ width: `${t.progress}%` }} /></div>
                    <span className="nx-num" style={{ fontSize: 12, color: 'var(--holo)', width: 34, textAlign: 'right' }}>{t.progress}%</span>
                  </div>
                ))}
              </div>
            ) : <Empty label="Sin tareas activas" />}
          </div>

          {/* Próximos combates */}
          {recent.length > 0 && (
            <div>
              <div className="nx-kicker" style={{ marginBottom: 12 }}>Cartelera</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {recent.map(m => {
                  const opp = NX.byId(m.a === c.id ? m.b : m.a);
                  return (
                    <div key={m.id} className="nx-panel" style={{ padding: 11, display: 'flex', alignItems: 'center', gap: 11 }}>
                      <Avatar c={opp} size={30} />
                      <span style={{ flex: 1, fontSize: 13 }}>vs <b>{opp.name}</b></span>
                      <span className="nx-data" style={{ fontSize: 11, color: m.live ? '#ff6b6b' : 'var(--txt-faint)' }}>{m.live ? 'EN VIVO' : m.when}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {c.id !== 'you' && (
            <Btn kind="accent" icon="swords" onClick={() => { onClose(); toast(`Reta a ${c.name} desde Combates`, { tone: 'info', icon: 'swords' }); }} style={{ justifyContent: 'center' }}>Retar a {c.name.split(' ')[0]}</Btn>
          )}
        </div>
      </div>
    </div>
  );
}

