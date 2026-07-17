import { useState, useEffect, useCallback, useRef } from 'react';
import QrScanner from 'qr-scanner';
import { Icon, Panel, Btn, Chip, Modal, toast } from '../components/ui.jsx';
import { playAtras } from '../utils/sounds.js';

function useWindowWidth() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return w;
}

/* ─── AUTH ─────────────────────────────────────────────────── */
const api = async (method, path, body) => {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('nx-token')}`,
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message ?? `Error ${res.status}`);
  return json;
};

/* ─── CONSTANTES ────────────────────────────────────────────── */
const TRAINER_TIERS = ['caballero', 'maestro', 'granmaestro'];
const SESION_TIPOS  = ['Entrenamiento Oficial', 'Entrenamiento Libre', 'Actividad', 'Taller', 'Reunión'];
const NX_FOCUS = ['Técnica', 'Cardio', 'Sparring', 'Footwork', 'Fuerza', 'Estudio', 'Recuperación'];
const NX_TAGS  = ['técnica', 'cardio', 'sparring', 'defensa', 'estudio', 'fuerza', 'flexibilidad'];

const FOCO_C = {
  Técnica: 'var(--holo)', Cardio: 'var(--holocron-naranja)', Sparring: '#ff2d45',
  Footwork: '#10b981', Fuerza: '#E6B325', Estudio: '#8b5cf6', Recuperación: '#38cdf0',
};
const NIVEL_C = {
  basico: 'var(--txt-dim)', intermedio: 'var(--holo)',
  avanzado: 'var(--holocron-naranja)', experto: '#ff2d45',
};

/* ─── PLAN NODE ─────────────────────────────────────────────── */
function PlanNode({ node, index, total, isEdit, onUp, onDown, onDelete, onChange, modulos }) {
  const isMod  = node.type === 'module';
  const accent = isMod ? 'var(--holo)' : 'var(--txt-dim)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {index > 0 && (
        <div style={{ width: 2, height: 16, background: 'var(--holo-line)', flexShrink: 0 }} />
      )}
      <div style={{
        width: '100%', padding: '12px 14px',
        border: `1px solid ${isMod ? 'var(--holo-line)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 'var(--radius-md)',
        background: isMod ? 'rgba(56,205,240,0.04)' : 'rgba(255,255,255,0.025)',
        display: 'flex', gap: 12, alignItems: 'flex-start',
      }}>
        {/* icon */}
        <div style={{
          width: 32, height: 32, borderRadius: 6, flexShrink: 0, marginTop: 1,
          background: isMod ? 'rgba(56,205,240,0.12)' : 'rgba(255,255,255,0.06)',
          display: 'grid', placeItems: 'center', color: accent,
        }}>
          <Icon name={isMod ? 'target' : 'edit'} size={14} />
        </div>

        {/* body */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {isMod ? (
            <>
              {isEdit && (
                <select className="nx-select" style={{ fontSize: 12, marginBottom: 6 }}
                  value={node.modulo_id ?? ''}
                  onChange={e => {
                    const id = e.target.value ? Number(e.target.value) : null;
                    const mod = modulos.find(m => m.id === id) ?? null;
                    onChange({ modulo_id: id, modulo: mod });
                  }}
                >
                  <option value="">— Seleccionar módulo —</option>
                  {modulos.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
              )}
              {node.modulo ? (
                <>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--txt)', lineHeight: 1.3 }}>{node.modulo.nombre}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    {node.modulo.foco && (
                      <span style={{ fontSize: 10, color: FOCO_C[node.modulo.foco] ?? 'var(--txt-dim)', fontFamily: 'var(--font-data)' }}>
                        {node.modulo.foco}
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: NIVEL_C[node.modulo.nivel_dificultad] ?? 'var(--txt-faint)', fontFamily: 'var(--font-data)', textTransform: 'uppercase' }}>
                      {node.modulo.nivel_dificultad}
                    </span>
                    {node.modulo.esfuerzo != null && (
                      <span style={{ fontSize: 10, color: 'var(--txt-faint)', fontFamily: 'var(--font-data)' }}>
                        Esfuerzo {node.modulo.esfuerzo}/10
                      </span>
                    )}
                  </div>
                </>
              ) : !isEdit && (
                <div style={{ fontSize: 12, color: 'var(--txt-faint)', fontStyle: 'italic' }}>Módulo no seleccionado</div>
              )}
            </>
          ) : (
            isEdit ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input className="nx-input" style={{ fontSize: 12 }}
                  placeholder="Título (opcional)"
                  value={node.titulo ?? ''}
                  onChange={e => onChange({ titulo: e.target.value })}
                />
                <textarea className="nx-textarea" rows={2} style={{ fontSize: 12, resize: 'vertical' }}
                  placeholder="Contenido de la nota..."
                  value={node.contenido ?? ''}
                  onChange={e => onChange({ contenido: e.target.value })}
                />
              </div>
            ) : (
              <>
                {node.titulo && <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--txt)', marginBottom: 3 }}>{node.titulo}</div>}
                {node.contenido && <div style={{ fontSize: 12, color: 'var(--txt-dim)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{node.contenido}</div>}
                {!node.titulo && !node.contenido && <div style={{ fontSize: 12, color: 'var(--txt-faint)', fontStyle: 'italic' }}>Nota vacía</div>}
              </>
            )
          )}
        </div>

        {/* controls */}
        {isEdit && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
            {[
              { label: '↑', act: onUp,     dis: index === 0,         style: {} },
              { label: '↓', act: onDown,   dis: index === total - 1, style: {} },
              { label: '✕', act: onDelete, dis: false,               style: { color: '#ff6b6b', background: 'rgba(220,38,38,0.08)', borderColor: 'rgba(220,38,38,0.2)' } },
            ].map(({ label, act, dis, style }) => (
              <button key={label} onClick={act} disabled={dis}
                style={{
                  background: 'transparent', border: '1px solid var(--holo-line)',
                  borderRadius: 4, padding: '2px 8px', cursor: dis ? 'not-allowed' : 'pointer',
                  color: 'var(--holo)', fontSize: 11, opacity: dis ? 0.35 : 1,
                  transition: 'all 0.1s', ...style,
                }}
              >{label}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── PLAN EDITOR ────────────────────────────────────────────── */
function PlanEditor({ initialNodes, sesionId, modulos, onSaved }) {
  const [nodes, setNodes] = useState(() =>
    (initialNodes ?? []).map((n, i) => ({ ...n, _k: i }))
  );
  const [saving, setSaving] = useState(false);

  const addNode = (type) => setNodes(p => [...p, { _k: Date.now(), type, modulo_id: null, modulo: null, titulo: '', contenido: '', orden: p.length }]);
  const moveUp   = (i) => setNodes(p => { const a = [...p]; [a[i], a[i-1]] = [a[i-1], a[i]]; return a; });
  const moveDown = (i) => setNodes(p => { const a = [...p]; [a[i], a[i+1]] = [a[i+1], a[i]]; return a; });
  const remove   = (i) => setNodes(p => p.filter((_, j) => j !== i));
  const update   = (i, patch) => setNodes(p => p.map((n, j) => j === i ? { ...n, ...patch } : n));

  const save = async () => {
    setSaving(true);
    try {
      const payload = nodes.map((n, i) => ({
        type: n.type, modulo_id: n.modulo_id ?? null,
        titulo: n.titulo || null, contenido: n.contenido || null, orden: i,
      }));
      const res = await api('POST', `/sesiones/${sesionId}/plan`, { nodes: payload });
      toast('Plan guardado', { tone: 'success', icon: 'check' });
      onSaved(res.plan_nodes ?? []);
    } catch (err) {
      toast(err.message, { tone: 'error', icon: 'x' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {nodes.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--txt-faint)', fontSize: 13 }}>
          Sin nodos. Agrega módulos o notas al plan.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {nodes.map((n, i) => (
          <PlanNode key={n._k} node={n} index={i} total={nodes.length} isEdit
            modulos={modulos}
            onUp={() => moveUp(i)} onDown={() => moveDown(i)}
            onDelete={() => remove(i)}
            onChange={patch => update(i, patch)}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <Btn kind="ghost" sm icon="target" onClick={() => addNode('module')}>+ Módulo</Btn>
        <Btn kind="ghost" sm icon="edit"   onClick={() => addNode('text')}>+ Nota</Btn>
        <div style={{ flex: 1 }} />
        <Btn kind="accent" sm icon="check" onClick={save} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar plan'}
        </Btn>
      </div>
    </div>
  );
}

/* ─── NODO ADICIONAL (aporte de caballero/maestro, fuera del plan principal) ── */
function AdicionalNodeRow({ node, index, total, canRemove, onRemove }) {
  return (
    <div>
      <PlanNode node={node} index={index} total={total} isEdit={false} modulos={[]} />
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '4px 4px 2px', fontSize: 10, color: 'var(--txt-faint)', fontFamily: 'var(--font-data)',
      }}>
        <span>
          Aportado por {node.creador?.name ?? 'alguien'}
          {node.creador?.handle && <> · @{node.creador.handle}</>}
        </span>
        {canRemove && (
          <button onClick={onRemove} style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer' }}>
            quitar
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── FORMULARIO PARA AGREGAR UN NODO ADICIONAL ───────────────── */
function AdicionalForm({ sesionId, modulos, onAdded }) {
  const [type, setType]           = useState(null); // null | 'module' | 'text'
  const [moduloId, setModuloId]   = useState(null);
  const [titulo, setTitulo]       = useState('');
  const [contenido, setContenido] = useState('');
  const [saving, setSaving]       = useState(false);

  const reset = () => { setType(null); setModuloId(null); setTitulo(''); setContenido(''); };

  const submit = async () => {
    setSaving(true);
    try {
      const res = await api('POST', `/sesiones/${sesionId}/plan/adicional`, {
        type, modulo_id: moduloId ?? null, titulo: titulo || null, contenido: contenido || null,
      });
      toast('Nodo adicional agregado', { tone: 'success', icon: 'check' });
      onAdded(res.node);
      reset();
    } catch (err) {
      toast(err.message, { tone: 'error', icon: 'x' });
    } finally {
      setSaving(false);
    }
  };

  if (!type) {
    return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Btn kind="ghost" sm icon="target" onClick={() => setType('module')}>+ Módulo</Btn>
        <Btn kind="ghost" sm icon="edit"   onClick={() => setType('text')}>+ Nota</Btn>
      </div>
    );
  }

  return (
    <div style={{ border: '1px dashed var(--holo-line)', borderRadius: 'var(--radius-md)', padding: 12 }}>
      {type === 'module' ? (
        <select className="nx-select" style={{ fontSize: 12 }}
          value={moduloId ?? ''}
          onChange={e => setModuloId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">— Seleccionar módulo —</option>
          {modulos.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input className="nx-input" style={{ fontSize: 12 }}
            placeholder="Título (opcional)" value={titulo} onChange={e => setTitulo(e.target.value)}
          />
          <textarea className="nx-textarea" rows={2} style={{ fontSize: 12, resize: 'vertical' }}
            placeholder="Contenido..." value={contenido} onChange={e => setContenido(e.target.value)}
          />
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
        <Btn kind="ghost" sm onClick={reset} disabled={saving}>Cancelar</Btn>
        <Btn kind="accent" sm icon="check" onClick={submit} disabled={saving || (type === 'module' && !moduloId)}>
          {saving ? 'Agregando...' : 'Agregar'}
        </Btn>
      </div>
    </div>
  );
}

/* ─── ESCANEO DE ASISTENCIA (QR) ──────────────────────────────── */
function extractHandle(raw) {
  const m = raw.match(/\/c\/([^/?#]+)/);
  return (m ? decodeURIComponent(m[1]) : raw).trim();
}

const SCAN_STATUS_LABEL = {
  marcado:       { label: 'Marcado · +75 cr', tone: 'green' },
  ya_marcado:    { label: 'Ya tenía asistencia', tone: 'dim' },
  no_encontrado: { label: 'Combatiente no encontrado', tone: 'orange' },
  es_encargado:  { label: 'Eres tú (encargado)', tone: 'dim' },
};

function AttendanceScanModal({ sesionId, onClose }) {
  const videoRef    = useRef(null);
  const scannerRef  = useRef(null);
  const scannedRef  = useRef([]);   // espejo de `scanned` para leer el valor actual dentro del callback del scanner
  const lastSeenRef = useRef(null); // último código leído, para no repetir el aviso mientras la cámara sigue apuntando al mismo QR
  const [scanned, setScanned]   = useState([]); // [{ handle, raw }]
  const [flash, setFlash]       = useState(null); // { handle, dup }
  const [camError, setCamError] = useState('');
  const [finalizing, setFinalizing] = useState(false);
  const [results, setResults]   = useState(null);

  useEffect(() => { scannedRef.current = scanned; }, [scanned]);

  useEffect(() => {
    const qs = new QrScanner(
      videoRef.current,
      (result) => {
        const raw = typeof result === 'string' ? result : result.data;
        const handle = extractHandle(raw);
        if (!handle) return;

        const key = handle.toLowerCase();
        if (lastSeenRef.current === key) return; // mismo QR aún en cuadro, no repetir el aviso
        lastSeenRef.current = key;

        const isDup = scannedRef.current.some(p => p.handle.toLowerCase() === key);
        if (isDup) {
          setFlash({ handle, dup: true });
          toast('Combatiente ya escaneado', { tone: 'info', icon: 'check', desc: `@${handle} ya está en la lista de esta sesión` });
          return;
        }

        setScanned(prev => [...prev, { handle, raw }]);
        setFlash({ handle, dup: false });
      },
      { highlightScanRegion: true, highlightCodeOutline: true, maxScansPerSecond: 5 }
    );
    scannerRef.current = qs;
    qs.start().catch(err => setCamError(err?.message ?? 'No se pudo acceder a la cámara.'));
    return () => { qs.stop(); qs.destroy(); };
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1200);
    return () => clearTimeout(t);
  }, [flash]);

  const removeOne = (handle) => {
    setScanned(prev => prev.filter(p => p.handle !== handle));
    if (lastSeenRef.current === handle.toLowerCase()) lastSeenRef.current = null;
  };

  const finalize = async () => {
    setFinalizing(true);
    try {
      const res = await api('POST', `/sesiones/${sesionId}/attend-scan`, { codes: scanned.map(s => s.raw) });
      scannerRef.current?.stop();
      setResults(res);
      toast('Asistencia registrada', {
        tone: 'success', icon: 'check',
        desc: `${res.marked} asistente(s) · +${res.encargado_credits} créditos para ti`,
      });
    } catch (err) {
      toast(err.message, { tone: 'error' });
    } finally {
      setFinalizing(false);
    }
  };

  return (
    <Modal open onClose={onClose} kicker="ESCANEO DE ASISTENCIA" title="Escanear QR de asistentes" width={480}>
      {results ? (
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div className="nx-num" style={{ fontSize: 30, color: 'var(--holo)' }}>+{results.encargado_credits}</div>
            <div className="nx-kicker">créditos para ti · {results.marked} asistente(s) marcados</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
            {results.results.map(r => {
              const s = SCAN_STATUS_LABEL[r.status] ?? { label: r.status, tone: 'dim' };
              return (
                <div key={r.handle} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1, fontSize: 12 }}>
                    {r.name ?? '—'} <span style={{ color: 'var(--txt-faint)', fontFamily: 'var(--font-data)' }}>@{r.handle}</span>
                  </span>
                  <Chip tone={s.tone} style={{ fontSize: 9 }}>{s.label}</Chip>
                </div>
              );
            })}
          </div>
          <Btn kind="accent" onClick={onClose} style={{ justifyContent: 'center' }}>Listo</Btn>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: '#000', aspectRatio: '1' }}>
            <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
            {flash && (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: flash.dup ? 'rgba(255,176,32,0.25)' : 'rgba(16,185,129,0.25)', pointerEvents: 'none' }}>
                <Chip tone={flash.dup ? 'orange' : 'green'} icon="check">
                  {flash.dup ? `Ya escaneado · @${flash.handle}` : `@${flash.handle}`}
                </Chip>
              </div>
            )}
          </div>
          {camError && <div style={{ fontSize: 12, color: '#ff6b6b' }}>{camError}</div>}

          <div>
            <div className="nx-kicker" style={{ marginBottom: 8 }}>Escaneados · {scanned.length}</div>
            {scanned.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--txt-faint)', textAlign: 'center', padding: '10px 0' }}>
                Apunta la cámara al código QR del perfil de cada asistente
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                {scanned.map(s => (
                  <div key={s.handle} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#10b981', flexShrink: 0 }}><Icon name="check" size={12} /></span>
                    <span style={{ flex: 1, fontSize: 12, fontFamily: 'var(--font-data)' }}>@{s.handle}</span>
                    <button onClick={() => removeOne(s.handle)} style={{ background: 'none', border: 'none', color: 'var(--txt-faint)', cursor: 'pointer', fontSize: 11 }}>quitar</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid var(--holo-line)' }}>
            <Btn kind="ghost" onClick={onClose} disabled={finalizing}>Cancelar</Btn>
            <Btn kind="accent" icon="check" onClick={finalize} disabled={finalizing}>
              {finalizing ? 'Registrando...' : 'Finalizar'}
            </Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ─── CLOSE MODAL ────────────────────────────────────────────── */
function CloseModal({ sesion, onClose, onClosed }) {
  const isMobile = useWindowWidth() < 640;
  const [form, setForm] = useState({ focus: 'Técnica', effort: 7, note: '', tags: [] });
  const [saving, setSaving] = useState(false);

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleTag = (t) => upd('tags', form.tags.includes(t) ? form.tags.filter(x => x !== t) : [...form.tags, t]);

  const submit = async () => {
    if (!form.note.trim()) { toast('Escribe una bitácora de cierre', { tone: 'error' }); return; }
    setSaving(true);
    try {
      const res = await api('POST', `/sesiones/${sesion.id}/close`, form);
      toast('Sesión cerrada', { tone: 'success', icon: 'check', desc: 'Bitácora global registrada' });
      onClosed(res);
    } catch (err) {
      toast(err.message, { tone: 'error', icon: 'x' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose}
      kicker="CERRAR SESIÓN"
      title={sesion.titulo}
      width={540}
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'rgba(255,107,0,0.08)', border: '1px solid rgba(255,107,0,0.25)', fontSize: 12, color: 'var(--holocron-naranja)' }}>
          Esta acción es irreversible. Se registrará la bitácora global y se cerrará la sesión para nuevas asistencias.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
          <div>
            <label className="nx-label">Foco de la sesión</label>
            <select className="nx-select" value={form.focus} onChange={e => upd('focus', e.target.value)}>
              {NX_FOCUS.map(f => <option key={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="nx-label">Esfuerzo global · {form.effort}/10</label>
            <input type="range" min="1" max="10" value={form.effort}
              onChange={e => upd('effort', +e.target.value)}
              style={{ width: '100%', accentColor: 'var(--holocron-naranja)', marginTop: 9 }}
            />
          </div>
        </div>

        <div>
          <label className="nx-label">Bitácora de cierre <span style={{ color: 'var(--holocron-naranja)' }}>*</span></label>
          <textarea className="nx-textarea" rows={4}
            placeholder="Cómo fue la sesión, qué se trabajó, observaciones generales del grupo..."
            value={form.note} onChange={e => upd('note', e.target.value)}
          />
        </div>

        <div>
          <label className="nx-label">Etiquetas</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {NX_TAGS.map(t => {
              const on = form.tags.includes(t);
              return (
                <button key={t} onClick={() => toggleTag(t)}
                  className={`nx-chip ${on ? '' : 'dim'}`}
                  style={{ cursor: 'pointer', borderColor: on ? 'var(--holo)' : undefined }}
                >
                  {on && <Icon name="check" size={10} />}{t}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--holo-line)' }}>
        <Btn kind="ghost" onClick={onClose} disabled={saving}>Cancelar</Btn>
        <Btn kind="accent" icon="check" onClick={submit} disabled={saving}
          style={{ background: 'rgba(255,107,0,0.15)', borderColor: 'var(--holocron-naranja)', color: 'var(--holocron-naranja)' }}
        >
          {saving ? 'Cerrando...' : 'Cerrar sesión'}
        </Btn>
      </div>
    </Modal>
  );
}

/* ─── CREATE MODAL ───────────────────────────────────────────── */
function CreateModal({ onClose, onCreated, user }) {
  const [form, setForm]       = useState({
    titulo: SESION_TIPOS[0], fecha: new Date().toISOString().slice(0, 10),
    sede_id: user?.sede?.id ?? '', encargados: [],
  });
  const [usuarios, setUsuarios] = useState([]);
  const [sedes, setSedes]       = useState([]);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    api('GET', '/admin/usuarios/options')
      .then(r => setUsuarios(r.options ?? []))
      .catch(() => {});
    api('GET', '/public/sedes')
      .then(r => setSedes(r.sedes ?? []))
      .catch(() => {});
  }, []);

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleUser = (id) => upd('encargados', form.encargados.includes(id) ? form.encargados.filter(x => x !== id) : [...form.encargados, id]);

  const submit = async () => {
    if (!form.fecha) { toast('Selecciona una fecha', { tone: 'error' }); return; }
    setSaving(true);
    try {
      const res = await api('POST', '/sesiones', { ...form, sede_id: form.sede_id || null });
      toast('Sesión creada', { tone: 'success', icon: 'check', desc: res.titulo });
      onCreated(res);
    } catch (err) {
      toast(err.message, { tone: 'error', icon: 'x' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} kicker="NUEVA SESIÓN" title="Crear Sesión de Entrenamiento" width={520}>
      <div style={{ display: 'grid', gap: 14 }}>
        <div>
          <label className="nx-label">Tipo de sesión <span style={{ color: 'var(--holocron-naranja)' }}>*</span></label>
          <select className="nx-select" value={form.titulo} onChange={e => upd('titulo', e.target.value)}>
            {SESION_TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="nx-label">Fecha <span style={{ color: 'var(--holocron-naranja)' }}>*</span></label>
          <input type="date" className="nx-input" value={form.fecha} onChange={e => upd('fecha', e.target.value)} />
        </div>
        <div>
          <label className="nx-label">Sede</label>
          <select className="nx-select" value={form.sede_id} onChange={e => upd('sede_id', e.target.value)}>
            <option value="">Sin sede específica</option>
            {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="nx-label">Encargados</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 160, overflowY: 'auto', padding: 4 }}>
            {usuarios.map(u => {
              const on = form.encargados.includes(u.id);
              return (
                <button key={u.id} type="button" onClick={() => toggleUser(u.id)}
                  style={{
                    padding: '5px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                    fontFamily: 'var(--font-data)', fontSize: 11, letterSpacing: '0.05em',
                    transition: 'all 0.15s',
                    background: on ? 'color-mix(in srgb, var(--holo) 18%, transparent)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${on ? 'var(--holo)' : 'var(--holo-line)'}`,
                    color: on ? 'var(--holo)' : 'var(--txt-dim)',
                  }}
                >
                  {on && '✓ '}{u.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--holo-line)' }}>
        <Btn kind="ghost" onClick={onClose} disabled={saving}>Cancelar</Btn>
        <Btn kind="accent" icon="plus" onClick={submit} disabled={saving}>
          {saving ? 'Creando...' : 'Crear sesión'}
        </Btn>
      </div>
    </Modal>
  );
}

/* ─── SESSION CARD ───────────────────────────────────────────── */
function SesionCard({ sesion, onClick }) {
  const closed = sesion.is_closed;
  return (
    <button onClick={onClick} className="nx-panel solid"
      style={{ padding: 16, textAlign: 'left', cursor: 'pointer', transition: 'all .15s', width: '100%' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--holo)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = ''}
    >
      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div className="nx-kicker" style={{ fontSize: 9, marginBottom: 3 }}>
            {new Date(sesion.fecha + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--txt)', lineHeight: 1.3 }}>{sesion.titulo}</div>
          {sesion.sede_nombre && (
            <div style={{ fontSize: 10, color: 'var(--holo)', fontFamily: 'var(--font-data)', marginTop: 3 }}>
              <Icon name="target" size={10} /> {sesion.sede_nombre}
            </div>
          )}
        </div>
        <Chip tone={closed ? 'dim' : 'green'} style={{ flexShrink: 0, marginLeft: 8 }}>
          {closed ? 'Cerrada' : 'Activa'}
        </Chip>
      </div>

      {/* encargados */}
      {sesion.encargados?.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
          {sesion.encargados.map(e => (
            <span key={e.id} style={{
              fontSize: 10, fontFamily: 'var(--font-data)', padding: '2px 8px',
              background: 'rgba(56,205,240,0.08)', border: '1px solid var(--holo-line)',
              borderRadius: 3, color: 'var(--txt-dim)',
            }}>
              {e.character?.handle ?? e.name}
            </span>
          ))}
        </div>
      )}

      {/* stats */}
      <div style={{ display: 'flex', gap: 14 }}>
        {[
          { icon: 'target', v: sesion.node_count, label: 'nodos' },
          { icon: 'user',   v: sesion.attendance_count, label: 'asistentes' },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ color: 'var(--txt-faint)' }}><Icon name={s.icon} size={12} /></span>
            <span className="nx-data" style={{ fontSize: 11, color: 'var(--txt-dim)' }}>{s.v} {s.label}</span>
          </div>
        ))}
        {sesion.i_am_encargado && (
          <Chip tone="orange" style={{ fontSize: 9, marginLeft: 'auto' }}>Encargado</Chip>
        )}
      </div>
    </button>
  );
}

/* ─── SESSION DETAIL ─────────────────────────────────────────── */
function SesionDetalle({ id, user, onBack }) {
  const isMobile = useWindowWidth() < 640;
  const [sesion, setSesion]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [editPlan, setEditPlan] = useState(false);
  const [modulos, setModulos]   = useState([]);
  const [showClose, setShowClose] = useState(false);
  const [showScan, setShowScan]   = useState(false);
  const [actioning, setActioning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api('GET', `/sesiones/${id}`);
      setSesion(res);
    } catch (err) {
      toast(err.message, { tone: 'error' });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api('GET', '/modulos-entrenamiento')
      .then(r => setModulos(r.modulos ?? []))
      .catch(() => {});
  }, []);

  if (loading || !sesion) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div className="nx-kicker" style={{ animation: 'nx-pulse 1.4s infinite' }}>CARGANDO...</div>
      </div>
    );
  }

  const isClosed = sesion.is_closed;
  const isEnc    = sesion.i_am_encargado;
  const myId     = user?.id;
  const iAttended = sesion.attendance.some(a => a.user_id === myId);
  const canMark   = isEnc || TRAINER_TIERS.includes(user?.tier ?? '');
  const canAddAdicional  = !isClosed && (sesion.puede_agregar_adicional ?? TRAINER_TIERS.includes(user?.tier ?? ''));
  const planAdicionales  = sesion.plan_nodes_adicionales ?? [];

  const unattend = async () => {
    setActioning(true);
    try {
      await api('DELETE', `/sesiones/${id}/attend`);
      toast('Asistencia retirada', { tone: 'info' });
      load();
    } catch (err) {
      toast(err.message, { tone: 'error' });
    } finally {
      setActioning(false);
    }
  };

  const removeAdicional = async (nodeId) => {
    try {
      await api('DELETE', `/sesiones/${id}/plan/adicional/${nodeId}`);
      setSesion(s => ({ ...s, plan_nodes_adicionales: (s.plan_nodes_adicionales ?? []).filter(n => n.id !== nodeId) }));
      toast('Nodo adicional eliminado', { tone: 'info' });
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  };

  const dateStr = new Date(sesion.fecha + 'T12:00:00').toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="nx-fade">
      {/* back + header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => { void playAtras(); onBack(); }}
          style={{ background: 'none', border: '1px solid var(--holo-line)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', color: 'var(--txt-dim)', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Icon name="arrow" size={12} style={{ transform: 'rotate(180deg)' }} /> Volver
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="nx-kicker" style={{ fontSize: 9 }}>{dateStr.toUpperCase()}</div>
          <div className="nx-display" style={{ fontSize: 18, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sesion.titulo}</div>
        </div>
        <Chip tone={isClosed ? 'dim' : 'green'}>{isClosed ? 'Cerrada' : 'Activa'}</Chip>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 320px', gap: 18, alignItems: 'start' }}>

        {/* ── Plan ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Panel kicker="PLAN DE ENTRENAMIENTO" title="Nodos del Plan" icon="target"
            right={isEnc && !isClosed && (
              <Btn kind="ghost" sm onClick={() => setEditPlan(e => !e)}>
                {editPlan ? 'Ver plan' : 'Editar plan'}
              </Btn>
            )}
          >
            {editPlan ? (
              <PlanEditor
                initialNodes={sesion.plan_nodes}
                sesionId={id}
                modulos={modulos}
                onSaved={nodes => { setSesion(s => ({ ...s, plan_nodes: nodes })); setEditPlan(false); }}
              />
            ) : sesion.plan_nodes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--txt-faint)', fontSize: 13 }}>
                {isEnc && !isClosed
                  ? <>Sin nodos. <button onClick={() => setEditPlan(true)} style={{ background: 'none', border: 'none', color: 'var(--holo)', cursor: 'pointer', textDecoration: 'underline' }}>Agregar plan →</button></>
                  : 'Esta sesión no tiene plan definido.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {sesion.plan_nodes.map((n, i) => (
                  <PlanNode key={n.id ?? i} node={n} index={i} total={sesion.plan_nodes.length}
                    isEdit={false} modulos={modulos}
                  />
                ))}
              </div>
            )}

            {/* Global closing note */}
            {sesion.global_note && (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--holo-line)' }}>
                <div className="nx-kicker" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="edit" size={11} /> BITÁCORA DE CIERRE
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                  {sesion.global_note.focus && (
                    <span style={{ fontSize: 11, color: FOCO_C[sesion.global_note.focus] ?? 'var(--txt-dim)', fontFamily: 'var(--font-data)' }}>
                      {sesion.global_note.focus}
                    </span>
                  )}
                  {sesion.global_note.effort && (
                    <span style={{ fontSize: 11, color: 'var(--txt-dim)', fontFamily: 'var(--font-data)' }}>
                      Esfuerzo {sesion.global_note.effort}/10
                    </span>
                  )}
                </div>
                {sesion.global_note.note && (
                  <div style={{ fontSize: 13, color: 'var(--txt-dim)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {sesion.global_note.note}
                  </div>
                )}
                {sesion.global_note.tags?.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {sesion.global_note.tags.map(t => <Chip key={t} tone="dim" style={{ fontSize: 9 }}>{t}</Chip>)}
                  </div>
                )}
              </div>
            )}
          </Panel>

          {/* ── Plan Adicional: aportes de caballeros/maestros, fuera del plan principal ── */}
          {(planAdicionales.length > 0 || canAddAdicional) && (
            <Panel kicker="APORTES DE LA COMUNIDAD" title="Adicional" icon="plus">
              {planAdicionales.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--txt-faint)', fontSize: 12, marginBottom: canAddAdicional ? 12 : 0 }}>
                  Sin nodos adicionales aún.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: canAddAdicional ? 14 : 0 }}>
                  {planAdicionales.map((n, i) => (
                    <AdicionalNodeRow key={n.id} node={n} index={i} total={planAdicionales.length}
                      canRemove={!isClosed && (n.created_by === myId || isEnc)}
                      onRemove={() => removeAdicional(n.id)}
                    />
                  ))}
                </div>
              )}
              {canAddAdicional && (
                <AdicionalForm sesionId={id} modulos={modulos}
                  onAdded={node => setSesion(s => ({ ...s, plan_nodes_adicionales: [...(s.plan_nodes_adicionales ?? []), node] }))}
                />
              )}
            </Panel>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Encargados */}
          <Panel kicker="ENCARGADOS" title="Responsables" icon="user">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sesion.encargados.map(e => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: 'rgba(56,205,240,0.12)', border: '1px solid var(--holo-line)',
                    display: 'grid', placeItems: 'center', color: 'var(--holo)', flexShrink: 0,
                    fontSize: 11, fontFamily: 'var(--font-data)', fontWeight: 600,
                  }}>
                    {(e.name ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt)' }}>{e.name}</div>
                    {e.character?.handle && (
                      <div style={{ fontSize: 10, color: 'var(--txt-faint)', fontFamily: 'var(--font-data)' }}>
                        @{e.character.handle}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {/* Asistencia */}
          <Panel kicker={`ASISTENCIA · ${sesion.attendance.length}`} title="Lista de Asistentes" icon="check">
            {/* Marcaje por QR (encargado / caballero / maestro) + estado propio */}
            {!isClosed && (
              <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--holo-line)', display: 'grid', gap: 10 }}>
                {canMark && (
                  <Btn kind="accent" sm icon="camera" onClick={() => setShowScan(true)} style={{ width: '100%', justifyContent: 'center' }}>
                    Escanear asistencia (QR)
                  </Btn>
                )}
                {iAttended ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Chip tone="green" icon="check">Tu asistencia está marcada</Chip>
                    <button onClick={unattend} disabled={actioning}
                      style={{ background: 'none', border: 'none', color: 'var(--txt-faint)', cursor: 'pointer', fontSize: 11 }}>
                      retirar
                    </button>
                  </div>
                ) : !canMark && (
                  <div style={{ fontSize: 12, color: 'var(--txt-faint)' }}>
                    Pide al encargado que escanee tu código QR (widget «Mi Código QR» en Comando) para registrar tu asistencia.
                  </div>
                )}
              </div>
            )}

            {/* Lista */}
            {sesion.attendance.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--txt-faint)', textAlign: 'center', padding: '12px 0' }}>Sin asistentes aún</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {sesion.attendance.map(a => (
                  <div key={a.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#10b981', flexShrink: 0 }}><Icon name="check" size={11} /></span>
                    <span style={{ fontSize: 12, flex: 1 }}>
                      {a.name ?? '—'}
                      {a.handle && <span style={{ fontSize: 10, color: 'var(--txt-faint)', fontFamily: 'var(--font-data)', marginLeft: 5 }}>@{a.handle}</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Cerrar sesión */}
          {isEnc && !isClosed && (
            <button onClick={() => setShowClose(true)}
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                background: 'rgba(255,107,0,0.06)', border: '1px solid rgba(255,107,0,0.25)',
                color: 'var(--holocron-naranja)', fontSize: 12, fontFamily: 'var(--font-data)',
                letterSpacing: '0.06em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,107,0,0.14)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,107,0,0.06)'}
            >
              <Icon name="check" size={13} /> CERRAR SESIÓN Y REGISTRAR BITÁCORA
            </button>
          )}
        </div>
      </div>

      {showClose && (
        <CloseModal
          sesion={sesion}
          onClose={() => setShowClose(false)}
          onClosed={updated => { setSesion(s => ({ ...s, ...updated, is_closed: true })); setShowClose(false); }}
        />
      )}

      {showScan && (
        <AttendanceScanModal
          sesionId={id}
          onClose={() => { setShowScan(false); load(); }}
        />
      )}
    </div>
  );
}

/* ─── MAIN VIEW ──────────────────────────────────────────────── */
export default function SesionesView({ user }) {
  const [sesiones, setSesiones]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activeSesion, setActiveSesion] = useState(null);
  const [showCreate, setShowCreate]   = useState(false);
  const [sedes, setSedes]             = useState([]);
  const [activeSede, setActiveSede]   = useState(user?.sede?.id ?? null);
  const canCreate = TRAINER_TIERS.includes(user?.tier ?? '');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api('GET', '/sesiones');
      setSesiones(res.data ?? []);
    } catch (err) {
      toast(err.message, { tone: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api('GET', '/public/sedes').then(r => setSedes(r.sedes ?? [])).catch(() => {});
  }, []);

  const sesionesFiltradas = activeSede == null
    ? sesiones
    : sesiones.filter(s => s.sede_id == null || s.sede_id === activeSede);

  if (activeSesion) {
    return (
      <SesionDetalle
        id={activeSesion}
        user={user}
        onBack={() => { setActiveSesion(null); load(); }}
      />
    );
  }

  return (
    <div className="nx-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div className="nx-kicker" style={{ marginBottom: 4 }}>ACADEMIA ORBITAL</div>
          <div className="nx-display" style={{ fontSize: 20 }}>Sesiones de Entrenamiento</div>
          <div style={{ fontSize: 12, color: 'var(--txt-dim)', marginTop: 2 }}>
            {canCreate ? 'Crea sesiones y diseña el plan de entrenamiento.' : 'Consulta las sesiones y marca tu asistencia.'}
          </div>
        </div>
        {canCreate && (
          <Btn kind="accent" icon="plus" onClick={() => setShowCreate(true)}>Nueva Sesión</Btn>
        )}
      </div>

      {sedes.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          <button onClick={() => setActiveSede(null)} className={`nx-chip ${activeSede === null ? '' : 'dim'}`}
            style={{ cursor: 'pointer', borderColor: activeSede === null ? 'var(--holo)' : undefined }}>Todas las sedes</button>
          {sedes.map(s => (
            <button key={s.id} onClick={() => setActiveSede(s.id)} className={`nx-chip ${activeSede === s.id ? '' : 'dim'}`}
              style={{ cursor: 'pointer', borderColor: activeSede === s.id ? 'var(--holo)' : undefined }}>{s.nombre}</button>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div className="nx-kicker" style={{ animation: 'nx-pulse 1.4s infinite' }}>CARGANDO SESIONES...</div>
        </div>
      ) : sesionesFiltradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--txt-faint)' }}>
          <div style={{ marginBottom: 10 }}><Icon name="calendar" size={36} /></div>
          <div className="nx-display" style={{ fontSize: 16, marginBottom: 6 }}>
            {sesiones.length === 0 ? 'Sin sesiones registradas' : 'Sin sesiones en esta sede'}
          </div>
          <div style={{ fontSize: 13, maxWidth: 320, margin: '0 auto 18px' }}>
            {canCreate ? 'Crea la primera sesión para comenzar.' : 'Los encargados registrarán sesiones próximamente.'}
          </div>
          {canCreate && <Btn kind="accent" icon="plus" onClick={() => setShowCreate(true)}>Crear primera sesión</Btn>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {sesionesFiltradas.map(s => (
            <SesionCard key={s.id} sesion={s} onClick={() => setActiveSesion(s.id)} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateModal
          user={user}
          onClose={() => setShowCreate(false)}
          onCreated={sesion => { setShowCreate(false); setActiveSesion(sesion.id); load(); }}
        />
      )}
    </div>
  );
}
