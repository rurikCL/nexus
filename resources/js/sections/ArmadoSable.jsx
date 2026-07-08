import { useState, useEffect, useMemo, useCallback } from 'react';
import { Icon, Panel, Btn, Chip, toast } from '../components/ui.jsx';
import { NX } from '../data/seed.js';

const AUTH = () => {
  const t = localStorage.getItem('nx-token');
  return { Accept: 'application/json', Authorization: `Bearer ${t}` };
};
const apiFetch = (path) =>
  fetch(`/api${path}`, { headers: AUTH() }).then((r) => r.json().then((d) => (r.ok ? d : Promise.reject(d))));
const apiSend = (method, path, data) =>
  fetch(`/api${path}`, {
    method,
    headers: { ...AUTH(), 'Content-Type': 'application/json' },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  }).then((r) => r.json().then((d) => (r.ok ? d : Promise.reject(d))));

const mediaUrl = (path) => {
  if (!path) return null;
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:') || path.startsWith('blob:')) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (cleanPath.startsWith('/storage/')) return cleanPath;
  if (cleanPath.startsWith('/admin/')) return `/storage${cleanPath}`;
  if (cleanPath.startsWith('/public/')) return cleanPath.replace('/public/', '/storage/');
  return `/storage${cleanPath}`;
};

/* Orden físico de armado: de la punta de la hoja al pomo */
const SLOTS = [
  { key: 'emisor',        tipo: 'emisor',            label: 'Emisor',               hint: 'Tipo de hoja',              icon: 'sword' },
  { key: 'lente',         tipo: 'lente_enfoque',     label: 'Lente de Enfoque',     hint: 'Precisión',                 icon: 'eye' },
  { key: 'cristal',       tipo: 'cristal',            label: 'Cristal',              hint: 'Afinidad y color de hoja', icon: 'star' },
  { key: 'nucleo',        tipo: 'nucleo_energia',     label: 'Núcleo de Energía',    hint: 'Capacidad y potencia',      icon: 'zap' },
  { key: 'estabilizador', tipo: 'estabilizador',      label: 'Estabilizador',        hint: 'Control y resistencia',     icon: 'shield' },
  { key: 'modulo',        tipo: 'modulo_activacion',  label: 'Módulo de Activación', hint: 'Funciones especiales',      icon: 'tasks' },
  { key: 'empunadura',    tipo: 'empunadura',         label: 'Empuñadura',           hint: 'Ergonomía',                 icon: 'anvil' },
  { key: 'accesorio',     tipo: 'accesorio',          label: 'Accesorio',            hint: 'Mejora adicional',          icon: 'crown' },
];

const BONUS_FIELDS = [
  { key: 'bono_ataque',     label: 'ATQ', color: '#ff7043' },
  { key: 'bono_defensa',    label: 'DEF', color: '#38cdf0' },
  { key: 'bono_punteria',   label: 'PNT', color: '#10b981' },
  { key: 'bono_movimiento', label: 'MOV', color: '#a78bfa' },
  { key: 'bono_iniciativa', label: 'INI', color: '#E6B325' },
  { key: 'bono_vida',       label: 'VID', color: '#ff2d45' },
  { key: 'bono_escudo',     label: 'ESC', color: '#26e3e3' },
];

const emptyForm = () => ({
  id: null, nombre: '',
  nucleo_id: null, cristal_id: null, lente_id: null, emisor_id: null,
  estabilizador_id: null, empunadura_id: null, modulo_id: null, accesorio_id: null,
});

function bonusPreview(objeto) {
  const parts = BONUS_FIELDS
    .filter((b) => objeto[b.key])
    .map((b) => `${objeto[b.key] > 0 ? '+' : ''}${objeto[b.key]} ${b.label}`);
  return parts.length ? parts.join(' · ') : '';
}

function sumaBonos(fuente, resolver) {
  const totales = Object.fromEntries(BONUS_FIELDS.map((b) => [b.key, 0]));
  SLOTS.forEach((s) => {
    const objeto = resolver(fuente, s);
    if (!objeto) return;
    BONUS_FIELDS.forEach((b) => { totales[b.key] += objeto[b.key] ?? 0; });
  });
  return totales;
}

