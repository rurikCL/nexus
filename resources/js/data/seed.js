/* NÉXUS — constantes de configuración estática (catálogos, paletas, utilidades). */

const TIERS = {
  iniciado:    { label: 'Iniciado',     color: 'var(--tier-iniciado)',    min: 0 },
  padawan:     { label: 'Padawan',      color: 'var(--tier-padawan)',     min: 8 },
  caballero:   { label: 'Caballero',    color: 'var(--tier-caballero)',   min: 20 },
  maestro:     { label: 'Maestro',      color: 'var(--tier-maestro)',     min: 38 },
  granmaestro: { label: 'Gran Maestro', color: 'var(--tier-granmaestro)', min: 50 },
};

const CLASSES = [
  { id: 'forma1', num: 'Forma I',   name: 'Shii-Cho',        desc: 'La forma de la determinación', img: '/assets/Forma1.png', icon: 'sword',  accent: '#ffb01f' },
  { id: 'forma2', num: 'Forma II',  name: 'Makashi',         desc: 'La forma del duelo',            img: '/assets/Forma2.png', icon: 'target', accent: '#38cdf0' },
  { id: 'forma3', num: 'Forma III', name: 'Soresu',          desc: 'La forma de la resistencia',    img: '/assets/Forma3.png', icon: 'shield', accent: '#10b981' },
  { id: 'forma4', num: 'Forma IV',  name: 'Ataru',           desc: 'La forma de la agresión',       img: '/assets/Forma4.png', icon: 'zap',    accent: '#FF6B00' },
  { id: 'forma5', num: 'Forma V',   name: 'Shien / Djem So', desc: 'La forma de la perseverancia',  img: '/assets/Forma5.png', icon: 'anvil',  accent: '#8b5cf6' },
  { id: 'forma6', num: 'Forma VI',  name: 'Niman',           desc: 'La forma de la moderación',     img: '/assets/Forma6.png', icon: 'star',   accent: '#E6B325' },
  { id: 'forma7', num: 'Forma VII', name: 'Juyo / Vaapad',   desc: 'La forma de la ferocidad',      img: '/assets/Forma7.png', icon: 'flame',  accent: '#ff2d45' },
];

const MEDALS = {
  'oro-temporada-3': { name: 'Oro · Temporada 3', icon: 'medal', tone: 'gold' },
  'racha-10':        { name: 'Racha de 10',        icon: 'flame', tone: 'orange' },
  'invicto-novato':  { name: 'Invicto Novato',     icon: 'shield', tone: 'holo' },
  'verdugo':         { name: 'Verdugo',            icon: 'sword', tone: 'red' },
  'muro':            { name: 'El Muro',            icon: 'anvil', tone: 'holo' },
  'leyenda-viva':    { name: 'Leyenda Viva',       icon: 'crown', tone: 'gold' },
};

const SABERS = {
  azul:    '#3aa0ff',
  verde:   '#34d36a',
  ambar:   '#ffb01f',
  purpura: '#b15cff',
  cian:    '#26e3e3',
  blanco:  '#eaf2ff',
  rojo:    '#ff2d45',
};

function tierOf(wins) {
  let t = 'iniciado';
  for (const k of Object.keys(TIERS)) if (wins >= TIERS[k].min) t = k;
  return t;
}

export const NX = {
  TIERS, CLASSES, MEDALS, SABERS, tierOf,
  fmtCLP: (n) => '₡' + new Intl.NumberFormat('es-CL').format(n),
};
