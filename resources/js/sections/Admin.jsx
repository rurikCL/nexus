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
const GROUPS = ['MAPA GALÁCTICO', 'ROL', 'COMPETITIVO', 'SISTEMA'];

/* ─── OPCIONES ESTÁTICAS ─────────────────────────────────── */
const RAREZA_OPTS     = ['comun', 'poco_comun', 'raro', 'epico', 'legendario'];
const HABILIDAD_TIPO_OPTS  = ['melee', 'distancia'];
const HABILIDAD_OBJETIVO_OPTS = ['target', 'self'];
const BUFF_STATS  = ['ataque', 'defensa', 'punteria', 'movimiento', 'iniciativa'];
const BUFF_LABEL  = { ataque: 'ATQ', defensa: 'DEF', punteria: 'PNT', movimiento: 'MOV', iniciativa: 'INI' };
const BUFF_COLOR  = { ataque: '#ff7043', defensa: '#38cdf0', punteria: '#10b981', movimiento: '#a78bfa', iniciativa: '#E6B325' };
const HOSTILIDAD_OPTS = ['seguro', 'bajo', 'medio', 'alto', 'extremo'];
const TIER_OPTS       = ['iniciado', 'padawan', 'caballero', 'maestro', 'granmaestro'];
const SABER_OPTS      = ['azul', 'verde', 'ambar', 'purpura', 'cian', 'blanco', 'rojo'];
const CLASE_OPTS      = ['forma1', 'forma2', 'forma3', 'forma4', 'forma5', 'forma6', 'forma7'];
const LADO_OPTS       = ['luminoso', 'oscuro', 'neutral'];
const TIPO_OBJETO_OPTS = [
  { value: 'arma',               label: 'Arma' },
  { value: 'nucleo_energia',     label: 'Núcleo de Energía' },
  { value: 'cristal',            label: 'Cristal' },
  { value: 'lente_enfoque',      label: 'Lente de Enfoque' },
  { value: 'emisor',             label: 'Emisor' },
  { value: 'estabilizador',      label: 'Estabilizador' },
  { value: 'empunadura',         label: 'Empuñadura' },
  { value: 'modulo_activacion',  label: 'Módulo de Activación' },
  { value: 'accesorio',          label: 'Accesorio' },
];
const TIPO_NPC_OPTS   = ['aliado', 'neutral', 'hostil', 'entrenador', 'mercader', { value: 'mision', label: 'misión' }, 'jefe'];
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
      { key: 'historia',            label: 'Historia',           type: 'textarea', span: 2 },
      { key: 'eventos_importantes', label: 'Eventos importantes', type: 'textarea', span: 2, hint: 'Un evento por línea. Los NPCs pueden agregar entradas automáticamente vía IA.' },
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
      { key: 'tipo',          label: 'Tipo',             type: 'select', options: TIPO_NPC_OPTS, hint: 'hostil: atacable, +25 rep al vencerlo · entrenador: atacable, sin efecto en reputación · el resto: atacarlo penaliza reputación' },
      { key: 'profesion',     label: 'Profesión',        type: 'text' },
      { key: 'faccion',       label: 'Facción',          type: 'text' },
      { key: 'visible',       label: 'Visible',          type: 'toggle' },
      { key: 'imagen_mini',   label: 'Miniatura',        type: 'file' },
      { key: 'imagen',        label: 'Imagen principal',  type: 'file' },
      { key: 'hito_requerimiento', label: 'Hito(s) requerido(s)', type: 'text', span: 2, hint: 'Nombres de hito separados por coma. El NPC solo aparece si el personaje posee todos.' },
      { key: 'fecha_inicio',  label: 'Disponible desde', type: 'date', hint: 'Opcional. El NPC solo aparece a partir de esta fecha.' },
      { key: 'fecha_fin',     label: 'Disponible hasta', type: 'date', hint: 'Opcional. El NPC deja de aparecer después de esta fecha.' },
      { key: 'saludo',        label: 'Saludo inicial',   type: 'textarea', span: 2, hint: 'Texto que el NPC dice al primer contacto. Usa [Nombre de Objeto] y @[Nombre de NPC] para referenciarlos.' },
      { key: 'interaccion',   label: 'Interacción',      type: 'textarea', span: 2, hint: 'Formato: "- palabra_clave: respuesta" por línea. Usa [Nombre de Objeto] y @[Nombre de NPC] para referenciarlos.' },
      { key: 'prompt',        label: 'Prompt IA',        type: 'textarea', span: 2, hint: 'Instrucciones de comportamiento para la IA. Si se rellena, el NPC usará IA en lugar del diálogo estático. Usa [Nombre de Objeto] y @[Nombre de NPC] para referenciarlos.' },
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

  /* ── ROL ── */
  rol_habilidades: {
    label: 'Habilidades de Rol', icon: 'zap', group: 'ROL',
    filters: [
      { key: 'tipo',  label: 'Tipo',  options: [{ value: 'melee', label: 'Melee' }, { value: 'distancia', label: 'Distancia' }] },
      { key: 'forma', label: 'Forma', options: [0,1,2,3,4,5,6,7].map(n => ({ value: String(n), label: n === 0 ? 'Universal (0)' : `Forma ${n}` })) },
    ],
    columns: [
      { key: 'id',           label: 'ID',      w: 52 },
      { key: 'icono',        label: 'Icono',   type: 'image', w: 52 },
      { key: 'nombre',       label: 'Nombre',  bold: true },
      { key: 'tipo',         label: 'Tipo',    dim: true, w: 80 },
      { key: 'forma',        label: 'Forma',   dim: true, w: 56 },
      { key: 'objetivo',     label: 'Obj',     dim: true, w: 60 },
      { key: 'damage',       label: 'Daño',    dim: true, w: 56 },
      { key: 'cooldown',     label: 'CD',      dim: true, w: 48 },
    ],
    fields: [
      { key: 'nombre',       label: 'Nombre',                type: 'text',      required: true },
      { key: 'icono',        label: 'Icono',                 type: 'file' },
      { key: 'tipo',         label: 'Tipo',                  type: 'select',    options: HABILIDAD_TIPO_OPTS, required: true, hint: 'melee = cuerpo a cuerpo · distancia = ataque a distancia' },
      { key: 'objetivo',     label: 'Objetivo',              type: 'select',    options: HABILIDAD_OBJETIVO_OPTS, hint: 'target = se aplica al rival · self = se aplica al usuario' },
      { key: 'forma',        label: 'Forma (0–7)',           type: 'number',    min: 0, max: 7, hint: 'Forma de sable que habilita esta habilidad (0 = todas)' },
      { key: 'costo_fuerza', label: 'Costo de Fuerza',      type: 'number',    min: 0 },
      { key: 'damage',       label: 'Daño base',             type: 'number',    min: 0 },
      { key: 'cooldown',     label: 'Cooldown (turnos)',     type: 'number',    min: 0, hint: 'Turnos que deben pasar antes de poder usar de nuevo esta habilidad' },
      { key: 'efecto',       label: 'Efecto',                type: 'textarea',  span: 2, hint: 'Descripción del efecto de la habilidad' },
      { key: 'buff',         label: 'Buff (al usuario)',     type: 'statStack', span: 2, hint: 'Cada clic suma +1 al stat. Ej: ATQ×2 + DEF×1 = +2 ataque y +1 defensa para el usuario durante el turno' },
      { key: 'debuff',       label: 'Debuff (al objetivo)',  type: 'statStack', span: 2, hint: 'Igual que Buff pero se resta al objetivo. Ej: PNT×1 + MOV×1 = -1 puntería y -1 movimiento al rival' },
    ],
    defaults: { tipo: 'melee', objetivo: 'target', forma: 0, costo_fuerza: 0, damage: 0, cooldown: 0 },
  },

  rol_objetos: {
    label: 'Objetos de Rol', icon: 'box', group: 'ROL',
    filters: [
      { key: 'tipo',   label: 'Tipo',   options: TIPO_OBJETO_OPTS },
      { key: 'rareza', label: 'Rareza', options: RAREZA_OPTS.map(r => ({ value: r, label: r })) },
    ],
    columns: [
      { key: 'id', label: 'ID', w: 52 },
      { key: 'nombre', label: 'Nombre', bold: true },
      { key: 'tipo', label: 'Tipo', dim: true },
      { key: 'rareza', label: 'Rareza', type: 'rareza' },
      { key: 'activo', label: 'Activo', type: 'bool', w: 68 },
    ],
    fields: [
      { key: 'nombre',      label: 'Nombre',      type: 'text', required: true, span: 2 },
      { key: 'tipo',        label: 'Tipo',        type: 'text', hint: "usa 'arma' para que dano/tipo_ataque apliquen en combate · usa nucleo_energia, cristal, lente_enfoque, emisor, estabilizador, empunadura, modulo_activacion o accesorio para que sea un componente de sable de luz" },
      { key: 'tipo_ataque', label: 'Tipo de ataque', type: 'select', options: HABILIDAD_TIPO_OPTS, hint: 'solo si tipo = arma · melee = cuerpo a cuerpo · distancia = a distancia' },
      { key: 'dano',        label: 'Daño',        type: 'number', min: 0, hint: 'solo si tipo = arma' },
      { key: 'rareza',      label: 'Rareza',      type: 'select', options: RAREZA_OPTS },
      { key: 'activo',      label: 'Activo',      type: 'toggle' },
      { key: 'imagen',      label: 'Imagen',      type: 'file', span: 2 },
      { key: 'descripcion', label: 'Descripción', type: 'textarea', span: 2 },
      { key: 'efecto',      label: 'Efecto',      type: 'textarea', span: 2 },
      { key: 'bono_ataque',     label: 'Bono Ataque',     type: 'number', min: -999, hint: 'Aplica si este objeto se usa como componente de sable equipado' },
      { key: 'bono_defensa',    label: 'Bono Defensa',    type: 'number', min: -999 },
      { key: 'bono_punteria',   label: 'Bono Puntería',   type: 'number', min: -999 },
      { key: 'bono_movimiento', label: 'Bono Movimiento', type: 'number', min: -999 },
      { key: 'bono_iniciativa', label: 'Bono Iniciativa', type: 'number', min: -999 },
      { key: 'bono_vida',       label: 'Bono Vida',       type: 'number', min: -999 },
      { key: 'bono_escudo',     label: 'Bono Escudo',     type: 'number', min: -999 },
      { key: 'bono_dano',       label: 'Bono Daño',       type: 'number', min: -999, hint: 'Se suma al daño melee fijo del sable' },
      { key: 'bono_critico',    label: 'Bono Crítico (CRT)', type: 'number', min: 0, hint: 'CRT 2 = crítico con 20, 19 o 18 natural. Un crítico siempre impacta y hace +1 de daño' },
      { key: 'bono_fuerza',     label: 'Bono Fuerza',    type: 'number', min: -999, hint: 'Aumenta el máximo de Fuerza en combate (base 10)' },
      { key: 'bono_generacion_fuerza', label: 'Bono Generación de Fuerza', type: 'number', min: -999, hint: 'Aumenta la Fuerza recuperada por turno (base 2)' },
      { key: 'consumo_energia', label: 'Consumo de Energía', type: 'number', min: 0, hint: 'Energía que consume esta pieza al instalarse en un sable' },
      { key: 'energia_maxima',  label: 'Energía Máxima',     type: 'number', min: 0, hint: 'Solo si tipo = nucleo_energia · energía máxima total que el sable puede soportar' },
      { key: 'color_hoja',      label: 'Color de hoja',   type: 'select', options: SABER_OPTS, hint: 'Solo si tipo = cristal · define el color del sable al activarlo' },
    ],
    defaults: { activo: true },
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
      { key: 'grado',    label: 'Grado',  type: 'text' },
      { key: 'clase',    label: 'Clase',  type: 'text' },
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
      { key: 'name',           label: 'Nombre',         type: 'text' },
      { key: 'handle',         label: 'Handle',         type: 'text' },
      { key: 'cls',            label: 'Clase',          type: 'select',  options: CLASE_OPTS },
      { key: 'saber_color',    label: 'Sable',          type: 'select',  options: SABER_OPTS },
      { key: 'side',           label: 'Lado',           type: 'select',  options: LADO_OPTS },
      { key: 'sector',         label: 'Sector',         type: 'text' },
      { key: 'sponsor',        label: 'Sponsor',        type: 'text' },
      { key: 'joined_year',    label: 'Año de ingreso', type: 'number',  min: 0 },
      { key: 'credits',        label: 'Créditos',       type: 'number',  min: 0 },
      { key: 'reputation',     label: 'Reputación',     type: 'number' },
      { key: 'wins',           label: 'Victorias',      type: 'number',  min: 0 },
      { key: 'losses',         label: 'Derrotas',       type: 'number',  min: 0 },
      { key: 'photo',          label: 'Foto',           type: 'file',    span: 2 },
      { key: 'bio',            label: 'Bio',            type: 'textarea', span: 2 },
      { key: 'lore',           label: 'Lore',           type: 'textarea', span: 2 },
      { key: 'vida',           label: 'Vida',           type: 'number',  min: 0 },
      { key: 'escudo',         label: 'Escudo',         type: 'number',  min: 0 },
      { key: 'defensa',        label: 'Defensa',        type: 'number',  min: 0 },
      { key: 'ataque',         label: 'Ataque',         type: 'number',  min: 0 },
      { key: 'movimiento',     label: 'Movimiento',     type: 'number',  min: 0 },
      { key: 'iniciativa',     label: 'Iniciativa',     type: 'number',  min: 0 },
      { key: 'punteria',       label: 'Puntería',       type: 'number',  min: 0 },
      { key: 'puntos_libres',  label: 'Puntos libres',  type: 'number',  min: 0 },
      { key: 'map_sistema_id', label: 'Sistema actual', type: 'relatedSelect', related: 'sistemas' },
      { key: 'map_planeta_id', label: 'Planeta actual', type: 'relatedSelect', related: 'planetas' },
      { key: 'map_zona_id',    label: 'Zona actual',    type: 'relatedSelect', related: 'zonas' },
      { key: 'map_lugar_id',   label: 'Lugar actual',   type: 'relatedSelect', related: 'lugares' },
    ],
    defaults: {},
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

  misiones: {
    label: 'Misiones', icon: 'target', group: 'SISTEMA',
    custom: true,
  },

  torneos: {
    label: 'Torneos', icon: 'trophy', group: 'COMPETITIVO',
    custom: true,
  },

  configuraciones: {
    label: 'Configuraciones', icon: 'settings', group: 'SISTEMA',
    noDelete: true,
    columns: [
      { key: 'id',             label: 'ID',      w: 52 },
      { key: 'nombre',         label: 'Nombre',  bold: true },
      { key: 'tipo_valor',     label: 'Tipo',    dim: true },
      { key: 'valor_numerico', label: 'Número',  w: 80 },
      { key: 'valor_texto',    label: 'Texto',   dim: true },
      { key: 'activo',         label: 'Activo',  type: 'bool', w: 68 },
    ],
    fields: [
      { key: 'nombre',         label: 'Nombre (clave)',  type: 'text',   required: true, hint: 'Identificador único, ej: retraso_texto_npc' },
      { key: 'tipo_valor',     label: 'Tipo de valor',   type: 'select', options: [{ value: 'numerico', label: 'Numérico' }, { value: 'texto', label: 'Texto' }] },
      { key: 'valor_numerico', label: 'Valor numérico',  type: 'number', min: 0 },
      { key: 'valor_texto',    label: 'Valor texto',     type: 'textarea', span: 2 },
      { key: 'activo',         label: 'Activo',          type: 'toggle' },
    ],
    defaults: { tipo_valor: 'numerico', activo: true },
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
      <input type="number" {...base} min={field.min ?? 0} {...(field.max != null ? { max: field.max } : {})}
        value={value ?? 0} onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
      />
    );
  }

  if (field.type === 'select') {
    return (
      <select className="nx-select" value={value ?? ''} onChange={e => onChange(e.target.value || null)}>
        <option value="">— Sin seleccionar —</option>
        {(field.options ?? []).map(o => {
          const val = typeof o === 'object' ? o.value : o;
          const lbl = typeof o === 'object' ? o.label : o;
          return <option key={val} value={val}>{lbl}</option>;
        })}
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

  if (field.type === 'date') {
    return (
      <input type="date" {...base}
        value={value ? String(value).slice(0, 10) : ''}
        onChange={e => onChange(e.target.value || null)}
      />
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

  if (field.type === 'statStack') {
    const arr = Array.isArray(value) ? value : [];
    const counts = Object.fromEntries(BUFF_STATS.map(s => [s, 0]));
    arr.forEach(s => { if (s in counts) counts[s]++; });

    const update = (stat, delta) => {
      const newCount = Math.max(0, counts[stat] + delta);
      const newArr = BUFF_STATS.flatMap(s => Array(s === stat ? newCount : counts[s]).fill(s));
      onChange(newArr);
    };

    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {BUFF_STATS.map(stat => {
          const count = counts[stat];
          const c = BUFF_COLOR[stat];
          const active = count > 0;
          const btnBase = {
            width: 20, height: 20, borderRadius: 4, border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.06)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, lineHeight: 1, color: 'var(--txt)', padding: 0,
          };
          return (
            <div key={stat} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: active ? `${c}18` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${active ? `${c}55` : 'var(--holo-line)'}`,
              borderRadius: 8, padding: '5px 9px', transition: 'all 0.15s',
            }}>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-data)', letterSpacing: '0.08em', color: active ? c : 'var(--txt-dim)', minWidth: 30 }}>
                {BUFF_LABEL[stat]}
              </span>
              <button type="button" onClick={() => update(stat, -1)} disabled={!active}
                style={{ ...btnBase, opacity: active ? 1 : 0.25, cursor: active ? 'pointer' : 'not-allowed' }}>−</button>
              <span style={{ fontSize: 13, fontFamily: 'var(--font-data)', minWidth: 14, textAlign: 'center', color: active ? c : 'var(--txt-faint)', fontWeight: active ? 700 : 400 }}>
                {count}
              </span>
              <button type="button" onClick={() => update(stat, 1)} style={btnBase}>+</button>
            </div>
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
            } else if (Array.isArray(val)) {
              payload.append(key, JSON.stringify(val));
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
            {field.hint && field.type !== 'textarea' && (
              <span style={{ fontSize: 10, color: 'var(--txt-faint)', fontFamily: 'var(--font-data)' }}>{field.hint}</span>
            )}
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

  if (col.type === 'image') {
    const src = raw ? (raw.startsWith('http') ? raw : `/storage/${raw}`) : null;
    return src
      ? <img src={src} alt="" style={{ width: 30, height: 30, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--holo-line)' }} />
      : <span style={{ color: 'var(--txt-faint)' }}>—</span>;
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
  const [activeFilters, setActiveFilters] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, per_page: 25 });
      if (search) params.set('q', search);
      Object.entries(activeFilters).forEach(([k, v]) => { if (v !== '') params.set(k, v); });
      const res = await api('GET', `/admin/${entityKey}?${params}`);
      setData(res);
    } catch (err) {
      toast(err.message, { tone: 'error', icon: 'x' });
    } finally {
      setLoading(false);
    }
  }, [entityKey, page, search, activeFilters]);

  useEffect(() => { setPage(1); setSearch(''); setSearchInput(''); setActiveFilters({}); }, [entityKey]);
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

        {/* Filtros específicos de entidad */}
        {(config.filters ?? []).map(f => (
          <select
            key={f.key}
            className="nx-select"
            value={activeFilters[f.key] ?? ''}
            onChange={e => { setActiveFilters(prev => ({ ...prev, [f.key]: e.target.value })); setPage(1); }}
            style={{ fontSize: 11, minWidth: 110, height: 32, padding: '0 8px' }}
          >
            <option value="">— {f.label} —</option>
            {f.options.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ))}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {Object.values(activeFilters).some(v => v !== '') && (
            <Btn kind="ghost" sm onClick={() => { setActiveFilters({}); setPage(1); }}>
              <Icon name="x" size={11} /> Limpiar
            </Btn>
          )}
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

        {/* tabla / vista custom */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {config.custom
            ? (activeEntity === 'torneos' ? <TorneosAdmin key={activeEntity} /> : <MisionesAdmin key={activeEntity} />)
            : (
              <EntityTable
                key={activeEntity}
                entityKey={activeEntity}
                config={config}
                relatedOptions={relatedOptions}
                onRefreshRelated={refreshRelated}
              />
            )
          }
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   MISIONES ADMIN — CRUD completo con objetivos y recompensas inline
───────────────────────────────────────────────────────────── */
const TIPO_MISION_OPTS  = ['temporada', 'comunidad', 'individual'];
const TIPO_OBJETIVO_OPTS = ['general', 'entrenamiento', 'combate', 'tarea', 'viaje', 'dialogo'];
const TIPO_RECOMPENSA_OPTS = ['creditos', 'titulo', 'insignia', 'objeto', 'habilidad'];

const FORMA_NOMBRES = ['Sin forma', 'Shii-Cho', 'Makashi', 'Soresu', 'Ataru', 'Shien / Djem So', 'Niman', 'Juyo / Vaapad'];
const habilidadLabel = (h) => h.forma > 0 ? `[Forma ${h.forma} — ${FORMA_NOMBRES[h.forma]}] ${h.label}` : h.label;

const EMPTY_OBJ = { nombre: '', descripcion: '', tipo: 'general', meta: 1, unidad: '' };
const EMPTY_REC = { nombre: '', descripcion: '', tipo: 'creditos', valor: 0, habilidad_id: null, objeto_id: null };
const EMPTY_MISION = {
  nombre: '', mision: '', descripcion: '', foto_mision: '',
  tipo_mision: 'individual', temporada_id: '', npc_id: '',
  puntos_requeridos: 100, activa: true, orden: 0,
  fecha_inicio: '', fecha_termino: '',
  hito_requerimiento: '', entregar_hito: '',
  objetivos: [], recompensas: [],
};

function misionFromApi(m) {
  return {
    nombre:             m.nombre            ?? '',
    mision:             m.mision            ?? '',
    descripcion:        m.descripcion       ?? '',
    foto_mision:        m.foto_mision       ?? '',
    tipo_mision:        m.tipo_mision       ?? 'individual',
    temporada_id:       m.temporada_id      ?? '',
    npc_id:             m.npc_id            ?? '',
    puntos_requeridos:  m.puntos_requeridos ?? 100,
    activa:             m.activa            ?? true,
    orden:              m.orden             ?? 0,
    fecha_inicio:         m.fecha_inicio          ?? '',
    fecha_termino:        m.fecha_termino         ?? '',
    hito_requerimiento:   m.hito_requerimiento    ?? '',
    entregar_hito:        m.entregar_hito         ?? '',
    objetivos:  (m.objetivos  ?? []).map(o => ({ ...o })),
    recompensas:(m.recompensas ?? []).map(r => ({ ...r, habilidad_id: r.habilidad_id ?? null, objeto_id: r.objeto_id ?? null })),
  };
}

function TagInput({ value, onChange, placeholder = 'Escribe y presiona Enter o coma...' }) {
  const [input, setInput] = useState('');
  const tags = value ? value.split(',').map(t => t.trim()).filter(Boolean) : [];

  const addTag = (raw) => {
    const newTags = raw.split(',').map(t => t.trim()).filter(Boolean);
    const merged = [...new Set([...tags, ...newTags])];
    onChange(merged.join(', '));
  };

  const removeTag = (tag) => {
    const next = tags.filter(t => t !== tag);
    onChange(next.join(', '));
  };

  const handleKey = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault();
      addTag(input);
      setInput('');
    } else if (e.key === 'Backspace' && !input && tags.length) {
      removeTag(tags[tags.length - 1]);
    }
  };

  const handleBlur = () => {
    if (input.trim()) { addTag(input); setInput(''); }
  };

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
      padding: '6px 10px', minHeight: 42, borderRadius: 8,
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
      cursor: 'text',
    }} onClick={e => e.currentTarget.querySelector('input')?.focus()}>
      {tags.map(tag => (
        <span key={tag} style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
          background: 'rgba(56,205,240,0.12)', border: '1px solid rgba(56,205,240,0.3)', color: 'var(--holo)',
        }}>
          {tag}
          <button onClick={() => removeTag(tag)} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--holo)',
            padding: 0, lineHeight: 1, fontSize: 13, opacity: 0.7,
          }}>×</button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKey}
        onBlur={handleBlur}
        placeholder={tags.length ? '' : placeholder}
        style={{
          flex: 1, minWidth: 120, background: 'none', border: 'none', outline: 'none',
          color: 'var(--txt)', fontSize: 13,
        }}
      />
    </div>
  );
}

function NpcPicker({ npcs, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = npcs.find(n => n.id === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const imgUrl = (n) => n.imagen_mini ? `/storage/${n.imagen_mini}` : null;

  const rowStyle = (active) => ({
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
    cursor: 'pointer', borderRadius: 6,
    background: active ? 'rgba(56,205,240,0.12)' : 'transparent',
    transition: 'background 0.15s',
  });

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${open ? 'var(--holo)' : 'rgba(255,255,255,0.12)'}`,
          minHeight: 44, transition: 'border-color 0.15s',
        }}
      >
        {selected ? (
          <>
            {imgUrl(selected)
              ? <img src={imgUrl(selected)} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              : <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(56,205,240,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>👤</div>
            }
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: 'var(--txt)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selected.nombre}</div>
              {selected.lugar && <div style={{ fontSize: 11, color: 'var(--txt-faint)', marginTop: 1 }}>{selected.lugar}</div>}
            </div>
          </>
        ) : (
          <span style={{ fontSize: 13, color: 'var(--txt-faint)' }}>— Seleccionar NPC —</span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--txt-faint)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▼</span>
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200,
          background: 'var(--bg-card, #0e1729)', border: '1px solid rgba(56,205,240,0.25)',
          borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          maxHeight: 260, overflowY: 'auto',
          padding: 4,
        }}>
          {/* Clear option */}
          <div
            onClick={() => { onChange(null); setOpen(false); }}
            style={{ ...rowStyle(value === null), color: 'var(--txt-faint)', fontSize: 12, fontStyle: 'italic' }}
          >
            Sin NPC asignado
          </div>

          {npcs.length === 0 && (
            <div style={{ padding: '12px', textAlign: 'center', fontSize: 12, color: 'var(--txt-faint)' }}>
              No hay NPCs de tipo misión
            </div>
          )}

          {npcs.map(n => (
            <div
              key={n.id}
              onClick={() => { onChange(n.id); setOpen(false); }}
              style={rowStyle(n.id === value)}
            >
              {imgUrl(n)
                ? <img src={imgUrl(n)} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: n.id === value ? '2px solid var(--holo)' : '2px solid transparent' }} />
                : <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(56,205,240,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>👤</div>
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: n.id === value ? 'var(--holo)' : 'var(--txt)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.nombre}</div>
                {n.lugar && <div style={{ fontSize: 11, color: 'var(--txt-faint)', marginTop: 1 }}>{n.lugar}</div>}
              </div>
              {n.id === value && <span style={{ fontSize: 12, color: 'var(--holo)' }}>✓</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MisionesAdmin() {
  const [misiones, setMisiones]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [editing, setEditing]       = useState(null);
  const [saving, setSaving]         = useState(false);
  const [form, setForm]             = useState({ ...EMPTY_MISION });
  const [filter, setFilter]         = useState('');
  const [habilidades, setHabilidades]   = useState([]);
  const [objetos, setObjetos]           = useState([]);
  const [npcsOptions, setNpcsOptions]   = useState([]);

  /* Load habilidades options once */
  useEffect(() => {
    api('GET', '/admin/rol_habilidades/options')
      .then(d => setHabilidades(d.options ?? []))
      .catch(() => {});
  }, []);

  /* Load objetos options once */
  useEffect(() => {
    api('GET', '/admin/rol_objetos/options')
      .then(d => setObjetos(d.options ?? []))
      .catch(() => {});
  }, []);

  /* Load NPCs (cualquier tipo) once */
  useEffect(() => {
    api('GET', '/misiones/npcs-mision')
      .then(d => setNpcsOptions(d.npcs ?? []))
      .catch(() => {});
  }, []);

  /* Load */
  const reload = useCallback(async (tipo = filter) => {
    setLoading(true);
    try {
      const q  = tipo ? `?tipo=${tipo}` : '';
      const res = await api('GET', `/misiones${q}`);
      setMisiones(res.misiones ?? []);
    } catch { toast('Error al cargar misiones', { tone: 'error', icon: 'x' }); }
    setLoading(false);
  }, [filter]);

  useEffect(() => { reload(); }, []);

  /* Start edit / create */
  const openNew  = () => { setForm({ ...EMPTY_MISION }); setEditing('new'); };
  const openEdit = (m) => { setForm(misionFromApi(m)); setEditing(m); };
  const cancel   = () => setEditing(null);

  /* Save */
  const handleSave = async () => {
    if (!form.nombre.trim() || !form.mision.trim()) {
      toast('Nombre y descripción de la misión son obligatorios', { tone: 'error', icon: 'x' }); return;
    }
    setSaving(true);
    try {
      const payloadObj = {
        ...form,
        temporada_id:        form.temporada_id        || null,
        npc_id:              form.npc_id              || null,
        fecha_inicio:        form.fecha_inicio        || null,
        fecha_termino:       form.fecha_termino       || null,
        puntos_requeridos:   Number(form.puntos_requeridos),
        orden:               Number(form.orden),
        hito_requerimiento:  form.hito_requerimiento  || null,
        entregar_hito:       form.entregar_hito       || null,
      };

      const hasNewFile = payloadObj.foto_mision instanceof File;
      let payload = payloadObj;
      if (hasNewFile) {
        payload = new FormData();
        Object.entries(payloadObj).forEach(([key, val]) => {
          if (val === null || val === undefined) return;
          if (val instanceof File) {
            payload.append(key, val);
          } else if (typeof val === 'boolean') {
            payload.append(key, val ? '1' : '0');
          } else if (Array.isArray(val) || typeof val === 'object') {
            payload.append(key, JSON.stringify(val));
          } else {
            payload.append(key, val);
          }
        });
        if (editing !== 'new') payload.append('_method', 'PATCH');
      }

      const method = hasNewFile ? 'POST' : (editing === 'new' ? 'POST' : 'PATCH');
      const path   = editing === 'new' ? '/misiones' : `/misiones/${editing.id}`;
      const res = await api(method, path, payload);
      toast(editing === 'new' ? 'Misión creada' : 'Misión actualizada', { tone: 'success', icon: 'check' });
      setEditing(null);
      reload(filter);
    } catch (e) { toast(e?.message ?? 'Error al guardar', { tone: 'error', icon: 'x' }); }
    setSaving(false);
  };

  /* Delete */
  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta misión y todos sus objetivos y recompensas?')) return;
    try {
      await api('DELETE', `/misiones/${id}`);
      setMisiones(prev => prev.filter(m => m.id !== id));
      toast('Misión eliminada', { tone: 'success', icon: 'check' });
    } catch { toast('Error al eliminar', { tone: 'error', icon: 'x' }); }
  };

  /* Form helpers */
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addObj = () => set('objetivos', [...form.objetivos, { ...EMPTY_OBJ }]);
  const rmObj  = (i) => set('objetivos', form.objetivos.filter((_, x) => x !== i));
  const setObj = (i, k, v) => set('objetivos', form.objetivos.map((o, x) => x === i ? { ...o, [k]: v } : o));

  const addRec = () => set('recompensas', [...form.recompensas, { ...EMPTY_REC }]);
  const rmRec  = (i) => set('recompensas', form.recompensas.filter((_, x) => x !== i));
  const setRec = (i, k, v) => set('recompensas', form.recompensas.map((r, x) => x === i ? { ...r, [k]: v } : r));

  const tipoColor = { temporada: '#E6B325', comunidad: '#10b981', individual: '#38cdf0' };

  /* ── FORM ── */
  if (editing !== null) {
    return (
      <div style={{ height: '100%', overflowY: 'auto', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button onClick={cancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt-dim)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <Icon name="chevron" size={13} style={{ transform: 'rotate(180deg)' }} /> Volver
          </button>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt)' }}>
            {editing === 'new' ? 'Nueva Misión' : `Editando: ${editing.nombre}`}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          {/* Tipo */}
          <div>
            <label className="nx-label">Tipo de misión *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {TIPO_MISION_OPTS.map(t => (
                <button key={t} onClick={() => set('tipo_mision', t)} style={{
                  flex: 1, padding: '8px 6px', borderRadius: 7, cursor: 'pointer', fontSize: 11,
                  fontFamily: 'var(--font-data)', letterSpacing: '0.08em', textTransform: 'uppercase',
                  background: form.tipo_mision === t ? `${tipoColor[t]}22` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${form.tipo_mision === t ? tipoColor[t] : 'rgba(255,255,255,0.1)'}`,
                  color: form.tipo_mision === t ? tipoColor[t] : 'var(--txt-dim)',
                }}>{t}</button>
              ))}
            </div>
          </div>

          {/* Nombre y misión */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label className="nx-label">Nombre *</label>
              <input className="nx-input" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej: Guardianes del Templo" />
            </div>
            <div>
              <label className="nx-label">Objetivo breve *</label>
              <input className="nx-input" value={form.mision} onChange={e => set('mision', e.target.value)} placeholder="Ej: Completar 10 sesiones de entrenamiento" />
            </div>
          </div>

          <div>
            <label className="nx-label">Descripción</label>
            <textarea className="nx-textarea" rows={3} value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Contexto e instrucciones detalladas..." />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 80px', gap: 14 }}>
            <div>
              <label className="nx-label">Fecha de inicio</label>
              <input className="nx-input" type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)} />
            </div>
            <div>
              <label className="nx-label">Fecha de término</label>
              <input className="nx-input" type="date" value={form.fecha_termino} onChange={e => set('fecha_termino', e.target.value)} />
            </div>
            <div>
              <label className="nx-label">Orden</label>
              <input className="nx-input" type="number" min="0" value={form.orden} onChange={e => set('orden', +e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <label className="nx-label">Activa</label>
              <button onClick={() => set('activa', !form.activa)} style={{
                padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 11,
                background: form.activa ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${form.activa ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.15)'}`,
                color: form.activa ? '#10b981' : 'var(--txt-dim)',
              }}>{form.activa ? 'Activa' : 'Inactiva'}</button>
            </div>
          </div>

          {/* Campos según tipo */}
          {form.tipo_mision === 'temporada' && (
            <div>
              <label className="nx-label">ID de Temporada</label>
              <input className="nx-input" type="number" min="1" value={form.temporada_id} onChange={e => set('temporada_id', e.target.value)} placeholder="ID de la temporada" />
            </div>
          )}
          {form.tipo_mision === 'comunidad' && (
            <div>
              <label className="nx-label">Puntos requeridos (meta global)</label>
              <input className="nx-input" type="number" min="1" value={form.puntos_requeridos} onChange={e => set('puntos_requeridos', +e.target.value)} />
            </div>
          )}
          {form.tipo_mision === 'individual' && (
            <div>
              <label className="nx-label">NPC que da la misión</label>
              <NpcPicker
                npcs={npcsOptions}
                value={form.npc_id ? +form.npc_id : null}
                onChange={id => set('npc_id', id)}
              />
            </div>
          )}

          <div>
            <label className="nx-label">Imagen de portada</label>
            <input type="file" accept="image/*" className="nx-input"
              onChange={e => e.target.files[0] && set('foto_mision', e.target.files[0])}
            />
            {form.foto_mision && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <img
                  src={form.foto_mision instanceof File
                    ? URL.createObjectURL(form.foto_mision)
                    : (form.foto_mision.startsWith('http') ? form.foto_mision : `/storage/${form.foto_mision}`)}
                  style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--holo-line)' }}
                />
                <span style={{ fontSize: 10, color: 'var(--txt-faint)' }}>
                  {form.foto_mision instanceof File ? 'Nuevo archivo seleccionado' : 'Imagen actual'}
                </span>
                <button type="button" onClick={() => set('foto_mision', '')} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt-faint)',
                  fontSize: 10, textDecoration: 'underline', padding: 0,
                }}>Quitar</button>
              </div>
            )}
          </div>

          {/* ── HITOS ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label className="nx-label">Hito requerimiento</label>
              <TagInput
                value={form.hito_requerimiento}
                onChange={v => set('hito_requerimiento', v)}
                placeholder="Hito necesario para completar..."
              />
              <div style={{ fontSize: 11, color: 'var(--txt-faint)', marginTop: 4 }}>
                El jugador debe tener estos hitos antes de completar la misión.
              </div>
            </div>
            <div>
              <label className="nx-label">Entregar hito</label>
              <TagInput
                value={form.entregar_hito}
                onChange={v => set('entregar_hito', v)}
                placeholder="Hito que se otorga al completar..."
              />
              <div style={{ fontSize: 11, color: 'var(--txt-faint)', marginTop: 4 }}>
                Hitos que se otorgan al jugador al finalizar la misión.
              </div>
            </div>
          </div>

          {/* ── OBJETIVOS ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <label className="nx-label" style={{ margin: 0 }}>Objetivos</label>
              <button onClick={addObj} style={{
                background: 'rgba(56,205,240,0.1)', border: '1px solid rgba(56,205,240,0.3)', color: 'var(--holo)',
                borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <Icon name="plus" size={11} /> Agregar objetivo
              </button>
            </div>
            {form.objetivos.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--txt-faint)', padding: '10px 0' }}>Sin objetivos — agrega al menos uno</div>
            )}
            <div style={{ display: 'grid', gap: 10 }}>
              {form.objetivos.map((o, i) => (
                <div key={i} style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid var(--holo-line)', position: 'relative' }}>
                  <button onClick={() => rmObj(i)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt-faint)', padding: 4 }}>
                    <Icon name="x" size={12} />
                  </button>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 80px 80px', gap: 10, paddingRight: 28, marginBottom: 8 }}>
                    <div>
                      <label className="nx-label">Nombre *</label>
                      <input className="nx-input" value={o.nombre} onChange={e => setObj(i, 'nombre', e.target.value)} placeholder="Ej: Ganar 5 combates" />
                    </div>
                    <div>
                      <label className="nx-label">Tipo</label>
                      <select className="nx-select" value={o.tipo ?? 'general'} onChange={e => setObj(i, 'tipo', e.target.value)}>
                        {TIPO_OBJETIVO_OPTS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="nx-label">Meta</label>
                      <input className="nx-input" type="number" min="1" value={o.meta ?? 1} onChange={e => setObj(i, 'meta', +e.target.value)} />
                    </div>
                    <div>
                      <label className="nx-label">Unidad</label>
                      <input className="nx-input" value={o.unidad ?? ''} onChange={e => setObj(i, 'unidad', e.target.value)} placeholder="victorias" />
                    </div>
                  </div>
                  <div>
                    <label className="nx-label">Descripción</label>
                    <input className="nx-input" value={o.descripcion ?? ''} onChange={e => setObj(i, 'descripcion', e.target.value)} placeholder="Detalle del objetivo..." />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── RECOMPENSAS ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <label className="nx-label" style={{ margin: 0 }}>Recompensas</label>
              <button onClick={addRec} style={{
                background: 'rgba(230,179,37,0.1)', border: '1px solid rgba(230,179,37,0.3)', color: '#E6B325',
                borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <Icon name="plus" size={11} /> Agregar recompensa
              </button>
            </div>
            {form.recompensas.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--txt-faint)', padding: '10px 0' }}>Sin recompensas definidas</div>
            )}
            <div style={{ display: 'grid', gap: 10 }}>
              {form.recompensas.map((r, i) => (
                <div key={i} style={{ padding: '12px 14px', background: 'rgba(230,179,37,0.04)', borderRadius: 8, border: '1px solid rgba(230,179,37,0.15)', position: 'relative' }}>
                  <button onClick={() => rmRec(i)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt-faint)', padding: 4 }}>
                    <Icon name="x" size={12} />
                  </button>
                  <div style={{ display: 'grid', gridTemplateColumns: (r.tipo === 'habilidad' || r.tipo === 'objeto') ? '1fr 110px' : '1fr 110px 80px', gap: 10, paddingRight: 28 }}>
                    <div>
                      <label className="nx-label">Nombre *</label>
                      <input className="nx-input" value={r.nombre} onChange={e => setRec(i, 'nombre', e.target.value)} placeholder="Ej: 500 Créditos" />
                    </div>
                    <div>
                      <label className="nx-label">Tipo</label>
                      <select className="nx-select" value={r.tipo ?? 'creditos'} onChange={e => setRec(i, 'tipo', e.target.value)}>
                        {TIPO_RECOMPENSA_OPTS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    {r.tipo !== 'habilidad' && r.tipo !== 'objeto' && (
                      <div>
                        <label className="nx-label">Valor</label>
                        <input className="nx-input" type="number" min="0" value={r.valor ?? 0} onChange={e => setRec(i, 'valor', +e.target.value)} />
                      </div>
                    )}
                  </div>
                  {r.tipo === 'habilidad' && (
                    <div style={{ marginTop: 10 }}>
                      <label className="nx-label">Habilidad a otorgar *</label>
                      <select className="nx-select" value={r.habilidad_id ?? ''}
                        onChange={e => setRec(i, 'habilidad_id', e.target.value ? +e.target.value : null)}>
                        <option value="">— Seleccionar habilidad —</option>
                        {habilidades.map(h => (
                          <option key={h.id} value={h.id}>{habilidadLabel(h)}</option>
                        ))}
                      </select>
                      {habilidades.length === 0 && (
                        <div style={{ fontSize: 11, color: 'var(--txt-faint)', marginTop: 4 }}>Cargando habilidades...</div>
                      )}
                    </div>
                  )}
                  {r.tipo === 'objeto' && (
                    <div style={{ marginTop: 10 }}>
                      <label className="nx-label">Objeto a otorgar *</label>
                      <select className="nx-select" value={r.objeto_id ?? ''}
                        onChange={e => setRec(i, 'objeto_id', e.target.value ? +e.target.value : null)}>
                        <option value="">— Seleccionar objeto —</option>
                        {objetos.map(o => (
                          <option key={o.id} value={o.id}>{o.label}</option>
                        ))}
                      </select>
                      {objetos.length === 0 && (
                        <div style={{ fontSize: 11, color: 'var(--txt-faint)', marginTop: 4 }}>Cargando objetos...</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Acciones */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 8, borderTop: '1px solid var(--holo-line)', marginTop: 4 }}>
            <Btn onClick={cancel}>Cancelar</Btn>
            <Btn kind="accent" icon="check" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : editing === 'new' ? 'Crear misión' : 'Guardar cambios'}
            </Btn>
          </div>
        </div>
      </div>
    );
  }

  /* ── LIST ── */
  const TIPOS = [{ v: '', l: 'Todas' }, { v: 'temporada', l: 'Temporada' }, { v: 'comunidad', l: 'Comunidad' }, { v: 'individual', l: 'Individual' }];
  const tipoC = { temporada: '#E6B325', comunidad: '#10b981', individual: '#38cdf0' };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--holo-line)', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {TIPOS.map(t => (
            <button key={t.v} onClick={() => { setFilter(t.v); reload(t.v); }} style={{
              padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 11,
              fontFamily: 'var(--font-data)', letterSpacing: '0.06em',
              background: filter === t.v ? 'color-mix(in srgb, var(--holo) 15%, transparent)' : 'transparent',
              border: `1px solid ${filter === t.v ? 'var(--holo)' : 'transparent'}`,
              color: filter === t.v ? 'var(--txt)' : 'var(--txt-dim)',
            }}>{t.l}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <Btn sm icon="plus" kind="accent" onClick={openNew}>Nueva misión</Btn>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <span className="nx-data" style={{ color: 'var(--holo)', animation: 'nx-pulse 1.4s infinite' }}>CARGANDO...</span>
          </div>
        )}
        {!loading && misiones.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--txt-faint)', fontSize: 13 }}>
            Sin misiones{filter ? ` de tipo "${filter}"` : ''}
          </div>
        )}
        <div style={{ display: 'grid', gap: 10 }}>
          {misiones.map(m => {
            const c = tipoC[m.tipo_mision] ?? '#38cdf0';
            return (
              <div key={m.id} style={{
                padding: '12px 14px', borderRadius: 8, border: '1px solid var(--holo-line)',
                background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'flex-start', gap: 12,
                borderLeft: `3px solid ${c}`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{m.nombre}</span>
                    <span style={{ fontSize: 9, fontFamily: 'var(--font-data)', padding: '2px 7px', borderRadius: 3, background: `${c}18`, color: c, border: `1px solid ${c}40` }}>
                      {m.tipo_mision?.toUpperCase()}
                    </span>
                    {!m.activa && <span style={{ fontSize: 9, color: 'var(--txt-faint)', fontFamily: 'var(--font-data)' }}>INACTIVA</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--txt-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.mision}</div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
                    <span className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)' }}>
                      {(m.objetivos ?? []).length} obj · {(m.recompensas ?? []).length} rec
                    </span>
                    {m.fecha_termino && (
                      <span className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)' }}>
                        <Icon name="clock" size={9} /> {m.fecha_termino}
                      </span>
                    )}
                  </div>
                  {m.tipo_mision === 'individual' && (m.npc || m.hito_requerimiento || m.entregar_hito) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 5 }}>
                      {m.npc && (
                        <span className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)' }}>
                          <Icon name="user" size={9} /> {m.npc.nombre}
                        </span>
                      )}
                      {m.hito_requerimiento && (
                        <span className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)' }}>
                          Requiere: <span style={{ color: 'var(--txt-dim)' }}>{m.hito_requerimiento}</span>
                        </span>
                      )}
                      {m.entregar_hito && (
                        <span className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)' }}>
                          Entrega: <span style={{ color: 'var(--txt-dim)' }}>{m.entregar_hito}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => openEdit(m)} style={{ background: 'rgba(56,205,240,0.08)', border: '1px solid rgba(56,205,240,0.2)', color: 'var(--holo)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 11 }}>
                    <Icon name="edit" size={12} />
                  </button>
                  <button onClick={() => handleDelete(m.id)} style={{ background: 'rgba(255,45,69,0.08)', border: '1px solid rgba(255,45,69,0.2)', color: '#ff6b6b', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 11 }}>
                    <Icon name="x" size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   TORNEOS ADMIN — CRUD de torneos competitivos
───────────────────────────────────────────────────────────── */
const EMPTY_TORNEO = {
  nombre: '', descripcion: '', imagen: '', premios: '', requisitos: '',
  cupos: 8, fecha_inicio: '',
};

function torneoFromApi(t) {
  return {
    nombre:        t.nombre        ?? '',
    descripcion:   t.descripcion   ?? '',
    imagen:        t.imagen        ?? '',
    premios:       t.premios       ?? '',
    requisitos:    t.requisitos    ?? '',
    cupos:         t.cupos         ?? 8,
    fecha_inicio:  t.fecha_inicio  ?? '',
  };
}

const ESTADO_TORNEO_ADMIN = {
  inscripcion: { label: 'Inscripción', color: '#10b981' },
  en_curso:    { label: 'En curso',    color: '#38cdf0' },
  finalizado:  { label: 'Finalizado',  color: '#E6B325' },
};

function TorneosAdmin() {
  const [torneos, setTorneos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving]   = useState(false);
  const [form, setForm]       = useState({ ...EMPTY_TORNEO });
  const [starting, setStarting] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api('GET', '/torneos');
      setTorneos(res.torneos ?? []);
    } catch { toast('Error al cargar torneos', { tone: 'error', icon: 'x' }); }
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, []);

  const openNew  = () => { setForm({ ...EMPTY_TORNEO }); setEditing('new'); };
  const openEdit = (t) => { setForm(torneoFromApi(t)); setEditing(t); };
  const cancel   = () => setEditing(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.nombre.trim() || !form.cupos) {
      toast('Nombre y cupos son obligatorios', { tone: 'error', icon: 'x' }); return;
    }
    setSaving(true);
    try {
      const payloadObj = {
        ...form,
        cupos:        Number(form.cupos),
        fecha_inicio: form.fecha_inicio || null,
      };

      const hasNewFile = payloadObj.imagen instanceof File;
      let payload = payloadObj;
      if (hasNewFile) {
        payload = new FormData();
        Object.entries(payloadObj).forEach(([key, val]) => {
          if (val === null || val === undefined) return;
          payload.append(key, val);
        });
        if (editing !== 'new') payload.append('_method', 'PATCH');
      }

      const method = hasNewFile ? 'POST' : (editing === 'new' ? 'POST' : 'PATCH');
      const path   = editing === 'new' ? '/torneos' : `/torneos/${editing.id}`;
      await api(method, path, payload);
      toast(editing === 'new' ? 'Torneo creado' : 'Torneo actualizado', { tone: 'success', icon: 'check' });
      setEditing(null);
      reload();
    } catch (e) { toast(e?.message ?? 'Error al guardar', { tone: 'error', icon: 'x' }); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este torneo y todos sus combates?')) return;
    try {
      await api('DELETE', `/torneos/${id}`);
      setTorneos(prev => prev.filter(t => t.id !== id));
      toast('Torneo eliminado', { tone: 'success', icon: 'check' });
    } catch { toast('Error al eliminar', { tone: 'error', icon: 'x' }); }
  };

  const handleIniciar = async (id) => {
    if (!window.confirm('¿Generar el árbol de este torneo? La inscripción se cerrará.')) return;
    setStarting(id);
    try {
      await api('POST', `/torneos/${id}/iniciar`);
      toast('Árbol generado', { tone: 'success', icon: 'check' });
      reload();
    } catch (e) { toast(e?.message ?? 'Error al generar el árbol', { tone: 'error', icon: 'x' }); }
    setStarting(null);
  };

  /* ── FORM ── */
  if (editing !== null) {
    return (
      <div style={{ height: '100%', overflowY: 'auto', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button onClick={cancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt-dim)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <Icon name="chevron" size={13} style={{ transform: 'rotate(180deg)' }} /> Volver
          </button>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt)' }}>
            {editing === 'new' ? 'Nuevo Torneo' : `Editando: ${editing.nombre}`}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 14 }}>
            <div>
              <label className="nx-label">Nombre *</label>
              <input className="nx-input" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej: Copa Solsticio" />
            </div>
            <div>
              <label className="nx-label">Cupos *</label>
              <input className="nx-input" type="number" min="2" value={form.cupos} onChange={e => set('cupos', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="nx-label">Descripción</label>
            <textarea className="nx-textarea" rows={3} value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Contexto y formato del torneo..." />
          </div>

          <div>
            <label className="nx-label">Fecha de inicio</label>
            <input className="nx-input" type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)} style={{ maxWidth: 220 }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label className="nx-label">Premios</label>
              <textarea className="nx-textarea" rows={4} value={form.premios} onChange={e => set('premios', e.target.value)} placeholder="Ej: 1er lugar: 500 créditos + medalla..." />
            </div>
            <div>
              <label className="nx-label">Requisitos</label>
              <textarea className="nx-textarea" rows={4} value={form.requisitos} onChange={e => set('requisitos', e.target.value)} placeholder="Ej: Tier caballero o superior..." />
            </div>
          </div>

          <div>
            <label className="nx-label">Imagen de portada</label>
            <input type="file" accept="image/*" className="nx-input"
              onChange={e => e.target.files[0] && set('imagen', e.target.files[0])}
            />
            {form.imagen && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <img
                  src={form.imagen instanceof File
                    ? URL.createObjectURL(form.imagen)
                    : (form.imagen.startsWith('http') ? form.imagen : `/storage/${form.imagen}`)}
                  style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--holo-line)' }}
                />
                <span style={{ fontSize: 10, color: 'var(--txt-faint)' }}>
                  {form.imagen instanceof File ? 'Nuevo archivo seleccionado' : 'Imagen actual'}
                </span>
                <button type="button" onClick={() => set('imagen', '')} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt-faint)',
                  fontSize: 10, textDecoration: 'underline', padding: 0,
                }}>Quitar</button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
            <Btn onClick={cancel}>Cancelar</Btn>
            <Btn kind="accent" icon="check" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Btn>
          </div>
        </div>
      </div>
    );
  }

  /* ── LIST ── */
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--holo-line)', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
        <div style={{ flex: 1 }} />
        <Btn sm icon="plus" kind="accent" onClick={openNew}>Nuevo torneo</Btn>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <span className="nx-data" style={{ color: 'var(--holo)', animation: 'nx-pulse 1.4s infinite' }}>CARGANDO...</span>
          </div>
        )}
        {!loading && torneos.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--txt-faint)', fontSize: 13 }}>Sin torneos</div>
        )}
        <div style={{ display: 'grid', gap: 10 }}>
          {torneos.map(t => {
            const e = ESTADO_TORNEO_ADMIN[t.estado] ?? ESTADO_TORNEO_ADMIN.inscripcion;
            return (
              <div key={t.id} style={{
                padding: '12px 14px', borderRadius: 8, border: '1px solid var(--holo-line)',
                background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'flex-start', gap: 12,
                borderLeft: `3px solid ${e.color}`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{t.nombre}</span>
                    <span style={{ fontSize: 9, fontFamily: 'var(--font-data)', padding: '2px 7px', borderRadius: 3, background: `${e.color}18`, color: e.color, border: `1px solid ${e.color}40` }}>
                      {e.label.toUpperCase()}
                    </span>
                  </div>
                  <div className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)' }}>
                    {t.inscritos_count} / {t.cupos} cupos
                    {t.ganador && ` · Campeón: ${t.ganador.name}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {t.estado === 'inscripcion' && (
                    <button onClick={() => handleIniciar(t.id)} disabled={starting === t.id || t.inscritos_count < 2}
                      style={{ background: 'rgba(230,179,37,0.1)', border: '1px solid rgba(230,179,37,0.3)', color: 'var(--pompeyo-oro)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 11, opacity: t.inscritos_count < 2 ? 0.4 : 1 }}>
                      <Icon name="crown" size={12} /> Generar Árbol
                    </button>
                  )}
                  <button onClick={() => openEdit(t)} style={{ background: 'rgba(56,205,240,0.08)', border: '1px solid rgba(56,205,240,0.2)', color: 'var(--holo)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 11 }}>
                    <Icon name="edit" size={12} />
                  </button>
                  <button onClick={() => handleDelete(t.id)} style={{ background: 'rgba(255,45,69,0.08)', border: '1px solid rgba(255,45,69,0.2)', color: '#ff6b6b', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 11 }}>
                    <Icon name="x" size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
