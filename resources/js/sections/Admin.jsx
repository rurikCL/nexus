import { useState, useEffect, useCallback, useRef } from 'react';
import { Icon, Panel, Btn, Chip, Modal, toast } from '../components/ui.jsx';

/* ─── AUTH ─────────────────────────────────────────────── */
const AUTH = () => {
  const t = localStorage.getItem('nx-token');
  return { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${t}` };
};
const api = async (method, path, body) => {
  const isFormData = body instanceof FormData;
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('nx-token')}`,
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    },
    body: isFormData ? body : (body != null ? JSON.stringify(body) : undefined),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message ?? `Error ${res.status}`);
  return json;
};

/* ─── GRUPOS para el sidebar ────────────────────────────── */
const GROUPS = ['MAPA GALÁCTICO', 'SISTEMA'];

/* ─── OPCIONES ESTÁTICAS ─────────────────────────────────── */
const RAREZA_OPTS     = ['comun', 'poco_comun', 'raro', 'epico', 'legendario'];
const HOSTILIDAD_OPTS = ['seguro', 'bajo', 'medio', 'alto', 'extremo'];
const TIER_OPTS       = ['iniciado', 'padawan', 'caballero', 'maestro', 'granmaestro'];
const SABER_OPTS      = ['azul', 'verde', 'ambar', 'purpura', 'cian', 'blanco', 'rojo'];
const CLASE_OPTS      = ['forma1', 'forma2', 'forma3', 'forma4', 'forma5', 'forma6', 'forma7'];
const LADO_OPTS       = ['luminoso', 'oscuro', 'neutral'];
const TIPO_NPC_OPTS   = ['aliado', 'neutral', 'hostil', 'mercader', 'mision', 'jefe'];
const TIPO_LUGAR_OPTS = ['exterior', 'interior'];

const H_COLOR = {
  seguro: '#10b981', bajo: '#38cdf0', medio: '#E6B325',
  alto: '#FF6B00', extremo: '#ff2d45',
};
const R_COLOR = {
  comun: '#8aa0c0', poco_comun: '#38cdf0', raro: '#10b981',
  epico: '#8b5cf6', legendario: '#E6B325',
};

