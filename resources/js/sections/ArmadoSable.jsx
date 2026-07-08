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

export const BONUS_FIELDS = [
  { key: 'bono_ataque',     label: 'ATQ', color: '#ff7043', icon: 'sword'  },
  { key: 'bono_defensa',    label: 'DEF', color: '#38cdf0', icon: 'shield' },
  { key: 'bono_punteria',   label: 'PNT', color: '#10b981', icon: 'eye'    },
  { key: 'bono_movimiento', label: 'MOV', color: '#a78bfa', icon: 'zap'    },
  { key: 'bono_iniciativa', label: 'INI', color: '#E6B325', icon: 'star'   },
  { key: 'bono_vida',       label: 'VID', color: '#ff2d45', icon: 'zap'    },
  { key: 'bono_escudo',     label: 'ESC', color: '#26e3e3', icon: 'shield' },
  { key: 'bono_dano',       label: 'DMG', color: '#ff5f2e', icon: 'flame'    },
  { key: 'bono_critico',    label: 'CRT', color: '#f43f5e', icon: 'target'   },
  { key: 'bono_fuerza',     label: 'FZ',  color: '#22c55e', icon: 'dumbbell' },
  { key: 'bono_generacion_fuerza', label: 'GEN', color: '#84cc16', icon: 'trending' },
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

function energyPreview(objeto) {
  const parts = [];
  if (objeto.consumo_energia) parts.push(`Consumo ${objeto.consumo_energia} EN`);
  if (objeto.tipo === 'nucleo_energia' && objeto.energia_maxima) parts.push(`Máx ${objeto.energia_maxima} EN`);
  return parts.join(' · ');
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

/* ─── modal selector de componente ──────────────────────── */
function ComponentPickerModal({ slot, opciones, onAssign, onClear, onClose }) {
  return (
    <div onMouseDown={onClose} className="nx-saber-modal-backdrop">
      <div onMouseDown={(e) => e.stopPropagation()} className="nx-panel solid nx-panel-glow nx-saber-modal">
        <header className="nx-panel-head">
          <span style={{ color: 'var(--holo)' }}><Icon name={slot.icon} size={15} /></span>
          <div style={{ flex: 1 }}>
            <div className="nx-kicker" style={{ marginBottom: 1 }}>{slot.label.toUpperCase()}</div>
            <div className="nx-display" style={{ fontSize: 13 }}>{slot.hint}</div>
          </div>
          <button className="nx-btn nx-btn-ghost nx-btn-sm" onClick={onClose} style={{ padding: 5 }}><Icon name="x" size={13} /></button>
        </header>
        <div className="nx-panel-body nx-saber-modal-list">
          {opciones.length === 0 && (
            <div className="nx-saber-modal-empty">
              No posees componentes de este tipo.
            </div>
          )}
          {opciones.map((o) => (
            <button key={o.id} onClick={() => onAssign(o)} className="nx-saber-modal-item">
              <div className="nx-saber-modal-icon">
                {o.imagen
                  ? <img src={mediaUrl(o.imagen)} alt={o.nombre} className="nx-saber-slot-image" />
                  : <Icon name={slot.icon} size={16} style={{ color: 'var(--holo)' }} />
                }
              </div>
              <div className="nx-saber-modal-meta">
                <div className="nx-saber-modal-name">{o.nombre}</div>
                {bonusPreview(o) && <div className="nx-saber-modal-bonus">{bonusPreview(o)}</div>}
                {energyPreview(o) && <div className="nx-saber-modal-bonus" style={{ color: '#ffb020' }}>{energyPreview(o)}</div>}
              </div>
            </button>
          ))}
          <button onClick={onClear} className="nx-saber-modal-clear">Vaciar slot</button>
        </div>
      </div>
    </div>
  );
}

/* ─── modal de confirmación al ensamblar (crear) un sable ──── */
function ConfirmCrearModal({ nombre, componentes, saving, onConfirm, onClose }) {
  return (
    <div onMouseDown={onClose} className="nx-saber-modal-backdrop">
      <div onMouseDown={(e) => e.stopPropagation()} className="nx-panel solid nx-panel-glow nx-saber-modal">
        <header className="nx-panel-head">
          <span style={{ color: 'var(--holo)' }}><Icon name="zap" size={15} /></span>
          <div style={{ flex: 1 }}>
            <div className="nx-kicker" style={{ marginBottom: 1 }}>ENSAMBLAR SABLE</div>
            <div className="nx-display" style={{ fontSize: 13 }}>{nombre || 'Sable'}</div>
          </div>
          <button className="nx-btn nx-btn-ghost nx-btn-sm" onClick={onClose} style={{ padding: 5 }}><Icon name="x" size={13} /></button>
        </header>
        <div className="nx-panel-body nx-saber-modal-list">
          <div style={{ fontSize: 12, color: 'var(--txt-dim)', marginBottom: 10, lineHeight: 1.5 }}>
            Al ensamblar el sable se <strong>consumirán permanentemente</strong> del inventario los siguientes componentes:
          </div>
          {componentes.length === 0 && (
            <div className="nx-saber-modal-empty">No has instalado ningún componente todavía.</div>
          )}
          {componentes.map(({ slot, objeto }) => (
            <div key={slot.key} className="nx-saber-modal-item" style={{ cursor: 'default' }}>
              <div className="nx-saber-modal-icon"><Icon name={slot.icon} size={16} style={{ color: 'var(--holo)' }} /></div>
              <div className="nx-saber-modal-meta">
                <div className="nx-saber-modal-name">{objeto.nombre}</div>
                <div className="nx-saber-modal-bonus">{slot.label}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '0 16px 16px' }}>
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn kind="accent" icon="check" onClick={onConfirm} disabled={saving}>{saving ? 'Ensamblando…' : 'Sí, ensamblar'}</Btn>
        </div>
      </div>
    </div>
  );
}

/* ─── modal de desarmado: el cristal siempre se recupera, se elige 1 más ──── */
function DesarmarModal({ sable, recuperarId, onSelect, saving, onConfirm, onClose }) {
  const cristal = sable.cristal ?? null;
  const otros = SLOTS.filter((s) => s.key !== 'cristal' && sable[s.key]);
  return (
    <div onMouseDown={onClose} className="nx-saber-modal-backdrop">
      <div onMouseDown={(e) => e.stopPropagation()} className="nx-panel solid nx-panel-glow nx-saber-modal">
        <header className="nx-panel-head">
          <span style={{ color: '#ff6b6b' }}><Icon name="x" size={15} /></span>
          <div style={{ flex: 1 }}>
            <div className="nx-kicker" style={{ marginBottom: 1 }}>DESARMAR SABLE</div>
            <div className="nx-display" style={{ fontSize: 13 }}>{sable.nombre}</div>
          </div>
          <button className="nx-btn nx-btn-ghost nx-btn-sm" onClick={onClose} style={{ padding: 5 }}><Icon name="x" size={13} /></button>
        </header>
        <div className="nx-panel-body nx-saber-modal-list">
          <div style={{ fontSize: 12, color: 'var(--txt-dim)', marginBottom: 10, lineHeight: 1.5 }}>
            Al desarmar este sable se pierden sus componentes. El <strong>cristal se recupera siempre</strong>; además puedes elegir <strong>1 componente</strong> para recuperar — el resto se pierde.
          </div>
          {cristal && (
            <div className="nx-saber-modal-item" style={{ cursor: 'default', opacity: 0.9 }}>
              <div className="nx-saber-modal-icon"><Icon name="star" size={16} style={{ color: 'var(--holo)' }} /></div>
              <div className="nx-saber-modal-meta">
                <div className="nx-saber-modal-name">{cristal.nombre}</div>
                <div className="nx-saber-modal-bonus" style={{ color: '#10b981' }}>Se recupera siempre</div>
              </div>
            </div>
          )}
          {otros.length === 0 && (
            <div className="nx-saber-modal-empty">Este sable no tiene más componentes instalados.</div>
          )}
          {otros.map((slot) => {
            const objeto = sable[slot.key];
            const selected = recuperarId === objeto.id;
            return (
              <button key={slot.key} onClick={() => onSelect(selected ? null : objeto.id)}
                className="nx-saber-modal-item"
                style={selected ? { borderColor: 'var(--holo)', background: 'rgba(56,205,240,0.08)' } : undefined}>
                <div className="nx-saber-modal-icon">
                  <Icon name={slot.icon} size={16} style={{ color: selected ? 'var(--holo)' : undefined }} />
                </div>
                <div className="nx-saber-modal-meta">
                  <div className="nx-saber-modal-name">{objeto.nombre}</div>
                  <div className="nx-saber-modal-bonus">{slot.label}{selected ? ' · a recuperar' : ''}</div>
                </div>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '0 16px 16px' }}>
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn kind="accent" icon="x" onClick={onConfirm} disabled={saving}>{saving ? 'Desarmando…' : 'Confirmar desarmado'}</Btn>
        </div>
      </div>
    </div>
  );
}

export function ArmadoSableView({ user, onUserUpdate }) {
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
  const [confirmCrear, setConfirmCrear] = useState(false);
  const [desarmarSable, setDesarmarSable] = useState(null);
  const [recuperarId, setRecuperarId] = useState(null);
  const [desarmando, setDesarmando] = useState(false);

  const actualizarInventario = (nuevoInventario) => {
    if (!nuevoInventario || !onUserUpdate) return;
    onUserUpdate({ ...user, character: { ...user.character, rol_objetos: nuevoInventario } });
  };

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

  const nucleoSeleccionado = objetoPorId(form.nucleo_id);
  const energiaMaxima = nucleoSeleccionado?.energia_maxima ?? 0;
  const consumoEnergia = useMemo(
    () => SLOTS.reduce((acc, s) => acc + (objetoPorId(form[`${s.key}_id`])?.consumo_energia ?? 0), 0),
    [form, objetoPorId]
  );
  const sobreConsumo = consumoEnergia > energiaMaxima;

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
        actualizarInventario(d.rol_objetos);
        toast('Sable ensamblado — componentes consumidos', { tone: 'success', icon: 'check' });
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

  const desarmar = async (id, idRecuperar) => {
    setDesarmando(true);
    try {
      const d = await apiSend('DELETE', `/sable/sables/${id}`, { recuperar_id: idRecuperar ?? null });
      setSables((prev) => prev.filter((s) => s.id !== id));
      if (form.id === id) nuevo();
      actualizarInventario(d.rol_objetos);
      toast('Sable desarmado', { tone: 'dim', icon: 'x' });
      setDesarmarSable(null);
    } catch (e) {
      toast(e?.message ?? 'Error al desarmar', { tone: 'error', icon: 'x' });
    } finally {
      setDesarmando(false);
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
    <div className="nx-fade nx-saber-workbench">
      <div className="nx-saber-layout nx-saber-layout-2col">
        <Panel kicker="Taller" title="Armado de Sable de Luz" icon="zap">
          <div className="nx-saber-main">
            <div className="nx-saber-header-row">
              <div className="nx-saber-input-wrap">
                <label className="nx-kicker" style={{ display: 'block', marginBottom: 6 }}>NOMBRE DEL SABLE</label>
                <input className="nx-input" value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: Sable de duelo" />
              </div>
              {cristalSeleccionado && <Chip tone="holo">Cristal {cristalSeleccionado.nombre}</Chip>}
            </div>

            <div className="nx-saber-energy-row" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0 4px' }}>
              <span className="nx-kicker" style={{ flexShrink: 0, color: sobreConsumo ? '#ff6b6b' : undefined }}>ENERGÍA</span>
              <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${energiaMaxima > 0 ? Math.min(100, (consumoEnergia / energiaMaxima) * 100) : (consumoEnergia > 0 ? 100 : 0)}%`,
                  background: sobreConsumo ? '#ff2d45' : '#38cdf0',
                  boxShadow: sobreConsumo ? '0 0 8px #ff2d45' : consumoEnergia > 0 ? '0 0 8px #38cdf0' : 'none',
                  transition: 'width 0.2s ease, background 0.2s ease',
                }} />
              </div>
              <span style={{
                fontSize: 11, fontFamily: 'var(--font-data)', flexShrink: 0,
                color: sobreConsumo ? '#ff6b6b' : 'var(--holo)',
              }}>
                {consumoEnergia}/{energiaMaxima} EN
              </span>
            </div>
            {sobreConsumo && (
              <div style={{
                fontSize: 11, color: '#ff6b6b', background: 'rgba(255,45,69,0.1)',
                border: '1px solid rgba(255,45,69,0.35)', borderRadius: 6, padding: '6px 10px', marginBottom: 4,
              }}>
                ⚠ El consumo de energía ({consumoEnergia}) supera la energía máxima del núcleo ({energiaMaxima}). No podrá guardarse hasta que ajustes los componentes o instales un núcleo más potente.
              </div>
            )}

            <div className="nx-saber-preview-panel">
              <div className="nx-kicker" style={{ marginBottom: 8 }}>VISTA ENSAMBLADA</div>
              <div className="nx-saber-preview-canvas">
                {/* Resplandor dinámico de la hoja */}
                {hexHoja && (
                  <div className="nx-saber-glow-bg" style={{
                    background: `radial-gradient(ellipse 280px 220px at 82% 6%, ${hexHoja}45, transparent 70%)`,
                  }} />
                )}
                <div className="nx-saber-canvas-scanlines" />

                {/* Bonos horizontales en la parte superior */}
                <div className="nx-saber-bonos-overlay">
                  {BONUS_FIELDS.map((b) => (
                    <div key={b.key} className="nx-saber-bono-chip">
                      <span className="nx-saber-bono-label" style={{ color: b.color }}>
                        <Icon name={b.icon} size={10} />{b.label}
                      </span>
                      <span className="nx-saber-bono-val" style={{ color: b.color }}>
                        {totalBonos[b.key] > 0 ? '+' : ''}{totalBonos[b.key]}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Sable diagonal — arte CSS */}
                <div className="nx-saber-diag-container">
                  {/* Hoja */}
                  <div
                    className={`nx-saber-diag-blade ${hexHoja ? 'is-on' : ''}`}
                    style={hexHoja ? {
                      background: `linear-gradient(180deg, transparent 0%, color-mix(in srgb, ${hexHoja} 12%, #fff) 22%, #ffffff 52%, ${hexHoja} 100%)`,
                      boxShadow: `0 0 14px 5px ${hexHoja}, 0 0 38px ${hexHoja}, 0 0 75px color-mix(in srgb, ${hexHoja} 40%, transparent)`,
                    } : {}}
                  />
                  {/* Conector emisor */}
                  <div
                    className="nx-saber-demitter"
                    style={hexHoja ? { boxShadow: `0 0 12px ${hexHoja}, 0 0 24px ${hexHoja}70` } : {}}
                  />
                  {/* Anillos del emisor */}
                  <div className="nx-saber-drings">
                    {[0,1,2,3,4].map(i => (
                      <div key={i} className={`nx-saber-dring${i % 2 === 1 ? ' gold' : ''}`} />
                    ))}
                  </div>
                  {/* Cuerpo principal */}
                  <div className="nx-saber-dhilt-body">
                    <div className="nx-saber-dhilt-btn" />
                    <div className="nx-saber-dhilt-groove" />
                  </div>
                  {/* Pomo */}
                  <div className="nx-saber-dhilt-pommel">
                    <div className="nx-saber-dhilt-mesh" />
                  </div>
                </div>
              </div>

              {/* Slots como grid compacto debajo del canvas */}
              <div className="nx-saber-slot-grid">
                {SLOTS.map((slot) => {
                  const pieza = objetoPorId(form[`${slot.key}_id`]);
                  return (
                    <button
                      key={slot.key}
                      className={`nx-saber-slot-compact ${pieza ? 'is-filled' : ''}`}
                      onClick={() => setPickerSlot(slot)}
                      title={slot.hint}
                    >
                      <Icon name={slot.icon} size={12} />
                      <span className="nx-saber-slot-compact-label">
                        {pieza ? pieza.nombre : slot.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="nx-saber-actions-row">
            <Btn kind="accent" icon={form.id ? 'check' : 'plus'}
              onClick={() => (form.id ? guardar() : setConfirmCrear(true))}
              disabled={saving || sobreConsumo}
              title={sobreConsumo ? 'El consumo de energía supera la energía máxima del núcleo' : undefined}>
              {saving ? 'Guardando…' : form.id ? 'Actualizar sable' : 'Guardar como nuevo'}
            </Btn>
            {form.id && <Btn onClick={nuevo}>Nuevo sable en blanco</Btn>}
          </div>
        </Panel>


        <Panel kicker="Loadouts" title="Sables Guardados" icon="roster" className="nx-saber-saved-panel">
          {loading && <div style={{ textAlign: 'center', padding: 20, color: 'var(--txt-faint)', fontSize: 12 }}>Cargando...</div>}
          {!loading && sables.length === 0 && (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--txt-faint)', fontSize: 12 }}>Aún no has guardado ningún sable.</div>
          )}
          <div className="nx-saber-saved-grid">
            {sables.map((s) => {
              const color = s.cristal?.color_hoja ? NX.SABERS[s.cristal.color_hoja] : null;
              const bonos = sumaBonos(s, (sable, slot) => sable[slot.key]);
              const consumo = s.consumo_energia ?? 0;
              const maxEnergia = s.energia_maxima ?? 0;
              const sobreConsumoGuardado = consumo > maxEnergia;
              return (
                <div key={s.id} className={`nx-panel solid nx-saber-saved-card ${s.activo ? 'is-active' : ''}`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    {color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0 }} />}
                    <span style={{ fontWeight: 700, fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.nombre}</span>
                    {s.activo && <Chip tone="green">Activo</Chip>}
                  </div>
                  <div className="nx-saber-saved-badges">
                    <span className="nx-saber-saved-badge" style={{
                      background: sobreConsumoGuardado ? 'rgba(255,45,69,0.14)' : 'rgba(56,205,240,0.14)',
                      borderColor: sobreConsumoGuardado ? 'rgba(255,45,69,0.45)' : 'rgba(56,205,240,0.45)',
                      color: sobreConsumoGuardado ? '#ff6b6b' : '#38cdf0',
                    }}>EN {consumo}/{maxEnergia}</span>
                    {BONUS_FIELDS.map((b) => (
                      bonos[b.key] !== 0 && (
                        <span key={b.key} className="nx-saber-saved-badge" style={{ background: `${b.color}14`, borderColor: `${b.color}45`, color: b.color }}>{b.label} {bonos[b.key] > 0 ? '+' : ''}{bonos[b.key]}</span>
                      )
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {!s.activo && <Btn sm icon="zap" onClick={() => activar(s.id)}>Activar</Btn>}
                    <Btn sm icon="edit" onClick={() => cargarParaEditar(s)}>Editar</Btn>
                    <Btn sm icon="x" onClick={() => { setDesarmarSable(s); setRecuperarId(null); }}>Desarmar</Btn>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {pickerSlot && (
        <ComponentPickerModal
          slot={pickerSlot}
          opciones={porTipo[pickerSlot.tipo]}
          onAssign={(o) => { setSlot(pickerSlot.key, o.id); setPickerSlot(null); }}
          onClear={() => { setSlot(pickerSlot.key, null); setPickerSlot(null); }}
          onClose={() => setPickerSlot(null)}
        />
      )}

      {confirmCrear && (
        <ConfirmCrearModal
          nombre={form.nombre}
          componentes={SLOTS
            .filter((s) => form[`${s.key}_id`])
            .map((s) => ({ slot: s, objeto: objetoPorId(form[`${s.key}_id`]) }))
            .filter((c) => c.objeto)}
          saving={saving}
          onConfirm={async () => { await guardar(); setConfirmCrear(false); }}
          onClose={() => setConfirmCrear(false)}
        />
      )}

      {desarmarSable && (
        <DesarmarModal
          sable={desarmarSable}
          recuperarId={recuperarId}
          onSelect={setRecuperarId}
          saving={desarmando}
          onConfirm={() => desarmar(desarmarSable.id, recuperarId)}
          onClose={() => setDesarmarSable(null)}
        />
      )}
    </div>
  );
}