/* ─── cuadro de componente (estilo slot de habilidad) ────── */
function ComponentTile({ slot, objeto, onClick }) {
  const isEmpty = !objeto;
  const preview = objeto ? bonusPreview(objeto) : '';
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
      padding: '9px 12px', borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s', position: 'relative',
      background: isEmpty ? 'rgba(255,255,255,0.025)' : 'color-mix(in srgb, var(--holo) 8%, transparent)',
      border: `1px solid ${isEmpty ? 'var(--holo-line)' : 'var(--holo)'}`,
      boxShadow: isEmpty ? 'none' : '0 0 14px -6px var(--holo)',
    }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--holo)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = isEmpty ? 'var(--holo-line)' : 'var(--holo)'; }}
    >
      <div style={{
        width: 46, height: 46, borderRadius: 9, flexShrink: 0, display: 'grid', placeItems: 'center', overflow: 'hidden',
        background: isEmpty ? 'rgba(255,255,255,0.04)' : 'rgba(56,205,240,0.14)',
        border: `1px ${isEmpty ? 'dashed' : 'solid'} ${isEmpty ? 'var(--holo-line)' : 'var(--holo)'}`,
      }}>
        {objeto?.imagen
          ? <img src={mediaUrl(objeto.imagen)} alt={objeto.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <Icon name={isEmpty ? 'plus' : slot.icon} size={18} style={{ color: isEmpty ? 'var(--txt-faint)' : 'var(--holo)' }} />
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="nx-kicker" style={{ fontSize: 9, marginBottom: 2, color: 'var(--txt-faint)' }}>{slot.label.toUpperCase()}</div>
        {objeto ? (
          <>
            <div className="nx-display" style={{ fontSize: 12, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{objeto.nombre}</div>
            <div style={{ fontSize: 10, color: 'var(--txt-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview || slot.hint}</div>
          </>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--txt-faint)' }}>{slot.hint} — vacío</div>
        )}
      </div>
    </button>
  );
}

/* ─── modal selector de componente ──────────────────────── */
function ComponentPickerModal({ slot, opciones, onAssign, onClear, onClose }) {
  return (
    <div onMouseDown={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1400,
      background: 'rgba(2,5,12,0.78)', backdropFilter: 'blur(6px)',
      display: 'grid', placeItems: 'center', padding: 20,
      animation: 'nx-fade-up 0.2s ease both',
    }}>
      <div onMouseDown={(e) => e.stopPropagation()} className="nx-panel solid nx-panel-glow" style={{
        width: 420, maxWidth: '100%', maxHeight: '80vh', overflowY: 'auto',
      }}>
        <header className="nx-panel-head">
          <span style={{ color: 'var(--holo)' }}><Icon name={slot.icon} size={15} /></span>
          <div style={{ flex: 1 }}>
            <div className="nx-kicker" style={{ marginBottom: 1 }}>{slot.label.toUpperCase()}</div>
            <div className="nx-display" style={{ fontSize: 13 }}>{slot.hint}</div>
          </div>
          <button className="nx-btn nx-btn-ghost nx-btn-sm" onClick={onClose} style={{ padding: 5 }}><Icon name="x" size={13} /></button>
        </header>
        <div className="nx-panel-body" style={{ display: 'grid', gap: 8 }}>
          {opciones.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 10px', color: 'var(--txt-faint)', fontSize: 12 }}>
              No posees componentes de este tipo.
            </div>
          )}
          {opciones.map((o) => (
            <button key={o.id} onClick={() => onAssign(o)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: 9, borderRadius: 8,
              textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s',
              background: 'rgba(255,255,255,0.03)', border: '1px solid var(--holo-line)',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--holo)'; e.currentTarget.style.background = 'rgba(56,205,240,0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--holo-line)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, overflow: 'hidden', background: 'rgba(255,255,255,0.05)', display: 'grid', placeItems: 'center' }}>
                {o.imagen
                  ? <img src={mediaUrl(o.imagen)} alt={o.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Icon name={slot.icon} size={16} style={{ color: 'var(--holo)' }} />
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--txt)', fontWeight: 600 }}>{o.nombre}</div>
                {bonusPreview(o) && <div style={{ fontSize: 10, color: 'var(--txt-faint)' }}>{bonusPreview(o)}</div>}
              </div>
            </button>
          ))}
          <button onClick={onClear} style={{
            textAlign: 'center', padding: '8px', borderRadius: 8, cursor: 'pointer', marginTop: 4,
            background: 'transparent', border: '1px dashed var(--holo-line)', color: 'var(--txt-faint)', fontSize: 11,
          }}>Vaciar slot</button>
        </div>
      </div>
    </div>
  );
}

