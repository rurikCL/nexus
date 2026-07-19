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
  mediaUrl,
  CharacterCreation,
  HabilidadSlot,
  HabilidadPickerModal,
  TitulosPanel,
  SaberBlade,
} from './Comando.jsx';

const EQUIP_TABS = [
  { value: 'inventario', label: 'Inventario', icon: 'roster' },
  { value: 'sable', label: 'Sable', icon: 'sword' },
  { value: 'nave', label: 'Nave', icon: 'ship' },
];

const ITEM_TYPES = [
  { value: 'arma', label: 'Armas', icon: 'sword' },
  { value: 'consumible', label: 'Consumibles', icon: 'box' },
  { value: 'mision', label: 'Misiones', icon: 'calendar' },
  { value: 'otro', label: 'Otros', icon: 'box' },
];

const fmtCr = (n) => `${Math.round(n ?? 0).toLocaleString('es-CL')} cr`;

function NaveMiniStatBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 9, fontFamily: 'var(--font-data)', color: 'var(--txt-faint)', width: 66, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 10, fontFamily: 'var(--font-data)', color: 'var(--txt-dim)', width: 44, textAlign: 'right', flexShrink: 0 }}>{value}/{max}</span>
    </div>
  );
}

function NaveCombatStat({ label, icon, color, base, efectivo }) {
  const baseVal = base ?? 0;
  const efectivoVal = efectivo ?? baseVal;
  const bono = efectivoVal - baseVal;
  return (
    <span className="nx-data" style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10,
      padding: '4px 9px', borderRadius: 4, background: `${color}14`, border: `1px solid ${color}40`, color,
    }}>
      <Icon name={icon} size={11} />
      {label} {efectivoVal}
      {bono > 0 && <span style={{ color: '#4ade80' }}>(+{bono})</span>}
    </span>
  );
}

const NAVE_BONUS_FIELDS = [
  { key: 'bono_ataque', label: 'ATQ', color: '#ff7043', icon: 'sword' },
  { key: 'bono_defensa', label: 'DEF', color: '#38cdf0', icon: 'shield' },
  { key: 'bono_punteria', label: 'PNT', color: '#22c55e', icon: 'target' },
  { key: 'bono_movimiento', label: 'MOV', color: '#E6B325', icon: 'arrow' },
  { key: 'bono_iniciativa', label: 'INI', color: '#a78bfa', icon: 'zap' },
  { key: 'bono_vida', label: 'VIDA', color: '#4ade80', icon: 'heart' },
  { key: 'bono_escudo', label: 'ESC', color: '#38cdf0', icon: 'shield' },
  { key: 'bono_capacidad_carga', label: 'CARGA', color: '#f59e0b', icon: 'box' },
  { key: 'bono_capacidad_salto', label: 'SALTO', color: '#a78bfa', icon: 'zap' },
  { key: 'bono_costo_reparacion', label: 'REPARO', color: '#22c55e', icon: 'shield' },
];

function MejoraSlot({ slot, mejora, onClick, disabled }) {
  const isEmpty = !mejora;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={isEmpty ? `Asignar mejora ${slot}` : mejora.nombre}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        padding: 14, borderRadius: 'var(--radius-md)', cursor: disabled ? 'wait' : 'pointer',
        background: isEmpty ? 'rgba(255,255,255,.025)' : 'color-mix(in srgb, var(--holo) 8%, rgba(255,255,255,.03))',
        border: `1px solid ${isEmpty ? 'var(--holo-line)' : 'var(--holo)'}`,
        boxShadow: isEmpty ? 'none' : '0 0 14px -6px var(--holo)',
        opacity: disabled ? 0.6 : 1, transition: 'all .18s', flex: 1, minWidth: 0,
      }}
    >
      {isEmpty ? (
        <>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '1px dashed var(--holo-line)', display: 'grid', placeItems: 'center', opacity: 0.5 }}>
            <Icon name="plus" size={16} />
          </div>
          <div className="nx-data" style={{ fontSize: 9, color: 'var(--txt-faint)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Slot {slot}
          </div>
        </>
      ) : (
        <>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            display: 'grid', placeItems: 'center',
            background: 'color-mix(in srgb, var(--holo) 15%, rgba(4,9,18,.8))',
            border: '1px solid var(--holo)',
            boxShadow: '0 0 12px -4px var(--holo)',
            overflow: 'hidden',
          }}>
            {mejora.imagen
              ? <img src={mediaUrl(mejora.imagen)} alt={mejora.nombre} style={{ width: 28, height: 28, objectFit: 'contain' }} />
              : <Icon name="box" size={18} style={{ color: 'var(--holo)' }} />
            }
          </div>
          <div style={{ textAlign: 'center', minWidth: 0 }}>
            <div className="nx-display" style={{ fontSize: 9, color: 'var(--holo)', lineHeight: 1.2, overflowWrap: 'break-word' }}>
              {mejora.nombre}
            </div>
          </div>
        </>
      )}
    </button>
  );
}