/* ─── CONFIG DE ENTIDADES ───────────────────────────────── */
const ENTITY_CONFIG = {
  /* ── MAP ── */
  sistemas: {
    label: 'Sistemas Solares', icon: 'star', group: 'MAPA GALÁCTICO',
    columns: [
      { key: 'id', label: 'ID', w: 52 },
      { key: 'nombre', label: 'Nombre', bold: true },
      { key: 'rareza', label: 'Rareza', type: 'rareza' },
      { key: 'hostilidad', label: 'Hostilidad', type: 'hostilidad' },
      { key: 'faccion', label: 'Facción', dim: true },
      { key: 'visible', label: 'Vis', type: 'bool', w: 52 },
    ],
    fields: [
      { key: 'nombre',      label: 'Nombre',            type: 'text',   required: true, span: 2 },
      { key: 'rareza',      label: 'Rareza',            type: 'select', options: RAREZA_OPTS },
      { key: 'hostilidad',  label: 'Hostilidad',        type: 'select', options: HOSTILIDAD_OPTS },
      { key: 'faccion',     label: 'Facción',           type: 'text' },
      { key: 'color',       label: 'Color del sistema', type: 'color' },
      { key: 'costo_viaje', label: 'Costo viaje (cr)',  type: 'number', min: 0 },
      { key: 'visible',     label: 'Visible',           type: 'toggle' },
      { key: 'imagen',      label: 'Imagen',            type: 'file',   span: 2 },
      { key: 'historia',    label: 'Historia',          type: 'textarea', span: 2 },
    ],
    defaults: { visible: true, costo_viaje: 0 },
  },

  planetas: {
    label: 'Planetas', icon: 'target', group: 'MAPA GALÁCTICO',
    columns: [
      { key: 'id', label: 'ID', w: 52 },
      { key: 'nombre', label: 'Nombre', bold: true },
      { key: 'sistema', label: 'Sistema', resolve: r => r.sistema?.nombre ?? '—', dim: true },
      { key: 'rareza', label: 'Rareza', type: 'rareza' },
      { key: 'hostilidad', label: 'Hostilidad', type: 'hostilidad' },
      { key: 'visible', label: 'Vis', type: 'bool', w: 52 },
    ],
    fields: [
      { key: 'SistemaID', label: 'Sistema',     type: 'relatedSelect', related: 'sistemas', required: true },
      { key: 'nombre',    label: 'Nombre',      type: 'text', required: true },
      { key: 'rareza',    label: 'Rareza',      type: 'select', options: RAREZA_OPTS },
      { key: 'clima',     label: 'Clima',       type: 'text' },
      { key: 'hostilidad',label: 'Hostilidad',  type: 'select', options: HOSTILIDAD_OPTS },
      { key: 'faccion',   label: 'Facción',     type: 'text' },
      { key: 'visible',   label: 'Visible',     type: 'toggle' },
      { key: 'imagen',    label: 'Imagen',      type: 'file', span: 2 },
      { key: 'historia',  label: 'Historia',    type: 'textarea', span: 2 },
    ],
    defaults: { visible: true },
  },

  zonas: {
    label: 'Zonas', icon: 'shield', group: 'MAPA GALÁCTICO',
    columns: [
      { key: 'id', label: 'ID', w: 52 },
      { key: 'nombre', label: 'Nombre', bold: true },
      { key: 'planeta', label: 'Planeta', resolve: r => r.planeta?.nombre ?? '—', dim: true },
      { key: 'hostilidad', label: 'Hostilidad', type: 'hostilidad' },
      { key: 'faccion', label: 'Facción', dim: true },
      { key: 'estrato_social', label: 'Estrato', dim: true },
      { key: 'visible', label: 'Vis', type: 'bool', w: 52 },
    ],
    fields: [
      { key: 'PlanetaID',     label: 'Planeta',          type: 'relatedSelect', related: 'planetas', required: true },
      { key: 'nombre',        label: 'Nombre',           type: 'text', required: true },
      { key: 'rareza',        label: 'Rareza',           type: 'select', options: RAREZA_OPTS },
      { key: 'hostilidad',    label: 'Hostilidad',       type: 'select', options: HOSTILIDAD_OPTS },
      { key: 'faccion',       label: 'Facción',          type: 'text' },
      { key: 'estrato_social',label: 'Estrato social',   type: 'text' },
      { key: 'impuestos',     label: 'Impuestos (%)',    type: 'number', min: 0 },
      { key: 'visible',       label: 'Visible',          type: 'toggle' },
      { key: 'imagen',        label: 'Imagen',           type: 'file', span: 2 },
      { key: 'historia',      label: 'Historia',         type: 'textarea', span: 2 },
    ],
    defaults: { visible: true, impuestos: 0 },
  },

  lugares: {
    label: 'Lugares', icon: 'target', group: 'MAPA GALÁCTICO',
    columns: [
      { key: 'id', label: 'ID', w: 52 },
      { key: 'nombre', label: 'Nombre', bold: true },
      { key: 'zona', label: 'Zona', resolve: r => r.zona?.nombre ?? '—', dim: true },
      { key: 'tipo', label: 'Tipo', dim: true },
      { key: 'rareza', label: 'Rareza', type: 'rareza' },
      { key: 'visible', label: 'Vis', type: 'bool', w: 52 },
    ],
    fields: [
      { key: 'ZonaID',        label: 'Zona',             type: 'relatedSelect', related: 'zonas', required: true, span: 2 },
      { key: 'nombre',        label: 'Nombre',           type: 'text', required: true, span: 2 },
      { key: 'tipo',          label: 'Tipo',             type: 'select', options: TIPO_LUGAR_OPTS },
      { key: 'rareza',        label: 'Rareza',           type: 'select', options: RAREZA_OPTS },
      { key: 'pase',          label: 'Pase requerido',   type: 'relatedSelect', related: 'rol_objetos' },
      { key: 'visible',       label: 'Visible',          type: 'toggle' },
      { key: 'lugarNorteID',  label: 'Norte →',          type: 'relatedSelect', related: 'lugares' },
      { key: 'lugarSurID',    label: 'Sur →',            type: 'relatedSelect', related: 'lugares' },
      { key: 'lugarEsteID',   label: 'Este →',           type: 'relatedSelect', related: 'lugares' },
      { key: 'lugarOesteID',  label: 'Oeste →',          type: 'relatedSelect', related: 'lugares' },
      { key: 'imagen',        label: 'Imagen',           type: 'file', span: 2 },
      { key: 'historia',      label: 'Historia',         type: 'textarea', span: 2 },
    ],
    defaults: { visible: true, tipo: 'exterior' },
  },

  npcs: {
    label: 'NPCs', icon: 'user', group: 'MAPA GALÁCTICO',
    columns: [
      { key: 'id', label: 'ID', w: 52 },
      { key: 'nombre', label: 'Nombre', bold: true },
      { key: 'lugar', label: 'Lugar', resolve: r => r.lugar?.nombre ?? '—', dim: true },
      { key: 'tipo', label: 'Tipo', dim: true },
      { key: 'profesion', label: 'Profesión', dim: true },
      { key: 'visible', label: 'Vis', type: 'bool', w: 52 },
    ],
    fields: [
      { key: 'LugarID',       label: 'Lugar',            type: 'relatedSelect', related: 'lugares', required: true, span: 2 },
      { key: 'nombre',        label: 'Nombre',           type: 'text', required: true },
      { key: 'tipo',          label: 'Tipo',             type: 'select', options: TIPO_NPC_OPTS },
      { key: 'profesion',     label: 'Profesión',        type: 'text' },
      { key: 'faccion',       label: 'Facción',          type: 'text' },
      { key: 'visible',       label: 'Visible',          type: 'toggle' },
      { key: 'imagen_mini',   label: 'Miniatura',        type: 'file' },
      { key: 'imagen',        label: 'Imagen principal',  type: 'file' },
      { key: 'saludo',        label: 'Saludo inicial',   type: 'textarea', span: 2, hint: 'Texto que el NPC dice al primer contacto.' },
      { key: 'interaccion',   label: 'Interacción',      type: 'textarea', span: 2, hint: 'Formato: "- palabra_clave: respuesta" por línea.' },
      { key: 'prompt',        label: 'Prompt IA',        type: 'textarea', span: 2, hint: 'Personalidad del NPC para Mistral AI. Si se define, activa el modo conversación libre.' },
      { key: 'urlInteraccion',label: 'URL interacción',  type: 'text', span: 2 },
      { key: 'MisionID',      label: 'ID de misión',     type: 'number', min: 0 },
      { key: 'vida',          label: 'Vida',             type: 'number', min: 0 },
      { key: 'escudo',        label: 'Escudo',           type: 'number', min: 0 },
      { key: 'defensa',       label: 'Defensa',          type: 'number', min: 0 },
      { key: 'ataque',        label: 'Ataque',           type: 'number', min: 0 },
      { key: 'movimiento',    label: 'Movimiento',       type: 'number', min: 0 },
      { key: 'iniciativa',    label: 'Iniciativa',       type: 'number', min: 0 },
      { key: 'punteria',      label: 'Puntería',         type: 'number', min: 0 },
    ],
    defaults: { visible: true, vida: 0, escudo: 0, defensa: 0, ataque: 0, movimiento: 0, iniciativa: 0, punteria: 0 },
  },

  naves: {
    label: 'Naves', icon: 'zap', group: 'MAPA GALÁCTICO',
    columns: [
      { key: 'id', label: 'ID', w: 52 },
      { key: 'nombre', label: 'Nombre', bold: true },
      { key: 'tipo', label: 'Tipo', dim: true },
      { key: 'rareza', label: 'Rareza', type: 'rareza' },
      { key: 'velocidad', label: 'Vel', w: 52 },
      { key: 'costo', label: 'Costo', dim: true },
    ],
    fields: [
      { key: 'nombre',           label: 'Nombre',               type: 'text', required: true, span: 2 },
      { key: 'tipo',             label: 'Tipo',                 type: 'text' },
      { key: 'rareza',           label: 'Rareza',               type: 'select', options: RAREZA_OPTS },
      { key: 'descripcion',      label: 'Descripción',          type: 'textarea', span: 2 },
      { key: 'capacidad_carga',  label: 'Capacidad de carga',   type: 'number', min: 0 },
      { key: 'vida',             label: 'Vida',                 type: 'number', min: 0 },
      { key: 'escudo',           label: 'Escudo',               type: 'number', min: 0 },
      { key: 'velocidad',        label: 'Velocidad',            type: 'number', min: 0 },
      { key: 'ataque',           label: 'Ataque',               type: 'number', min: 0 },
      { key: 'maniobrabilidad',  label: 'Maniobrabilidad',      type: 'number', min: 0 },
      { key: 'capacidad_salto',  label: 'Capacidad de salto',   type: 'number', min: 0 },
      { key: 'costo',            label: 'Costo (cr)',           type: 'number', min: 0 },
      { key: 'costo_reparacion', label: 'Costo reparación (cr)',type: 'number', min: 0 },
      { key: 'imagen',           label: 'Imagen de la nave',    type: 'file', span: 2 },
    ],
    defaults: {},
  },

  /* ── SISTEMA ── */
  usuarios: {
    label: 'Usuarios', icon: 'roster', group: 'SISTEMA',
    columns: [
      { key: 'id', label: 'ID', w: 52 },
      { key: 'name', label: 'Nombre', bold: true },
      { key: 'email', label: 'Email', dim: true },
      { key: 'tier', label: 'Tier', type: 'tier' },
      { key: 'tutor', label: 'Tutor', resolve: r => r.tutor?.name ?? '—', dim: true },
      { key: 'roles', label: 'Roles', resolve: r => r.roles?.map(ro => ro.label).join(', ') || '—', dim: true },
      { key: 'created_at', label: 'Registro', resolve: r => r.created_at?.slice(0, 10), dim: true },
    ],
    noDelete: true,
    fields: [
      { key: 'name',     label: 'Nombre', type: 'text',          required: true },
      { key: 'email',    label: 'Email',  type: 'text',          required: true },
      { key: 'tier',     label: 'Tier',   type: 'select',        options: TIER_OPTS },
      { key: 'tutor_id', label: 'Tutor',  type: 'relatedSelect', related: 'usuarios' },
      { key: 'roles',    label: 'Roles',  type: 'multiCheckbox', related: 'roles',    span: 2 },
    ],
    defaults: { tier: 'iniciado', roles: [] },
  },

  roles: {
    label: 'Roles', icon: 'shield', group: 'SISTEMA',
    columns: [
      { key: 'id',          label: 'ID',          w: 52 },
      { key: 'name',        label: 'Slug',         bold: true },
      { key: 'label',       label: 'Nombre',       dim: false },
      { key: 'description', label: 'Descripción',  dim: true },
    ],
    fields: [
      { key: 'name',        label: 'Slug (único)',  type: 'text',     required: true, hint: 'Sin espacios, ej: rpg_master' },
      { key: 'label',       label: 'Nombre visible', type: 'text',   required: true },
      { key: 'description', label: 'Descripción',   type: 'textarea', span: 2 },
    ],
    defaults: {},
  },

  personajes: {
    label: 'Personajes', icon: 'ghost', group: 'SISTEMA',
    columns: [
      { key: 'id', label: 'ID', w: 52 },
      { key: 'handle', label: 'Handle', bold: true },
      { key: 'name', label: 'Nombre' },
      { key: 'cls', label: 'Clase', dim: true },
      { key: 'saber_color', label: 'Sable', dim: true },
      { key: 'side', label: 'Lado', dim: true },
      { key: 'credits', label: 'Créditos', w: 80 },
    ],
    fields: [
      { key: 'name',       label: 'Nombre',      type: 'text' },
      { key: 'handle',     label: 'Handle',      type: 'text' },
      { key: 'cls',        label: 'Clase',       type: 'select', options: CLASE_OPTS },
      { key: 'saber_color',label: 'Sable',       type: 'select', options: SABER_OPTS },
      { key: 'side',       label: 'Lado',        type: 'select', options: LADO_OPTS },
      { key: 'credits',    label: 'Créditos',    type: 'number', min: 0 },
      { key: 'wins',       label: 'Victorias',   type: 'number', min: 0 },
      { key: 'losses',     label: 'Derrotas',    type: 'number', min: 0 },
      { key: 'bio',        label: 'Bio',         type: 'textarea', span: 2 },
    ],
    defaults: {},
  },

  rol_objetos: {
    label: 'Objetos de Rol', icon: 'box', group: 'SISTEMA',
    columns: [
      { key: 'id', label: 'ID', w: 52 },
      { key: 'nombre', label: 'Nombre', bold: true },
      { key: 'tipo', label: 'Tipo', dim: true },
      { key: 'rareza', label: 'Rareza', type: 'rareza' },
      { key: 'activo', label: 'Activo', type: 'bool', w: 68 },
    ],
    fields: [
      { key: 'nombre',      label: 'Nombre',      type: 'text', required: true, span: 2 },
      { key: 'tipo',        label: 'Tipo',        type: 'text' },
      { key: 'rareza',      label: 'Rareza',      type: 'select', options: RAREZA_OPTS },
      { key: 'activo',      label: 'Activo',      type: 'toggle' },
      { key: 'imagen',      label: 'Imagen',      type: 'file', span: 2 },
      { key: 'descripcion', label: 'Descripción', type: 'textarea', span: 2 },
      { key: 'efecto',      label: 'Efecto',      type: 'textarea', span: 2 },
    ],
    defaults: { activo: true },
  },

  rol_character_objeto: {
    label: 'Asignación Objetos', icon: 'link', group: 'SISTEMA',
    columns: [
      { key: 'id', label: 'ID', w: 52 },
      { key: 'character', label: 'Personaje', resolve: r => r.character?.handle || r.character?.name || '—', bold: true },
      { key: 'rol_objeto', label: 'Objeto', resolve: r => r.rol_objeto?.nombre ?? '—' },
      { key: 'created_at', label: 'Asignado', resolve: r => r.created_at?.slice(0, 10), dim: true },
    ],
    fields: [
      { key: 'character_id',  label: 'Personaje', type: 'relatedSelect', related: 'personajes', required: true },
      { key: 'rol_objeto_id', label: 'Objeto',    type: 'relatedSelect', related: 'rol_objetos', required: true },
    ],
    defaults: {},
  },
};

