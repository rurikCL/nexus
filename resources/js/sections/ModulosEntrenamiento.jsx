import { useState, useEffect } from 'react';
import { NX } from '../data/seed.js';
import { Icon, Panel, Btn, Chip, Avatar, Modal, toast, ImageSlot } from '../components/ui.jsx';

/* NÉXUS — Módulos de Entrenamiento */

const FOCOS        = ['Técnica', 'Cardio', 'Sparring', 'Footwork', 'Fuerza', 'Estudio', 'Recuperación'];
const FORMAS       = NX.CLASSES.map(c => ({ id: c.id, label: `${c.num} · ${c.name}` }));
const NIVELES      = ['basico', 'intermedio', 'avanzado', 'experto'];
const ESTADOS      = ['pendiente', 'revision', 'confirmado'];
const RANGOS       = ['iniciado', 'padawan', 'caballero', 'maestro'];
const ADMIN_TIERS  = ['caballero', 'maestro', 'granmaestro'];

const NIVEL_COLOR = {
  basico:       '#38cdf0',
  intermedio:   '#10b981',
  avanzado:     '#FF6B00',
  experto:      '#E6B325',
};

const NIVEL_LABEL = {
  basico:       'Básico',
  intermedio:   'Intermedio',
  avanzado:     'Avanzado',
  experto:      'Experto',
};

const ESTADO_COLOR = {
  pendiente:   '#a0a0b0',
  revision:    '#FF6B00',
  confirmado:  '#10b981',
};

const ESTADO_LABEL = {
  pendiente:   'Pendiente',
  revision:    'En Revisión',
  confirmado:  'Confirmado',
};

const RANGO_COLOR = {
  iniciado:    'var(--tier-iniciado, #a0a0b0)',
  padawan:     'var(--tier-padawan, #38cdf0)',
  caballero:   'var(--tier-caballero, #10b981)',
  maestro:     'var(--tier-maestro, #E6B325)',
};

const RANGO_LABEL = {
  iniciado:    'Iniciados',
  padawan:     'Padawan',
  caballero:   'Caballeros',
  maestro:     'Maestros',
};

function useWindowWidth() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return w;
}

const TOKEN = () => localStorage.getItem('nx-token');