function MejoraBadges({ mejora }) {
  const badges = NAVE_BONUS_FIELDS.filter(b => mejora[b.key]);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {badges.map(b => (
        <span key={b.key} style={{
          fontSize: 8, fontFamily: 'var(--font-data)', letterSpacing: '0.06em',
          padding: '2px 6px', borderRadius: 3,
          background: `${b.color}18`, border: `1px solid ${b.color}40`,
          color: b.color, whiteSpace: 'nowrap', lineHeight: 1.4,
        }}>
          {mejora[b.key] > 0 ? '+' : ''}{mejora[b.key]} {b.label}
        </span>
      ))}
      {mejora.bono_cooldown ? (
        <span style={{
          fontSize: 8, fontFamily: 'var(--font-data)', letterSpacing: '0.06em',
          padding: '2px 6px', borderRadius: 3,
          background: '#f59e0b18', border: '1px solid #f59e0b40',
          color: '#f59e0b', whiteSpace: 'nowrap', lineHeight: 1.4,
        }}>
          {mejora.bono_cooldown} CD{mejora.mejora_habilidad ? `: ${mejora.mejora_habilidad.nombre}` : ''}
        </span>
      ) : null}
    </div>
  );
}

function MejoraPickerRow({ mejora, selected, onAssign }) {
  return (
    <div onClick={onAssign} style={{
      display: 'flex', alignItems: 'flex-start', gap: 11,
      padding: '10px 12px', borderRadius: 'var(--radius-md)',
      border: `1px solid ${selected ? 'var(--holo)' : 'var(--holo-line)'}`,
      background: selected ? 'color-mix(in srgb, var(--holo) 10%, rgba(255,255,255,.03))' : 'rgba(255,255,255,.02)',
      cursor: 'pointer', transition: 'all .15s',
    }}
      onMouseEnter={e => { if (!selected) { e.currentTarget.style.borderColor = 'var(--holo)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--holo) 8%, transparent)'; } }}
      onMouseLeave={e => { if (!selected) { e.currentTarget.style.borderColor = 'var(--holo-line)'; e.currentTarget.style.background = 'rgba(255,255,255,.02)'; } }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        display: 'grid', placeItems: 'center',
        background: 'rgba(56,205,240,0.12)', border: '1px solid rgba(56,205,240,0.28)',
        overflow: 'hidden',
      }}>
        {mejora.imagen
          ? <img src={mediaUrl(mejora.imagen)} alt={mejora.nombre} style={{ width: 28, height: 28, objectFit: 'contain' }} />
          : <Icon name="box" size={20} style={{ color: 'var(--holo)' }} />
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--txt)', lineHeight: 1.2 }}>{mejora.nombre}</div>
          {selected && <Chip tone="green" icon="check">Instalada</Chip>}
        </div>
        {mejora.efecto && (
          <div style={{ fontSize: 11, color: 'var(--txt-dim)', marginBottom: 6 }}>{mejora.efecto}</div>
        )}
        <MejoraBadges mejora={mejora} />
      </div>
    </div>
  );
}

