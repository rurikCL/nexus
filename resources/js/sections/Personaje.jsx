import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NX } from '../data/seed.js';
import { Icon, Panel, Btn, Chip, Avatar, TierBadge, MedalIcon, toast, ImageSlot } from '../components/ui.jsx';
import { playClickHabilidad, playClickOpcion } from '../utils/sounds.js';
import {
  useWindowWidth,
  mapApiCharacterToStoreCharacter,
  SIDES,
  TIER_RANGO_IMG,
  CLASES_JEDI,
  RANGOS_JEDI,
  FORMA_LABELS,
  CharacterCreation,
  HabilidadSlot,
  HabilidadPickerModal,
  TitulosPanel,
  SaberBlade,
} from './Comando.jsx';

export function PersonajeView({ S, user, go, onCharacterCreated }) {
  const isMobile = useWindowWidth() < 640;
  const me = S.byId('you') ?? {};
  const myTier = user?.tier ?? me.tier ?? 'iniciado';
  const ch = S.character;
  const puntos_libres = ch.puntos_libres ?? 5;
  const [statCaps, setStatCaps] = useState({ asignacion: 10, items: 15 });
  const COMBAT_STATS = ['vida', 'escudo', 'defensa', 'ataque', 'movimiento', 'iniciativa', 'punteria'];
  const COMBAT_LABEL = { vida: 'Vida', escudo: 'Escudo', defensa: 'Defensa', ataque: 'Ataque', movimiento: 'Agilidad', iniciativa: 'Iniciativa', punteria: 'Puntería' };
  const COMBAT_DEFAULTS = { vida: 8, escudo: 4, defensa: 2, ataque: 2, movimiento: 2, iniciativa: 2, punteria: 2 };
  const baseCombat = ch.combat_base_stats ?? {};
  const itemBonuses = ch.sable_bonos ?? {};
  const sab = NX.SABERS[ch.saber] || NX.SABERS.azul;
  const [saving, setSaving] = useState(false);

  const [habilidades, setHabilidades] = useState([]);
  const [slotPicker, setSlotPicker]   = useState(null);
  const [selectedForma, setSelectedForma] = useState(() => user?.character?.current_forma ?? 1);
  const [formaSlots, setFormaSlots]   = useState(() => {
    const raw = user?.character?.habilidades_por_forma ?? {};
    const allHabs = user?.character?.all_habilidades_data ?? {};
    const resolved = {};
    for (const [f, ids] of Object.entries(raw)) {
      resolved[f] = (Array.isArray(ids) ? ids : [null, null, null, null]).map(id =>
        id && allHabs[String(id)] ? allHabs[String(id)] : null
      );
    }
    return resolved;
  });

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('nx-token');
    fetch('/api/admin/configuraciones?q=cap_stats_&per_page=10', {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        if (cancelled) return;
        const caps = { asignacion: 10, items: 15 };
        for (const row of d?.data ?? []) {
          if (row?.nombre === 'cap_stats_asignacion') caps.asignacion = Math.max(1, Number(row.valor_numerico ?? 10));
          if (row?.nombre === 'cap_stats_items') caps.items = Math.max(1, Number(row.valor_numerico ?? 15));
        }
        setStatCaps(caps);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!user?.character) return;
    const raw     = user.character.habilidades_por_forma ?? {};
    const allHabs = user.character.all_habilidades_data  ?? {};
    const resolved = {};
    for (const [f, ids] of Object.entries(raw)) {
      resolved[f] = (Array.isArray(ids) ? ids : [null, null, null, null]).map(id =>
        id && allHabs[String(id)] ? allHabs[String(id)] : null
      );
    }
    setFormaSlots(resolved);
    setSelectedForma(user.character.current_forma ?? 1);
  }, [
    user?.character?.id,
    user?.character?.current_forma,
    user?.character?.habilidades_por_forma,
    user?.character?.all_habilidades_data,
  ]);

  const currentSlots = formaSlots[String(selectedForma)] ?? [null, null, null, null];
  const [armaEquipadaId, setArmaEquipadaId] = useState(() => user?.character?.arma_equipada?.id ?? '');
  const [equipandoArma, setEquipandoArma]   = useState(false);

  useEffect(() => {
    setArmaEquipadaId(user?.character?.arma_equipada?.id ?? '');
  }, [user?.character?.id, user?.character?.arma_equipada?.id]);

  const inventario = user?.character?.rol_objetos ?? [];
  const armasDisponibles = inventario.filter(o => o.tipo === 'arma');
  const [invTab, setInvTab] = useState('arma');
  const [equipOpen, setEquipOpen] = useState(false);
  const [equipTab, setEquipTab]   = useState('inventario');
  const itemsDeTab = inventario.filter(o => o.tipo === invTab);

  useEffect(() => {
    if (!equipOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [equipOpen]);

  const handleEquiparArma = async () => {
    setEquipandoArma(true);
    const token = localStorage.getItem('nx-token');
    try {
      const res = await fetch('/api/character/equipar-arma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rol_objeto_id: armaEquipadaId || null }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        toast(armaEquipadaId ? 'Arma equipada' : 'Arma desequipada', { tone: 'success', icon: 'check' });
        onCharacterCreated?.({ ...user.character, arma_equipada: data?.arma_equipada ?? null });
      } else {
        toast('Error al equipar el arma', { tone: 'error', icon: 'x' });
      }
    } catch {
      toast('Error de conexión', { tone: 'error', icon: 'x' });
    } finally {
      setEquipandoArma(false);
    }
  };

  const loadHabilidades = () => {
    if (habilidades.length > 0) return;
    const token = localStorage.getItem('nx-token');
    fetch('/api/rol-habilidades?aprendidas=1', {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    }).then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.habilidades) setHabilidades(d.habilidades); })
      .catch(() => {});
  };

  const handleOpenPicker = (slot) => {
    loadHabilidades();
    setSlotPicker(slot);
  };

  const handleAssignHabilidad = async (habilidad) => {
    const slot = slotPicker;
    setSlotPicker(null);
    void playClickHabilidad();
    const newCurrent = [...currentSlots];
    newCurrent[slot - 1] = habilidad;
    const newFormaSlots = { ...formaSlots, [String(selectedForma)]: newCurrent };
    setFormaSlots(newFormaSlots);
    const token = localStorage.getItem('nx-token');
    try {
      const slotPayload = {};
      newCurrent.forEach((h, i) => { slotPayload[i + 1] = h?.id ?? null; });
      const res = await fetch('/api/character/habilidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ forma: selectedForma, slots: slotPayload }),
      });
      if (res.ok) {
        toast('Habilidad asignada', { tone: 'success', icon: 'check', desc: `"${habilidad.nombre}" en Forma ${selectedForma}, slot ${slot}` });
        onCharacterCreated?.({
          ...user.character,
          current_forma: selectedForma,
          habilidades_por_forma: { ...(user.character.habilidades_por_forma ?? {}), [String(selectedForma)]: newCurrent.map(h => h?.id ?? null) },
          all_habilidades_data: { ...(user.character.all_habilidades_data ?? {}), [String(habilidad.id)]: habilidad },
        });
      }
    } catch {
      toast('Error al guardar habilidad', { tone: 'error', icon: 'x' });
      setFormaSlots(formaSlots);
    }
  };

  if (!user?.character) {
    return <CharacterCreation user={user} S={S} onCharacterCreated={onCharacterCreated} />;
  }

  const combatBump = (stat, d) => {
    const pts = ch.puntos_libres ?? 5;
    const cur = ch[stat] ?? COMBAT_DEFAULTS[stat];
    const cap = statCaps.asignacion ?? 10;
    if (d > 0 && (pts <= 0 || cur >= cap)) return;
    const nv = cur + d;
    if (nv < 1 || nv > cap) return;
    S.setCharacter({
      ...ch,
      [stat]: nv,
      combat_base_stats: { ...(ch.combat_base_stats ?? {}), [stat]: nv },
      puntos_libres: pts - d,
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('nx-token');
      const res = await fetch('/api/character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: ch.name, handle: ch.handle, bio: ch.bio || '', lore: ch.lore || '',
          cls: ch.cls, side: ch.side, saber_color: ch.saber, stats: ch.stats,
          vida: ch.vida ?? 8, escudo: ch.escudo ?? 4, defensa: ch.defensa ?? 2,
          ataque: ch.ataque ?? 2, movimiento: ch.movimiento ?? 2,
          iniciativa: ch.iniciativa ?? 2, punteria: ch.punteria ?? 2,
          puntos_libres: ch.puntos_libres ?? 5,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.message ?? 'Error al guardar', { tone: 'error', icon: 'x' }); return; }
      const savedCharacter = mapApiCharacterToStoreCharacter(data.character, ch);
      if (savedCharacter) {
        S.setCharacter(savedCharacter);
        onCharacterCreated?.(savedCharacter);
      }
      window.dispatchEvent(new CustomEvent('nx-mision-updated', {
        detail: { type: 'hitos-sync', source: 'character-save' },
      }));
      toast('Personaje guardado', { tone: 'success', icon: 'check', desc: 'Tu ficha de combate está actualizada' });
    } catch {
      toast('Error de conexión', { tone: 'error', icon: 'x' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="nx-fade nx-personaje-grid" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '340px 1fr', gap: 18, alignItems: 'start', width: '100%', maxWidth: '100%', overflowX: 'clip' }}>
        <div style={{ display: 'grid', gap: 18, minWidth: 0, maxWidth: '100%' }}>
          <Panel kicker="Retrato de combate" title="Identidad" icon="user" noBody>
            <div className="nx-panel-body" style={{ display: 'grid', placeItems: 'center', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ position: 'relative', width: 200, height: 220 }}>
                  <ImageSlot src={ch.photo} onUpload={(url) => S.setCharacter({ ...ch, photo: url, photo_url: url })}
                    className="nx-hex" style={{ width: 200, height: 220, display: 'block' }}
                    shape="rect" placeholder="Sube tu retrato" />
                  <div className="nx-hex" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', border: `1.5px solid ${sab}`, boxShadow: `0 0 26px -8px ${sab} inset` }} />
                </div>
                <SaberBlade color={sab} onClick={() => go?.('armado-sable')} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div className="nx-display" style={{ fontSize: 20 }}>{ch.name}</div>
                {user?.character?.titulo_activo && (
                  <div className="nx-data" style={{ fontSize: 11, color: 'var(--holocron-oro)', marginTop: 2 }}>
                    {user.character.titulo_activo.nombre}
                  </div>
                )}
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

          <TitulosPanel user={user} onCharacterCreated={onCharacterCreated} />

          <Panel kicker="Cristal de poder" title="Color de Sable" icon="zap">
            {ch.side === 'oscuro' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center', border: `2px solid ${NX.SABERS.rojo}`, background: 'rgba(4,9,18,0.5)', boxShadow: `0 0 16px -3px ${NX.SABERS.rojo}` }}>
                  <span style={{ width: 18, height: 18, borderRadius: '50%', background: NX.SABERS.rojo, boxShadow: `0 0 12px ${NX.SABERS.rojo}` }} />
                </span>
                <div>
                  <div className="nx-data" style={{ fontSize: 11, color: NX.SABERS.rojo, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Cristal Rojo · Kyber corrompido</div>
                  <div style={{ fontSize: 9, color: 'var(--txt-faint)', marginTop: 3 }}>El Lado Oscuro impone su cristal. No hay elección.</div>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {Object.keys(NX.SABERS).filter(k => k !== 'rojo').map((key) => {
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
              </>
            )}
          </Panel>

          <Panel kicker="Logros" title="Medallas" icon="medal">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {(me.medals ?? []).map((m) => <MedalIcon key={m} id={m} size={40} />)}
            </div>
          </Panel>

          <Panel kicker="Orden Jedi" title="Rango" icon="shield">
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 6 }}>
              {RANGOS_JEDI.map(r => {
                const on = myTier === r.id;
                return (
                  <div key={r.id} style={{
                    padding: '10px 6px 8px', borderRadius: 'var(--radius-md)', textAlign: 'center',
                    border: `1px solid ${on ? 'var(--holo)' : 'var(--holo-line)'}`,
                    background: on ? 'color-mix(in srgb, var(--holo) 10%, transparent)' : 'rgba(255,255,255,.02)',
                    boxShadow: on ? '0 0 14px -6px var(--holo)' : 'none',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                  }}>
                    <img src={r.img} alt={r.label} style={{
                      width: 42, height: 42, objectFit: 'contain',
                      filter: on ? 'drop-shadow(0 0 6px var(--holo))' : 'brightness(0.45) saturate(0.3)',
                    }} />
                    <div className="nx-display" style={{ fontSize: 9, color: on ? 'var(--holo)' : 'var(--txt-faint)', lineHeight: 1.2 }}>{r.label}</div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel kicker="Orden Jedi" title="Clase y Grado" icon="star">
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                {CLASES_JEDI.map(c => {
                  const on = user?.clase === c.id;
                  return (
                    <div key={c.id} style={{
                      padding: '10px 6px 8px', borderRadius: 'var(--radius-md)', textAlign: 'center',
                      border: `1px solid ${on ? c.color : 'var(--holo-line)'}`,
                      background: on ? `color-mix(in srgb, ${c.color} 10%, transparent)` : 'rgba(255,255,255,.02)',
                      boxShadow: on ? `0 0 14px -6px ${c.color}` : 'none',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                    }}>
                      <img src={c.img} alt={c.label} style={{
                        width: 42, height: 42, objectFit: 'contain',
                        filter: on ? `drop-shadow(0 0 6px ${c.color})` : 'brightness(0.45) saturate(0.3)',
                      }} />
                      <div className="nx-display" style={{ fontSize: 9, color: on ? c.color : 'var(--txt-faint)', lineHeight: 1.2 }}>{c.label}</div>
                    </div>
                  );
                })}
              </div>
              {myTier === 'caballero' && (
                <div>
                  <div className="nx-kicker" style={{ marginBottom: 6 }}>Grado</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[1, 2, 3, 4, 5].map(n => {
                      const on = Number(user?.grado) === n;
                      return (
                        <div key={n} style={{
                          width: 36, height: 36, borderRadius: 'var(--radius-md)',
                          border: `1px solid ${on ? 'var(--holo)' : 'var(--holo-line)'}`,
                          background: on ? 'color-mix(in srgb, var(--holo) 18%, transparent)' : 'rgba(255,255,255,.02)',
                          color: on ? 'var(--holo)' : 'var(--txt-faint)',
                          fontFamily: 'var(--font-data)', fontSize: 13, fontWeight: 700,
                          display: 'grid', placeItems: 'center',
                          boxShadow: on ? '0 0 10px -4px var(--holo)' : 'none',
                        }}>{n}</div>
                      );
                    })}
                  </div>
                </div>
              )}
              {!user?.clase && (
                <div style={{ fontSize: 10, color: 'var(--txt-faint)', fontStyle: 'italic', fontFamily: 'var(--font-data)' }}>
                  Sin clase asignada.
                </div>
              )}
            </div>
          </Panel>
        </div>

        <div style={{ display: 'grid', gap: 18, minWidth: 0, maxWidth: '100%' }}>
          <Panel kicker="Ficha" title="Datos del Personaje" icon="edit"
            right={<Btn kind="accent" icon="check" sm disabled={saving} onClick={handleSave}>{saving ? 'Guardando...' : 'Guardar'}</Btn>}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
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
                <label className="nx-label">Lore del personaje</label>
                <textarea className="nx-textarea" value={ch.lore ?? ''} onChange={(e) => S.setCharacter({ ...ch, lore: e.target.value })} placeholder="Historia, origen, motivaciones..." style={{ minHeight: 90 }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="nx-label">Lado de la Fuerza</label>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
                  {Object.entries(SIDES).map(([key, s]) => {
                    const on = ch.side === key;
                    return (
                      <button key={key} onClick={() => S.setCharacter({ ...ch, side: key, ...(key === 'oscuro' ? { saber: 'rojo' } : ch.saber === 'rojo' ? { saber: 'azul' } : {}) })}
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: 6, width: '100%', minWidth: 0 }}>
              {CLASES_JEDI.map((c) => {
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

          <Panel kicker="Técnicas de Combate" title="Habilidades" icon="zap">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {FORMA_LABELS.map((label, i) => {
                const f = i + 1;
                const active = f === selectedForma;
                return (
                  <button key={f} onClick={() => { void playClickOpcion(); setSelectedForma(f); }} title={label} style={{
                    padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 10,
                    fontFamily: 'var(--font-data)', letterSpacing: '0.08em',
                    background: active ? 'color-mix(in srgb, var(--holo) 18%, rgba(255,255,255,.04))' : 'rgba(255,255,255,.04)',
                    border: `1px solid ${active ? 'var(--holo)' : 'var(--holo-line)'}`,
                    color: active ? 'var(--holo)' : 'var(--txt-faint)',
                    boxShadow: active ? '0 0 10px -4px var(--holo)' : 'none',
                    transition: 'all .14s',
                  }}>
                    {label}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 9, color: 'var(--txt-faint)', fontFamily: 'var(--font-data)', marginBottom: 10, letterSpacing: '0.06em' }}>
              {FORMA_LABELS[selectedForma - 1]} — 4 slots
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: 10, width: '100%', minWidth: 0 }}>
              {[1, 2, 3, 4].map(slot => (
                <HabilidadSlot key={slot} slot={slot} habilidad={currentSlots[slot - 1] ?? null} onClick={() => { void playClickOpcion(); handleOpenPicker(slot); }} />
              ))}
            </div>
          </Panel>

          <HabilidadPickerModal
            open={slotPicker !== null}
            onClose={() => setSlotPicker(null)}
            habilidades={habilidades.filter(h => h.forma === 0 || h.forma === selectedForma)}
            onAssign={handleAssignHabilidad}
            slotIndex={slotPicker}
          />

          <Panel kicker="Atributos" title="Distribución de Stats" icon="trending"
            right={<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Chip tone={puntos_libres > 0 ? 'green' : 'dim'} icon="zap">{puntos_libres} pts libres</Chip><Btn kind="accent" icon="check" sm disabled={saving} onClick={handleSave}>Asignar</Btn></div>}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 10, width: '100%', minWidth: 0 }}>
              {COMBAT_STATS.map((s) => {
                const base = baseCombat[s] ?? ch[s] ?? COMBAT_DEFAULTS[s];
                const bonus = itemBonuses[s] ?? 0;
                const total = base + bonus;
                const atCap = base >= (statCaps.asignacion ?? 10);
                return (
                  <div key={s} style={{
                    display: 'grid', gridTemplateColumns: 'minmax(72px, 1fr) auto auto auto auto auto', alignItems: 'center', gap: 8,
                    padding: '10px 12px', borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--holo-line)', background: 'rgba(255,255,255,0.02)',
                    minWidth: 0, maxWidth: '100%',
                  }}>
                    <span className="nx-data" style={{ fontSize: 11, color: 'var(--txt-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 0 }}>
                      {COMBAT_LABEL[s]}
                    </span>
                    <span className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)' }}>x</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                      <button className="nx-btn nx-btn-ghost nx-btn-sm" style={{ padding: '4px 8px' }}
                        onClick={() => combatBump(s, -1)} disabled={base <= 1}>
                        <span style={{ fontSize: 12, lineHeight: 1 }}>-</span>
                      </button>
                      <span className="nx-num" style={{ minWidth: 24, textAlign: 'center', fontSize: 15, color: atCap ? 'var(--holocron-oro)' : 'var(--txt)' }}>{base}</span>
                      <button className="nx-btn nx-btn-ghost nx-btn-sm" style={{ padding: '4px 8px' }}
                        onClick={() => combatBump(s, +1)} disabled={puntos_libres <= 0 || base >= statCaps.asignacion}>
                        <Icon name="plus" size={11} />
                      </button>
                    </div>
                    <span className="nx-data" style={{ fontSize: 11, color: bonus >= 0 ? '#10b981' : '#ff6b6b', whiteSpace: 'nowrap', minWidth: 0 }}>
                      {bonus >= 0 ? '+' : ''}{bonus}
                    </span>
                    <span className="nx-data" style={{ fontSize: 12, color: 'var(--txt-faint)' }}>=</span>
                    <span className="nx-num" style={{ fontSize: 19, color: atCap ? 'var(--holocron-oro)' : 'var(--txt)', minWidth: 28, textAlign: 'right', justifySelf: 'end' }}>
                      {total}
                    </span>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>

      {/* Cajón de equipo */}
      {createPortal(<>
        <button
          onClick={() => setEquipOpen(o => !o)}
          style={{
            position: 'fixed', top: '50%', right: equipOpen ? 400 : 0, transform: 'translateY(-50%)',
            zIndex: 41, cursor: 'pointer',
            background: 'rgba(5,10,22,0.92)', backdropFilter: 'blur(6px)',
            border: '1px solid var(--holo-line)', borderRight: equipOpen ? '1px solid var(--holo-line)' : 'none',
            borderRadius: '8px 0 0 8px',
            padding: '16px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            color: 'var(--holo)', transition: 'right 0.28s var(--ease-standard)',
          }}
        >
          <Icon name="chevron" size={13} style={{ transform: equipOpen ? 'rotate(0deg)' : 'rotate(180deg)' }} />
          <span style={{ writingMode: 'vertical-rl', fontFamily: 'var(--font-data)', fontSize: 10, letterSpacing: '0.14em' }}>EQUIPO</span>
        </button>
      </>, document.body)}
    </>
  );
}
