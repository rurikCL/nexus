import { useState, useEffect, useRef } from 'react';
import { NX } from '../data/seed.js';
import { Icon, Panel, Btn, Chip, Avatar, TierBadge, MedalIcon, Modal, toast } from '../components/ui.jsx';

/* ── Utilidades ─────────────────────────────────────────── */
const TIER_COLORS = {
  iniciado: '#8aa0c0', padawan: '#38cdf0', caballero: '#10b981',
  maestro: '#FF6B00', granmaestro: '#E6B325',
};

const PODIO_CFG = [
  { key: 'primer_lugar',   fieldId: 'primer_lugar_id',   label: '1er Lugar', color: 'var(--pompeyo-oro)',  num: '1' },
  { key: 'segundo_lugar',  fieldId: 'segundo_lugar_id',  label: '2do Lugar', color: '#c0c0c0',             num: '2' },
  { key: 'tercer_lugar',   fieldId: 'tercer_lugar_id',   label: '3er Lugar', color: '#cd7f32',             num: '3' },
];

const fmtDate = (d) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const EMPTY_RECOMPENSA = { nombre: '', descripcion: '', creditos: 0, experiencia: 0, medalla_id: '' };

function makeFormFrom(t) {
  return {
    nombre:           t?.nombre           ?? '',
    descripcion:      t?.descripcion      ?? '',
    foto_emblema:     t?.foto_path        ?? '',
    foto_url:         t?.foto_emblema     ?? '',
    periodo_inicio:   t?.periodo_inicio   ?? '',
    periodo_fin:      t?.periodo_fin      ?? '',
    primer_lugar_id:  t?.primer_lugar_id  ?? '',
    segundo_lugar_id: t?.segundo_lugar_id ?? '',
    tercer_lugar_id:  t?.tercer_lugar_id  ?? '',
    recompensas:      t?.recompensas?.map(r => ({ ...r })) ?? [],
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
  const up = (field, val) => onChange(idx, field, val);
  return (
    <div style={{
      display: 'grid', gap: 10, padding: '12px 14px',
      background: 'rgba(255,255,255,.03)', borderRadius: 'var(--radius-md)',
      border: '1px solid var(--holo-line)', position: 'relative',
    }}>
      <button
        onClick={() => onRemove(idx)}
        style={{
          position: 'absolute', top: 8, right: 8, background: 'none', border: 'none',
          cursor: 'pointer', color: 'var(--txt-faint)', padding: 4, borderRadius: 4,
          display: 'grid', placeItems: 'center',
        }}
        onMouseEnter={e => e.currentTarget.style.color = '#ff6b6b'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--txt-faint)'}
      >
        <Icon name="x" size={13} />
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', gap: 10, paddingRight: 28 }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 210px', gap: 10 }}>
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

/* ── TemporadaModal ─────────────────────────────────────── */
function TemporadaModal({ open, onClose, editing, combatants, onSaved }) {
  const [form, setForm] = useState(makeFormFrom(editing));
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(makeFormFrom(editing)); }, [editing, open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addRecompensa = () => setForm(f => ({ ...f, recompensas: [...f.recompensas, { ...EMPTY_RECOMPENSA }] }));

  const changeRecompensa = (idx, field, val) =>
    setForm(f => ({ ...f, recompensas: f.recompensas.map((r, i) => i === idx ? { ...r, [field]: val } : r) }));

  const removeRecompensa = (idx) =>
    setForm(f => ({ ...f, recompensas: f.recompensas.filter((_, i) => i !== idx) }));

  const handleSave = async () => {
    if (!form.nombre.trim()) { toast('El nombre es requerido', { tone: 'error', icon: 'x' }); return; }
    if (!form.periodo_inicio || !form.periodo_fin) { toast('Las fechas son requeridas', { tone: 'error', icon: 'x' }); return; }

    setSaving(true);
    try {
      const token = localStorage.getItem('nx-token');
      const url    = editing ? `/api/temporadas/${editing.id}` : '/api/temporadas';
      const method = editing ? 'PUT' : 'POST';
      const body = {
        nombre:           form.nombre.trim(),
        descripcion:      form.descripcion.trim() || null,
        foto_emblema:     form.foto_emblema || null,
        periodo_inicio:   form.periodo_inicio,
        periodo_fin:      form.periodo_fin,
        primer_lugar_id:  form.primer_lugar_id  || null,
        segundo_lugar_id: form.segundo_lugar_id || null,
        tercer_lugar_id:  form.tercer_lugar_id  || null,
        recompensas:      form.recompensas.filter(r => r.nombre.trim()),
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
      width={680}
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
        <div className="nx-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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

        {/* Podio */}
        <div>
          <div className="nx-kicker" style={{ marginBottom: 10 }}>Podio</div>
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
                    <option key={c.id} value={c.id}>{c.name} (@{c.handle})</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

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

        {/* Acciones */}
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

/* ── TemporadaCard ──────────────────────────────────────── */
function TemporadaCard({ temporada: t, canEdit, onEdit }) {
  const [showRec, setShowRec] = useState(false);

  return (
    <div className="nx-panel" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Emblema header */}
      <div style={{ height: 110, position: 'relative', overflow: 'hidden', flexShrink: 0,
        background: t.foto_emblema ? 'var(--space-700)' : 'linear-gradient(135deg, rgba(56,205,240,.07), rgba(230,179,37,.04))' }}>
        {t.foto_emblema && (
          <img src={t.foto_emblema} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5 }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(11,26,54,.98) 0%, rgba(11,26,54,.3) 100%)' }} />
        <div style={{ position: 'absolute', bottom: 14, left: 18, right: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div className="nx-kicker" style={{ marginBottom: 2, fontSize: 9 }}>Temporada</div>
            <h3 className="nx-display" style={{ fontSize: 17, color: 'var(--txt)', margin: 0, lineHeight: 1.2 }}>{t.nombre}</h3>
          </div>
          <Chip tone={t.activa ? 'green' : 'dim'} style={{ flexShrink: 0 }}>{t.activa ? 'ACTIVA' : 'FINALIZADA'}</Chip>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '14px 18px 16px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        {/* Período */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--txt-faint)', fontSize: 11 }}>
          <Icon name="calendar" size={12} />
          <span className="nx-data">{fmtDate(t.periodo_inicio)} → {fmtDate(t.periodo_fin)}</span>
        </div>

        {/* Descripción */}
        {t.descripcion && (
          <div style={{ fontSize: 12, color: 'var(--txt-dim)', lineHeight: 1.55 }}>{t.descripcion}</div>
        )}

        <hr className="nx-divider" />

        {/* Podio */}
        <div style={{ display: 'grid', gap: 7 }}>
          {PODIO_CFG.map(p => {
            const winner = t[p.key];
            const avatarC = winner
              ? { initials: (winner.handle || '?').substring(0, 2).toUpperCase(), color: TIER_COLORS[winner.tier] ?? '#38cdf0' }
              : null;
            return (
              <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  display: 'grid', placeItems: 'center',
                  background: `color-mix(in srgb, ${p.color} 15%, rgba(4,7,15,.8))`,
                  border: `1px solid ${p.color}55`,
                }}>
                  <span className="nx-num" style={{ fontSize: 9, color: p.color }}>{p.num}</span>
                </div>
                {winner ? (
                  <>
                    <Avatar c={avatarC} size={24} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{winner.name}</div>
                      <div className="nx-data" style={{ fontSize: 9, color: 'var(--txt-faint)' }}>@{winner.handle}</div>
                    </div>
                    <TierBadge tier={winner.tier} sm />
                  </>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--txt-faint)' }}>Sin asignar</span>
                )}
              </div>
            );
          })}
        </div>

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
                        {r.medalla_id && NX.MEDALS[r.medalla_id] && (
                          <MedalIcon id={r.medalla_id} size={22} />
                        )}
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

        {/* Acciones tutor */}
        {canEdit && (
          <div style={{ marginTop: 'auto', paddingTop: 8 }}>
            <Btn kind="ghost" sm icon="edit" onClick={() => onEdit(t)} style={{ width: '100%', justifyContent: 'center' }}>
              Editar temporada
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Vista principal ────────────────────────────────────── */
export function TemporadasView({ S, user }) {
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
      {/* Header */}
      <Panel
        title="Temporadas de la Academia"
        kicker="HISTORIAL · TEMPORADAS"
        icon="crown"
        right={canEdit && <Btn kind="accent" icon="plus" onClick={openCreate}>Nueva Temporada</Btn>}
      >
        <div style={{ fontSize: 13, color: 'var(--txt-dim)', lineHeight: 1.6 }}>
          Registro oficial de las temporadas de combate. Cada temporada define un período de competencia, su podio de campeones y las recompensas otorgadas.
        </div>
      </Panel>

      {/* Contenido */}
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
          <div className="nx-display" style={{ fontSize: 15, color: 'var(--txt-dim)', marginBottom: 6 }}>
            Aún no hay temporadas
          </div>
          <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)', marginBottom: 20 }}>
            {canEdit ? 'Crea la primera temporada de la Academia' : 'El tutor registrará las temporadas próximamente'}
          </div>
          {canEdit && (
            <Btn kind="accent" icon="plus" onClick={openCreate}>Crear primera temporada</Btn>
          )}
        </div>
      ) : (
        <div className="nx-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18, alignItems: 'start' }}>
          {temporadas.map(t => (
            <TemporadaCard key={t.id} temporada={t} canEdit={canEdit} onEdit={openEdit} />
          ))}
        </div>
      )}

      {/* Modal crear/editar */}
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