/* ─── FIELD INPUT ────────────────────────────────────────── */
function FieldInput({ field, value, onChange, relatedOptions }) {
  const base = { className: field.type === 'textarea' ? 'nx-textarea' : 'nx-input' };

  if (field.type === 'textarea') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <textarea {...base} rows={field.rows ?? 3}
          value={value ?? ''} onChange={e => onChange(e.target.value)}
          placeholder={field.hint ?? ''}
          style={{ minHeight: 72, resize: 'vertical' }}
        />
        {field.hint && (
          <span style={{ fontSize: 10, color: 'var(--txt-faint)', fontFamily: 'var(--font-data)' }}>{field.hint}</span>
        )}
      </div>
    );
  }

  if (field.type === 'number') {
    return (
      <input type="number" {...base} min={field.min ?? 0}
        value={value ?? 0} onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
      />
    );
  }

  if (field.type === 'select') {
    return (
      <select className="nx-select" value={value ?? ''} onChange={e => onChange(e.target.value || null)}>
        <option value="">— Sin seleccionar —</option>
        {(field.options ?? []).map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    );
  }

  if (field.type === 'relatedSelect') {
    const opts = relatedOptions?.[field.related] ?? [];
    return (
      <select className="nx-select" value={value ?? ''} onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}>
        <option value="">— Sin seleccionar —</option>
        {opts.map(o => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    );
  }

  if (field.type === 'toggle') {
    const on = value === true || value === 1 || value === '1';
    return (
      <button type="button" onClick={() => onChange(!on)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px',
          background: on ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${on ? '#10b981' : 'var(--holo-line)'}`,
          borderRadius: 'var(--radius-md)', cursor: 'pointer', color: on ? '#10b981' : 'var(--txt-dim)',
          fontFamily: 'var(--font-data)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
          transition: 'all 0.15s',
        }}
      >
        <div style={{
          width: 28, height: 16, borderRadius: 8,
          background: on ? '#10b981' : 'rgba(255,255,255,0.12)',
          position: 'relative', transition: 'background 0.2s',
        }}>
          <div style={{
            position: 'absolute', top: 2, left: on ? 14 : 2,
            width: 12, height: 12, borderRadius: '50%', background: '#fff',
            transition: 'left 0.2s',
          }} />
        </div>
        {on ? 'Visible' : 'Oculto'}
      </button>
    );
  }

  if (field.type === 'color') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input type="color" value={value || '#38cdf0'}
          onChange={e => onChange(e.target.value)}
          style={{ width: 36, height: 36, border: '1px solid var(--holo-line)', borderRadius: 6, background: 'none', cursor: 'pointer', padding: 2 }}
        />
        <input className="nx-input" type="text" style={{ flex: 1 }}
          value={value || ''} onChange={e => onChange(e.target.value)}
          placeholder="#38cdf0"
        />
      </div>
    );
  }

  if (field.type === 'file') {
    const isFile = value instanceof File;
    const previewUrl = isFile ? URL.createObjectURL(value) : (value ? (value.startsWith('http') ? value : `/storage/${value}`) : null);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <input type="file" accept="image/*" onChange={e => onChange(e.target.files[0])}
          style={{
            fontSize: 11, color: 'var(--txt-dim)', fontFamily: 'var(--font-data)',
            padding: '6px 10px', border: '1px solid var(--holo-line)', borderRadius: 'var(--radius-sm)',
            width: '100%',
          }}
        />
        {previewUrl && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src={previewUrl}
              style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--holo-line)' }}
            />
            <span style={{ fontSize: 10, color: 'var(--txt-faint)' }}>{isFile ? 'Nuevo archivo' : 'Archivo actual'}</span>
          </div>
        )}
      </div>
    );
  }

  if (field.type === 'multiCheckbox') {
    const opts = relatedOptions?.[field.related] ?? [];
    const vals = Array.isArray(value) ? value : [];
    const toggle = (id) => {
      const next = vals.includes(id) ? vals.filter(v => v !== id) : [...vals, id];
      onChange(next);
    };
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {opts.length === 0 && (
          <span style={{ fontSize: 11, color: 'var(--txt-faint)', fontFamily: 'var(--font-data)' }}>Cargando opciones...</span>
        )}
        {opts.map(o => {
          const on = vals.includes(o.id);
          return (
            <button key={o.id} type="button" onClick={() => toggle(o.id)}
              style={{
                padding: '5px 13px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                fontFamily: 'var(--font-data)', fontSize: 11, letterSpacing: '0.06em',
                transition: 'all 0.15s',
                background: on ? 'color-mix(in srgb, var(--holo) 18%, transparent)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${on ? 'var(--holo)' : 'var(--holo-line)'}`,
                color: on ? 'var(--holo)' : 'var(--txt-dim)',
              }}
            >
              {on && <span style={{ marginRight: 5 }}>✓</span>}{o.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <input type="text" {...base}
      value={value ?? ''} onChange={e => onChange(e.target.value)}
    />
  );
}

/* ─── CRUD MODAL ─────────────────────────────────────────── */
function CrudModal({ entityKey, config, record, relatedOptions, onSave, onClose }) {
  const isEdit = !!record?.id;
  const [form, setForm]       = useState(() => {
    const base = { ...(config.defaults ?? {}), ...(record ?? {}) };
    // Normalizar campos multiCheckbox: convertir array de objetos a array de IDs
    config.fields.forEach(f => {
      if (f.type === 'multiCheckbox' && Array.isArray(base[f.key])) {
        base[f.key] = base[f.key].map(v => (typeof v === 'object' ? v.id : v));
      }
    });
    return base;
  });
  const [saving, setSaving]   = useState(false);

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const path   = isEdit ? `/admin/${entityKey}/${record.id}` : `/admin/${entityKey}`;
      
      let payload;
      const hasFiles = config.fields.some(f => f.type === 'file' && form[f.key] instanceof File);
      
      if (hasFiles) {
        payload = new FormData();
        Object.entries(form).forEach(([key, val]) => {
          if (val !== null && val !== undefined) {
            if (typeof val === 'boolean') {
              payload.append(key, val ? '1' : '0');
            } else {
              payload.append(key, val);
            }
          }
        });
        if (isEdit) payload.append('_method', 'PATCH');
      } else {
        payload = form;
      }

      const method = (isEdit && hasFiles) ? 'POST' : (isEdit ? 'PATCH' : 'POST');
      await api(method, path, payload);
      toast(isEdit ? 'Registro actualizado' : 'Registro creado', { tone: 'success', icon: 'check' });
      onSave();
    } catch (err) {
      toast(err.message, { tone: 'error', icon: 'x' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      kicker={isEdit ? `EDITAR · ${config.label.toUpperCase()}` : `NUEVO · ${config.label.toUpperCase()}`}
      title={isEdit ? `Editando #${record.id}` : `Crear ${config.label}`}
      width={620}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px', paddingTop: 4 }}>
        {config.fields.map(field => (
          <div key={field.key}
            style={{ gridColumn: field.span === 2 ? '1 / -1' : 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}
          >
            <label className="nx-label">
              {field.label}
              {field.required && <span style={{ color: 'var(--pompeyo-naranja)', marginLeft: 2 }}>*</span>}
            </label>
            <FieldInput
              field={field}
              value={form[field.key]}
              onChange={val => setField(field.key, val)}
              relatedOptions={relatedOptions}
            />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--holo-line)' }}>
        <Btn kind="ghost" onClick={onClose} disabled={saving}>Cancelar</Btn>
        <Btn kind="accent" icon="check" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear registro'}
        </Btn>
      </div>
    </Modal>
  );
}

/* ─── CELL RENDERER ─────────────────────────────────────── */
function CellValue({ col, record }) {
  const raw = col.resolve ? col.resolve(record) : record[col.key];

  if (col.type === 'bool') {
    return raw ? (
      <span style={{ color: '#10b981', fontSize: 11, fontFamily: 'var(--font-data)' }}>✓</span>
    ) : (
      <span style={{ color: 'var(--txt-faint)', fontSize: 11 }}>—</span>
    );
  }
  if (col.type === 'hostilidad') {
    const c = H_COLOR[raw?.toLowerCase()] ?? 'var(--txt-faint)';
    return raw ? (
      <span style={{
        fontSize: 10, color: c, border: `1px solid ${c}55`,
        borderRadius: 4, padding: '2px 7px', fontFamily: 'var(--font-data)',
        letterSpacing: '0.08em', background: `${c}18`, textTransform: 'uppercase',
      }}>{raw}</span>
    ) : <span style={{ color: 'var(--txt-faint)' }}>—</span>;
  }
  if (col.type === 'rareza') {
    const c = R_COLOR[raw?.toLowerCase()?.replace(' ', '_')] ?? 'var(--txt-faint)';
    return raw ? (
      <span style={{ fontSize: 10, color: c, fontFamily: 'var(--font-data)', fontWeight: 700 }}>{raw}</span>
    ) : <span style={{ color: 'var(--txt-faint)' }}>—</span>;
  }
  if (col.type === 'tier') {
    const TIER_C = { iniciado: '#8aa0c0', padawan: '#38cdf0', caballero: '#10b981', maestro: '#FF6B00', granmaestro: '#E6B325' };
    const c = TIER_C[raw] ?? 'var(--txt-faint)';
    return raw ? (
      <span style={{ fontSize: 10, color: c, fontFamily: 'var(--font-data)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{raw}</span>
    ) : <span style={{ color: 'var(--txt-faint)' }}>—</span>;
  }

  if (raw == null || raw === '') return <span style={{ color: 'var(--txt-faint)' }}>—</span>;

  return (
    <span style={{
      fontSize: 12,
      color: col.bold ? 'var(--txt)' : col.dim ? 'var(--txt-dim)' : 'var(--txt)',
      fontWeight: col.bold ? 600 : 400,
      fontFamily: col.mono ? 'var(--font-data)' : 'var(--font-body)',
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180,
    }}>
      {String(raw)}
    </span>
  );
}

/* ─── ENTITY TABLE ───────────────────────────────────────── */
function EntityTable({ entityKey, config, relatedOptions, onRefreshRelated }) {
  const [data, setData]         = useState(null);
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading]   = useState(false);
  const [editRecord, setEditRecord]   = useState(null);  // null=closed, {}=new, {id,...}=edit
  const [deleteId, setDeleteId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, per_page: 25 });
      if (search) params.set('q', search);
      const res = await api('GET', `/admin/${entityKey}?${params}`);
      setData(res);
    } catch (err) {
      toast(err.message, { tone: 'error', icon: 'x' });
    } finally {
      setLoading(false);
    }
  }, [entityKey, page, search]);

  useEffect(() => { setPage(1); setSearch(''); setSearchInput(''); }, [entityKey]);
  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    try {
      await api('DELETE', `/admin/${entityKey}/${id}`);
      toast('Registro eliminado', { tone: 'success', icon: 'check' });
      setDeleteId(null);
      onRefreshRelated?.(entityKey);
      load();
    } catch (err) {
      toast(err.message, { tone: 'error', icon: 'x' });
    }
  };

  const handleSaved = () => {
    setEditRecord(null);
    onRefreshRelated?.(entityKey);
    load();
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const records    = data?.data ?? [];
  const total      = data?.total ?? 0;
  const lastPage   = data?.last_page ?? 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>

      {/* toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
        borderBottom: '1px solid var(--holo-line)', flexShrink: 0,
      }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 6, flex: 1 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
            <input className="nx-input" style={{ paddingLeft: 32, fontSize: 12 }}
              placeholder={`Buscar ${config.label.toLowerCase()}...`}
              value={searchInput} onChange={e => setSearchInput(e.target.value)}
            />
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--txt-faint)', pointerEvents: 'none' }}>
              <Icon name="target" size={13} />
            </span>
          </div>
          <Btn kind="ghost" sm onClick={() => { setSearch(searchInput); setPage(1); }}>
            Buscar
          </Btn>
          {search && (
            <Btn kind="ghost" sm onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}>
              <Icon name="x" size={11} />
            </Btn>
          )}
        </form>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <Btn kind="ghost" sm onClick={load} disabled={loading}>
            <Icon name="zap" size={11} />
          </Btn>
          <Btn kind="accent" sm icon="plus" onClick={() => setEditRecord({})}>
            Nuevo
          </Btn>
        </div>
      </div>

      {/* tabla */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading && !data ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
            <div className="nx-kicker" style={{ animation: 'nx-pulse 1.4s infinite' }}>CARGANDO...</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--holo-line)', background: 'rgba(4,7,15,0.4)' }}>
                {config.columns.map(col => (
                  <th key={col.key} style={{
                    padding: '9px 12px', textAlign: 'left',
                    fontFamily: 'var(--font-data)', fontSize: 10, letterSpacing: '0.1em',
                    textTransform: 'uppercase', color: 'var(--holo)', fontWeight: 600,
                    whiteSpace: 'nowrap', width: col.w ?? 'auto',
                  }}>
                    {col.label}
                  </th>
                ))}
                <th style={{
                  padding: '9px 12px', textAlign: 'right', width: 100,
                  fontFamily: 'var(--font-data)', fontSize: 10, letterSpacing: '0.1em',
                  textTransform: 'uppercase', color: 'var(--holo)', fontWeight: 600,
                }}>
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 && (
                <tr>
                  <td colSpan={config.columns.length + 1}
                    style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--txt-faint)', fontSize: 13 }}>
                    {search ? `Sin resultados para "${search}"` : 'Sin registros'}
                  </td>
                </tr>
              )}
              {records.map((r, i) => (
                <tr key={r.id}
                  style={{
                    borderBottom: '1px solid rgba(56,205,240,0.06)',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(56,205,240,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'}
                >
                  {config.columns.map(col => (
                    <td key={col.key} style={{ padding: '9px 12px', maxWidth: col.w ?? 200 }}>
                      <CellValue col={col} record={r} />
                    </td>
                  ))}
                  <td style={{ padding: '6px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {deleteId === r.id ? (
                      <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: 'var(--txt-dim)', fontFamily: 'var(--font-data)', marginRight: 4 }}>¿Eliminar?</span>
                        <button
                          onClick={() => handleDelete(r.id)}
                          style={{
                            background: 'rgba(220,38,38,0.2)', border: '1px solid rgba(220,38,38,0.5)',
                            borderRadius: 4, padding: '3px 9px', cursor: 'pointer',
                            color: '#ff6b6b', fontSize: 10, fontFamily: 'var(--font-data)', letterSpacing: '0.06em',
                          }}
                        >Sí</button>
                        <button
                          onClick={() => setDeleteId(null)}
                          style={{
                            background: 'transparent', border: '1px solid var(--holo-line)',
                            borderRadius: 4, padding: '3px 9px', cursor: 'pointer',
                            color: 'var(--txt-dim)', fontSize: 10, fontFamily: 'var(--font-data)',
                          }}
                        >No</button>
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', gap: 4 }}>
                        <button
                          onClick={() => setEditRecord(r)}
                          title="Editar"
                          style={{
                            background: 'rgba(56,205,240,0.08)', border: '1px solid var(--holo-line)',
                            borderRadius: 4, padding: '4px 8px', cursor: 'pointer', color: 'var(--holo)',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(56,205,240,0.18)'; e.currentTarget.style.borderColor = 'var(--holo)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(56,205,240,0.08)'; e.currentTarget.style.borderColor = 'var(--holo-line)'; }}
                        >
                          <Icon name="edit" size={12} />
                        </button>
                        {!config.noDelete && (
                          <button
                            onClick={() => setDeleteId(r.id)}
                            title="Eliminar"
                            style={{
                              background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)',
                              borderRadius: 4, padding: '4px 8px', cursor: 'pointer', color: '#ff6b6b',
                              transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.18)'; e.currentTarget.style.borderColor = 'rgba(220,38,38,0.5)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.06)'; e.currentTarget.style.borderColor = 'rgba(220,38,38,0.2)'; }}
                          >
                            <Icon name="x" size={12} />
                          </button>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* paginación */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
        borderTop: '1px solid var(--holo-line)', flexShrink: 0,
        background: 'rgba(4,7,15,0.3)',
      }}>
        <span style={{ fontSize: 11, color: 'var(--txt-dim)', fontFamily: 'var(--font-data)', flex: 1 }}>
          {total} registro{total !== 1 ? 's' : ''}{search ? ` · filtrado: "${search}"` : ''}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{
              background: 'transparent', border: '1px solid var(--holo-line)',
              borderRadius: 4, padding: '4px 10px', cursor: page <= 1 ? 'not-allowed' : 'pointer',
              color: page <= 1 ? 'var(--txt-faint)' : 'var(--holo)', opacity: page <= 1 ? 0.4 : 1,
            }}
          >
            <Icon name="arrow" size={12} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <span className="nx-data" style={{ fontSize: 11, color: 'var(--txt-dim)', minWidth: 70, textAlign: 'center' }}>
            {page} / {lastPage}
          </span>
          <button
            onClick={() => setPage(p => Math.min(lastPage, p + 1))}
            disabled={page >= lastPage}
            style={{
              background: 'transparent', border: '1px solid var(--holo-line)',
              borderRadius: 4, padding: '4px 10px', cursor: page >= lastPage ? 'not-allowed' : 'pointer',
              color: page >= lastPage ? 'var(--txt-faint)' : 'var(--holo)', opacity: page >= lastPage ? 0.4 : 1,
            }}
          >
            <Icon name="arrow" size={12} />
          </button>
        </div>
      </div>

      {/* modal crear/editar */}
      {editRecord !== null && (
        <CrudModal
          entityKey={entityKey}
          config={config}
          record={editRecord?.id ? editRecord : null}
          relatedOptions={relatedOptions}
          onSave={handleSaved}
          onClose={() => setEditRecord(null)}
        />
      )}
    </div>
  );
}

/* ─── ADMIN VIEW ─────────────────────────────────────────── */
export default function AdminView() {
  const [activeEntity, setActiveEntity] = useState('sistemas');
  const [relatedOptions, setRelatedOptions] = useState({});

  const config = ENTITY_CONFIG[activeEntity];

  /* precarga las opciones de entidades relacionadas cuando cambia la entidad activa */
  useEffect(() => {
    const needed = new Set(
      (config?.fields ?? [])
        .filter(f => f.type === 'relatedSelect' || f.type === 'multiCheckbox')
        .map(f => f.related)
    );
    needed.forEach(async (entity) => {
      if (relatedOptions[entity]) return;
      try {
        const res = await api('GET', `/admin/${entity}/options`);
        setRelatedOptions(prev => ({ ...prev, [entity]: res.options ?? [] }));
      } catch {}
    });
  }, [activeEntity]);

  const refreshRelated = (entity) => {
    setRelatedOptions(prev => {
      const next = { ...prev };
      delete next[entity];
      return next;
    });
  };

  return (
    <div className="nx-fade" style={{
      display: 'grid', gridTemplateColumns: '200px 1fr',
      height: 'calc(100vh - 100px)', minHeight: 500,
      border: '1px solid var(--holo-line)', borderRadius: 'var(--radius-lg)',
      overflow: 'hidden', background: 'rgba(4,7,15,0.5)',
    }}>

      {/* ── sidebar interno ── */}
      <aside style={{
        borderRight: '1px solid var(--holo-line)',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
        background: 'rgba(4,7,15,0.4)',
      }}>
        <div style={{ padding: '14px 12px 10px', borderBottom: '1px solid var(--holo-line)' }}>
          <div className="nx-kicker" style={{ marginBottom: 2 }}>PANEL</div>
          <div className="nx-display" style={{ fontSize: 13, color: 'var(--txt)' }}>Configuración</div>
        </div>

        <nav style={{ flex: 1, padding: 6 }}>
          {GROUPS.map(group => (
            <div key={group}>
              <div className="nx-kicker" style={{ padding: '10px 8px 4px', fontSize: 9, letterSpacing: '0.16em' }}>
                {group}
              </div>
              {Object.entries(ENTITY_CONFIG)
                .filter(([, c]) => c.group === group)
                .map(([key, c]) => {
                  const active = activeEntity === key;
                  return (
                    <button key={key} onClick={() => setActiveEntity(key)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 10px', borderRadius: 'var(--radius-sm)', border: 'none',
                        background: active ? 'color-mix(in srgb, var(--holo) 12%, transparent)' : 'transparent',
                        color: active ? 'var(--txt)' : 'var(--txt-dim)',
                        cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-data)',
                        fontSize: 11, letterSpacing: '0.04em', transition: 'all 0.15s',
                        borderLeft: active ? '2px solid var(--holo)' : '2px solid transparent',
                      }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--txt)'; }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--txt-dim)'; }}
                    >
                      <span style={{ color: active ? 'var(--holo)' : 'inherit', flexShrink: 0 }}>
                        <Icon name={c.icon} size={13} />
                      </span>
                      {c.label}
                    </button>
                  );
                })}
            </div>
          ))}
        </nav>
      </aside>

      {/* ── contenido ── */}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        {/* header */}
        <div style={{
          padding: '11px 16px', borderBottom: '1px solid var(--holo-line)',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
          background: 'rgba(4,7,15,0.3)',
        }}>
          <span style={{ color: 'var(--holo)' }}><Icon name={config.icon} size={16} /></span>
          <div style={{ flex: 1 }}>
            <div className="nx-kicker" style={{ fontSize: 8 }}>{config.group}</div>
            <div className="nx-display" style={{ fontSize: 14, color: 'var(--txt)' }}>{config.label}</div>
          </div>
          {config.noDelete && (
            <Chip tone="dim">Solo lectura parcial</Chip>
          )}
        </div>

        {/* tabla */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <EntityTable
            key={activeEntity}
            entityKey={activeEntity}
            config={config}
            relatedOptions={relatedOptions}
            onRefreshRelated={refreshRelated}
          />
        </div>
      </div>
    </div>
  );
}
