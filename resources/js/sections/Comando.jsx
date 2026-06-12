import { useState, useEffect, useRef } from 'react';
import { NX } from '../data/seed.js';
import { Icon, Panel, Btn, Chip, Avatar, TierBadge, Stat, MedalIcon, Modal, toast, ImageSlot } from '../components/ui.jsx';

/* NÉXUS — Comando (dashboard) + Mi Personaje */

const SIDES = {
  luminoso: { label: 'Lado Luminoso', color: '#3aa0ff', img: '/assets/lado-luminoso.png', desc: 'Disciplina, honor y protección' },
  oscuro:   { label: 'Lado Oscuro',   color: '#ff2d45', img: '/assets/lado-oscuro.png',   desc: 'Pasión, ambición y poder' },
};

export function classIcon(clsId) {
  const c = NX.CLASSES.find(x => x.id === clsId);
  return c ? c.icon : 'shield';
}

/* ===================== COMANDO ===================== */
export function ComandoView({ S, go, user }) {
  const me = NX.byId('you');
  const myTier = user?.tier ?? me.tier;
  const ch = S.character;
  const sab = NX.SABERS[ch.saber] || NX.SABERS.azul;
  const myTasks = S.tasks.filter(t => t.pupil === 'you' && t.status !== 'completada');
  const nextCombat = S.combats.find(m => m.a === 'you' || m.b === 'you');
  const loggedCount = Object.keys(S.training.logged).length;
  const opp = nextCombat ? NX.byId(nextCombat.a === 'you' ? nextCombat.b : nextCombat.a) : null;

  const KPIS = [
    { k: 'Créditos', v: NX.fmtCLP(S.credits), icon: 'coin', tone: 'var(--pompeyo-oro)' },
    { k: 'Victorias', v: me.wins, sub: `${me.winrate}% efectividad`, icon: 'trophy', tone: 'var(--pompeyo-naranja)' },
    { k: 'Racha', v: `${me.streak} W`, sub: 'sin perder', icon: 'flame', tone: 'var(--holo)' },
    { k: 'Asistencia', v: `${loggedCount} días`, sub: S.training.month, icon: 'calendar', tone: 'var(--green-500)' },
  ];

  return (
    <div className="nx-fade" style={{ display: 'grid', gap: 18 }}>
      {/* Hero */}
      <section className="nx-panel" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 22, padding: 22, flexWrap: 'wrap', alignItems: 'center' }}>
          <Avatar c={me} size={86} ring />
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="nx-kicker">Combatiente · {me.sector}</div>
            <h1 className="nx-display" style={{ fontSize: 30, margin: '4px 0 8px', color: 'var(--txt)' }}>{ch.name}</h1>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <TierBadge tier={myTier} />
              {(() => { const c = NX.CLASSES.find(x => x.id === ch.cls); return c ? <Chip icon={c.icon}>{c.num} · {c.name}</Chip> : null; })()}
              <Chip tone="dim" icon="user">@{ch.handle}</Chip>
              <span className="nx-chip dim" style={{ borderColor: `${sab}66` }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: sab, boxShadow: `0 0 8px ${sab}` }} />Sable {ch.saber}</span>
            </div>
          </div>
          {nextCombat && (
            <div className="nx-panel solid" style={{ padding: 16, minWidth: 230 }}>
              <div className="nx-kicker" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {nextCombat.live && <span className="nx-live-dot" />} Tu próximo combate
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0' }}>
                <Avatar c={opp} size={36} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>vs {opp.name}</div>
                  <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-dim)' }}>{nextCombat.round} · {nextCombat.when}</div>
                </div>
              </div>
              <Btn kind="accent" icon="swords" sm onClick={() => go('combates')} style={{ width: '100%', justifyContent: 'center' }}>Ver combate</Btn>
            </div>
          )}
        </div>
      </section>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        {KPIS.map((k) => (
          <div key={k.k} className="nx-panel" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="nx-kicker">{k.k}</div>
              <span style={{ color: k.tone }}><Icon name={k.icon} size={17} /></span>
            </div>
            <div className="nx-num" style={{ fontSize: 30, color: k.tone, marginTop: 6, lineHeight: 1 }}>{k.v}</div>
            {k.sub && <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)', marginTop: 4 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      <div className="nx-grid-2" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 18, alignItems: 'start' }}>
        {/* Tareas activas */}
        <Panel title="Tareas Asignadas" kicker="Tutor · Diego Fuentes" icon="tasks"
          right={<Btn sm icon="arrow" iconRight={null} onClick={() => go('tareas')}>Ver todas</Btn>}>
          <div style={{ display: 'grid', gap: 10 }}>
            {myTasks.length === 0 && <Empty label="Sin Tareas" />}
            {myTasks.map((t) => (
              <div key={t.id} className="nx-panel solid" style={{ padding: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{t.title}</div>
                  <Chip tone="dim" icon="clock">{t.due}</Chip>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 9 }}>
                  <div className="nx-bar" style={{ flex: 1 }}><i style={{ width: `${t.progress}%` }} /></div>
                  <span className="nx-num" style={{ fontSize: 12, color: 'var(--holo)' }}>{t.progress}%</span>
                  <Chip tone="gold" icon="coin">+{t.reward}</Chip>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <div style={{ display: 'grid', gap: 18 }}>
          {/* Próximos eventos */}
          <Panel title="Próximos Eventos" kicker="Presentaciones" icon="star"
            right={<Btn sm onClick={() => go('eventos')}>Más</Btn>}>
            <div style={{ display: 'grid', gap: 10 }}>
              {S.events.filter(e => e.status !== 'REALIZADO').slice(0, 3).map((e) => (
                <div key={e.id} style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
                  <span style={{ width: 4, alignSelf: 'stretch', borderRadius: 4, background: e.banner }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</div>
                    <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)' }}>{e.date}</div>
                  </div>
                  <Chip tone={e.mine ? 'green' : e.status === 'ABIERTO' ? 'green' : 'dim'}>{e.mine ? 'Inscrito' : e.status}</Chip>
                </div>
              ))}
            </div>
          </Panel>

          {/* Mini ranking */}
          <Panel title="Top Ranking" kicker="Temporada 3" icon="trophy"
            right={<Btn sm onClick={() => go('ranking')}>Ladder</Btn>}>
            <div style={{ display: 'grid', gap: 8 }}>
              {S.ranking.slice(0, 4).map((c, i) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="nx-num" style={{ fontSize: 15, width: 22, color: i === 0 ? 'var(--pompeyo-oro)' : 'var(--txt-faint)' }}>{i + 1}</span>
                  <Avatar c={c} size={28} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: c.id === 'you' ? 700 : 500, color: c.id === 'you' ? 'var(--pompeyo-naranja)' : 'var(--txt)' }}>{c.name}</span>
                  <span className="nx-num" style={{ fontSize: 13, color: 'var(--txt-dim)' }}>{c.wins}W</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

export function Empty({ label }) {
  return (
    <div style={{ textAlign: 'center', padding: 24, color: 'var(--txt-faint)' }}>
      <div style={{ opacity: 0.4, display: 'flex', justifyContent: 'center', marginBottom: 8 }}><Icon name="target" size={28} /></div>
      <div className="nx-data" style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

/* ===================== CREAR PERSONAJE ===================== */
function CharacterCreation({ user, S, onCharacterCreated }) {
  const DEFAULT_STATS = { fuerza: 50, velocidad: 50, tecnica: 50, defensa: 50, foco: 50 };
  const [form, setForm] = useState({
    name: user?.name ?? '',
    handle: '',
    bio: '',
    cls: 'vanguardia',
    side: 'luminoso',
    saber: 'cian',
    stats: DEFAULT_STATS,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('El nombre de combate es requerido.'); return; }
    if (!form.handle.trim()) { setError('El alias (handle) es requerido.'); return; }
    setSaving(true);
    try {
      const token = localStorage.getItem('nx-token');
      const res = await fetch('/api/character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: form.name.trim(),
          handle: form.handle.trim().toUpperCase(),
          bio: form.bio.trim(),
          cls: form.cls,
          side: form.side,
          saber_color: form.saber,
          stats: form.stats,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? 'Error al crear el personaje.'); return; }
      S.setCharacter({ name: form.name.trim(), handle: form.handle.trim().toUpperCase(), bio: form.bio.trim(), cls: form.cls, side: form.side, saber: form.saber, stats: form.stats, pool: 0 });
      toast('Personaje creado', { tone: 'success', icon: 'check', desc: `¡Bienvenido a la Academia, ${form.name.trim()}!` });
      onCharacterCreated?.(data.character);
    } catch {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="nx-fade" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8 }}>
      <div style={{ width: '100%', maxWidth: 620 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div className="nx-kicker" style={{ marginBottom: 6 }}>Primera vez en la Academia</div>
          <h2 className="nx-display" style={{ fontSize: 22, color: 'var(--txt)', margin: 0 }}>Forja tu Identidad</h2>
          <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)', marginTop: 5 }}>Crea tu personaje de combate para empezar</div>
        </div>

        <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
          <Panel kicker="Identidad" title="Datos del Personaje" icon="user">
            {error && (
              <div style={{ padding: '8px 12px', marginBottom: 10, borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,107,0,0.4)', background: 'rgba(255,107,0,0.1)', color: 'var(--pompeyo-naranja)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
                <Icon name="x" size={13} />{error}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="nx-label">Nombre de combate *</label>
                <input className="nx-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Tu nombre en la Arena" required />
              </div>
              <div>
                <label className="nx-label">Alias (handle) *</label>
                <input className="nx-input" value={form.handle} onChange={e => set('handle', e.target.value.toUpperCase())} placeholder="ALIAS" required maxLength={20} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="nx-label">Grito de guerra</label>
                <textarea className="nx-textarea" value={form.bio} onChange={e => set('bio', e.target.value)} placeholder="Tu frase antes del duelo..." style={{ minHeight: 56 }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="nx-label">Lado de la Fuerza</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {Object.entries(SIDES).map(([key, s]) => {
                    const on = form.side === key;
                    return (
                      <button type="button" key={key} onClick={() => set('side', key)}
                        className="nx-panel solid" style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'stretch', borderColor: on ? s.color : undefined, boxShadow: on ? `0 0 16px -6px ${s.color}` : undefined, background: on ? `color-mix(in srgb, ${s.color} 8%, var(--space-panel-solid))` : undefined, transition: 'all .2s' }}>
                        <div style={{ width: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in srgb, ${s.color} 5%, rgba(4,9,18,0.9))`, borderRight: `1px solid ${on ? s.color + '55' : 'var(--holo-line)'}` }}>
                          <img src={s.img} alt={s.label} style={{ width: 38, height: 38, objectFit: 'contain', filter: on ? `drop-shadow(0 0 6px ${s.color})` : 'brightness(0.6) saturate(0.6)', transition: 'filter .2s' }} />
                        </div>
                        <div style={{ padding: '8px 11px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <div className="nx-display" style={{ fontSize: 12, color: on ? s.color : 'var(--txt)', lineHeight: 1.2 }}>{s.label}</div>
                          <div style={{ fontSize: 9, color: 'var(--txt-dim)', marginTop: 3 }}>{s.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Panel>

          <Panel kicker="Especialización" title="Forma de Combate" icon="sword">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 6 }}>
              {NX.CLASSES.map((c) => {
                const active = form.cls === c.id;
                return (
                  <button type="button" key={c.id} onClick={() => set('cls', c.id)}
                    className="nx-panel solid" style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'stretch', borderColor: active ? c.accent : undefined, boxShadow: active ? `0 0 18px -6px ${c.accent}` : undefined, background: active ? `color-mix(in srgb, ${c.accent} 8%, var(--space-panel-solid))` : undefined, transition: 'all .2s' }}>
                    <div style={{ width: 64, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in srgb, ${c.accent} 5%, rgba(4,9,18,0.9))`, borderRight: `1px solid ${active ? c.accent + '55' : 'var(--holo-line)'}` }}>
                      <img src={c.img} alt={c.name} style={{ width: 46, height: 46, objectFit: 'contain', filter: active ? `drop-shadow(0 0 7px ${c.accent})` : 'brightness(0.6) saturate(0.6)', transition: 'filter .2s' }} />
                    </div>
                    <div style={{ padding: '8px 11px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ fontFamily: 'var(--font-data)', fontSize: 8, letterSpacing: '0.16em', textTransform: 'uppercase', color: c.accent, marginBottom: 1 }}>{c.num}</div>
                      <div className="nx-display" style={{ fontSize: 12, color: active ? c.accent : 'var(--txt)', lineHeight: 1.2 }}>{c.name}</div>
                      <div style={{ fontSize: 9, color: 'var(--txt-dim)', marginTop: 3, lineHeight: 1.3 }}>{c.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel kicker="Cristal de poder" title="Color de Sable" icon="zap">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              {Object.keys(NX.SABERS).map((key) => {
                const col = NX.SABERS[key]; const on = form.saber === key;
                return (
                  <button type="button" key={key} title={key} onClick={() => set('saber', key)}
                    style={{ width: 38, height: 38, borderRadius: '50%', cursor: 'pointer', display: 'grid', placeItems: 'center', border: on ? `2px solid ${col}` : '1px solid var(--holo-line)', background: 'rgba(4,9,18,0.5)', boxShadow: on ? `0 0 14px -3px ${col}` : 'none', transition: 'all .15s' }}>
                    <span style={{ width: 15, height: 15, borderRadius: '50%', background: col, boxShadow: `0 0 8px ${col}` }} />
                  </button>
                );
              })}
              <span className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginLeft: 4 }}>Cristal: {form.saber}</span>
            </div>
          </Panel>

          <button type="submit" disabled={saving} className="nx-btn nx-btn-accent" style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 12 }}>
            {saving
              ? <><span className="nx-live-dot" style={{ background: '#fff', boxShadow: 'none' }} />Forjando personaje...</>
              : <><Icon name="shield" size={14} />Forjar Personaje</>}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ===================== MI PERSONAJE ===================== */
export function PersonajeView({ S, user, onCharacterCreated }) {
  const me = NX.byId('you');
  const myTier = user?.tier ?? me.tier;
  const ch = S.character;
  const pool = ch.pool;
  const STATS = ['fuerza', 'velocidad', 'tecnica', 'defensa', 'foco'];
  const STAT_LABEL = { fuerza: 'Fuerza', velocidad: 'Velocidad', tecnica: 'Técnica', defensa: 'Defensa', foco: 'Foco' };
  const sab = NX.SABERS[ch.saber] || NX.SABERS.azul;
  const [saving, setSaving] = useState(false);

  if (!user?.character) {
    return <CharacterCreation user={user} S={S} onCharacterCreated={onCharacterCreated} />;
  }

  const bump = (stat, d) => {
    if (d > 0 && pool <= 0) return;
    const nv = ch.stats[stat] + d;
    if (nv < 0 || nv > 99) return;
    S.setCharacter({ ...ch, stats: { ...ch.stats, [stat]: nv }, pool: pool - d });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('nx-token');
      const res = await fetch('/api/character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: ch.name, handle: ch.handle, bio: ch.bio || '', cls: ch.cls, side: ch.side, saber_color: ch.saber, stats: ch.stats }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.message ?? 'Error al guardar', { tone: 'error', icon: 'x' }); return; }
      toast('Personaje guardado', { tone: 'success', icon: 'check', desc: 'Tu ficha de combate está actualizada' });
    } catch {
      toast('Error de conexión', { tone: 'error', icon: 'x' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="nx-fade nx-personaje-grid" style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 18, alignItems: 'start' }}>
      {/* Retrato */}
      <div style={{ display: 'grid', gap: 18 }}>
        <Panel kicker="Retrato de combate" title="Identidad" icon="user" noBody>
          <div className="nx-panel-body" style={{ display: 'grid', placeItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ position: 'relative', width: 200, height: 220 }}>
                <ImageSlot id="nx-portrait" className="nx-hex" style={{ width: 200, height: 220, display: 'block' }}
                  shape="rect" placeholder="Sube tu retrato"></ImageSlot>
                <div className="nx-hex" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', border: `1.5px solid ${sab}`, boxShadow: `0 0 26px -8px ${sab} inset` }} />
              </div>
              <SaberBlade color={sab} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="nx-display" style={{ fontSize: 20 }}>{ch.name}</div>
              <div className="nx-data" style={{ fontSize: 12, color: 'var(--holo)', marginTop: 2 }}>@{ch.handle}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <TierBadge tier={myTier} />
              {(() => { const c = NX.CLASSES.find(x => x.id === ch.cls); return c ? <Chip icon={c.icon}>{c.num} · {c.name}</Chip> : null; })()}
              {ch.side && (() => { const s = SIDES[ch.side]; return (
                <span className="nx-data" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: s.color, padding: '3px 8px', border: `1px solid ${s.color}55`, borderRadius: 'var(--radius-sm)', background: `color-mix(in srgb, ${s.color} 12%, transparent)` }}>
                  <Icon name={s.icon} size={10} />{s.label}
                </span>
              ); })()}
            </div>
          </div>
        </Panel>

        <Panel kicker="Cristal de poder" title="Color de Sable" icon="zap">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {Object.keys(NX.SABERS).map((key) => {
              const col = NX.SABERS[key]; const on = ch.saber === key;
              return (
                <button key={key} title={key} onClick={() => S.setCharacter({ ...ch, saber: key })}
                  style={{ width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', display: 'grid', placeItems: 'center',
                    border: on ? `2px solid ${col}` : '1px solid var(--holo-line)', background: 'rgba(4,9,18,0.5)',
                    boxShadow: on ? `0 0 16px -3px ${col}` : 'none', transition: 'all .15s' }}>
                  <span style={{ width: 18, height: 18, borderRadius: '50%', background: col, boxShadow: `0 0 12px ${col}` }} />
                </button>
              );
            })}
          </div>
          <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)', marginTop: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Cristal: {ch.saber}</div>
        </Panel>

        <Panel kicker="Logros" title="Medallas" icon="medal">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {me.medals.map((m) => <MedalIcon key={m} id={m} size={40} />)}
          </div>
        </Panel>
      </div>

      {/* Editor */}
      <div style={{ display: 'grid', gap: 18 }}>
        <Panel kicker="Ficha" title="Datos del Personaje" icon="edit"
          right={<Btn kind="accent" icon="check" sm disabled={saving} onClick={handleSave}>{saving ? 'Guardando...' : 'Guardar'}</Btn>}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label className="nx-label">Nombre de combate *</label>
              <input className="nx-input" value={ch.name} onChange={(e) => S.setCharacter({ ...ch, name: e.target.value })} />
            </div>
            <div>
              <label className="nx-label">Alias (handle) *</label>
              <input className="nx-input" value={ch.handle} onChange={(e) => S.setCharacter({ ...ch, handle: e.target.value.toUpperCase() })} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="nx-label">Grito de guerra</label>
              <textarea className="nx-textarea" value={ch.bio} onChange={(e) => S.setCharacter({ ...ch, bio: e.target.value })} placeholder="Tu frase antes del duelo..." />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="nx-label">Lado de la Fuerza</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {Object.entries(SIDES).map(([key, s]) => {
                  const on = ch.side === key;
                  return (
                    <button key={key} onClick={() => S.setCharacter({ ...ch, side: key })}
                      className="nx-panel solid" style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'stretch', borderColor: on ? s.color : undefined, boxShadow: on ? `0 0 16px -6px ${s.color}` : undefined, background: on ? `color-mix(in srgb, ${s.color} 8%, var(--space-panel-solid))` : undefined, transition: 'all .2s' }}>
                      <div style={{ width: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in srgb, ${s.color} 5%, rgba(4,9,18,0.9))`, borderRight: `1px solid ${on ? s.color + '55' : 'var(--holo-line)'}` }}>
                        <img src={s.img} alt={s.label} style={{ width: 38, height: 38, objectFit: 'contain', filter: on ? `drop-shadow(0 0 6px ${s.color})` : 'brightness(0.6) saturate(0.6)', transition: 'filter .2s' }} />
                      </div>
                      <div style={{ padding: '8px 11px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div className="nx-display" style={{ fontSize: 12, color: on ? s.color : 'var(--txt)', lineHeight: 1.2 }}>{s.label}</div>
                        <div style={{ fontSize: 9, color: 'var(--txt-dim)', marginTop: 3 }}>{s.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Panel>

        <Panel kicker="Especialización" title="Forma de Combate" icon="sword">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 6 }}>
            {NX.CLASSES.map((c) => {
              const active = ch.cls === c.id;
              return (
                <button key={c.id} onClick={() => S.setCharacter({ ...ch, cls: c.id })}
                  className="nx-panel solid" style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'stretch', borderColor: active ? c.accent : undefined, boxShadow: active ? `0 0 20px -6px ${c.accent}` : undefined, background: active ? `color-mix(in srgb, ${c.accent} 8%, var(--space-panel-solid))` : undefined, transition: 'all .2s' }}>
                  <div style={{ width: 68, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in srgb, ${c.accent} 5%, rgba(4,9,18,0.9))`, borderRight: `1px solid ${active ? c.accent + '55' : 'var(--holo-line)'}` }}>
                    <img src={c.img} alt={c.name} style={{ width: 50, height: 50, objectFit: 'contain', filter: active ? `drop-shadow(0 0 8px ${c.accent}) drop-shadow(0 0 3px ${c.accent})` : 'brightness(0.6) saturate(0.6)', transition: 'filter .2s' }} />
                  </div>
                  <div style={{ padding: '9px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-data)', fontSize: 8, letterSpacing: '0.16em', textTransform: 'uppercase', color: c.accent, marginBottom: 1 }}>{c.num}</div>
                    <div className="nx-display" style={{ fontSize: 12, color: active ? c.accent : 'var(--txt)', lineHeight: 1.2 }}>{c.name}</div>
                    <div style={{ fontSize: 9, color: 'var(--txt-dim)', marginTop: 3, lineHeight: 1.3 }}>{c.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel kicker="Atributos" title="Distribución de Stats" icon="trending"
          right={<Chip tone={pool > 0 ? 'green' : 'dim'} icon="zap">{pool} pts libres</Chip>}>
          <div style={{ display: 'grid', gap: 14 }}>
            {STATS.map((s) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="nx-data" style={{ width: 86, fontSize: 12, color: 'var(--txt-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{STAT_LABEL[s]}</span>
                <div className="nx-bar" style={{ flex: 1 }}><i style={{ width: `${ch.stats[s]}%` }} /></div>
                <span className="nx-num" style={{ width: 30, textAlign: 'right', fontSize: 15 }}>{ch.stats[s]}</span>
                <div style={{ display: 'flex', gap: 5 }}>
                  <button className="nx-btn nx-btn-ghost nx-btn-sm" style={{ padding: '4px 8px' }} onClick={() => bump(s, -1)} disabled={ch.stats[s] <= 0}><Icon name="x" size={11} /></button>
                  <button className="nx-btn nx-btn-ghost nx-btn-sm" style={{ padding: '4px 8px' }} onClick={() => bump(s, +1)} disabled={pool <= 0 || ch.stats[s] >= 99}><Icon name="plus" size={11} /></button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

export function SaberBlade({ color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: 220, justifyContent: 'flex-end' }}>
      <div style={{ width: 11, flex: 1, marginBottom: 2, borderRadius: 6, position: 'relative',
        background: color, boxShadow: `0 0 16px 1px ${color}, 0 0 38px 6px ${color}55` }}>
        <div style={{ position: 'absolute', top: 3, bottom: 3, left: '50%', transform: 'translateX(-50%)', width: 4, borderRadius: 3, background: 'rgba(255,255,255,0.92)' }} />
      </div>
      <div style={{ width: 19, height: 56, borderRadius: 4, background: 'linear-gradient(90deg,#2c3445,#a9b8cf 42%,#2c3445)', border: '1px solid #161d29', boxShadow: '0 3px 8px rgba(0,0,0,.55)' }}>
        <div style={{ height: 6, margin: '9px 2px 0', background: '#161d29', borderRadius: 2 }} />
        <div style={{ height: 4, margin: '6px 2px 0', background: color, borderRadius: 2, boxShadow: `0 0 7px ${color}` }} />
        <div style={{ height: 6, margin: '6px 2px 0', background: '#161d29', borderRadius: 2 }} />
      </div>
    </div>
  );
}
