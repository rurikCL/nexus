import { useState, useEffect, useRef } from 'react';
import { NX } from '../data/seed.js';
import { Icon, Panel, Btn, Chip, Avatar, TierBadge, MedalIcon, Modal, toast } from '../components/ui.jsx';
import { buildMissionCompletionTransmision } from '../utils/missionTransmission.js';

function mediaUrl(path) {
  if (!path) return null;
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:') || path.startsWith('blob:')) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (cleanPath.startsWith('/storage/')) return cleanPath;
  if (cleanPath.startsWith('/admin/'))   return `/storage${cleanPath}`;
  if (cleanPath.startsWith('/public/'))  return cleanPath.replace('/public/', '/storage/');
  return `/storage${cleanPath}`;
}

/* ── Constantes ─────────────────────────────────────────── */
const TIER_COLORS = {
  iniciado: '#8aa0c0', padawan: '#38cdf0', caballero: '#10b981',
  maestro: '#FF6B00', granmaestro: '#E6B325',
};

const TIERS = [
  { id: 'iniciado',  label: 'Iniciado'  },
  { id: 'padawan',   label: 'Padawan'   },
  { id: 'caballero', label: 'Caballero' },
  { id: 'maestro',   label: 'Maestro'   },
];

const PODIO_CFG = [
  { key: 'primer_lugar',  fieldId: 'primer_lugar_id',  label: '1er Lugar', color: 'var(--holocron-oro)', num: '1' },
  { key: 'segundo_lugar', fieldId: 'segundo_lugar_id', label: '2do Lugar', color: '#c0c0c0',            num: '2' },
  { key: 'tercer_lugar',  fieldId: 'tercer_lugar_id',  label: '3er Lugar', color: '#cd7f32',            num: '3' },
];

const fmtDate = (d) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function useIsMobile() {
  const [m, setM] = useState(() => window.innerWidth < 700);
  useEffect(() => {
    const fn = () => setM(window.innerWidth < 700);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return m;
}

const EMPTY_RECOMPENSA = { nombre: '', descripcion: '', creditos: 0, experiencia: 0, medalla_id: '' };
const EMPTY_PODIO = (rango) => ({ rango, primer_lugar_id: '', segundo_lugar_id: '', tercer_lugar_id: '' });

function makeFormFrom(t) {
  return {
    nombre:                t?.nombre                ?? '',
    descripcion:           t?.descripcion           ?? '',
    foto_emblema:          t?.foto_path             ?? '',
    foto_url:              t?.foto_emblema          ?? '',
    periodo_inicio:        t?.periodo_inicio        ?? '',
    periodo_fin:           t?.periodo_fin           ?? '',
    divide_por_rango:      t?.divide_por_rango      ?? false,
    asignacion_automatica: t?.asignacion_automatica ?? true,
    primer_lugar_id:       t?.primer_lugar_id       ?? '',
    segundo_lugar_id:      t?.segundo_lugar_id      ?? '',
    tercer_lugar_id:       t?.tercer_lugar_id       ?? '',
    recompensas:           t?.recompensas?.map(r => ({ ...r })) ?? [],
    podios: TIERS.map(tier => {
      const existing = t?.podios?.find(p => p.rango === tier.id);
      return {
        rango:            tier.id,
        primer_lugar_id:  existing?.primer_lugar_id  ?? '',
        segundo_lugar_id: existing?.segundo_lugar_id ?? '',
        tercer_lugar_id:  existing?.tercer_lugar_id  ?? '',
      };
    }),
  };
}

/* ── EmblemSlot ─────────────────────────────────────────── */
function EmblemSlot({ preview, onUpload }) {
  const [uploading, setUploading] = useState(false);
  const ref = useRef(null);

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const token = localStorage.getItem('nx-token');
      const fd = new FormData();
      fd.append('emblema', file);
      const res = await fetch('/api/upload/emblema', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        body: fd,
      });
      const data = await res.json();
      if (res.ok) onUpload?.(data.path, data.url);
      else toast('Error al subir emblema', { tone: 'error', icon: 'x' });
    } catch {
      toast('Error de conexión', { tone: 'error', icon: 'x' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      onClick={() => !uploading && ref.current?.click()}
      style={{
        width: '100%', height: 140, borderRadius: 'var(--radius-lg)',
        border: preview ? 'none' : '2px dashed var(--holo-line)',
        cursor: uploading ? 'wait' : 'pointer',
        position: 'relative', overflow: 'hidden',
        background: preview ? 'var(--space-700)' : 'rgba(56,205,240,.04)',
        display: 'grid', placeItems: 'center',
        transition: 'border-color .15s',
      }}
      onMouseEnter={e => { if (!preview) e.currentTarget.style.borderColor = 'var(--holo)'; }}
      onMouseLeave={e => { if (!preview) e.currentTarget.style.borderColor = 'var(--holo-line)'; }}
    >
      {preview && (
        <>
          <img src={preview} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.65 }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(4,7,15,.75) 0%, transparent 55%)' }} />
        </>
      )}
      <div style={{ position: 'relative', textAlign: 'center', color: preview ? 'rgba(255,255,255,.9)' : 'var(--txt-faint)', zIndex: 1 }}>
        {uploading
          ? <><span className="nx-live-dot" style={{ marginRight: 6 }} />Subiendo...</>
          : <>
              <Icon name="upload" size={20} />
              <div className="nx-label" style={{ marginTop: 6 }}>{preview ? 'Cambiar emblema' : 'Subir emblema'}</div>
            </>
        }
      </div>
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => handleFile(e.target.files?.[0])} />
    </div>
  );
}