const api = {
  list: () =>
    fetch('/api/modulos-entrenamiento', { headers: { Authorization: `Bearer ${TOKEN()}` } })
      .then(r => r.json()),
  revisores: () =>
    fetch('/api/modulos-entrenamiento/revisores', { headers: { Authorization: `Bearer ${TOKEN()}` } })
      .then(r => r.json()),
  create: (body) =>
    fetch('/api/modulos-entrenamiento', {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()),
  update: (id, body) =>
    fetch(`/api/modulos-entrenamiento/${id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${TOKEN()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()),
  remove: (id) =>
    fetch(`/api/modulos-entrenamiento/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${TOKEN()}` },
    }).then(r => r.json()),
  generarFoto: (body) =>
    fetch('/api/modulos-entrenamiento/fotos/generar', {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()),
};

/* ---- Tarjeta de módulo ---- */
function ModuloCard({ modulo, isAdmin, onEdit, onDelete, onClick }) {
  const forma = NX.CLASSES.find(c => c.id === modulo.forma);
  const nivelColor = NIVEL_COLOR[modulo.nivel_dificultad] ?? '#38cdf0';

  return (
    <div
      onClick={onClick}
      style={{
        background: 'rgba(255,255,255,.03)',
        border: '1px solid var(--holo-line)',
        borderRadius: 'var(--radius-lg)',
        padding: 16,
        cursor: 'pointer',
        transition: 'border-color .15s, box-shadow .15s',
        display: 'grid', gap: 12,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--holo)'; e.currentTarget.style.boxShadow = '0 0 18px -8px var(--holo)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--holo-line)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Foto hero */}
      {modulo.fotos?.[0] && (
        <div style={{ height: 96, borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <img src={modulo.fotos[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
        </div>
      )}

      {/* Cabecera */}
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', lineHeight: 1.3 }}>{modulo.nombre}</div>
            {modulo.foco && (
              <div className="nx-data" style={{ fontSize: 9, color: 'var(--txt-faint)', marginTop: 2 }}>{modulo.foco}</div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', flexShrink: 0 }}>
            <span style={{
              fontSize: 8, fontFamily: 'var(--font-data)', letterSpacing: '0.1em',
              color: nivelColor, background: `color-mix(in srgb, ${nivelColor} 14%, transparent)`,
              border: `1px solid color-mix(in srgb, ${nivelColor} 35%, transparent)`,
              padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap',
            }}>
              {NIVEL_LABEL[modulo.nivel_dificultad] ?? modulo.nivel_dificultad}
            </span>
            {(() => {
              const ec = ESTADO_COLOR[modulo.estado] ?? '#a0a0b0';
              return (
                <span style={{
                  fontSize: 8, fontFamily: 'var(--font-data)', letterSpacing: '0.1em',
                  color: ec, background: `color-mix(in srgb, ${ec} 14%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${ec} 35%, transparent)`,
                  padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap',
                }}>
                  {ESTADO_LABEL[modulo.estado] ?? modulo.estado}
                </span>
              );
            })()}
            {modulo.rango && (() => {
              const rc = RANGO_COLOR[modulo.rango] ?? '#a0a0b0';
              return (
                <span style={{
                  fontSize: 8, fontFamily: 'var(--font-data)', letterSpacing: '0.1em',
                  color: rc, background: `color-mix(in srgb, ${rc} 14%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${rc} 35%, transparent)`,
                  padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap',
                }}>
                  {RANGO_LABEL[modulo.rango] ?? modulo.rango}
                </span>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Datos */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {modulo.esfuerzo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ display: 'flex', gap: 2 }}>
              {Array.from({ length: 10 }, (_, i) => (
                <span key={i} style={{
                  display: 'block', width: 4, height: 8, borderRadius: 2,
                  background: i < modulo.esfuerzo ? 'var(--holocron-naranja)' : 'rgba(255,255,255,.1)',
                }} />
              ))}
            </div>
            <span className="nx-data" style={{ fontSize: 8, color: 'var(--txt-faint)' }}>{modulo.esfuerzo}/10</span>
          </div>
        )}
        {forma && (
          <span className="nx-data" style={{ fontSize: 9, color: forma.accent ?? 'var(--txt-dim)' }}>
            {forma.num} {forma.name}
          </span>
        )}
      </div>

      {/* Objetivos preview */}
      {modulo.objetivos?.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {modulo.objetivos.slice(0, 3).map((o, i) => (
            <span key={i} style={{
              fontSize: 9, color: 'var(--txt-dim)',
              background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)',
              padding: '2px 7px', borderRadius: 4,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130,
            }}>
              {o}
            </span>
          ))}
          {modulo.objetivos.length > 3 && (
            <span style={{ fontSize: 9, color: 'var(--txt-faint)' }}>+{modulo.objetivos.length - 3}</span>
          )}
        </div>
      )}

      {/* Footer autor + acciones admin */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--holo-line)', paddingTop: 10 }}>
        <span className="nx-data" style={{ fontSize: 9, color: 'var(--txt-faint)', flex: 1 }}>
          por {modulo.creado_por?.name ?? '—'}
          {modulo.revisado_por && <> · revisado por {modulo.revisado_por.name}</>}
        </span>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
            <Btn sm icon="edit" onClick={() => onEdit(modulo)}>Editar</Btn>
            <Btn sm kind="danger" icon="trash" onClick={() => onDelete(modulo)}>Eliminar</Btn>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Modal de detalle ---- */
function ModuloDetailModal({ modulo, onClose }) {
  const isMobile = useWindowWidth() < 640;
  if (!modulo) return null;
  const forma = NX.CLASSES.find(c => c.id === modulo.forma);
  const nivelColor = NIVEL_COLOR[modulo.nivel_dificultad] ?? '#38cdf0';

  return (
    <Modal open title={modulo.nombre} onClose={onClose}>
      <div style={{ display: 'grid', gap: 20 }}>
        {/* Fotos */}
        {modulo.fotos?.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap: 8 }}>
            {modulo.fotos.map((src, i) => (
              <div key={i} style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', aspectRatio: '1' }}>
                <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        )}

        {/* Chips metadata */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{
            fontSize: 9, fontFamily: 'var(--font-data)', letterSpacing: '0.1em',
            color: nivelColor, background: `color-mix(in srgb, ${nivelColor} 14%, transparent)`,
            border: `1px solid color-mix(in srgb, ${nivelColor} 35%, transparent)`,
            padding: '3px 8px', borderRadius: 4,
          }}>
            {NIVEL_LABEL[modulo.nivel_dificultad] ?? modulo.nivel_dificultad}
          </span>
          {(() => {
            const ec = ESTADO_COLOR[modulo.estado] ?? '#a0a0b0';
            return (
              <span style={{
                fontSize: 9, fontFamily: 'var(--font-data)', letterSpacing: '0.1em',
                color: ec, background: `color-mix(in srgb, ${ec} 14%, transparent)`,
                border: `1px solid color-mix(in srgb, ${ec} 35%, transparent)`,
                padding: '3px 8px', borderRadius: 4,
              }}>
                {ESTADO_LABEL[modulo.estado] ?? modulo.estado}
              </span>
            );
          })()}
          {modulo.foco && <Chip>{modulo.foco}</Chip>}
          {forma && <Chip tone="holo">{forma.num} · {forma.name}</Chip>}
          {modulo.rango && <Chip>{RANGO_LABEL[modulo.rango] ?? modulo.rango}</Chip>}
          {modulo.esfuerzo && (
            <span className="nx-data" style={{ fontSize: 10, color: 'var(--holocron-naranja)' }}>
              Esfuerzo {modulo.esfuerzo}/10
            </span>
          )}
        </div>

        {/* Descripción */}
        {modulo.descripcion && (
          <p style={{ fontSize: 13, color: 'var(--txt-dim)', lineHeight: 1.6, margin: 0 }}>{modulo.descripcion}</p>
        )}

        {/* Objetivos */}
        {modulo.objetivos?.length > 0 && (
          <div>
            <div className="nx-kicker" style={{ marginBottom: 8 }}>Objetivos</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {modulo.objetivos.map((o, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ color: 'var(--holo)', marginTop: 2, flexShrink: 0 }}><Icon name="check" size={12} /></span>
                  <span style={{ fontSize: 13, color: 'var(--txt)' }}>{o}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Video */}
        {modulo.video && (
          <div>
            <div className="nx-kicker" style={{ marginBottom: 8 }}>Video de referencia</div>
            <a
              href={modulo.video} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--holo)', fontSize: 12 }}
            >
              <Icon name="video" size={14} /> Ver video
            </a>
          </div>
        )}

        {/* Autores */}
        <div style={{ borderTop: '1px solid var(--holo-line)', paddingTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {modulo.creado_por && (
            <div className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)' }}>
              Creado por <span style={{ color: 'var(--txt)' }}>{modulo.creado_por.name}</span>
            </div>
          )}
          {modulo.revisado_por && (
            <div className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)' }}>
              Revisado por <span style={{ color: 'var(--txt)' }}>{modulo.revisado_por.name}</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ---- Formulario (crear / editar) ---- */
const EMPTY_FORM = {
  nombre: '', descripcion: '', objetivos: [], foco: '', esfuerzo: 5,
  forma: '', fotos: [], video: '', nivel_dificultad: 'basico', estado: 'pendiente', rango: '', revisado_por: '',
};

function ModuloForm({ initial, onSave, onClose, saving }) {
  const isMobile = useWindowWidth() < 640;
  const [form, setForm] = useState(() => initial
    ? { ...EMPTY_FORM, ...initial, objetivos: initial.objetivos ?? [], fotos: initial.fotos ?? [], revisado_por: initial.revisado_por?.id ?? '', estado: initial.estado ?? 'pendiente' }
    : { ...EMPTY_FORM });
  const [objInput, setObjInput] = useState('');
  const [fotoInput, setFotoInput] = useState('');
  const [revisores, setRevisores] = useState([]);
  const [descripcionIA, setDescripcionIA] = useState('');
  const [generandoFoto, setGenerandoFoto] = useState(false);
  const [fotosGeneradasIds, setFotosGeneradasIds] = useState([]);

  useEffect(() => {
    api.revisores().then(d => setRevisores(d.revisores ?? [])).catch(() => {});
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addObjetivo = () => {
    const t = objInput.trim();
    if (!t) return;
    set('objetivos', [...form.objetivos, t]);
    setObjInput('');
  };

  const removeObjetivo = (i) => set('objetivos', form.objetivos.filter((_, idx) => idx !== i));

  const addFoto = () => {
    const t = fotoInput.trim();
    if (!t || form.fotos.length >= 6) return;
    set('fotos', [...form.fotos, t]);
    setFotoInput('');
  };

  const removeFoto = (i) => set('fotos', form.fotos.filter((_, idx) => idx !== i));

  const generarFotoIA = async () => {
    const descripcion = descripcionIA.trim() || form.descripcion.trim();
    if (!descripcion) { toast('Escribe una descripción para generar la imagen', { tone: 'red', icon: 'alert' }); return; }
    if (form.fotos.length >= 6) { toast('Ya alcanzaste el máximo de 6 fotos', { tone: 'red', icon: 'alert' }); return; }

    setGenerandoFoto(true);
    try {
      const d = await api.generarFoto({
        descripcion,
        modulo_entrenamiento_id: initial?.id ?? null,
      });
      if (d.foto?.url) {
        set('fotos', [...form.fotos, d.foto.url]);
        if (!initial) setFotosGeneradasIds(ids => [...ids, d.foto.id]);
        setDescripcionIA('');
        toast('Imagen generada', { tone: 'success', icon: 'check' });
      } else {
        toast(d.message ?? 'Error al generar la imagen', { tone: 'red', icon: 'alert' });
      }
    } finally {
      setGenerandoFoto(false);
    }
  };

  const handleSubmit = () => {
    if (!form.nombre.trim()) { toast('El nombre es obligatorio', { tone: 'red', icon: 'alert' }); return; }
    onSave({
      ...form,
      revisado_por: form.revisado_por ? Number(form.revisado_por) : null,
      fotos_generadas_ids: fotosGeneradasIds,
    });
  };

  return (
    <Modal open title={initial ? 'Editar módulo' : 'Nuevo módulo'} onClose={onClose}>
      <div style={{ display: 'grid', gap: 16 }}>

        {/* Nombre */}
        <div>
          <label className="nx-label">Nombre *</label>
          <input className="nx-input" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej. Defensa con Soresu" />
        </div>

        {/* Descripción */}
        <div>
          <label className="nx-label">Descripción</label>
          <textarea className="nx-textarea" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} rows={3} placeholder="Descripción general del módulo..." />
        </div>

        {/* Foco / Forma / Nivel / Rango / Esfuerzo */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
          <div>
            <label className="nx-label">Foco</label>
            <select className="nx-select" value={form.foco} onChange={e => set('foco', e.target.value)}>
              <option value="">— Sin foco —</option>
              {FOCOS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="nx-label">Nivel de dificultad</label>
            <select className="nx-select" value={form.nivel_dificultad} onChange={e => set('nivel_dificultad', e.target.value)}>
              {NIVELES.map(n => <option key={n} value={n}>{NIVEL_LABEL[n]}</option>)}
            </select>
          </div>
          <div>
            <label className="nx-label">Forma de combate</label>
            <select className="nx-select" value={form.forma} onChange={e => set('forma', e.target.value)}>
              <option value="">— Sin forma —</option>
              {FORMAS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label className="nx-label">Rango requerido</label>
            <select className="nx-select" value={form.rango} onChange={e => set('rango', e.target.value)}>
              <option value="">— Sin rango —</option>
              {RANGOS.map(r => <option key={r} value={r}>{RANGO_LABEL[r]}</option>)}
            </select>
          </div>
          <div>
            <label className="nx-label">Esfuerzo · {form.esfuerzo}/10</label>
            <input type="range" min="1" max="10" value={form.esfuerzo} onChange={e => set('esfuerzo', +e.target.value)}
              style={{ width: '100%', accentColor: 'var(--holocron-naranja)', marginTop: 8 }} />
          </div>
        </div>

        {/* Objetivos */}
        <div>
          <label className="nx-label">Objetivos</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input className="nx-input" style={{ flex: 1 }} value={objInput}
              onChange={e => setObjInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addObjetivo(); } }}
              placeholder="Ej. Practicar bloqueo circular..." />
            <Btn sm icon="plus" onClick={addObjetivo}>Agregar</Btn>
          </div>
          {form.objetivos.length > 0 && (
            <div style={{ display: 'grid', gap: 5 }}>
              {form.objetivos.map((o, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', background: 'rgba(255,255,255,.04)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--holo-line)' }}>
                  <span style={{ color: 'var(--holo)', flexShrink: 0 }}><Icon name="check" size={11} /></span>
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--txt)' }}>{o}</span>
                  <button onClick={() => removeObjetivo(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt-faint)', padding: 2 }}>
                    <Icon name="x" size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fotos */}
        <div>
          <label className="nx-label">Fotos de ejemplo (hasta 6 · URL)</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input className="nx-input" style={{ flex: 1 }} value={fotoInput}
              onChange={e => setFotoInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFoto(); } }}
              placeholder="https://..." />
            <Btn sm icon="image" onClick={addFoto} disabled={form.fotos.length >= 6}>Agregar</Btn>
          </div>

          {/* Generar con IA */}
          <div style={{
            display: 'flex', gap: 8, marginBottom: 8, padding: 10,
            background: 'rgba(255,255,255,.03)', border: '1px solid var(--holo-line)', borderRadius: 'var(--radius-md)',
          }}>
            <input className="nx-input" style={{ flex: 1 }} value={descripcionIA}
              onChange={e => setDescripcionIA(e.target.value)}
              placeholder="Describe la imagen a generar (o déjalo vacío para usar la descripción del módulo)"
              disabled={generandoFoto || form.fotos.length >= 6} />
            <Btn sm kind="accent" icon={generandoFoto ? 'loader' : 'star'} onClick={generarFotoIA}
              disabled={generandoFoto || form.fotos.length >= 6}>
              {generandoFoto ? 'Generando…' : 'Generar con IA'}
            </Btn>
          </div>

          {form.fotos.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap: 8 }}>
              {form.fotos.map((src, i) => (
                <div key={i} style={{ position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden', aspectRatio: '1' }}>
                  <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.75 }} />
                  <button
                    onClick={() => removeFoto(i)}
                    style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,.7)', border: 'none', borderRadius: '50%', width: 20, height: 20, display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#fff' }}>
                    <Icon name="x" size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Video */}
        <div>
          <label className="nx-label">Video (URL)</label>
          <input className="nx-input" value={form.video} onChange={e => set('video', e.target.value)} placeholder="https://..." />
        </div>

        {/* Estado + Revisado por */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
          <div>
            <label className="nx-label">Estado</label>
            <select className="nx-select" value={form.estado} onChange={e => set('estado', e.target.value)}>
              {ESTADOS.map(e => (
                <option key={e} value={e}>{ESTADO_LABEL[e]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="nx-label">Revisado por <span style={{ color: 'var(--txt-faint)', fontWeight: 400 }}>(Guardián / Maestro)</span></label>
            <select className="nx-select" value={form.revisado_por} onChange={e => set('revisado_por', e.target.value)}>
              <option value="">— Sin revisor —</option>
              {revisores.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name}{r.handle ? ` (@${r.handle})` : ''} · {r.clase ?? r.tier}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn kind="accent" icon={saving ? 'loader' : 'check'} onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando…' : (initial ? 'Guardar cambios' : 'Crear módulo')}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

/* ---- Vista principal ---- */
export function ModulosEntrenamientoView({ user }) {
  const [modulos, setModulos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail]   = useState(null);
  const [editing, setEditing]  = useState(null);  // null = cerrado, false = nuevo, obj = editar
  const [saving, setSaving]    = useState(false);
  const [filtro, setFiltro]    = useState('');
  const [filtroNivel, setFiltroNivel] = useState('');
  const [filtroRango, setFiltroRango] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');

  const isAdmin = ADMIN_TIERS.includes(user?.tier ?? '');

  const load = () => {
    setLoading(true);
    api.list().then(d => {
      setModulos(d.modulos ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (form) => {
    setSaving(true);
    try {
      if (editing && editing !== false) {
        const d = await api.update(editing.id, form);
        if (d.modulo) {
          setModulos(ms => ms.map(m => m.id === d.modulo.id ? d.modulo : m));
          toast('Módulo actualizado', { tone: 'success', icon: 'check' });
        } else {
          toast(d.message ?? 'Error al actualizar', { tone: 'red', icon: 'alert' });
        }
      } else {
        const d = await api.create(form);
        if (d.modulo) {
          setModulos(ms => [d.modulo, ...ms]);
          toast('Módulo creado', { tone: 'success', icon: 'check' });
        } else {
          toast(d.message ?? 'Error al crear', { tone: 'red', icon: 'alert' });
        }
      }
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (modulo) => {
    if (!confirm(`¿Eliminar "${modulo.nombre}"?`)) return;
    const d = await api.remove(modulo.id);
    if (d.message) {
      setModulos(ms => ms.filter(m => m.id !== modulo.id));
      toast('Módulo eliminado', { tone: 'orange', icon: 'trash' });
    }
  };

  const visible = modulos.filter(m => {
    const q = filtro.toLowerCase();
    const matchQ = !q || m.nombre.toLowerCase().includes(q) || (m.descripcion ?? '').toLowerCase().includes(q);
    const matchN = !filtroNivel || m.nivel_dificultad === filtroNivel;
    const matchR = !filtroRango || m.rango === filtroRango;
    const matchE = !filtroEstado || m.estado === filtroEstado;
    return matchQ && matchN && matchR && matchE;
  });

  const hayFiltros = filtro || filtroNivel || filtroRango || filtroEstado;
  const limpiarFiltros = () => { setFiltro(''); setFiltroNivel(''); setFiltroRango(''); setFiltroEstado(''); };

  return (
    <div className="nx-fade" style={{ display: 'grid', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <input className="nx-input" style={{ flex: 1, minWidth: 200 }} value={filtro}
          onChange={e => setFiltro(e.target.value)} placeholder="Buscar módulo..." />
        {isAdmin && (
          <Btn kind="accent" icon="plus" onClick={() => setEditing(false)}>Nuevo módulo</Btn>
        )}
      </div>

      {/* Barra de filtros */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <select className="nx-select" style={{ width: 160 }} value={filtroNivel} onChange={e => setFiltroNivel(e.target.value)}>
          <option value="">Todos los niveles</option>
          {NIVELES.map(n => <option key={n} value={n}>{NIVEL_LABEL[n]}</option>)}
        </select>
        <select className="nx-select" style={{ width: 160 }} value={filtroRango} onChange={e => setFiltroRango(e.target.value)}>
          <option value="">Todos los rangos</option>
          {RANGOS.map(r => <option key={r} value={r}>{RANGO_LABEL[r]}</option>)}
        </select>
        <select className="nx-select" style={{ width: 160 }} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
        </select>
        {hayFiltros && (
          <Btn sm icon="x" onClick={limpiarFiltros}>Limpiar filtros</Btn>
        )}
      </div>

      {/* Stats rápidos */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {NIVELES.map(n => {
          const count = modulos.filter(m => m.nivel_dificultad === n).length;
          const c = NIVEL_COLOR[n];
          return (
            <button key={n} onClick={() => setFiltroNivel(filtroNivel === n ? '' : n)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
                background: filtroNivel === n ? `color-mix(in srgb, ${c} 18%, transparent)` : 'rgba(255,255,255,.03)',
                border: `1px solid ${filtroNivel === n ? c : 'var(--holo-line)'}`,
                borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all .15s',
              }}>
              <span className="nx-num" style={{ fontSize: 18, color: c }}>{count}</span>
              <span className="nx-data" style={{ fontSize: 9, color: 'var(--txt-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{NIVEL_LABEL[n]}</span>
            </button>
          );
        })}
      </div>

      {/* Grid de módulos */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--txt-faint)' }}>
          <div className="nx-data" style={{ fontSize: 11, letterSpacing: '0.15em' }}>CARGANDO MÓDULOS…</div>
        </div>
      ) : visible.length === 0 ? (
        <Panel title="Sin módulos">
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--txt-faint)', fontSize: 13 }}>
            {hayFiltros ? 'No hay módulos con ese filtro.' : 'No hay módulos registrados aún.'}
            {isAdmin && !hayFiltros && (
              <div style={{ marginTop: 16 }}>
                <Btn kind="accent" icon="plus" onClick={() => setEditing(false)}>Crear primer módulo</Btn>
              </div>
            )}
          </div>
        </Panel>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {visible.map(m => (
            <ModuloCard
              key={m.id}
              modulo={m}
              isAdmin={isAdmin}
              onClick={() => setDetail(m)}
              onEdit={() => setEditing(m)}
              onDelete={() => handleDelete(m)}
            />
          ))}
        </div>
      )}

      {/* Modal detalle */}
      {detail && <ModuloDetailModal modulo={detail} onClose={() => setDetail(null)} />}

      {/* Modal formulario */}
      {editing !== null && (
        <ModuloForm
          initial={editing || null}
          onSave={handleSave}
          onClose={() => setEditing(null)}
          saving={saving}
        />
      )}
    </div>
  );
}
