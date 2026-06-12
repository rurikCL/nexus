/* NÉXUS — datos semilla (MOCK).
   En producción, reemplazar por respuestas de la API Laravel (ver src/api/endpoints.js). */

  const TIERS = {
    iniciado:    { label: 'Iniciado',     color: 'var(--tier-iniciado)',    min: 0 },
    padawan:     { label: 'Padawan',      color: 'var(--tier-padawan)',     min: 8 },
    caballero:   { label: 'Caballero',    color: 'var(--tier-caballero)',   min: 20 },
    maestro:     { label: 'Maestro',      color: 'var(--tier-maestro)',     min: 38 },
    granmaestro: { label: 'Gran Maestro', color: 'var(--tier-granmaestro)', min: 50 },
  };

  const CLASSES = [
    { id: 'forma1', num: 'Forma I',   name: 'Shii-Cho',       desc: 'La forma de la determinación', img: '/assets/Forma1.png', icon: 'sword',  accent: '#ffb01f' },
    { id: 'forma2', num: 'Forma II',  name: 'Makashi',        desc: 'La forma del duelo',            img: '/assets/Forma2.png', icon: 'target', accent: '#38cdf0' },
    { id: 'forma3', num: 'Forma III', name: 'Soresu',         desc: 'La forma de la resistencia',    img: '/assets/Forma3.png', icon: 'shield', accent: '#10b981' },
    { id: 'forma4', num: 'Forma IV',  name: 'Ataru',          desc: 'La forma de la agresión',       img: '/assets/Forma4.png', icon: 'zap',    accent: '#FF6B00' },
    { id: 'forma5', num: 'Forma V',   name: 'Shien / Djem So', desc: 'La forma de la perseverancia', img: '/assets/Forma5.png', icon: 'anvil',  accent: '#8b5cf6' },
    { id: 'forma6', num: 'Forma VI',  name: 'Niman',          desc: 'La forma de la moderación',     img: '/assets/Forma6.png', icon: 'star',   accent: '#E6B325' },
    { id: 'forma7', num: 'Forma VII', name: 'Juyo / Vaapad',  desc: 'La forma de la ferocidad',      img: '/assets/Forma7.png', icon: 'flame',  accent: '#ff2d45' },
  ];

  function tierOf(wins) {
    let t = 'iniciado';
    for (const k of Object.keys(TIERS)) if (wins >= TIERS[k].min) t = k;
    return t;
  }

  // Colores de sable por combatiente
  const SABERS = {
    azul:    '#3aa0ff', verde:   '#34d36a', ambar:   '#ffb01f',
    purpura: '#b15cff', cian:    '#26e3e3', blanco:  '#eaf2ff',
    rojo:    '#ff2d45',
  };

  // Combatientes (incluye al usuario actual: id 'you')
  const combatants = [
    { id: 'you',  name: 'Valentina Soto',  handle: 'V-SOTO', initials: 'VS', color: '#FF6B00',
      cls: 'forma4', side: 'luminoso', wins: 34, losses: 11, streak: 4, credits: 4250, gold: true,
      stats: { fuerza: 78, velocidad: 64, tecnica: 71, defensa: 58, foco: 82 },
      medals: ['oro-temporada-3', 'racha-10', 'invicto-novato'], bio: 'Cierro distancias antes de que respires.',
      sector: 'Sector Andes', sponsor: 'Banco Estado', joined: '2024' },
    { id: 'c2',  name: 'Carlos Méndez',   handle: 'C-MNDZ', initials: 'CM', color: '#38cdf0',
      cls: 'forma2', side: 'luminoso', wins: 41, losses: 9, streak: 7, credits: 6120, gold: true,
      stats: { fuerza: 60, velocidad: 88, tecnica: 84, defensa: 49, foco: 76 },
      medals: ['oro-temporada-3', 'racha-10', 'verdugo'], bio: 'No me vas a ver venir.', sector: 'Sector Litoral' },
    { id: 'c3',  name: 'María González',  handle: 'M-GNZL', initials: 'MG', color: '#8b5cf6',
      cls: 'forma3', side: 'oscuro', wins: 28, losses: 14, streak: 2, credits: 3380, gold: false,
      stats: { fuerza: 85, velocidad: 41, tecnica: 66, defensa: 90, foco: 70 },
      medals: ['muro', 'racha-10'], bio: 'Pasa si puedes.', sector: 'Sector Andes' },
    { id: 'c4',  name: 'Diego Fuentes',   handle: 'D-FNTS', initials: 'DF', color: '#10b981',
      cls: 'forma7', side: 'oscuro', wins: 52, losses: 6, streak: 11, credits: 9870, gold: true,
      stats: { fuerza: 58, velocidad: 72, tecnica: 91, defensa: 63, foco: 95 },
      medals: ['leyenda-viva', 'oro-temporada-3', 'racha-10', 'verdugo', 'invicto-novato'],
      bio: 'Leo el combate tres turnos antes que tú.', sector: 'Sector Litoral' },
    { id: 'c5',  name: 'Javiera Rojas',   handle: 'J-ROJS', initials: 'JR', color: '#ec4899',
      cls: 'forma5', side: 'luminoso', wins: 19, losses: 17, streak: 0, credits: 1540, gold: false,
      stats: { fuerza: 55, velocidad: 79, tecnica: 62, defensa: 51, foco: 68 },
      medals: ['racha-10'], bio: 'Subiendo rápido.', sector: 'Sector Sur' },
    { id: 'c6',  name: 'Tomás Bravo',     handle: 'T-BRVO', initials: 'TB', color: '#f97316',
      cls: 'forma1', side: 'luminoso', wins: 12, losses: 20, streak: 0, credits: 720, gold: false,
      stats: { fuerza: 70, velocidad: 52, tecnica: 48, defensa: 60, foco: 44 },
      medals: [], bio: 'Recluta con hambre.', sector: 'Sector Sur' },
    { id: 'c7',  name: 'Ignacia Lillo',   handle: 'I-LILO', initials: 'IL', color: '#38cdf0',
      cls: 'forma6', side: 'oscuro', wins: 7, losses: 9, streak: 1, credits: 410, gold: false,
      stats: { fuerza: 40, velocidad: 58, tecnica: 64, defensa: 47, foco: 72 },
      medals: [], bio: 'Aprendiendo a leer el ring.', sector: 'Sector Andes' },
    { id: 'c8',  name: 'Felipe Araya',    handle: 'F-ARYA', initials: 'FA', color: '#8b5cf6',
      cls: 'forma3', side: 'oscuro', wins: 3, losses: 6, streak: 0, credits: 180, gold: false,
      stats: { fuerza: 66, velocidad: 38, tecnica: 40, defensa: 71, foco: 50 },
      medals: [], bio: 'Día uno.', sector: 'Sector Litoral' },
  ];
  const SABER_BY_ID = { you: 'azul', c2: 'verde', c3: 'purpura', c4: 'verde', c5: 'cian', c6: 'ambar', c7: 'azul', c8: 'blanco' };
  combatants.forEach(c => { c.tier = tierOf(c.wins); c.total = c.wins + c.losses;
    c.saber = SABERS[SABER_BY_ID[c.id] || 'azul']; c.saberName = SABER_BY_ID[c.id] || 'azul';
    c.winrate = c.total ? Math.round(c.wins / c.total * 100) : 0; });

  const MEDALS = {
    'oro-temporada-3': { name: 'Oro · Temporada 3', icon: 'medal', tone: 'gold' },
    'racha-10':        { name: 'Racha de 10', icon: 'flame', tone: 'orange' },
    'invicto-novato':  { name: 'Invicto Novato', icon: 'shield', tone: 'holo' },
    'verdugo':         { name: 'Verdugo', icon: 'sword', tone: 'red' },
    'muro':            { name: 'El Muro', icon: 'anvil', tone: 'holo' },
    'leyenda-viva':    { name: 'Leyenda Viva', icon: 'crown', tone: 'gold' },
  };

  // Eventos = presentaciones a las que se asiste (todo el año). Inscripción + recompensa.
  const events = [
    { id: 'ev1', name: 'Exhibición de Formas · Verano', type: 'EXHIBICIÓN', status: 'REALIZADO',
      date: '10/01/2026', location: 'Domo Central', reward: 350, rewardBadge: null,
      capacity: 30, registered: 27, mine: true, claimed: false, banner: '#FF6B00',
      desc: 'Cada combatiente presenta su forma de sable ante la Orden. Recompensa por presentación completada.' },
    { id: 'ev2', name: 'Exhibición de Formas · Otoño', type: 'EXHIBICIÓN', status: 'ABIERTO',
      date: '22/03/2026', location: 'Domo Central', reward: 400, rewardBadge: 'Insignia Exhibición',
      capacity: 30, registered: 18, mine: false, claimed: false, banner: '#FF6B00',
      desc: 'Presenta tu forma de sable ante un jurado de Maestros. Cupos limitados.' },
    { id: 'ev3', name: 'Ceremonia de Ascenso', type: 'CEREMONIA', status: 'ABIERTO',
      date: '15/05/2026', location: 'Salón de la Orden', reward: 600, rewardBadge: null,
      capacity: 80, registered: 54, mine: true, claimed: false, banner: '#E6B325',
      desc: 'Reconocimiento de nuevos rangos. Los pupilos destacados presentan su progreso.' },
    { id: 'ev4', name: 'Demostración Académica · Andes', type: 'DEMOSTRACIÓN', status: 'ABIERTO',
      date: '27/06/2026', location: 'Plaza Andes', reward: 300, rewardBadge: null,
      capacity: 20, registered: 12, mine: false, claimed: false, banner: '#38cdf0',
      desc: 'Demos abiertas al público. Inscríbete para presentar una rutina de 5 minutos.' },
    { id: 'ev5', name: 'Taller Abierto: Lectura de Combate', type: 'TALLER', status: 'PRÓXIMO',
      date: '28/07/2026', location: 'Sala Táctica', reward: 250, rewardBadge: null,
      capacity: 16, registered: 4, mine: false, claimed: false, banner: '#8b5cf6',
      desc: 'Presenta el análisis de un duelo grabado frente al grupo. Inscripción abre pronto.' },
    { id: 'ev6', name: 'Gala Anual NÉXUS', type: 'GALA', status: 'PRÓXIMO',
      date: '12/12/2026', location: 'Gran Domo', reward: 1000, rewardBadge: 'Medalla de Gala',
      capacity: 120, registered: 31, mine: false, claimed: false, banner: '#E6B325',
      desc: 'Cierre de temporada. Presentaciones de élite y entrega de reconocimientos.' },
  ];

  // Combates oficiales (con cuotas para apostar)
  const combats = [
    { id: 'm1', a: 'c4', b: 'c2', oddsA: 1.6, oddsB: 2.3, when: 'HOY 20:00', live: true,
      event: 'Copa Orbital · Cuartos', round: 'Cuartos · A' },
    { id: 'm2', a: 'c3', b: 'you', oddsA: 2.1, oddsB: 1.7, when: 'HOY 20:40', live: false,
      event: 'Copa Orbital · Cuartos', round: 'Cuartos · B' },
    { id: 'm3', a: 'c5', b: 'c6', oddsA: 1.5, oddsB: 2.5, when: 'MAÑ 18:30', live: false,
      event: 'Sparring Abierto', round: 'Práctica' },
    { id: 'm4', a: 'c7', b: 'c8', oddsA: 1.8, oddsB: 1.9, when: 'MAÑ 19:10', live: false,
      event: 'Sparring Abierto', round: 'Práctica' },
  ];

  // Tareas tutor -> pupilo. Tutor actual: Diego (c4). Pupilos: you, c6, c7, c8.
  const tasks = [
    { id: 't1', pupil: 'you', tutor: 'c4', title: '3 sesiones de footwork', detail: 'Sube velocidad de 64 a 70. Graba cada sesión en bitácora.',
      due: '14/06', progress: 66, status: 'en-curso', reward: 200, created: '08/06' },
    { id: 't2', pupil: 'you', tutor: 'c4', title: 'Estudiar 2 combates de Méndez', detail: 'Identifica su tell antes del crítico.',
      due: '16/06', progress: 30, status: 'en-curso', reward: 150, created: '09/06' },
    { id: 't3', pupil: 'you', tutor: 'c4', title: 'Acondicionamiento defensivo', detail: 'Defensa por debajo de 60. Necesita trabajo.',
      due: '20/06', progress: 0, status: 'pendiente', reward: 250, created: '10/06' },
    { id: 't4', pupil: 'c6', tutor: 'c4', title: 'Fundamentos de guardia', detail: 'Mantener guardia alta 5 rounds completos.',
      due: '13/06', progress: 100, status: 'revision', reward: 120, created: '06/06' },
    { id: 't5', pupil: 'c7', tutor: 'c4', title: 'Lectura de patrones', detail: 'Anota patrones de 3 oponentes distintos.',
      due: '17/06', progress: 45, status: 'en-curso', reward: 180, created: '08/06' },
    { id: 't6', pupil: 'c8', tutor: 'c4', title: 'Resistencia base', detail: '20 min de circuito sin parar.',
      due: '12/06', progress: 80, status: 'en-curso', reward: 100, created: '07/06' },
  ];

  // Asistencia + bitácora del usuario actual. Días marcados de Junio 2026.
  const training = {
    month: 'Junio 2026',
    logged: {
      '2': { focus: 'Técnica', effort: 7, note: 'Trabajé combos de entrada. El timing aún me falla contra zurdos.', tags: ['técnica','sparring'], media: 2, tasks: ['t1'] },
      '4': { focus: 'Cardio', effort: 8, note: 'Circuito completo + 4 rounds de sombra. Las piernas respondieron.', tags: ['cardio'], media: 1, tasks: [] },
      '6': { focus: 'Sparring', effort: 9, note: 'Sparring con María. Me pasó por encima en defensa, confirmado lo que dijo Diego.', tags: ['sparring','defensa'], media: 3, tasks: ['t3'] },
      '9': { focus: 'Footwork', effort: 6, note: 'Solo footwork. Grabado para la tarea de Diego.', tags: ['técnica'], media: 1, tasks: ['t1'] },
      '10':{ focus: 'Estudio', effort: 4, note: 'Vi dos combates de Méndez. Su tell: baja el hombro derecho antes del crítico.', tags: ['estudio'], media: 0, tasks: ['t2'] },
    },
    creditsPerSession: 75,
  };

  // Niveles de gamificación (créditos)
  const ranking = [...combatants].sort((a,b)=> b.wins - a.wins || b.winrate - a.winrate);

export const NX = {
    TIERS, CLASSES, MEDALS, SABERS, combatants, events, combats, tasks, training, ranking, tierOf,
    byId: (id) => combatants.find(c => c.id === id),
    fmtCLP: (n) => '₡' + new Intl.NumberFormat('es-CL').format(n),
    me: 'you', tutorView: 'c4',
  };