/* ── RecompensaRow ──────────────────────────────────────── */
function RecompensaRow({ r, idx, onChange, onRemove }) {
  const isMobile = useIsMobile();
  const up = (field, val) => onChange(idx, field, val);
  return (
    <div style={{
      display: 'grid', gap: 10, padding: '12px 14px',
      background: 'rgba(255,255,255,.03)', borderRadius: 'var(--radius-md)',
      border: '1px solid var(--holo-line)', position: 'relative',
    }}>
      <button onClick={() => onRemove(idx)} style={{
        position: 'absolute', top: 8, right: 8, background: 'none', border: 'none',
        cursor: 'pointer', color: 'var(--txt-faint)', padding: 4, borderRadius: 4,
        display: 'grid', placeItems: 'center',
      }}
        onMouseEnter={e => e.currentTarget.style.color = '#ff6b6b'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--txt-faint)'}
      >
        <Icon name="x" size={13} />
      </button>
      <div style={{
        display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 90px 90px', gap: 10,
        paddingRight: 28,
      }}>
        <div>
          <label className="nx-label">Nombre recompensa</label>
          <input className="nx-input" value={r.nombre} placeholder="Nombre"
            onChange={e => up('nombre', e.target.value)} />
        </div>
        <div>
          <label className="nx-label">Créditos</label>
          <input className="nx-input" type="number" min="0" value={r.creditos}
            onChange={e => up('creditos', +e.target.value)} />
        </div>
        <div>
          <label className="nx-label">Experiencia</label>
          <input className="nx-input" type="number" min="0" value={r.experiencia}
            onChange={e => up('experiencia', +e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 210px', gap: 10 }}>
        <div>
          <label className="nx-label">Descripción (opcional)</label>
          <input className="nx-input" value={r.descripcion ?? ''} placeholder="Descripción de la recompensa"
            onChange={e => up('descripcion', e.target.value)} />
        </div>
        <div>
          <label className="nx-label">Medalla</label>
          <select className="nx-select" value={r.medalla_id ?? ''}
            onChange={e => up('medalla_id', e.target.value)}>
            <option value="">Sin medalla</option>
            {Object.entries(NX.MEDALS).map(([id, m]) => (
              <option key={id} value={id}>{m.name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

/* ── PodioSelector (selector de 3 puestos para un rango) ── */
function PodioSelector({ tier, podio, combatants, onChange }) {
  const color = TIER_COLORS[tier.id] ?? '#38cdf0';
  const up = (field, val) => onChange(tier.id, field, val);
  return (
    <div style={{
      padding: '12px 14px', borderRadius: 'var(--radius-md)',
      background: 'rgba(255,255,255,.03)',
      border: `1px solid ${color}33`,
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
        <span className="nx-label" style={{ color }}>{tier.label}</span>
      </div>
      <div style={{ display: 'grid', gap: 7 }}>
        {PODIO_CFG.map(p => (
          <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
              display: 'grid', placeItems: 'center',
              background: `color-mix(in srgb, ${p.color} 18%, rgba(4,7,15,.8))`,
              border: `1px solid ${p.color}55`,
            }}>
              <span className="nx-num" style={{ fontSize: 8, color: p.color }}>{p.num}</span>
            </div>
            <select className="nx-select" style={{ flex: 1, fontSize: 11 }}
              value={podio[p.fieldId] ?? ''}
              onChange={e => up(p.fieldId, e.target.value)}>
              <option value="">{p.label} — Sin asignar</option>
              {combatants.map(c => (
                <option key={c.userId} value={c.userId}>{c.name} (@{c.handle})</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── ToggleRow ──────────────────────────────────────────── */
function ToggleRow({ active, onToggle, label, descOn, descOff }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 14px', borderRadius: 'var(--radius-md)',
      background: active ? 'rgba(56,205,240,.06)' : 'rgba(255,255,255,.03)',
      border: '1px solid var(--holo-line)',
      cursor: 'pointer',
    }} onClick={onToggle}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--txt-faint)', marginTop: 2 }}>
          {active ? descOn : descOff}
        </div>
      </div>
      <div style={{
        width: 36, height: 20, borderRadius: 10, flexShrink: 0,
        background: active ? 'var(--holo)' : 'rgba(255,255,255,.12)',
        position: 'relative', transition: 'background .2s',
      }}>
        <div style={{
          position: 'absolute', top: 3, left: active ? 18 : 3,
          width: 14, height: 14, borderRadius: '50%', background: '#fff',
          transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.3)',
        }} />
      </div>
    </div>
  );
}

/* ── TemporadaModal ─────────────────────────────────────── */
function TemporadaModal({ open, onClose, editing, combatants, onSaved }) {
  const isMobile = useIsMobile();
  const [form, setForm] = useState(makeFormFrom(editing));
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(makeFormFrom(editing)); }, [editing, open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addRecompensa = () => setForm(f => ({ ...f, recompensas: [...f.recompensas, { ...EMPTY_RECOMPENSA }] }));

  const changeRecompensa = (idx, field, val) =>
    setForm(f => ({ ...f, recompensas: f.recompensas.map((r, i) => i === idx ? { ...r, [field]: val } : r) }));

  const removeRecompensa = (idx) =>
    setForm(f => ({ ...f, recompensas: f.recompensas.filter((_, i) => i !== idx) }));

  const changePodio = (rango, field, val) =>
    setForm(f => ({ ...f, podios: f.podios.map(p => p.rango === rango ? { ...p, [field]: val } : p) }));

  const handleSave = async () => {
    if (!form.nombre.trim()) { toast('El nombre es requerido', { tone: 'error', icon: 'x' }); return; }
    if (!form.periodo_inicio || !form.periodo_fin) { toast('Las fechas son requeridas', { tone: 'error', icon: 'x' }); return; }

    setSaving(true);
    try {
      const token = localStorage.getItem('nx-token');
      const url    = editing ? `/api/temporadas/${editing.id}` : '/api/temporadas';
      const method = editing ? 'PUT' : 'POST';
      const manualPodio = !form.asignacion_automatica;
      const body = {
        nombre:                form.nombre.trim(),
        descripcion:           form.descripcion.trim() || null,
        foto_emblema:          form.foto_emblema || null,
        divide_por_rango:      form.divide_por_rango,
        asignacion_automatica: form.asignacion_automatica,
        periodo_inicio:        form.periodo_inicio,
        periodo_fin:           form.periodo_fin,
        primer_lugar_id:  (manualPodio && !form.divide_por_rango) ? (+form.primer_lugar_id  || null) : null,
        segundo_lugar_id: (manualPodio && !form.divide_por_rango) ? (+form.segundo_lugar_id || null) : null,
        tercer_lugar_id:  (manualPodio && !form.divide_por_rango) ? (+form.tercer_lugar_id  || null) : null,
        recompensas:      form.recompensas.filter(r => r.nombre.trim()),
        podios:           (manualPodio && form.divide_por_rango) ? form.podios.map(p => ({
          ...p,
          primer_lugar_id:  +p.primer_lugar_id  || null,
          segundo_lugar_id: +p.segundo_lugar_id || null,
          tercer_lugar_id:  +p.tercer_lugar_id  || null,
        })) : [],
      };
      const res  = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.message ?? 'Error al guardar', { tone: 'error', icon: 'x' }); return; }
      toast(editing ? 'Temporada actualizada' : 'Temporada creada', { tone: 'success', icon: 'check' });
      onSaved?.(data.temporada);
      onClose();
    } catch {
      toast('Error de conexión', { tone: 'error', icon: 'x' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Editar Temporada' : 'Nueva Temporada'}
      kicker="GESTIÓN · TEMPORADAS"
      width={700}
    >
      <div style={{ display: 'grid', gap: 18 }}>

        {/* Emblema */}
        <div>
          <label className="nx-label" style={{ display: 'block', marginBottom: 8 }}>Foto emblema</label>
          <EmblemSlot
            preview={form.foto_url}
            onUpload={(path, url) => setForm(f => ({ ...f, foto_emblema: path, foto_url: url }))}
          />
        </div>

        {/* Nombre + descripción */}
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label className="nx-label">Nombre de la temporada *</label>
            <input className="nx-input" value={form.nombre} placeholder="Ej. Temporada 4 — El Despertar"
              onChange={e => set('nombre', e.target.value)} />
          </div>
          <div>
            <label className="nx-label">Descripción</label>
            <textarea className="nx-textarea" value={form.descripcion} rows={2}
              placeholder="Contexto de la temporada, objetivos, lore..."
              onChange={e => set('descripcion', e.target.value)} />
          </div>
        </div>

        {/* Período */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
          <div>
            <label className="nx-label">Inicio del período *</label>
            <input className="nx-input" type="date" value={form.periodo_inicio}
              onChange={e => set('periodo_inicio', e.target.value)} />
          </div>
          <div>
            <label className="nx-label">Fin del período *</label>
            <input className="nx-input" type="date" value={form.periodo_fin}
              onChange={e => set('periodo_fin', e.target.value)} />
          </div>
        </div>

        {/* Toggle asignación automática */}
        <ToggleRow
          active={form.asignacion_automatica}
          onToggle={() => set('asignacion_automatica', !form.asignacion_automatica)}
          label="Asignación automática de podio"
          descOn="El podio se calcula según puntaje de victorias al finalizar la temporada"
          descOff="El podio se asigna de forma manual"
        />

        {/* Toggle ranking por rango */}
        <ToggleRow
          active={form.divide_por_rango}
          onToggle={() => set('divide_por_rango', !form.divide_por_rango)}
          label="Dividir podio por rango"
          descOn="Cada tier tiene su propio 1°, 2° y 3° lugar"
          descOff="Un único podio global para la temporada"
        />

        {/* Podio global o por rango — solo visible en asignación manual */}
        {!form.asignacion_automatica && form.divide_por_rango ? (
          <div>
            <div className="nx-kicker" style={{ marginBottom: 10 }}>Podio por Rango</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {TIERS.map(tier => (
                <PodioSelector
                  key={tier.id}
                  tier={tier}
                  podio={form.podios.find(p => p.rango === tier.id) ?? EMPTY_PODIO(tier.id)}
                  combatants={combatants}
                  onChange={changePodio}
                />
              ))}
            </div>
          </div>
        ) : !form.asignacion_automatica ? (
          <div>
            <div className="nx-kicker" style={{ marginBottom: 10 }}>Podio Global</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {PODIO_CFG.map(p => (
                <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    display: 'grid', placeItems: 'center',
                    background: `color-mix(in srgb, ${p.color} 18%, rgba(4,7,15,.8))`,
                    border: `1px solid ${p.color}66`,
                  }}>
                    <span className="nx-num" style={{ fontSize: 11, color: p.color }}>{p.num}</span>
                  </div>
                  <select className="nx-select" style={{ flex: 1 }}
                    value={form[p.fieldId] ?? ''}
                    onChange={e => set(p.fieldId, e.target.value)}>
                    <option value="">{p.label} — Sin asignar</option>
                    {combatants.map(c => (
                      <option key={c.userId} value={c.userId}>{c.name} (@{c.handle})</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{
            padding: '12px 16px', borderRadius: 'var(--radius-md)',
            background: 'rgba(56,205,240,.04)', border: '1px dashed var(--holo-line)',
            display: 'flex', alignItems: 'center', gap: 10, color: 'var(--txt-faint)',
          }}>
            <Icon name="trophy" size={14} />
            <span style={{ fontSize: 12 }}>
              El podio se calculará automáticamente al finalizar la temporada, según las victorias registradas.
            </span>
          </div>
        )}

        {/* Recompensas */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div className="nx-kicker">Recompensas</div>
            <Btn sm icon="plus" kind="ghost" onClick={addRecompensa}>Agregar</Btn>
          </div>
          {form.recompensas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--txt-faint)', fontSize: 12 }}>
              Sin recompensas definidas
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {form.recompensas.map((r, idx) => (
                <RecompensaRow key={idx} r={r} idx={idx} onChange={changeRecompensa} onRemove={removeRecompensa} />
              ))}
            </div>
          )}
        </div>

        <hr className="nx-divider" />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn kind="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn kind="accent" icon="check" disabled={saving} onClick={handleSave}>
            {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear Temporada'}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

/* ── PodioRow (visual compacto de 1 puesto) ─────────────── */
function PodioRow({ winner, numColor, num }) {
  if (!winner) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <PodioNum color={numColor} num={num} />
      <span style={{ fontSize: 11, color: 'var(--txt-faint)' }}>Sin asignar</span>
    </div>
  );
  const avatarC = { initials: winner.initials || (winner.handle || '?').substring(0, 2).toUpperCase(), color: TIER_COLORS[winner.tier] ?? '#38cdf0' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <PodioNum color={numColor} num={num} />
      <Avatar c={avatarC} size={24} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{winner.name}</div>
        <div className="nx-data" style={{ fontSize: 9, color: 'var(--txt-faint)' }}>@{winner.handle}</div>
      </div>
      <TierBadge tier={winner.tier} sm />
    </div>
  );
}

function PodioNum({ color, num, size = 22 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      display: 'grid', placeItems: 'center',
      background: `color-mix(in srgb, ${color} 15%, rgba(4,7,15,.8))`,
      border: `1px solid ${color}55`,
    }}>
      <span className="nx-num" style={{ fontSize: 9, color }}>{num}</span>
    </div>
  );
}

/* ── MisionDetallePopup — detalle completo de una misión + completar ── */
function MisionDetallePopup({ mision, busy, onClose, onCompletar }) {
  const done = mision.completada_por_mi;
  const hitosReq = mision.hito_requerimiento
    ? mision.hito_requerimiento.split(',').map(h => h.trim()).filter(Boolean)
    : [];

  return (
    <>
      <Modal open onClose={onClose} kicker={done ? 'Misión completada' : 'Detalle de misión'} title={mision.nombre} zIndex={1100}>
        <div style={{ display: 'grid', gap: 16 }}>
        {mision.foto_mision && (
          <div style={{ height: 140, borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <img src={mediaUrl(mision.foto_mision)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}

        {mision.mision && (
          <p style={{ fontSize: 13, color: 'var(--txt)', fontWeight: 600, margin: 0 }}>{mision.mision}</p>
        )}
        {mision.descripcion && (
          <p style={{ fontSize: 12.5, color: 'var(--txt-dim)', lineHeight: 1.6, margin: 0 }}>{mision.descripcion}</p>
        )}

        {/* Objetivos con progreso */}
        {(mision.objetivos ?? []).length > 0 && (
          <div>
            <div className="nx-kicker" style={{ marginBottom: 8 }}>OBJETIVOS</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {mision.objetivos.map(o => {
                const actual = o.progreso_actual ?? 0;
                const pct = o.meta > 0 ? Math.min(100, Math.round((actual / o.meta) * 100)) : 100;
                return (
                  <div key={o.id} style={{
                    padding: '8px 10px', borderRadius: 7,
                    background: o.completado ? 'rgba(16,185,129,0.06)' : 'rgba(56,205,240,0.05)',
                    border: `1px solid ${o.completado ? 'rgba(16,185,129,0.25)' : 'var(--holo-line)'}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icon name={o.completado ? 'check' : 'target'} size={13} style={{ color: o.completado ? '#10b981' : 'var(--holo)', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--txt)', fontWeight: 600 }}>{o.nombre}</div>
                      <span className="nx-data" style={{ fontSize: 10, color: o.completado ? '#10b981' : 'var(--txt-faint)' }}>
                        {actual}/{o.meta}{o.unidad ? ` ${o.unidad}` : ''}
                      </span>
                    </div>
                    {o.descripcion && <div style={{ fontSize: 11, color: 'var(--txt-faint)', marginTop: 3, marginLeft: 21 }}>{o.descripcion}</div>}
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, marginTop: 6 }}>
                      <div style={{
                        height: '100%', width: `${pct}%`, borderRadius: 2, transition: 'width 0.4s ease',
                        background: o.completado ? '#10b981' : 'var(--holo)',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Hitos requeridos */}
        {hitosReq.length > 0 && (
          <div>
            <div className="nx-kicker" style={{ marginBottom: 8 }}>HITOS REQUERIDOS</div>
            <div style={{ fontSize: 11, color: mision.cumple_hitos ? '#10b981' : 'var(--txt-faint)' }}>
              {hitosReq.join(', ')}
            </div>
          </div>
        )}

        {/* Recompensas */}
        {(mision.recompensas ?? []).length > 0 && (
          <div>
            <div className="nx-kicker" style={{ marginBottom: 8 }}>RECOMPENSAS</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {mision.recompensas.map((r, i) => (
                <span key={r.id ?? i} style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 4,
                  background: 'rgba(230,179,37,0.1)', border: '1px solid rgba(230,179,37,0.25)', color: '#E6B325',
                }}>
              {r.tipo === 'creditos' ? '💰' : r.tipo === 'hito' ? '⭐' : '📦'} {r.tipo === 'hito' ? (r.hito || r.nombre) : r.nombre}{r.valor > 0 ? ` ×${r.valor}` : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        {done ? (
          <div style={{ fontSize: 12, color: '#10b981', textAlign: 'right' }}>Ya completaste esta misión.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, paddingTop: 4 }}>
            {!mision.puede_completar && (
              <div style={{ fontSize: 11, color: 'var(--txt-faint)' }}>
                {!mision.cumple_hitos ? 'Aún no cumples los hitos requeridos.' : 'Aún no completas todos los objetivos.'}
              </div>
            )}
            <Btn kind="accent" icon="check" onClick={onCompletar} disabled={busy || !mision.puede_completar}>
              {busy ? 'Completando...' : 'Completar misión'}
            </Btn>
          </div>
        )}
        </div>
      </Modal>
    </>
  );
}

/* ── MisionesTemporadaModal — Battle pass popup ─────────── */
function MisionesTemporadaModal({ temporadaId, temporadaNombre, onClose, onUserUpdate, onTransmision }) {
  const [misiones, setMisiones]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (!temporadaId) return;
    const load = () => {
      const token = localStorage.getItem('nx-token');
      setLoading(true);
      fetch(`/api/misiones/temporada/${temporadaId}`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      }).then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.misiones) setMisiones(d.misiones); })
        .catch(() => {})
        .finally(() => setLoading(false));
    };
    load();
    const handler = () => load();
    window.addEventListener('nx-mision-updated', handler);
    return () => window.removeEventListener('nx-mision-updated', handler);
  }, [temporadaId]);

  const completadas = misiones.filter(m => m.completada_por_mi).length;
  const selectedMision = misiones.find(m => m.id === selectedId) ?? null;

  const handleCompletar = async () => {
    if (!selectedMision) return;
    setCompleting(true);
    try {
      const token = localStorage.getItem('nx-token');
      const res = await fetch(`/api/misiones/${selectedMision.id}/completar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || 'No se pudo completar la misión');

      toast('¡Misión completada!', { tone: 'success', icon: 'check' });
      (data?.hitos_otorgados ?? []).forEach((hito) => {
        toast(`🏆 Hito obtenido: "${hito}"`, { tone: 'success', icon: 'star' });
      });
      setMisiones(prev => prev.map(m => m.id === selectedMision.id
        ? { ...m, completada_por_mi: true, status: 'completada', puede_completar: false }
        : m));
      const transmision = buildMissionCompletionTransmision(data);
      if (transmision) {
        onTransmision?.(transmision);
      }
      setSelectedId(null);

      // Las recompensas (créditos, hitos, títulos) ya se otorgaron en el servidor —
      // refresca el usuario global para que se reflejen sin recargar la página
      // (p. ej. el widget de Hitos en Comando).
      if (onUserUpdate) {
        fetch('/api/me', { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } })
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d) onUserUpdate(d); })
          .catch(() => {});
      }
    } catch (e) {
      toast(e.message || 'Error al completar la misión', { tone: 'error', icon: 'x' });
    } finally {
      setCompleting(false);
    }
  };

  return (
    <Modal open onClose={onClose} kicker="Pase de Batalla" title={temporadaNombre ?? 'Misiones de Temporada'}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 32 }}>
          <span className="nx-data" style={{ color: 'var(--holo)', animation: 'nx-pulse 1.4s infinite' }}>CARGANDO...</span>
        </div>
      ) : misiones.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--txt-faint)', fontSize: 13 }}>
          Esta temporada no tiene misiones configuradas aún
        </div>
      ) : (
        <>
          {/* Progreso global del pase */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)' }}>PROGRESO DEL PASE</span>
              <span className="nx-num" style={{ fontSize: 11, color: 'var(--holo)' }}>
                {completadas} / {misiones.length}
              </span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 3 }}>
              <div style={{
                height: '100%',
                width: `${misiones.length ? Math.round((completadas / misiones.length) * 100) : 0}%`,
                background: completadas === misiones.length ? '#10b981' : 'var(--holo)',
                borderRadius: 3, transition: 'width 0.5s ease',
              }} />
            </div>
          </div>

          {/* Lista de misiones */}
          <div style={{ display: 'grid', gap: 10, maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
            {misiones.map((m, idx) => {
              const done = m.completada_por_mi;
              return (
                <button key={m.id} onClick={() => setSelectedId(m.id)} style={{
                  display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 8,
                  background: done ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${done ? 'rgba(16,185,129,0.25)' : 'var(--holo-line)'}`,
                  opacity: done ? 0.85 : 1, cursor: 'pointer', textAlign: 'left', width: '100%',
                  color: 'inherit', font: 'inherit', transition: 'border-color 0.15s, background 0.15s',
                }}
                  onMouseEnter={e => { if (!done) e.currentTarget.style.borderColor = 'var(--holo)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = done ? 'rgba(16,185,129,0.25)' : 'var(--holo-line)'; }}
                >
                  {/* Número / check */}
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    display: 'grid', placeItems: 'center',
                    background: done ? 'rgba(16,185,129,0.2)' : 'rgba(56,205,240,0.1)',
                    border: `2px solid ${done ? '#10b981' : 'rgba(56,205,240,0.3)'}`,
                  }}>
                    {done
                      ? <Icon name="check" size={14} style={{ color: '#10b981' }} />
                      : <span className="nx-num" style={{ fontSize: 11, color: 'var(--holo)' }}>{idx + 1}</span>
                    }
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: done ? '#10b981' : 'var(--txt)' }}>
                        {m.nombre}
                      </div>
                      {!done && m.puede_completar && (
                        <Chip tone="green" style={{ fontSize: 9 }}>Lista para completar</Chip>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--txt-dim)', marginBottom: 6 }}>{m.mision}</div>

                    {/* Objetivos */}
                    {(m.objetivos ?? []).length > 0 && (
                      <div style={{ display: 'grid', gap: 3, marginBottom: 6 }}>
                        {m.objetivos.map(obj => (
                          <div key={obj.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--txt-faint)' }}>
                            <div style={{ width: 4, height: 4, borderRadius: '50%', background: (done || obj.completado) ? '#10b981' : 'var(--holo)', flexShrink: 0 }} />
                            {obj.nombre}
                            <span style={{ marginLeft: 'auto' }}>
                              {obj.progreso_actual ?? 0}/{obj.meta} {obj.unidad ?? ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Recompensas */}
                    {(m.recompensas ?? []).length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {m.recompensas.map((r, i) => (
                          <span key={r.id ?? i} style={{
                            fontSize: 10, padding: '2px 8px', borderRadius: 4,
                            background: 'rgba(230,179,37,0.1)', border: '1px solid rgba(230,179,37,0.25)', color: '#E6B325',
                          }}>
                            {r.tipo === 'creditos' ? '💰' : r.tipo === 'hito' ? '⭐' : '📦'} {r.tipo === 'hito' ? (r.hito || r.nombre) : r.nombre}{r.valor > 0 ? ` ×${r.valor}` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {selectedMision && (
        <MisionDetallePopup
          mision={selectedMision}
          busy={completing}
          onClose={() => setSelectedId(null)}
          onCompletar={handleCompletar}
        />
      )}
    </Modal>
  );
}

/* ── TemporadaCard ──────────────────────────────────────── */
function TemporadaCard({ temporada: t, canEdit, onEdit, onUserUpdate, onTransmision }) {
  const [showRec, setShowRec]       = useState(false);
  const [openTier, setOpenTier]     = useState(null);
  const [showMisiones, setShowMisiones] = useState(false);

  const hasPodios = t.divide_por_rango && t.podios?.length > 0;
  const activePodios = hasPodios
    ? t.podios.filter(p => p.primer_lugar || p.segundo_lugar || p.tercer_lugar)
    : [];

  return (
    <div className="nx-panel" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Emblema header */}
      <div style={{ height: 110, position: 'relative', overflow: 'hidden', flexShrink: 0,
        background: t.foto_emblema ? 'var(--space-700)' : 'linear-gradient(135deg, rgba(56,205,240,.07), rgba(230,179,37,.04))' }}>
        {t.foto_emblema && (
          <img src={t.foto_emblema} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5 }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(11,26,54,.98) 0%, rgba(11,26,54,.3) 100%)' }} />
        <div style={{ position: 'absolute', bottom: 14, left: 18, right: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 8 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="nx-kicker" style={{ marginBottom: 2, fontSize: 9 }}>Temporada</div>
            <h3 className="nx-display" style={{
              fontSize: 17, color: 'var(--txt)', margin: 0, lineHeight: 1.2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{t.nombre}</h3>
          </div>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
            {t.divide_por_rango && <Chip tone="dim" icon="user" style={{ fontSize: 9 }}>Por rango</Chip>}
            <Chip tone={t.activa ? 'green' : 'dim'}>{t.activa ? 'ACTIVA' : 'FINALIZADA'}</Chip>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '14px 18px 16px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        {/* Período */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--txt-faint)', fontSize: 11 }}>
          <Icon name="calendar" size={12} />
          <span className="nx-data">{fmtDate(t.periodo_inicio)} → {fmtDate(t.periodo_fin)}</span>
        </div>

        {t.descripcion && (
          <div style={{ fontSize: 12, color: 'var(--txt-dim)', lineHeight: 1.55 }}>{t.descripcion}</div>
        )}

        <hr className="nx-divider" />

        {/* Podio */}
        {t.divide_por_rango ? (
          /* Podio por rango — acordeón de tiers */
          <div style={{ display: 'grid', gap: 6 }}>
            {activePodios.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--txt-faint)', textAlign: 'center', padding: '8px 0' }}>Sin podio asignado aún</div>
            ) : activePodios.map(p => {
              const tierInfo = TIERS.find(t => t.id === p.rango);
              const color    = TIER_COLORS[p.rango] ?? '#38cdf0';
              const isOpen   = openTier === p.rango;
              return (
                <div key={p.rango} style={{
                  borderRadius: 'var(--radius-md)', overflow: 'hidden',
                  border: `1px solid ${color}33`, borderLeft: `3px solid ${color}`,
                }}>
                  <button
                    onClick={() => setOpenTier(isOpen ? null : p.rango)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px', background: 'rgba(255,255,255,.02)',
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0 }} />
                    <span className="nx-label" style={{ flex: 1, color, minWidth: 0 }}>{tierInfo?.label ?? p.rango}</span>
                    {p.primer_lugar && (
                      <span style={{
                        fontSize: 11, color: 'var(--txt-dim)', fontWeight: 600, flexShrink: 1, minWidth: 0,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110,
                      }}>
                        {p.primer_lugar.name}
                      </span>
                    )}
                    <Icon name={isOpen ? 'chevdown' : 'chevron'} size={11} />
                  </button>
                  {isOpen && (
                    <div style={{ padding: '8px 12px 10px', display: 'grid', gap: 7 }}>
                      <PodioRow winner={p.primer_lugar}  numColor="var(--holocron-oro)" num="1" />
                      <PodioRow winner={p.segundo_lugar} numColor="#c0c0c0"            num="2" />
                      <PodioRow winner={p.tercer_lugar}  numColor="#cd7f32"            num="3" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Podio global */
          <div style={{ display: 'grid', gap: 7 }}>
            <PodioRow winner={t.primer_lugar}  numColor="var(--holocron-oro)" num="1" />
            <PodioRow winner={t.segundo_lugar} numColor="#c0c0c0"            num="2" />
            <PodioRow winner={t.tercer_lugar}  numColor="#cd7f32"            num="3" />
          </div>
        )}

        {/* Recompensas */}
        {t.recompensas?.length > 0 && (
          <>
            <hr className="nx-divider" />
            <button
              onClick={() => setShowRec(v => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--holo)', padding: '4px 0', textAlign: 'left' }}
            >
              <Icon name={showRec ? 'chevdown' : 'chevron'} size={11} />
              <span className="nx-label">{t.recompensas.length} recompensa{t.recompensas.length > 1 ? 's' : ''}</span>
            </button>
            {showRec && (
              <div style={{ display: 'grid', gap: 7 }}>
                {t.recompensas.map((r, i) => (
                  <div key={i} style={{ padding: '8px 12px', background: 'rgba(255,255,255,.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--holo-line)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt)' }}>{r.nombre}</span>
                      <div style={{ display: 'flex', gap: 5 }}>
                        {r.creditos > 0 && <Chip tone="gold" icon="coin">{r.creditos} cr</Chip>}
                        {r.experiencia > 0 && <Chip tone="orange">+{r.experiencia} XP</Chip>}
                        {r.medalla_id && NX.MEDALS[r.medalla_id] && <MedalIcon id={r.medalla_id} size={22} />}
                      </div>
                    </div>
                    {r.descripcion && (
                      <div style={{ fontSize: 11, color: 'var(--txt-faint)', marginTop: 4 }}>{r.descripcion}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Acciones */}
        <div style={{ marginTop: 'auto', paddingTop: 8, display: 'flex', gap: 8 }}>
          <Btn kind="ghost" sm icon="target" onClick={() => setShowMisiones(true)} style={{ flex: 1, justifyContent: 'center' }}>
            Misiones
          </Btn>
          {canEdit && (
            <Btn kind="ghost" sm icon="edit" onClick={() => onEdit(t)} style={{ flex: 1, justifyContent: 'center' }}>
              Editar
            </Btn>
          )}
        </div>
      </div>

      {showMisiones && (
        <MisionesTemporadaModal
          temporadaId={t.id}
          temporadaNombre={t.nombre}
          onClose={() => setShowMisiones(false)}
          onUserUpdate={onUserUpdate}
          onTransmision={onTransmision}
        />
      )}
    </div>
  );
}

/* ── Vista principal ────────────────────────────────────── */
export function TemporadasView({ S, user, onUserUpdate, onTransmision }) {
  const isMobile = useIsMobile();
  const [temporadas, setTemporadas] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editing,    setEditing]    = useState(null);

  const canEdit = user?.tier === 'maestro' || user?.tier === 'granmaestro';
  const combatants = S.combatants.filter(c => c.id !== 'you');

  useEffect(() => {
    const token = localStorage.getItem('nx-token');
    fetch('/api/temporadas', {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    }).then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.temporadas) setTemporadas(d.temporadas); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSaved = (t) => {
    setTemporadas(prev => {
      const idx = prev.findIndex(x => x.id === t.id);
      return idx >= 0 ? prev.map((x, i) => i === idx ? t : x) : [t, ...prev];
    });
  };

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit   = (t)  => { setEditing(t);    setModalOpen(true); };

  return (
    <div className="nx-fade" style={{ display: 'grid', gap: 20 }}>
      <Panel
        title="Temporadas de la Academia"
        kicker="HISTORIAL · TEMPORADAS"
        icon="crown"
        right={!isMobile && canEdit && <Btn kind="accent" icon="plus" onClick={openCreate}>Nueva Temporada</Btn>}
      >
        <div style={{ fontSize: 13, color: 'var(--txt-dim)', lineHeight: 1.6 }}>
          Registro oficial de las temporadas de combate. Cada temporada define un período de competencia, su podio de campeones y las recompensas otorgadas.
        </div>
        {isMobile && canEdit && (
          <Btn kind="accent" icon="plus" onClick={openCreate} style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}>
            Nueva Temporada
          </Btn>
        )}
      </Panel>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--txt-faint)' }}>
          <span className="nx-live-dot" style={{ marginRight: 8 }} />
          <span className="nx-data" style={{ fontSize: 11 }}>Cargando temporadas...</span>
        </div>
      ) : temporadas.length === 0 ? (
        <div className="nx-panel" style={{ textAlign: 'center', padding: 56 }}>
          <div style={{ opacity: 0.3, marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
            <Icon name="crown" size={40} />
          </div>
          <div className="nx-display" style={{ fontSize: 15, color: 'var(--txt-dim)', marginBottom: 6 }}>Aún no hay temporadas</div>
          <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)', marginBottom: 20 }}>
            {canEdit ? 'Crea la primera temporada de la Academia' : 'El tutor registrará las temporadas próximamente'}
          </div>
          {canEdit && <Btn kind="accent" icon="plus" onClick={openCreate}>Crear primera temporada</Btn>}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 18, alignItems: 'start',
        }}>
          {temporadas.map(t => (
            <TemporadaCard key={t.id} temporada={t} canEdit={canEdit} onEdit={openEdit} onUserUpdate={onUserUpdate} onTransmision={onTransmision} />
          ))}
        </div>
      )}

      <TemporadaModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        combatants={combatants}
        onSaved={handleSaved}
      />
    </div>
  );
}