function MejoraPickerModal({ open, onClose, mejoras, onAssign, onUnassign, slotIndex, currentId }) {
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(4,7,15,0.85)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'rgba(5,10,22,0.98)', border: '1px solid var(--holo-line)',
        borderRadius: 'var(--radius-lg)', boxShadow: '0 24px 80px rgba(0,0,0,.7)',
        width: '100%', maxWidth: 520, maxHeight: '80vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--holo-line)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--holo)' }}><Icon name="box" size={16} /></span>
          <div style={{ flex: 1 }}>
            <div className="nx-display" style={{ fontSize: 14 }}>Seleccionar Mejora</div>
            <div className="nx-data" style={{ fontSize: 9, color: 'var(--txt-faint)', marginTop: 2 }}>SLOT {slotIndex} — Elige una mejora para tu nave</div>
          </div>
          <button className="nx-btn nx-btn-ghost" style={{ padding: 7 }} onClick={onClose}>
            <Icon name="x" size={15} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {currentId && (
            <button onClick={onUnassign} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 12px', marginBottom: 10, borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--holo-line)', background: 'rgba(255,255,255,.02)',
              color: 'var(--txt-dim)', cursor: 'pointer', fontSize: 12,
            }}>
              <Icon name="x" size={13} /> Quitar mejora de este slot
            </button>
          )}
          {mejoras.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--txt-faint)' }}>
              <div className="nx-data" style={{ fontSize: 11, letterSpacing: '0.1em' }}>NO POSEES MEJORAS DE NAVE</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {mejoras.map(m => (
                <MejoraPickerRow key={m.id} mejora={m} selected={m.id === currentId} onAssign={() => onAssign(m)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function NaveMejorasSlots({ owned, onChanged }) {
  const [mejoras, setMejoras] = useState([]);
  const [busySlot, setBusySlot] = useState(null);
  const [pickerSlot, setPickerSlot] = useState(null);

  const authHeaders = () => ({ Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('nx-token')}` });

  useEffect(() => {
    fetch(`/api/naves/${owned.id}/mejoras-options`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : { mejoras: [] })
      .then(d => setMejoras(d.mejoras ?? []))
      .catch(() => {});
  }, [owned.id]);

  const setSlot = async (slot, objetoId) => {
    setBusySlot(slot);
    try {
      const res = await fetch(`/api/naves/${owned.id}/mejoras/${slot}`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ objeto_id: objetoId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? data.error ?? 'No se pudo actualizar la mejora.');
      setPickerSlot(null);
      onChanged?.();
    } catch (err) {
      toast(err.message ?? 'No se pudo actualizar la mejora', { tone: 'error' });
    } finally {
      setBusySlot(null);
    }
  };

  return (
    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--holo-line)' }}>
      <div className="nx-kicker" style={{ fontSize: 9, marginBottom: 8 }}>Mejoras instaladas (4 slots)</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {[1, 2, 3, 4].map(slot => (
          <MejoraSlot
            key={slot} slot={slot} mejora={owned[`mejora${slot}`]}
            disabled={busySlot === slot}
            onClick={() => setPickerSlot(slot)}
          />
        ))}
      </div>
      {mejoras.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--txt-faint)', marginTop: 8 }}>
          No posees mejoras de nave en tu inventario. Consíguelas con un vendedor.
        </div>
      )}

      <MejoraPickerModal
        open={pickerSlot != null}
        onClose={() => setPickerSlot(null)}
        mejoras={mejoras}
        slotIndex={pickerSlot}
        currentId={pickerSlot ? (owned[`mejora${pickerSlot}`]?.id ?? null) : null}
        onAssign={(m) => setSlot(pickerSlot, m.id)}
        onUnassign={() => setSlot(pickerSlot, null)}
      />
    </div>
  );
}

function NaveEquipadaPanel() {
  const [naves, setNaves] = useState([]);
  const [naveEquipadaId, setNaveEquipadaId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const authHeaders = () => ({ Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('nx-token')}` });

  const load = () => {
    setLoading(true);
    fetch('/api/naves/mias', { headers: authHeaders() })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setNaves(d.naves ?? []); setNaveEquipadaId(d.nave_equipada_id ?? null); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const runAction = async (id, path, successMsg) => {
    setBusy(id);
    try {
      const res = await fetch(`/api${path}`, { method: 'POST', headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? 'No se pudo completar la acción.');
      if (successMsg) toast(successMsg, { tone: 'success', icon: 'check' });
      load();
    } catch (err) {
      toast(err.message ?? 'No se pudo completar la acción', { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const equipar     = (owned) => runAction(owned.id, `/naves/${owned.id}/equipar`, `${owned.nave?.nombre ?? 'Nave'} equipada`);
  const desequipar  = ()      => runAction('unequip', '/naves/desequipar');
  const reabastecer = (owned) => runAction(`fuel-${owned.id}`, `/naves/${owned.id}/reabastecer`, 'Combustible reabastecido');
  const reparar     = (owned) => runAction(`fix-${owned.id}`,  `/naves/${owned.id}/reparar`,     'Nave reparada');

  const equipada = naves.find(n => n.id === naveEquipadaId);
  const otras    = naves.filter(n => n.id !== naveEquipadaId);

  return (
    <Panel kicker="Equipo" title="Nave Equipada" icon="ship">
      {loading ? (
        <div style={{ fontSize: 12, color: 'var(--txt-faint)', padding: '6px 0' }}>Cargando naves...</div>
      ) : naves.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--txt-faint)', padding: '6px 0' }}>
          No posees ninguna nave. Consigue una hablando con un vendedor de naves en el Mapa Galáctico.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {equipada ? (
            <div className="nx-panel solid" style={{ padding: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center',
                  background: 'color-mix(in srgb, var(--holo) 18%, rgba(4,9,18,0.9))',
                  border: '1px solid var(--holo-line)', overflow: 'hidden',
                }}>
                  {equipada.nave?.imagen
                    ? <img src={mediaUrl(equipada.nave.imagen)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <Icon name="ship" size={22} style={{ color: 'var(--holo)' }} />}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="nx-display" style={{ fontSize: 13, color: 'var(--txt)' }}>{equipada.nave?.nombre}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    <Chip tone="green" icon="check">Equipada</Chip>
                    <Chip tone="dim">+{equipada.capacidad_carga_max ?? 0} carga</Chip>
                  </div>
                </div>
              </div>
              <Btn kind="ghost" sm onClick={desequipar} disabled={busy === 'unequip'} style={{ marginTop: 12 }}>
                Desequipar
              </Btn>
              <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
                <NaveMiniStatBar label="Vida"        value={equipada.vida_actual}        max={equipada.vida_max ?? 0}            color="#4ade80" />
                <NaveMiniStatBar label="Escudo"      value={equipada.escudo_actual}      max={equipada.escudo_max ?? 0}          color="#38cdf0" />
                <NaveMiniStatBar label="Combustible" value={equipada.combustible_actual} max={equipada.capacidad_salto_max ?? 0} color="var(--holocron-oro)" />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <NaveCombatStat label="Atq" icon="sword"  color="#ff7043" base={equipada.nave?.ataque}         efectivo={equipada.ataque_efectivo} />
                <NaveCombatStat label="Vel" icon="zap"    color="#E6B325" base={equipada.nave?.velocidad}      efectivo={equipada.velocidad_efectiva} />
                <NaveCombatStat label="Man" icon="target" color="#a78bfa" base={equipada.nave?.maniobrabilidad} efectivo={equipada.maniobrabilidad_efectiva} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <Btn kind="ghost" sm icon="fuel" onClick={() => reabastecer(equipada)}
                  disabled={busy === `fuel-${equipada.id}` || equipada.combustible_actual >= (equipada.capacidad_salto_max ?? 0)}>
                  Reabastecer ({fmtCr(equipada.nave?.costo_combustible)})
                </Btn>
                <Btn kind="ghost" sm icon="shield" onClick={() => reparar(equipada)}
                  disabled={busy === `fix-${equipada.id}` || (equipada.vida_actual >= (equipada.vida_max ?? 0) && equipada.escudo_actual >= (equipada.escudo_max ?? 0))}>
                  Reparar ({fmtCr(equipada.costo_reparacion_final)})
                </Btn>
              </div>
              <NaveMejorasSlots owned={equipada} onChanged={load} />
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--txt-faint)' }}>
              No tienes ninguna nave equipada. Elige una de tus naves abajo.
            </div>
          )}

          {otras.length > 0 && (
            <div style={{ display: 'grid', gap: 8 }}>
              <div className="nx-kicker" style={{ fontSize: 9 }}>Otras naves propias</div>
              {otras.map(owned => (
                <div key={owned.id} className="nx-panel" style={{ padding: 11, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 8, background: 'rgba(56,205,240,0.08)',
                    display: 'grid', placeItems: 'center', flexShrink: 0, overflow: 'hidden',
                  }}>
                    {owned.nave?.imagen
                      ? <img src={mediaUrl(owned.nave.imagen)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <Icon name="ship" size={16} style={{ color: 'var(--holo)' }} />}
                  </div>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--txt)' }}>{owned.nave?.nombre}</span>
                  <Btn kind="accent" sm onClick={() => equipar(owned)} disabled={busy === owned.id}>
                    {busy === owned.id ? '...' : 'Equipar'}
                  </Btn>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function WeaponCard({ objeto, selected, onClick }) {
  const isUnarmed = !objeto;
  const img = objeto ? mediaUrl(objeto.imagen) : null;
  const dano = isUnarmed ? 3 : (objeto.dano ?? null);
  const danoPerforante = isUnarmed ? 0 : (objeto.dano_perforante ?? 0);
  const tipoAtaque = isUnarmed ? null : objeto.tipo_ataque;

  return (
    <button
      onClick={onClick}
      title={isUnarmed ? 'Sin arma (desarmado)' : objeto.nombre}
      className="nx-panel solid"
      style={{
        padding: 0, overflow: 'hidden', cursor: 'pointer', textAlign: 'left',
        display: 'flex', alignItems: 'stretch', width: '100%',
        borderColor: selected ? 'var(--holo)' : undefined,
        boxShadow: selected ? '0 0 16px -6px var(--holo)' : undefined,
        background: selected ? 'color-mix(in srgb, var(--holo) 8%, var(--space-panel-solid))' : undefined,
        transition: 'all .18s',
      }}
    >
      <div style={{
        width: 60, height: 60, flexShrink: 0, display: 'grid', placeItems: 'center',
        background: 'color-mix(in srgb, var(--holo) 5%, rgba(4,9,18,0.9))',
        borderRight: `1px solid ${selected ? 'var(--holo)' + '55' : 'var(--holo-line)'}`,
      }}>
        {img ? (
          <img src={img} alt={objeto.nombre} style={{
            width: 44, height: 44, objectFit: 'contain',
            filter: selected ? 'drop-shadow(0 0 6px var(--holo))' : 'brightness(0.75) saturate(0.8)',
            transition: 'filter .18s',
          }} />
        ) : (
          <Icon name="sword" size={26} style={{ color: 'var(--txt-faint)', opacity: isUnarmed ? 0.4 : 0.7 }} />
        )}
      </div>
      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5, minWidth: 0, flex: 1 }}>
        <div className="nx-display" style={{
          fontSize: 12, color: selected ? 'var(--holo)' : 'var(--txt)', lineHeight: 1.2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {isUnarmed ? 'Sin arma (desarmado)' : objeto.nombre}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {dano != null && (
            <span className="nx-data" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--txt-dim)' }}>
              <Icon name="flame" size={12} style={{ color: '#ff6b6b' }} /> {dano}
            </span>
          )}
          {danoPerforante > 0 && (
            <span className="nx-data" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--txt-dim)' }}>
              <Icon name="fire" size={12} style={{ color: '#8aa0c0' }} /> +{danoPerforante}P
            </span>
          )}
          {tipoAtaque && (
            <span className="nx-data" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--txt-dim)', textTransform: 'capitalize' }}>
              <Icon name={tipoAtaque === 'melee' ? 'sword' : 'target'} size={12} /> {tipoAtaque}
            </span>
          )}
        </div>
      </div>
      {selected && (
        <div style={{ display: 'flex', alignItems: 'center', paddingRight: 12 }}>
          <Icon name="check" size={16} style={{ color: 'var(--holo)' }} />
        </div>
      )}
    </button>
  );
}

function InventoryItemCard({ objeto, icon = 'star' }) {
  const img = mediaUrl(objeto.imagen);
  const typeLabel = objeto.tipo ? String(objeto.tipo).replaceAll('_', ' ') : '';

  return (
    <div className="nx-panel solid" style={{ padding: 0, overflow: 'hidden', display: 'flex', alignItems: 'stretch' }}>
      <div style={{
        width: 60, height: 60, flexShrink: 0, display: 'grid', placeItems: 'center',
        background: 'color-mix(in srgb, var(--holo) 5%, rgba(4,9,18,0.9))',
        borderRight: '1px solid var(--holo-line)',
      }}>
        {img ? (
          <img src={img} alt={objeto.nombre} style={{ width: 44, height: 44, objectFit: 'contain', filter: 'brightness(0.85) saturate(0.85)' }} />
        ) : (
          <Icon name={icon} size={24} style={{ color: 'var(--txt-faint)', opacity: 0.6 }} />
        )}
      </div>
      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, minWidth: 0, flex: 1 }}>
        <div className="nx-display" style={{ fontSize: 12, color: 'var(--txt)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {objeto.nombre}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {objeto.rareza && (
            <span className="nx-data" style={{ fontSize: 9, color: 'var(--txt-faint)', textTransform: 'capitalize' }}>{objeto.rareza}</span>
          )}
          {typeLabel && (
            <span className="nx-data" style={{ fontSize: 9, color: 'var(--txt-faint)', textTransform: 'capitalize' }}>{typeLabel}</span>
          )}
          {objeto.tipo === 'nucleo_energia' && !!objeto.energia_maxima && (
            <span className="nx-data" style={{ fontSize: 10, color: '#ffb020' }}>Máx {objeto.energia_maxima} EN</span>
          )}
          {!!objeto.consumo_energia && (
            <span className="nx-data" style={{ fontSize: 10, color: '#ffb020' }}>Consumo {objeto.consumo_energia} EN</span>
          )}
          {objeto.tipo === 'cristal' && objeto.color_hoja && (
            <span className="nx-data" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--txt-dim)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: NX.SABERS[objeto.color_hoja] || '#38cdf0' }} />
              {objeto.color_hoja}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

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

  const sableActivo = user?.character?.sable_activo ?? null;
  const sableColorHex = NX.SABERS[sableActivo?.color_hoja] || NX.SABERS.azul;

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
            position: 'fixed', top: '50%', right: equipOpen ? 390 : 0, transform: 'translateY(-50%)',
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

        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(390px, 100vw)',
          zIndex: 40,
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(5,10,22,0.96)',
          backdropFilter: 'blur(10px)',
          borderLeft: '1px solid var(--holo-line)',
          transform: equipOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.28s var(--ease-standard)',
          boxShadow: equipOpen ? '-20px 0 60px -10px rgba(0,0,0,0.7)' : 'none',
          pointerEvents: equipOpen ? 'auto' : 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 14px 10px', borderBottom: '1px solid var(--holo-line)', flexShrink: 0 }}>
            <div>
              <div className="nx-kicker" style={{ marginBottom: 2 }}>Equipo</div>
              <div className="nx-display" style={{ fontSize: 14 }}>Barra lateral</div>
            </div>
            <button onClick={() => setEquipOpen(false)} className="nx-btn nx-btn-ghost nx-btn-sm" style={{ padding: '6px 8px' }}>
              <Icon name="x" size={13} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: 6, padding: '12px 14px 0', flexShrink: 0 }}>
            {EQUIP_TABS.map(t => {
              const active = equipTab === t.value;
              return (
                <button key={t.value} onClick={() => setEquipTab(t.value)} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center',
                  padding: '7px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 10,
                  fontFamily: 'var(--font-data)', letterSpacing: '0.05em',
                  background: active ? 'color-mix(in srgb, var(--holo) 18%, rgba(255,255,255,.04))' : 'rgba(255,255,255,.04)',
                  border: `1px solid ${active ? 'var(--holo)' : 'var(--holo-line)'}`,
                  color: active ? 'var(--holo)' : 'var(--txt-faint)',
                  boxShadow: active ? '0 0 10px -4px var(--holo)' : 'none',
                  transition: 'all .14s',
                }}>
                  <Icon name={t.icon} size={12} />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'grid', gap: 14 }}>
            {equipTab === 'sable' && (
              <Panel kicker="Equipo" title="Sable de Luz" icon="sword"
                right={<Btn kind="ghost" icon="sword" sm onClick={() => { setEquipOpen(false); go?.('armado-sable'); }}>Gestionar sable</Btn>}>
                {sableActivo ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center',
                      background: `color-mix(in srgb, ${sableColorHex} 18%, rgba(4,9,18,0.9))`,
                      border: `1px solid color-mix(in srgb, ${sableColorHex} 55%, transparent)`,
                    }}>
                      <Icon name="sword" size={22} style={{ color: sableColorHex, filter: `drop-shadow(0 0 6px ${sableColorHex})` }} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="nx-display" style={{ fontSize: 13, color: 'var(--txt)' }}>{sableActivo.nombre}</div>
                      <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                        <Chip tone="green" icon="check">Armado</Chip>
                        <span className="nx-data" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--txt-dim)' }}>
                          <Icon name="flame" size={12} style={{ color: '#ff6b6b' }} /> {sableActivo.dano} DMG melee
                        </span>
                        {sableActivo.dano_perforante > 0 && (
                          <span className="nx-data" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--txt-dim)' }}>
                            <Icon name="fire" size={12} style={{ color: '#8aa0c0' }} /> +{sableActivo.dano_perforante}P
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--txt-faint)', flexBasis: '100%' }}>
                      Tu sable armado ataca cuerpo a cuerpo en combate y tiene prioridad sobre cualquier arma equipada.
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--txt-faint)', padding: '6px 0' }}>
                    No tienes ningún sable de luz armado. Ensambla y activa uno en «Armado de Sable» para usarlo en combate.
                  </div>
                )}
              </Panel>
            )}

            {equipTab === 'nave' && <NaveEquipadaPanel />}

            {equipTab === 'inventario' && (
              <Panel kicker="Equipo" title="Inventario" icon="roster"
                right={invTab === 'arma' ? (
                  <Btn kind="accent" icon="check" sm disabled={equipandoArma || (armaEquipadaId ?? '') === (user?.character?.arma_equipada?.id ?? '')} onClick={handleEquiparArma}>
                    {equipandoArma ? 'Equipando...' : 'Equipar'}
                  </Btn>
                ) : null}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                  {ITEM_TYPES.map(t => {
                    const count = inventario.filter(o => o.tipo === t.value).length;
                    const active = invTab === t.value;
                    return (
                      <button key={t.value} onClick={() => setInvTab(t.value)} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 10,
                        fontFamily: 'var(--font-data)', letterSpacing: '0.06em',
                        background: active ? 'color-mix(in srgb, var(--holo) 18%, rgba(255,255,255,.04))' : 'rgba(255,255,255,.04)',
                        border: `1px solid ${active ? 'var(--holo)' : 'var(--holo-line)'}`,
                        color: active ? 'var(--holo)' : 'var(--txt-faint)',
                        boxShadow: active ? '0 0 10px -4px var(--holo)' : 'none',
                        transition: 'all .14s',
                      }}>
                        <Icon name={t.icon} size={12} />
                        {t.label}
                        <span style={{ opacity: 0.7 }}>({count})</span>
                      </button>
                    );
                  })}
                </div>

                {invTab === 'arma' ? (
                  <>
                    {sableActivo && (
                      <div style={{ fontSize: 11, color: 'var(--txt-faint)', padding: '0 0 10px' }}>
                        Tienes un sable de luz armado - se usará en combate en lugar de esta arma mientras esté activo.
                      </div>
                    )}
                    {armasDisponibles.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--txt-faint)', padding: '6px 0' }}>
                        No posees armas en tu inventario. Sin arma equipada, tus ataques básicos hacen 3 de daño.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                        <WeaponCard objeto={null} selected={!armaEquipadaId} onClick={() => setArmaEquipadaId('')} />
                        {armasDisponibles.map(o => (
                          <WeaponCard key={o.id} objeto={o} selected={armaEquipadaId === o.id} onClick={() => setArmaEquipadaId(o.id)} />
                        ))}
                      </div>
                    )}
                  </>
                ) : itemsDeTab.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--txt-faint)', padding: '6px 0' }}>
                    No posees objetos de este tipo. Los componentes de sable se instalan desde «Armado de Sable».
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                    {itemsDeTab.map(o => (
                      <InventoryItemCard key={o.id} objeto={o} icon={ITEM_TYPES.find(t => t.value === invTab)?.icon} />
                    ))}
                  </div>
                )}
              </Panel>
            )}
          </div>
        </div>
      </>, document.body)}
    </>
  );
}