export function ArmadoSableView({ user }) {
  const inventario = user?.character?.rol_objetos ?? [];

  const porTipo = useMemo(() => {
    const m = {};
    SLOTS.forEach((s) => { m[s.tipo] = inventario.filter((o) => o.tipo === s.tipo); });
    return m;
  }, [inventario]);

  const objetoPorId = useCallback((id) => inventario.find((o) => o.id === id) ?? null, [inventario]);

  const [sables, setSables]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [form, setForm]         = useState(emptyForm());
  const [saving, setSaving]     = useState(false);
  const [pickerSlot, setPickerSlot] = useState(null);

  const reload = useCallback(() => {
    setLoading(true);
    apiFetch('/sable/sables')
      .then((d) => setSables(d.sables ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const totalBonos = useMemo(
    () => sumaBonos(form, (f, s) => objetoPorId(f[`${s.key}_id`])),
    [form, objetoPorId]
  );

  const cristalSeleccionado = objetoPorId(form.cristal_id);
  const hexHoja = cristalSeleccionado?.color_hoja ? NX.SABERS[cristalSeleccionado.color_hoja] : null;

  const setSlot = (key, value) => setForm((f) => ({ ...f, [`${key}_id`]: value ? Number(value) : null }));

  const nuevo = () => setForm(emptyForm());

  const cargarParaEditar = (sable) => {
    setForm({
      id: sable.id,
      nombre: sable.nombre ?? '',
      ...Object.fromEntries(SLOTS.map((s) => [`${s.key}_id`, sable[`${s.key}_id`] ?? null])),
    });
  };

  const guardar = async () => {
    setSaving(true);
    const payload = {
      nombre: form.nombre || 'Sable',
      ...Object.fromEntries(SLOTS.map((s) => [`${s.key}_id`, form[`${s.key}_id`]])),
    };
    try {
      if (form.id) {
        const d = await apiSend('PATCH', `/sable/sables/${form.id}`, payload);
        setSables((prev) => prev.map((s) => (s.id === form.id ? d.sable : s)));
        toast('Sable actualizado', { tone: 'success', icon: 'check' });
      } else {
        const d = await apiSend('POST', '/sable/sables', payload);
        setSables((prev) => [d.sable, ...prev]);
        cargarParaEditar(d.sable);
        toast('Sable guardado', { tone: 'success', icon: 'check' });
      }
    } catch (e) {
      toast(e?.message ?? 'Error al guardar', { tone: 'error', icon: 'x' });
    } finally {
      setSaving(false);
    }
  };

  const activar = async (id) => {
    try {
      await apiSend('POST', `/sable/sables/${id}/activar`);
      setSables((prev) => prev.map((s) => ({ ...s, activo: s.id === id })));
      toast('Sable activado', { tone: 'success', icon: 'zap' });
    } catch (e) {
      toast(e?.message ?? 'Error al activar', { tone: 'error', icon: 'x' });
    }
  };

  const eliminar = async (id) => {
    try {
      await apiSend('DELETE', `/sable/sables/${id}`);
      setSables((prev) => prev.filter((s) => s.id !== id));
      if (form.id === id) nuevo();
      toast('Sable eliminado', { tone: 'dim', icon: 'x' });
    } catch (e) {
      toast(e?.message ?? 'Error al eliminar', { tone: 'error', icon: 'x' });
    }
  };

  if (!user?.character) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--txt-dim)' }}>
        Necesitas un personaje creado para armar un sable.
      </div>
    );
  }

  return (
    <div className="nx-fade" style={{ display: 'grid', gap: 18 }}>
      <Panel kicker="Taller" title="Armado de Sable de Luz" icon="zap">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 24 }}>
          {/* Constructor: hoja + pieza por pieza, de la punta al pomo */}
          <div>
            <div style={{ marginBottom: 14 }}>
              <label className="nx-kicker" style={{ display: 'block', marginBottom: 6 }}>NOMBRE DEL SABLE</label>
              <input className="nx-input" value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej: Sable de duelo" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 14 }}>
              {/* Hoja: se extiende visualmente desde el emisor (primer cuadro) */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{
                  width: 10, alignSelf: 'stretch', borderRadius: 5, minHeight: 40,
                  background: hexHoja ?? 'rgba(255,255,255,0.05)',
                  boxShadow: hexHoja ? `0 0 22px 4px ${hexHoja}` : 'none',
                  border: hexHoja ? 'none' : '1px dashed var(--holo-line)',
                  transition: 'background 0.2s ease',
                }} />
              </div>

              {/* Pila de componentes: emisor → ... → accesorio (pomo) */}
              <div style={{ display: 'grid', gap: 8 }}>
                {SLOTS.map((slot) => (
                  <ComponentTile
                    key={slot.key}
                    slot={slot}
                    objeto={objetoPorId(form[`${slot.key}_id`])}
                    onClick={() => setPickerSlot(slot)}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <Btn kind="accent" icon={form.id ? 'check' : 'plus'} onClick={guardar} disabled={saving}>
                {saving ? 'Guardando…' : form.id ? 'Actualizar sable' : 'Guardar como nuevo'}
              </Btn>
              {form.id && <Btn onClick={nuevo}>Nuevo sable en blanco</Btn>}
            </div>
          </div>

          {/* Bonos totales */}
          <div>
            <div className="nx-kicker" style={{ marginBottom: 8 }}>BONOS TOTALES</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {BONUS_FIELDS.map((b) => (
                <div key={b.key} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '7px 10px', borderRadius: 6,
                  background: `${b.color}14`, border: `1px solid ${b.color}45`,
                }}>
                  <span style={{ fontSize: 10, color: b.color, fontFamily: 'var(--font-data)', letterSpacing: '0.08em' }}>{b.label}</span>
                  <span className="nx-num" style={{ fontSize: 15, color: b.color }}>
                    {totalBonos[b.key] > 0 ? '+' : ''}{totalBonos[b.key]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <Panel kicker="Loadouts" title="Sables Guardados" icon="roster">
        {loading && <div style={{ textAlign: 'center', padding: 20, color: 'var(--txt-faint)', fontSize: 12 }}>Cargando…</div>}
        {!loading && sables.length === 0 && (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--txt-faint)', fontSize: 12 }}>Aún no has guardado ningún sable.</div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))', gap: 12 }}>
          {sables.map((s) => {
            const color = s.cristal?.color_hoja ? NX.SABERS[s.cristal.color_hoja] : null;
            const bonos = sumaBonos(s, (sable, slot) => sable[slot.key]);
            return (
              <div key={s.id} className="nx-panel solid" style={{
                padding: 14,
                border: s.activo ? '1px solid rgba(16,185,129,0.5)' : '1px solid var(--holo-line)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  {color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0 }} />}
                  <span style={{ fontWeight: 700, fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.nombre}</span>
                  {s.activo && <Chip tone="green">Activo</Chip>}
                </div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
                  {BONUS_FIELDS.map((b) => (
                    bonos[b.key] !== 0 && (
                      <span key={b.key} style={{
                        fontSize: 9, fontFamily: 'var(--font-data)', padding: '2px 6px', borderRadius: 4,
                        background: `${b.color}14`, border: `1px solid ${b.color}45`, color: b.color,
                      }}>{b.label} {bonos[b.key] > 0 ? '+' : ''}{bonos[b.key]}</span>
                    )
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {!s.activo && <Btn sm icon="zap" onClick={() => activar(s.id)}>Activar</Btn>}
                  <Btn sm icon="edit" onClick={() => cargarParaEditar(s)}>Editar</Btn>
                  <Btn sm icon="x" onClick={() => eliminar(s.id)}>Eliminar</Btn>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {pickerSlot && (
        <ComponentPickerModal
          slot={pickerSlot}
          opciones={porTipo[pickerSlot.tipo]}
          onAssign={(o) => { setSlot(pickerSlot.key, o.id); setPickerSlot(null); }}
          onClear={() => { setSlot(pickerSlot.key, null); setPickerSlot(null); }}
          onClose={() => setPickerSlot(null)}
        />
      )}
    </div>
  );
}
