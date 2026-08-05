import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './ui.jsx';
import { NX } from '../data/seed.js';
import { playClickHabilidad, playClickOpcion, playCombateNpc, playSound } from '../utils/sounds.js';
import { tirarEstancia, mensajeEstancia, mensajeSinTirada } from '../utils/estancia.js';
import { getRelativeCenter } from './combatFx.jsx';
import EnergyStrikeEffect from './EnergyStrikeEffect.jsx';
import RangedStrikeEffect from './RangedStrikeEffect.jsx';
import FloatingCombatText from './FloatingCombatText.jsx';
import { useDiceRoller, useDragToThrow, renderDiceText } from './DiceRoller.jsx';
import { SkillTooltip } from './SkillTooltip.jsx';
import { NpcCombatCardModal } from './CombatCard.jsx';
import StatusBurstEffect from './StatusBurstEffect.jsx';
import { EmojiRing, EmojiBurst } from './EmojiExpressions.jsx';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/* Tabla de efectividad entre formas: forma atacante → forma que supera con +1 de daño (ver formaBonoDano; igual que en PvP/Raid) */
const FORMA_BEATS = {
  1: 6, // Shii-Cho    → Niman
  2: 1, // Makashi     → Shii-Cho
  3: 4, // Soresu      → Ataru
  4: 5, // Ataru       → Shien/Djem So
  5: 3, // Shien/DjSo  → Soresu
  6: 7, // Niman       → Juyo/Vaapad
  7: 2, // Juyo/Vaapad → Makashi
};
/* Tabla de resistencia: forma defensora → forma cuyos ataques recibe con -1 de daño (ver formaBonoDano) */
const FORMA_RESISTS = {
  1: 5, // Shii-Cho    resiste a Shien/Djem So
  2: 4, // Makashi     resiste a Ataru
  3: 1, // Soresu      resiste a Shii-Cho
  4: 7, // Ataru       resiste a Juyo/Vaapad
  5: 3, // Shien/DjSo  resiste a Soresu
  6: 6, // Niman       resiste a Niman
  7: 2, // Juyo/Vaapad resiste a Makashi
};
/* Forma 0 = universal: nunca aplica bono ni penalización */
const formaEsEfectiva = (atkForma, defForma) => {
  if (!atkForma || !defForma) return false;
  return FORMA_BEATS[atkForma] === defForma;
};
const formaEsResistente = (atkForma, defForma) => {
  if (!atkForma || !defForma) return false;
  return FORMA_RESISTS[defForma] === atkForma;
};
/* Bono de daño plano por forma: +1 si el atacante es efectivo, -1 si el defensor resiste (se suman si ambos aplican) */
const formaBonoDano = (atkForma, defForma) => {
  let bono = 0;
  if (formaEsEfectiva(atkForma, defForma)) bono += 1;
  if (formaEsResistente(atkForma, defForma)) bono -= 1;
  return bono;
};

/* Bono persistente por tener una Forma de Combate equipada (hasta cambiarla con "stance") — igual en los 3 sistemas de combate. */
const FORMA_BONOS = {
  1: { ataque: 1 },
  2: { dano_escudo: 1 },
  3: { defensa: 1 },
  4: { iniciativa: 1 },
  5: { dano: 1 },
  6: { movimiento: 1 },
  7: { dano_perforante: 1 },
};
const formaBono = (forma, clave) => FORMA_BONOS[forma]?.[clave] ?? 0;

/* ─── Estados de combate ───────────────────────────────────────────────
   Espejo en JS de app/Support/Combat/AplicaEstadosCombate.php — este combate
   contra NPC es 100% client-side (localStorage), sin servidor autoritativo. */
const TIPOS_ESTADO = [
  'paralizado', 'inmune_paralisis', 'aturdido', 'marcado', 'protegido',
  'sangrado', 'envenenado', 'debilitado', 'confundido', 'regeneracion',
  'deflectar', 'contraataque',
];
const DEFAULTS_ESTADO = {
  paralizado: { turns: 1, valor: 0 },
  aturdido: { turns: 1, valor: 0 },
  marcado: { turns: null, valor: 0 },
  protegido: { turns: null, valor: 0 },
  sangrado: { turns: 2, valor: 1 },
  envenenado: { turns: 3, valor: 2 },
  debilitado: { turns: 2, valor: 0 },
  confundido: { turns: 1, valor: 0 },
  regeneracion: { turns: 2, valor: 2 },
  deflectar: { turns: 1, valor: 0 },
  contraataque: { turns: 1, valor: 0 },
};
const ESTADOS_DOT = { sangrado: true, envenenado: true };
const ESTADOS_HOT = { regeneracion: true };
const ESTADO_ICON = {
  paralizado: '🔒', aturdido: '💫', marcado: '🎯', protegido: '🛡️',
  sangrado: '🩸', envenenado: '☠️', debilitado: '⬇️', confundido: '❓', regeneracion: '💚',
  deflectar: '↩️', contraataque: '🗡️',
};
const ESTADO_LABEL = {
  paralizado: 'Paralizado', aturdido: 'Aturdido', marcado: 'Marcado', protegido: 'Protegido',
  sangrado: 'Sangrado', envenenado: 'Envenenado', debilitado: 'Debilitado', confundido: 'Confundido', regeneracion: 'Regeneración',
  deflectar: 'Deflectar', contraataque: 'Contraataque',
};

const esTipoEstado = (stat) => TIPOS_ESTADO.includes(stat);
const tieneEstado = (estados, tipo) => estados.some(e => e.tipo === tipo);
const quitarEstado = (estados, tipo) => estados.filter(e => e.tipo !== tipo);
const agregarEstado = (estados, tipo, turns, valor = 0) => {
  const i = estados.findIndex(e => e.tipo === tipo);
  if (i === -1) return [...estados, { tipo, turns, valor }];
  const next = [...estados];
  const actual = next[i];
  next[i] = {
    ...actual,
    turns: (turns === null || actual.turns === null) ? null : Math.max(actual.turns, turns),
    valor: valor > 0 ? valor : actual.valor,
  };
  return next;
};
/* Duración de deflectar/contraataque configurable por habilidad (campo `duracion`), a
   diferencia del resto de los estados que usan un valor fijo de diseño. */
const ESTADOS_DURACION_CONFIGURABLE = ['deflectar', 'contraataque'];
const agregarEstadoPorTipo = (estados, tipo, duracionHabilidad = null) => {
  const def = DEFAULTS_ESTADO[tipo] ?? { turns: 1, valor: 0 };
  const turns = (duracionHabilidad != null && ESTADOS_DURACION_CONFIGURABLE.includes(tipo)) ? duracionHabilidad : def.turns;
  return agregarEstado(estados, tipo, turns, def.valor);
};
const intentarParalizar = (estados) => {
  if (tieneEstado(estados, 'inmune_paralisis')) return { estados, aplicado: false };
  return { estados: agregarEstadoPorTipo(estados, 'paralizado'), aplicado: true };
};
const resolverParalisisAlEmpezarTurno = (estados) => {
  if (!tieneEstado(estados, 'paralizado')) return { estados, paralizado: false };
  const sinParalisis = quitarEstado(estados, 'paralizado');
  return { estados: agregarEstadoPorTipo(sinParalisis, 'inmune_paralisis'), paralizado: true };
};
const mitigarTiradaAturdido = (estados, roll) => (tieneEstado(estados, 'aturdido') ? Math.floor(roll / 2) : roll);
const mitigarDanoDebilitado = (estadosAtacante, dmg) => (tieneEstado(estadosAtacante, 'debilitado') ? Math.floor(dmg / 2) : dmg);
const resolverConfundido = (estados) => tieneEstado(estados, 'confundido') && Math.random() < 0.5;
const consumirProtegido = (estadosObjetivo) => {
  if (!tieneEstado(estadosObjetivo, 'protegido')) return { estados: estadosObjetivo, activo: false };
  return { estados: quitarEstado(estadosObjetivo, 'protegido'), activo: true };
};
const consumirMarcado = (estadosObjetivo, atkDadoNatural) => {
  if (!tieneEstado(estadosObjetivo, 'marcado')) return { estados: estadosObjetivo, activo: false, forzarExito: false };
  return { estados: quitarEstado(estadosObjetivo, 'marcado'), activo: true, forzarExito: atkDadoNatural > 2 };
};
/* Deflectar (a distancia) / Contraataque (cuerpo a cuerpo): a diferencia de protegido, solo
   consume si el tipo de ataque coincide. Si se consume, el golpe se evita por completo y el
   atacante recibe la mitad del daño que iba a infligir (ver mitadDano). */
const consumirDeflectarOContraataque = (estadosObjetivo, esDistancia) => {
  const tipo = esDistancia ? 'deflectar' : 'contraataque';
  if (!tieneEstado(estadosObjetivo, tipo)) return { estados: estadosObjetivo, activo: false, tipo: null };
  return { estados: quitarEstado(estadosObjetivo, tipo), activo: true, tipo };
};
const mitadDano = (dmg, dmgEscudo, dmgPerforante) => [
  Math.floor(Math.max(0, dmg) / 2), Math.floor(Math.max(0, dmgEscudo) / 2), Math.floor(Math.max(0, dmgPerforante) / 2),
];
const aplicarEstadoDeHabilidad = (estados, tipo, duracionHabilidad = null) =>
  (tipo === 'paralizado' ? intentarParalizar(estados).estados : agregarEstadoPorTipo(estados, tipo, duracionHabilidad));
const tickEstadosRonda = (estados, hp, maxHp, nombreActor) => {
  let nextHp = hp;
  const mensajes = [];
  const restantes = [];
  for (const e of estados) {
    if (ESTADOS_DOT[e.tipo] && e.valor > 0) {
      nextHp = Math.max(0, nextHp - e.valor);
      mensajes.push(`${nombreActor} sufre ${e.tipo}: −${e.valor} vida`);
    } else if (ESTADOS_HOT[e.tipo] && e.valor > 0) {
      nextHp = Math.min(maxHp, nextHp + e.valor);
      mensajes.push(`${nombreActor} se regenera: +${e.valor} vida`);
    }
    if (e.turns === null) { restantes.push(e); continue; }
    const turns = e.turns - 1;
    if (turns > 0) restantes.push({ ...e, turns });
  }
  return { estados: restantes, hp: nextHp, mensajes };
};

function useIsMobile() {
  const [m, setM] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const fn = () => setM(window.innerWidth < 640);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return m;
}

const mediaUrl = (path) => {
  if (!path) return null;
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:') || path.startsWith('blob:')) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (cleanPath.startsWith('/storage/')) return cleanPath;
  if (cleanPath.startsWith('/admin/')) return `/storage${cleanPath}`;
  if (cleanPath.startsWith('/public/')) return cleanPath.replace('/public/', '/storage/');
  return `/storage${cleanPath}`;
};

const NPC_COMBAT_LS = 'nx-npc-combat';
const BADGE_ICON = { ATQ: 'sword', DEF: 'shield', PNT: 'target', MOV: 'arrow' };
const STAT_ABBR = { ataque: 'ATQ', defensa: 'DEF', punteria: 'PNT', movimiento: 'AGI', iniciativa: 'INI' };

/* Fondo espacial autocontenido (estrellas + planetas) para combates navales */
function pseudoRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function useSpaceStarsCSS() {
  return useMemo(() => {
    const dot = (x, y, r, a) =>
      `radial-gradient(circle at ${x}% ${y}%, rgba(219,230,245,${a}) 0px, rgba(219,230,245,${a}) ${r.toFixed(2)}px, transparent ${(r + 0.5).toFixed(2)}px)`;
    return Array.from({ length: 160 }, (_, i) => {
      const x = (pseudoRandom(i * 12.9898 + 1) * 100).toFixed(2);
      const y = (pseudoRandom(i * 78.233 + 3) * 100).toFixed(2);
      const r = pseudoRandom(i * 37.719 + 5) * 0.9 + 0.3;
      const a = (pseudoRandom(i * 91.345 + 7) * 0.5 + 0.35).toFixed(2);
      return dot(x, y, r, a);
    }).join(', ');
  }, []);
}

function SpaceBackground() {
  const starsCSS = useSpaceStarsCSS();
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 25%, #0c1e42, #020810 75%)' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: starsCSS }} />
      {/* planetas decorativos */}
      <div style={{
        position: 'absolute', top: '6%', right: '8%', width: 150, height: 150, borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 30%, #7bc8d4dd, #386185aa 55%, #0c1e4233 85%, transparent)',
        boxShadow: '0 0 70px 6px rgba(56,205,240,0.10)',
      }} />
      <div style={{
        position: 'absolute', bottom: '10%', left: '5%', width: 78, height: 78, borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 30%, #d4a76add, #8a6a4aaa 55%, #2a1f1533 85%, transparent)',
        boxShadow: '0 0 40px 4px rgba(212,167,106,0.10)',
      }} />
      <div style={{
        position: 'absolute', top: '38%', left: '14%', width: 26, height: 26, borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 30%, #a8b8d4dd, #5a6a8aaa 60%, transparent)',
      }} />
    </div>
  );
}

export default function NpcCombatScreen({ npc, player, lugarImagen, planetaNombre, lugarNombre, planetaImagen, onVictory, onDefeat, onFlee, initialState, naveMode = false, esEnemigo = false, objetosUtilizables = [], onUsarObjeto }) {
  /* 2d6 (reemplaza el 1d20 anterior) — devuelve ambos dados (para el registro/animación) y su suma. */
  const tirarDados = () => {
    const dado1 = 1 + Math.floor(Math.random() * 6);
    const dado2 = 1 + Math.floor(Math.random() * 6);
    return { dado1, dado2, total: dado1 + dado2 };
  };

  /* En combate naval, `player.vida`/`.escudo` es el HP/escudo ACTUAL (posiblemente
     dañado, persiste hasta reparar) — el máximo real de la nave viaja aparte en
     `vida_max`/`escudo_max`. Fuera de combate naval no se pasan (el personaje siempre
     empieza cada combate a full), así que caen de vuelta a player.vida/escudo. */
  const maxPlayer = { vida: player.vida_max ?? player.vida, escudo: player.escudo_max ?? player.escudo };

  /* Nivel de dificultad (estrellas): +1 a todos los atributos por nivel SOBRE 1 (npcBonoNivel: 0
     en nivel 1, +4 en nivel 5 — no confundir con npcNivel, que arranca en 1 y solo alimenta el
     sistema de dobles/daño de habilidad de más abajo). Nivel 1-3: crítico por "dobles" de
     siempre (mismo criterio que MapNpc::esCriticoDobles). Nivel 4: crítico si un dado es 6 y el
     otro 5+. Nivel 5: un dado 6 y el otro 4+. Doble 1 nunca es crítico — ver esFalloCriticoNpc
     más abajo. No aplica a naves. El bono plano de +nivel en daño (fuera de crítico) es
     EXCLUSIVO de los Jefes (combate RAID) — un enemigo de encuentro aleatorio (map_enemigos,
     `esEnemigo`) no lo recibe. El +1 de daño en un golpe crítico, en cambio, aplica parejo a
     cualquier enemigo (igual que el crítico de un jugador). */
  const npcNivel = naveMode ? 0 : (npc.nivel ?? 1);
  const npcBonoNivel = naveMode ? 0 : Math.max(0, npcNivel - 1);
  const npcBonoCriticoDobles = Math.min(4, Math.floor((npcNivel + 1) / 2));
  const esCriticoDobles = (dado1, dado2, bono) => dado1 === dado2 && dado1 !== 1 && dado1 >= (6 - bono);
  const esCriticoNpc = (dado1, dado2) => {
    if (npcNivel >= 4) {
      const companero = npcNivel >= 5 ? 4 : 5;
      return (dado1 === 6 && dado2 >= companero) || (dado2 === 6 && dado1 >= companero);
    }
    return esCriticoDobles(dado1, dado2, npcBonoCriticoDobles);
  };
  const esFalloCriticoNpc = (dado1, dado2) => dado1 === 1 && dado2 === 1;
  const npcDanoNivel = esEnemigo ? 0 : npcBonoNivel;
  const npcCritBonus = 1;

  const maxNpc    = { vida: Math.max(npc.vida, 1) + npcBonoNivel, escudo: Math.min(5, (npc.escudo ?? 0) + npcBonoNivel) };

  const npcAtk = Math.max(npc.ataque,     1) + npcBonoNivel;
  const npcDef = Math.max(npc.defensa,    1) + npcBonoNivel;
  const npcMov = Math.max(npc.movimiento, 1) + npcBonoNivel;
  const npcIni = Math.max(npc.iniciativa, 1) + npcBonoNivel;
  // punteria=0 es un flag de "sin ataque a distancia" (ver effNpcPnt > 0 más abajo) — el
  // bono de nivel no debe convertir a un NPC melee-only en uno con capacidad a distancia.
  const npcPnt = (npc.punteria ?? 0) > 0 ? (npc.punteria + npcBonoNivel) : 0;

  /* Hasta 2 habilidades propias de un enemigo de encuentro aleatorio (map_enemigos) — mismo
     criterio que los Jefes en Combate RAID: en su turno, 60% de probabilidad de usar una
     disponible (sin cooldown) en vez de su ataque normal. Solo aplica a `esEnemigo`; un NPC
     regular (hostil/aliado/etc.) nunca tiene estos slots pobladas ni los usaría. */
  const npcHabilidades = esEnemigo ? [npc.habilidad1, npc.habilidad2].filter(Boolean) : [];

  const maxFuerza      = player.maxFuerza      ?? 10;
  const fuerzaPorTurno = player.fuerzaPorTurno ?? 2;

  const [playerHp,     setPlayerHp]     = useState(initialState?.playerHp ?? { vida: player.vida, escudo: player.escudo });
  const [npcHp,        setNpcHp]        = useState(initialState?.npcHp    ?? { vida: maxNpc.vida,    escudo: maxNpc.escudo    });
  const [phase,        setPhase]        = useState(initialState?.phase     ?? 'initiative');
  const [currTurn,     setCurrTurn]     = useState(initialState?.currTurn  ?? null);
  const [iniciativaMsg, setIniciativaMsg] = useState(null); // { key, texto } — banner grande en vez de la tirada de dados
  const [inicioMsg,     setInicioMsg]     = useState(null); // { key } — banner "¡Combate iniciado!"
  const [combatIntroDone, setCombatIntroDone] = useState(!!initialState); // true tras el banner de inicio — habilita el banner "Turno N"
  /* Combate nuevo (no restaurado): arranca detenido en un botón "Comenzar" — evita que, si le
     toca actuar primero al NPC, su golpe se resuelva tan rápido tras montar la pantalla que no
     dé tiempo a notarlo. Un combate restaurado (initialState) ya estaba en curso, así que arranca
     ya "iniciado". */
  const [started, setStarted] = useState(!!initialState);
  /* Bloquea acciones de ambos lados mientras se anuncian los banners de Turno/Iniciativa
     (inicio de combate o cambio de ronda) — evita que el jugador ataque o que el turno
     automático del NPC se dispare en medio del anuncio. */
  const [phaseLock,     setPhaseLock]     = useState(!initialState);
  const [log,          setLog]          = useState(initialState?.log       ?? []);
  const [ronda,        setRonda]        = useState(initialState?.ronda       ?? 1);
  const [rondaTurno,   setRondaTurno]   = useState(initialState?.rondaTurno  ?? 0);
  /* endTurnAfter lee estos refs (no el state directo) para no depender de un closure que
     podría haber quedado obsoleto si se invoca desde un efecto creado en un render anterior —
     mismo riesgo que playerHp/npcHp/estados, que ya se resuelve pasándolos vía `overrides`. */
  const rondaRef = useRef(ronda);
  const rondaTurnoRef = useRef(rondaTurno);
  useEffect(() => { rondaRef.current = ronda; }, [ronda]);
  useEffect(() => { rondaTurnoRef.current = rondaTurno; }, [rondaTurno]);
  const [npcBusy,      setNpcBusy]      = useState(false);
  /* Bloquea toda acción del jugador entre el momento en que una acción termina de resolverse
     (animación/daño/log ya aplicados) y el hand-off real de turno dentro de endTurnAfter — sin
     esto, durante la nueva espera de 2s (rolling ya volvió a false) el jugador podía hacer clic
     en otra acción y ejecutar dos golpes en el mismo turno. */
  const [actionLock,   setActionLock]   = useState(false);
  /* Una sola tirada de cambio de estancia por turno (ver doChangeForma). Ref y no state:
     se lee de forma sincrónica en el mismo handler donde se escribe. Se resetea al pasar
     el turno, en endTurnAfter. */
  const estanciaTiradaRef = useRef(false);
  const [logCollapsed, setLogCollapsed] = useState(false);
  const [bgImg,        setBgImg]        = useState(lugarImagen ?? null);
  const logRef = useRef(null);
  const stageRef = useRef(null);
  const playerHudRef = useRef(null);
  const npcHudRef = useRef(null);
  const playerAvatarRef = useRef(null);
  const [strike, setStrike]         = useState(null);
  const [floatTexts, setFloatTexts] = useState([]);
  const [showCombatCard, setShowCombatCard] = useState(false);
  const [emojiPicker, setEmojiPicker] = useState(false);
  const [emojiBurst, setEmojiBurst]   = useState(null);
  const [objetoPicker, setObjetoPicker] = useState(false);
  const [usingObjeto, setUsingObjeto]   = useState(false);

  /* Texto flotante mostrado sobre el objetivo al terminar el golpe de energía */
  const resultTextFor = (hit, ranged, crit, dmg, effective = false, resistant = false) => {
    if (!hit) return { variant: ranged ? 'dodge' : 'block', text: ranged ? 'ESQUIVADO' : 'BLOQUEADO' };
    if (crit) return { variant: 'crit', text: `¡CRÍTICO! −${dmg}` };
    if (effective) return { variant: 'effective', text: `¡EFECTIVO! −${dmg}` };
    if (resistant) return { variant: 'resistant', text: `RESISTIDO −${dmg}` };
    return { variant: 'hit', text: `HIT: ${dmg}` };
  };

  /* Expresión cosmética: no consume turno. Combate contra NPC = solo local, sin sincronizar rival. */
  const sendEmoji = (it) => {
    setEmojiPicker(false);
    setEmojiBurst({ id: `${Date.now()}`, emoji: it.emoji });
    setLog(prev => [...prev, {
      text: `${player.nombre} ${it.desc} ${it.emoji} (${it.label})`,
      type: 'info', id: prev.length, ronda, actor: 'player',
    }]);
  };

  /* Texto flotante independiente de un golpe (curaciones): aparece sobre `ref` sin VFX de golpe */
  const showFloatText = (ref, result) => {
    if (!stageRef.current || !ref.current) return;
    const pos = getRelativeCenter(ref.current, stageRef.current);
    setFloatTexts((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, x: pos.x, y: pos.y, ...result }]);
  };

  const playStatusFx = (targetRef, variant) => new Promise((resolve) => {
    if (!stageRef.current || !targetRef?.current) {
      resolve();
      return;
    }
    setStatusFx({
      key: `${Date.now()}-${Math.random()}`,
      variant,
      targetRef,
      onResolve: resolve,
    });
  });

  /* Dispara el VFX de golpe (melee/a distancia) entre jugador y NPC */
  const triggerStrike = ({ playerIsAttacker, ranged, hit, crit = false, effective = false, resistant = false, dmg = 0 }) => {
    if (!stageRef.current) return Promise.resolve();
    const attackerRef = playerIsAttacker ? playerHudRef : npcHudRef;
    const targetRef    = playerIsAttacker ? npcHudRef : playerHudRef;
    const arma = playerIsAttacker ? player.arma_equipada : null;
    const color = playerIsAttacker
      ? ((arma?.es_sable && NX.SABERS[arma.color_hoja]) || '#38cdf0')
      : '#ff2d45';
    return new Promise((resolve) => {
      setStrike({
        key: `${Date.now()}-${Math.random()}`,
        type: ranged ? 'ranged' : 'melee',
        outcome: hit ? 'hit' : (ranged ? 'dodge' : 'block'),
        color, attackerRef, targetRef,
        from: getRelativeCenter(attackerRef.current, stageRef.current),
        to: getRelativeCenter(targetRef.current, stageRef.current),
        result: resultTextFor(hit, ranged, crit, dmg, effective, resistant),
        onResolve: resolve,
      });
    });
  };

  /* Estado de habilidades del jugador */
  const [playerFuerza, setPlayerFuerza] = useState(initialState?.playerFuerza ?? 0);
  const [cooldowns,    setCooldowns]    = useState(initialState?.cooldowns     ?? {});
  const [playerBuffs,  setPlayerBuffs]  = useState(initialState?.playerBuffs  ?? []);
  const [npcDebuffs,   setNpcDebuffs]   = useState(initialState?.npcDebuffs   ?? []);
  const [playerDebuffs, setPlayerDebuffs] = useState(initialState?.playerDebuffs ?? []);
  /* Buffs del propio enemigo — de una habilidad suya que se refuerza a sí mismo al usarla
     (ver npcHabilidades). Ningún NPC regular llega a poblar esto hoy. */
  const [npcBuffs, setNpcBuffs] = useState(initialState?.npcBuffs ?? []);
  const [playerEstados, setPlayerEstados] = useState(initialState?.playerEstados ?? []);
  const [npcEstados,    setNpcEstados]    = useState(initialState?.npcEstados    ?? []);
  /* Cooldowns de las habilidades PROPIAS del enemigo (`npcHabilidades`) — análogo a `cooldowns`
     del jugador, pero para el bando NPC. Solo se puebla si `esEnemigo`. */
  const [npcCooldowns, setNpcCooldowns] = useState(initialState?.npcCooldowns ?? {});
  const [statusFx, setStatusFx]        = useState(null);

  /* Forma actual y cambio de estancia */
  const habPool    = player.all_habilidades_data ?? {};
  const porForma   = player.habilidades_por_forma ?? {};
  const [currentForma,  setCurrentForma]  = useState(initialState?.currentForma ?? player.current_forma ?? 1);
  const [stancePicker,  setStancePicker]  = useState(false);
  const isMobile = useIsMobile();
  const { diceOverlay, rollDice, rolling } = useDiceRoller();
  const { throwHandle, armThrow, armed } = useDragToThrow();
  const [hoveredHabId, setHoveredHabId] = useState(null);

  const FORMA_LABELS_SHORT = ['Shii-Cho', 'Makashi', 'Soresu', 'Ataru', 'Shien/DjSo', 'Niman', 'Juyo/Vaapad'];

  /* Habilidades de la forma actual (del pool, sin fetch adicional) */
  const habilidades = useMemo(() => {
    const slotIds = Array.isArray(porForma[String(currentForma)]) ? porForma[String(currentForma)] : [];
    return slotIds.filter(Boolean).map(id => habPool[String(id)]).filter(Boolean);
  }, [currentForma]);

  /* Agrupa el log plano en tarjetas de ronda → tarjetas de turno (por actor consecutivo) */
  const logRounds = useMemo(() => {
    const rounds = [];
    let curRound = null;
    let curTurn = null;
    log.forEach(entry => {
      const r = entry.ronda ?? 1;
      if (!curRound || curRound.ronda !== r) {
        curRound = { ronda: r, turns: [] };
        rounds.push(curRound);
        curTurn = null;
      }
      const actor = entry.actor ?? 'system';
      if (!curTurn || curTurn.actor !== actor) {
        curTurn = { actor, entries: [] };
        curRound.turns.push(curTurn);
      }
      curTurn.entries.push(entry);
    });
    return rounds;
  }, [log]);

  /* Stats efectivos considerando buffs/debuffs */
  const countBuff       = (stat) => playerBuffs.filter(b => b.stat === stat).length;
  const countNpcBuff    = (stat) => npcBuffs.filter(b => b.stat === stat).length;
  const countNpcDeb     = (stat) => npcDebuffs.filter(d => d.stat === stat).length;
  const countPlayerDeb  = (stat) => playerDebuffs.filter(d => d.stat === stat).length;

  const effPlayerAtk = Math.max(1, player.ataque     + countBuff('ataque')     - countPlayerDeb('ataque')     + formaBono(currentForma, 'ataque'));
  const effPlayerDef = Math.max(1, player.defensa    + countBuff('defensa')    - countPlayerDeb('defensa')    + formaBono(currentForma, 'defensa'));
  const effPlayerPnt = Math.max(0, player.punteria   + countBuff('punteria')   - countPlayerDeb('punteria'));
  const effPlayerMov = Math.max(1, player.movimiento + countBuff('movimiento') - countPlayerDeb('movimiento') + formaBono(currentForma, 'movimiento'));

  const effNpcAtk = Math.max(1, npcAtk + countNpcBuff('ataque')     - countNpcDeb('ataque'));
  const effNpcDef = Math.max(1, npcDef + countNpcBuff('defensa')    - countNpcDeb('defensa'));
  const effNpcMov = Math.max(1, npcMov + countNpcBuff('movimiento') - countNpcDeb('movimiento'));
  const effNpcPnt = Math.max(0, npcPnt + countNpcBuff('punteria')   - countNpcDeb('punteria'));

  const effPlayerIni = Math.max(1, player.iniciativa + countBuff('iniciativa') - countPlayerDeb('iniciativa') + formaBono(currentForma, 'iniciativa'));
  const effNpcIni     = Math.max(1, npcIni + countNpcBuff('iniciativa') - countNpcDeb('iniciativa'));

  /* Fondo desde el lugar del NPC (no aplica a combates navales: usan fondo espacial fijo) */
  useEffect(() => {
    if (naveMode || bgImg || !npc.LugarID) return;
    const token = localStorage.getItem('nx-token');
    fetch(`/api/map/lugares/${npc.LugarID}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
      .then(r => r.json())
      .then(d => { if (d.lugar?.imagen) setBgImg(mediaUrl(d.lugar.imagen)); })
      .catch(() => {});
  }, []);

  /* Pausa (ms) entre acciones/banners del combate — configurable en Configuracion
     (combate_pausa_accion_ms). Este combate es 100% cliente (sin servidor autoritativo),
     así que se lee vía el mismo endpoint admin genérico que ya usan Personaje.jsx/Mapa.jsx
     (no requiere rol admin, solo sesión autenticada — ver AdminController). */
  const [pausaMs, setPausaMs] = useState(2000);
  useEffect(() => {
    const token = localStorage.getItem('nx-token');
    fetch('/api/admin/configuraciones?q=combate_pausa_accion_ms', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
      .then(r => r.json())
      .then(d => {
        const row = (d.data ?? d.items ?? []).find(r => r.nombre === 'combate_pausa_accion_ms');
        if (row && row.valor_numerico > 0) setPausaMs(row.valor_numerico);
      })
      .catch(() => {});
  }, []);

  /* Daño con tres componentes: dmg (normal), dmgEscudo (extra solo contra escudo)
     y dmgPerforante (ignora el escudo, siempre pasa a la vida). Sin escudo, todo
     (dmg + dmgPerforante) pasa a la vida, sin mitigar. Con escudo: dmgEscudo se
     aplica primero, sin modificar; si tras eso queda algo de escudo, el daño
     normal (dmg) se mitiga a la mitad (redondeado hacia abajo) antes de restarse
     del escudo — el sobrante de esa mitad (ya mitigado, sin volver a dividirse)
     pasa a la vida. Si dmgEscudo por sí solo agota el escudo restante, éste queda
     en 0 y el resto (dmg sin mitigar + dmgPerforante) pasa directo a la vida.
     Misma lógica que PvpCombatController::applyDamage. */
  const applyDmg = (dmg, hp, dmgEscudo = 0, dmgPerforante = 0) => {
    if (hp.escudo <= 0) {
      return { escudo: 0, vida: Math.max(0, hp.vida - dmg - dmgPerforante) };
    }
    const escudoTrasComponenteEscudo = Math.max(0, hp.escudo - Math.max(0, dmgEscudo));
    if (escudoTrasComponenteEscudo > 0) {
      const dmgMitigado = Math.floor(Math.max(0, dmg) / 2);
      const desborde = Math.max(0, dmgMitigado - escudoTrasComponenteEscudo);
      return { escudo: Math.max(0, escudoTrasComponenteEscudo - dmgMitigado), vida: Math.max(0, hp.vida - desborde - dmgPerforante) };
    }
    return { escudo: 0, vida: Math.max(0, hp.vida - dmg - dmgPerforante) };
  };

  /* Describe en texto el reparto de daño entre escudo y vida — misma lógica que applyDmg */
  const describeDano = (dmg, dmgEscudo, dmgPerforante, escudoAntes) => {
    if (escudoAntes <= 0) {
      return `−${dmg + dmgPerforante} daño a la vida`;
    }
    const escudoTrasComponenteEscudo = Math.max(0, escudoAntes - Math.max(0, dmgEscudo));
    if (escudoTrasComponenteEscudo > 0) {
      const dmgMitigado = Math.floor(Math.max(0, dmg) / 2);
      const desborde = Math.max(0, dmgMitigado - escudoTrasComponenteEscudo);
      const totalEscudo = Math.min(dmgMitigado, escudoTrasComponenteEscudo) + Math.max(0, dmgEscudo);
      let msg = `−${totalEscudo} daño al escudo`;
      if (desborde > 0) msg += `, −${desborde} daño a la vida (escudo perforado)`;
      if (dmgPerforante > 0) msg += `, −${dmgPerforante} daño perforante a la vida`;
      return msg;
    }
    const totalVida = dmg + dmgPerforante;
    return `−${Math.max(0, dmgEscudo)} daño al escudo — ¡escudo perforado! −${totalVida} daño a la vida`;
  };

  /* Secuencia de arranque — solo si es combate nuevo (no restaurado) Y el jugador ya presionó
     "Comenzar" (`started`): banner "Inicio combate" (2s) → banner "Turno 1" (2s) → banner
     "Iniciativa" (2s) → recién ahí se habilita la acción (phaseLock=false). Guarda `cancelled`:
     en desarrollo React.StrictMode invoca este efecto dos veces al montar sin llamar a nuestro
     cleanup entre medio salvo que lo devolvamos — sin esta guarda, la segunda invocación corría
     completa igual que la primera (dos tiradas de iniciativa, dos setLog pisándose entre sí). */
  useEffect(() => {
    if (initialState || !started) return;
    let cancelled = false;
    void playCombateNpc();
    const pTirada = tirarDados(); const nTirada = tirarDados();
    const pR = pTirada.total; const nR = nTirada.total;
    const pT = pR + effPlayerIni; const nT = nR + effNpcIni;
    const first = pT >= nT ? 'player' : 'npc';
    (async () => {
      setLog([{ text: '⚔ ¡COMBATE INICIADO!', type: 'system', id: 0, ronda: 1, actor: 'system' }]);
      setInicioMsg({ key: `inicio-${Date.now()}` });
      await sleep(pausaMs);
      if (cancelled) return;
      setInicioMsg(null);
      setCombatIntroDone(true); // habilita el banner "Turno N" (antes solo dependía de phase==='battle')

      await sleep(pausaMs); // banner "Turno 1" visible
      if (cancelled) return;

      setIniciativaMsg({ key: `ini-1-${Date.now()}`, texto: first === 'player' ? player.nombre : npc.nombre });
      await sleep(pausaMs); // banner "Iniciativa"
      if (cancelled) return;
      setIniciativaMsg(null);

      setLog(prev => [...prev,
        { text: `Ronda 1 — Iniciativa: Tú 2d6(${pTirada.dado1}+${pTirada.dado2})+${effPlayerIni}=${pT} | ${npc.nombre} 2d6(${nTirada.dado1}+${nTirada.dado2})+${effNpcIni}=${nT}`, type: 'info', id: prev.length, ronda: 1, actor: 'system' },
        { text: first === 'player' ? '¡Atacas primero!' : `¡${npc.nombre} actúa primero!`, type: first === 'player' ? 'success' : 'danger', id: prev.length + 1, ronda: 1, actor: 'system' },
      ]);
      setPhase('battle');
      setCurrTurn(first);
      setPhaseLock(false);
      /* Pre-recuperar fuerza si el jugador actúa primero */
      if (first === 'player') setPlayerFuerza(fuerzaPorTurno);
    })();
    return () => { cancelled = true; };
  }, [started]);

  /*
   * Termina el turno de quien actuó — decide si sigue la ronda o se tira nueva
   * iniciativa. `overrides` permite pasar el hp/estados YA actualizados por la
   * acción que se acaba de resolver (setPlayerHp/setPlayerEstados son async y
   * el closure de esta función seguiría viendo el valor previo al re-render).
   * Se invoca SIEMPRE justo después de resolver una acción (mensaje + sonido/animación +
   * actualización de valores ya hechos por el llamador) — la espera de 2s de acá es la
   * pausa de "fase de combate" antes de pasar al siguiente combatiente.
   */
  const endTurnAfter = async (actor, overrides = {}) => {
    setActionLock(true);
    estanciaTiradaRef.current = false; // termina el turno: se habilita otra tirada de estancia
    try {
    await sleep(pausaMs);
    const curPlayerHp = overrides.playerHp ?? playerHp;
    const curNpcHp = overrides.npcHp ?? npcHp;
    const curPlayerEstados = overrides.playerEstados ?? playerEstados;
    const curNpcEstados = overrides.npcEstados ?? npcEstados;

    if (rondaTurnoRef.current === 0) {
      /* Primera acción de la ronda: actúa el otro, sin nueva tirada */
      const next = actor === 'player' ? 'npc' : 'player';
      setRondaTurno(1);
      setCurrTurn(next);
      if (next === 'player') setPlayerFuerza(p => Math.min(maxFuerza, p + fuerzaPorTurno));
    } else {
      /* Ambos actuaron: termina la ronda — tick de buffs/debuffs/estados (duran N rondas) y nueva iniciativa */
      setPlayerBuffs(prev => prev.map(b => ({ ...b, turns: b.turns - 1 })).filter(b => b.turns > 0));
      setNpcBuffs(prev => prev.map(b => ({ ...b, turns: b.turns - 1 })).filter(b => b.turns > 0));
      setNpcDebuffs(prev => prev.map(d => ({ ...d, turns: d.turns - 1 })).filter(d => d.turns > 0));
      setPlayerDebuffs(prev => prev.map(d => ({ ...d, turns: d.turns - 1 })).filter(d => d.turns > 0));

      const playerTick = tickEstadosRonda(curPlayerEstados, curPlayerHp.vida, maxPlayer.vida, player.nombre);
      const npcTick = tickEstadosRonda(curNpcEstados, curNpcHp.vida, maxNpc.vida, npc.nombre);
      setPlayerEstados(playerTick.estados);
      setNpcEstados(npcTick.estados);

      const nextPlayerHp = { ...curPlayerHp, vida: playerTick.hp };
      const nextNpcHp = { ...curNpcHp, vida: npcTick.hp };
      if (nextPlayerHp.vida !== curPlayerHp.vida) setPlayerHp(nextPlayerHp);
      if (nextNpcHp.vida !== curNpcHp.vida) setNpcHp(nextNpcHp);

      const tickMsgs = [...playerTick.mensajes, ...npcTick.mensajes];
      if (tickMsgs.length > 0) {
        setLog(prev => [...prev, ...tickMsgs.map((text, i) => ({ text, type: 'info', id: prev.length + i, ronda: rondaRef.current, actor: 'system' }))]);
      }

      if (nextNpcHp.vida <= 0) {
        setLog(prev => [...prev, { text: `⚡ ¡${npc.nombre} derrotado!`, type: 'success', id: prev.length, ronda: rondaRef.current, actor: 'system' }]);
        setPhase('victory');

        return;
      }
      if (nextPlayerHp.vida <= 0) {
        setLog(prev => [...prev, { text: '☠ Has sido derrotado.', type: 'danger', id: prev.length, ronda: rondaRef.current, actor: 'system' }]);
        setPhase('defeat');

        return;
      }

      const pTirada = tirarDados(); const nTirada = tirarDados();
      const pR = pTirada.total; const nR = nTirada.total;
      const pT = pR + effPlayerIni; const nT = nR + effNpcIni;
      const first = pT >= nT ? 'player' : 'npc';
      const nuevaRonda = rondaRef.current + 1;

      setPhaseLock(true);
      setRonda(nuevaRonda); // dispara el remount del banner "Turno N" (key={ronda})
      await sleep(pausaMs); // banner "Turno N" visible

      setIniciativaMsg({ key: `ini-${nuevaRonda}-${Date.now()}`, texto: first === 'player' ? player.nombre : npc.nombre });
      await sleep(pausaMs); // banner "Iniciativa"
      setIniciativaMsg(null);

      setLog(prev => [...prev,
        { text: `Ronda ${nuevaRonda} — Iniciativa: Tú 2d6(${pTirada.dado1}+${pTirada.dado2})+${effPlayerIni}=${pT} | ${npc.nombre} 2d6(${nTirada.dado1}+${nTirada.dado2})+${effNpcIni}=${nT}`, type: 'info', id: prev.length, ronda: nuevaRonda, actor: 'system' },
        { text: first === 'player' ? '¡Actúas primero!' : `¡${npc.nombre} actúa primero!`, type: first === 'player' ? 'success' : 'danger', id: prev.length + 1, ronda: nuevaRonda, actor: 'system' },
      ]);
      setRondaTurno(0);
      setCurrTurn(first);
      setPhaseLock(false);
      if (first === 'player') setPlayerFuerza(p => Math.min(maxFuerza, p + fuerzaPorTurno));
    }
    } finally {
      setActionLock(false);
    }
  };

  /* Persistir estado en localStorage cada vez que cambia algo de batalla.
     Mapa.jsx escribe esta misma clave con campos propios (npcTipo, esEnemigoAmbush) que este
     componente no conoce — se preservan leyendo lo ya guardado antes de sobreescribir, para
     que un reload a mitad de combate no pierda si el rival era un enemigo de encuentro. */
  useEffect(() => {
    if (phase === 'initiative' || phase === 'victory' || phase === 'defeat' || phase === 'fled') return;
    let prevExtra = {};
    try {
      const raw = localStorage.getItem(NPC_COMBAT_LS);
      if (raw) {
        const { npc: _n, player: _p, lugarImagen: _li, planetaNombre: _pn, lugarNombre: _ln, planetaImagen: _pi, state: _s, ...rest } = JSON.parse(raw);
        prevExtra = rest;
      }
    } catch { /* localStorage corrupto o ausente — se ignora, se persiste solo lo propio */ }
    localStorage.setItem(NPC_COMBAT_LS, JSON.stringify({
      ...prevExtra,
      npc, player, lugarImagen, planetaNombre, lugarNombre, planetaImagen,
      state: {
        playerHp, npcHp, phase, currTurn, log, ronda, rondaTurno, playerFuerza, cooldowns,
        playerBuffs, npcBuffs, npcDebuffs, playerDebuffs, npcCooldowns, playerEstados, npcEstados, currentForma,
      },
    }));
  }, [playerHp, npcHp, phase, currTurn, log, ronda, rondaTurno, playerFuerza, cooldowns, playerBuffs, npcBuffs, npcDebuffs, playerDebuffs, npcCooldowns, playerEstados, npcEstados, currentForma]);

  /* Turno del NPC */
  useEffect(() => {
    if (currTurn !== 'npc' || phase !== 'battle' || phaseLock) return;
    setNpcBusy(true);
    let cancelled = false;
    const npcLabel = naveMode ? 'NAVE' : npc.nombre.slice(0, 8).toUpperCase();
    (async () => {
      await sleep(700);
      if (cancelled) return;

      /* Parálisis: el NPC pierde el turno automáticamente y queda inmune al próximo intento */
      const paralisisInfo = resolverParalisisAlEmpezarTurno(npcEstados);
      if (paralisisInfo.paralizado) {
        setNpcEstados(paralisisInfo.estados);
        setLog(prev => [...prev, { text: `${npc.nombre} está paralizado y pierde el turno`, type: 'info', id: prev.length, ronda, actor: 'npc' }]);
        setNpcBusy(false);
        endTurnAfter('npc', { npcEstados: paralisisInfo.estados });

        return;
      }

      /* Confundido: 50% de probabilidad de que el NPC se golpee a sí mismo en vez de atacar */
      const confundidoNpc = resolverConfundido(npcEstados);
      if (confundidoNpc) {
        setLog(prev => [...prev, { text: `¡${npc.nombre} está confundido!`, type: 'info', id: prev.length, ronda, actor: 'npc' }]);
      }

      /* Habilidad propia del enemigo (2 slots, ver npcHabilidades): 60% de probabilidad de
         usar una disponible (sin cooldown, no "self") en vez del ataque normal — mismo
         criterio que el turno automático del Jefe en Combate RAID. El cooldown se registra
         al elegirla, sin importar si el golpe conecta o no. */
      const habDisponibles = confundidoNpc ? [] : npcHabilidades.filter(h =>
        (npcCooldowns[h.id] ?? 0) <= 0 && h.objetivo !== 'self'
      );
      const hab = (habDisponibles.length > 0 && Math.random() <= 0.6)
        ? habDisponibles[Math.floor(Math.random() * habDisponibles.length)]
        : null;
      if (hab && hab.cooldown > 0) {
        setNpcCooldowns(prev => ({ ...prev, [hab.id]: hab.cooldown }));
      }

      /* El buff propio de la habilidad (si tiene uno) se aplica al enemigo mismo al usarla,
         sin importar si el golpe conecta — mismo criterio que el buff del jugador. No afecta
         la tirada de ESTE turno (los stats efectivos ya se leen más abajo con el buff previo),
         solo a partir del próximo, igual que el resto de los buffs/debuffs del combate. */
      const habBuffNpc = hab && Array.isArray(hab.buff) ? hab.buff : [];
      let npcEstadosAfterSelfBuff = npcEstados;
      if (habBuffNpc.length > 0) {
        const habBuffStatsNpc = habBuffNpc.filter(s => !esTipoEstado(s));
        const habBuffEstadosNpc = habBuffNpc.filter(esTipoEstado);
        const habRondasNpc = hab.duracion ?? 2;
        if (habBuffStatsNpc.length > 0) {
          setNpcBuffs(prev => [...prev, ...habBuffStatsNpc.map(stat => ({ stat, turns: habRondasNpc }))]);
        }
        if (habBuffEstadosNpc.length > 0) {
          npcEstadosAfterSelfBuff = habBuffEstadosNpc.reduce((acc, tipo) => aplicarEstadoDeHabilidad(acc, tipo, habRondasNpc), npcEstadosAfterSelfBuff);
          setNpcEstados(npcEstadosAfterSelfBuff);
        }
      }

      /* Leer stats efectivos ahora (closure over current state at render time) */
      const useRanged = !confundidoNpc && (hab ? hab.tipo !== 'melee' : (effNpcPnt > 0 && Math.random() > 0.5));

      /* Anuncio inmediato — antes de la animación (dados/golpe). Si el NPC está confundido,
         el mensaje de confusión de más arriba ya cubre el anuncio (el "objetivo" real es
         forzado, no una elección). */
      if (!confundidoNpc) {
        const accionLabel = hab
          ? `${npc.nombre} usa "${hab.nombre}"`
          : useRanged
            ? `${npc.nombre} dispara`
            : `${npc.nombre} ataca`;
        setLog(prev => [...prev, { text: accionLabel, type: 'info', id: prev.length, ronda, actor: 'npc' }]);
      }

      const defEstadosPrevios = confundidoNpc ? npcEstados : playerEstados;
      const aTirada = tirarDados();
      const dTirada = tirarDados();
      const aR = mitigarTiradaAturdido(npcEstados, aTirada.total);
      const dR = mitigarTiradaAturdido(defEstadosPrevios, dTirada.total);
      const atkStatVal = confundidoNpc ? effNpcAtk : (useRanged ? effNpcPnt : effNpcAtk);
      const defStatVal = confundidoNpc ? effNpcDef : (useRanged ? effPlayerMov : effPlayerDef);
      const [aT, dT] = [aR + atkStatVal, dR + defStatVal];
      const esCritico = !confundidoNpc && esCriticoNpc(aTirada.dado1, aTirada.dado2);
      const esFalloCritico = !confundidoNpc && esFalloCriticoNpc(aTirada.dado1, aTirada.dado2);

      /* Marcado/protegido del objetivo se consumen sin importar si el golpe finalmente conecta */
      let estadosObjetivo = defEstadosPrevios;
      const protegidoInfo = consumirProtegido(estadosObjetivo);
      estadosObjetivo = protegidoInfo.estados;
      const marcaInfo = consumirMarcado(estadosObjetivo, aR);
      estadosObjetivo = marcaInfo.estados;

      let hit = esCritico || aT > dT;
      if (protegidoInfo.activo) hit = false;
      else if (marcaInfo.activo) hit = marcaInfo.forzarExito;
      if (esFalloCritico) hit = false; // Doble 1 ("ojos de serpiente") siempre falla, sin importar stats, marca o protección.

      /* Deflectar (a distancia) / Contraataque (cuerpo a cuerpo): solo si el golpe iba a conectar
         y no es el NPC golpeándose a sí mismo por confusión. */
      let reflejoInfo = { activo: false, tipo: null };
      if (hit && !confundidoNpc) {
        reflejoInfo = consumirDeflectarOContraataque(estadosObjetivo, useRanged);
        estadosObjetivo = reflejoInfo.estados;
      }
      if (confundidoNpc) setNpcEstados(estadosObjetivo); else setPlayerEstados(estadosObjetivo);

      await rollDice([
        { key: 'npc', color: '#ff6b6b', label: npcLabel, values: [aTirada.dado1, aTirada.dado2] },
        { key: 'ply', color: '#38cdf0', label: 'TÚ', values: [dTirada.dado1, dTirada.dado2] },
      ]);
      if (cancelled) return;

      /* Daño: si usó habilidad, viene de esa habilidad (con bono ±1 por forma efectiva/resistente,
         igual que el jefe/jugador); si no, de dano/dano_escudo/dano_perforante del enemigo (esEnemigo)
         o, para un NPC regular sin esos campos, el viejo estimado a partir de su Ataque/Puntería. */
      const habEffective = hab ? formaEsEfectiva(hab.forma, currentForma) : false;
      const habResistant = hab ? formaEsResistente(hab.forma, currentForma) : false;
      let dmg;
      let dmgEscudo = 0;
      let dmgPerforante = 0;
      if (hab) {
        dmg = Number(hab.damage ?? 0);
        dmgEscudo = Number(hab.damage_escudo ?? 0);
        dmgPerforante = Number(hab.damage_perforante ?? 0);
        dmg = Math.max(0, dmg + formaBonoDano(hab.forma, currentForma));
      } else if (esEnemigo) {
        dmg = Number(npc.dano ?? 0);
        dmgEscudo = Number(npc.dano_escudo ?? 0);
        dmgPerforante = Number(npc.dano_perforante ?? 0);
      } else {
        dmg = (confundidoNpc ? effNpcAtk : (useRanged ? effNpcPnt : effNpcAtk)) + npcDanoNivel;
      }
      // Golpe crítico de cualquier enemigo (jefe, encuentro común, o vía habilidad): +1 de daño plano.
      if (esCritico) dmg += npcCritBonus;
      const dmgBase = mitigarDanoDebilitado(npcEstados, dmg);
      await triggerStrike({ playerIsAttacker: false, ranged: useRanged, hit: hit && !reflejoInfo.activo, crit: esCritico, effective: habEffective, resistant: habResistant, dmg: dmgBase });

      const rollDesc = confundidoNpc
        ? `${npc.nombre} se ataca a sí mismo: 2d6(${aTirada.dado1}+${aTirada.dado2})+${atkStatVal}=${aT} vs 2d6(${dTirada.dado1}+${dTirada.dado2})+${defStatVal}=${dT}`
        : `2d6(${aTirada.dado1}+${aTirada.dado2})+${atkStatVal}=${aT} vs 2d6(${dTirada.dado1}+${dTirada.dado2})+${defStatVal}=${dT}`;
      let entries = confundidoNpc
        ? [{ text: rollDesc, type: 'info', diceColors: ['#ff6b6b'] }]
        : [
          { text: rollDesc, type: 'info', diceColors: ['#ff6b6b'] },
          { text: useRanged ? `Esquivas: 2d6(${dTirada.dado1}+${dTirada.dado2})+${effPlayerMov}=${dT}` : `Defiendes: 2d6(${dTirada.dado1}+${dTirada.dado2})+${effPlayerDef}=${dT}`, type: 'info', diceColors: ['#38cdf0'] },
        ];
      if (hab && habEffective && hit) {
        entries.push({ text: `¡Forma efectiva! +1 daño (Forma ${formaLabel(hab.forma)} vs Forma ${formaLabel(currentForma)})`, type: 'danger' });
      } else if (hab && habResistant && hit) {
        entries.push({ text: `Resistencia de forma −1 daño (Forma ${formaLabel(hab.forma)} vs Forma ${formaLabel(currentForma)})`, type: 'success' });
      }

      /* Estados finales del jugador tras esta acción — arranca en `estadosObjetivo` (ya incluye
         el consumo de marcado/protegido de más arriba) y se le suman los estados de la
         habilidad del enemigo, si corresponde. Se usa una única variable (en vez de un segundo
         setPlayerEstados por separado) para que tanto el setState final como el override que
         recibe endTurnAfter() queden consistentes — de lo contrario, el setPlayerEstados(...)
         del cierre de ronda más abajo pisaría el estado recién aplicado aquí. */
      let finalPlayerEstados = estadosObjetivo;

      let newHp;
      let newNpcHpReflejo = null;
      if (confundidoNpc) {
        newHp = hit ? applyDmg(dmgBase, npcHp) : { ...npcHp };
        entries.push(hit
          ? { text: `¡Se golpea a sí mismo! −${dmgBase} daño`, type: 'danger' }
          : { text: 'Falla el golpe contra sí mismo', type: 'info' });
      } else if (hit && reflejoInfo.activo) {
        const [mitadDmg, mitadEsc, mitadPerf] = mitadDano(dmgBase, dmgEscudo, dmgPerforante);
        newHp = { ...playerHp };
        newNpcHpReflejo = applyDmg(mitadDmg, npcHp, mitadEsc, mitadPerf);
        const verbo = reflejoInfo.tipo === 'deflectar' ? 'Deflectas' : 'Contraatacas';
        entries.push({ text: `¡${verbo} el ataque de ${npc.nombre}! −${mitadDmg + mitadEsc + mitadPerf} daño de vuelta`, type: 'success' });
      } else {
        newHp = hit ? applyDmg(dmgBase, playerHp, dmgEscudo, dmgPerforante) : { ...playerHp };
        entries.push(hit
          ? { text: esCritico ? `¡CRÍTICO! −${dmgBase} daño` : `¡${useRanged ? 'Te impactan' : 'Golpe'}! −${dmgBase} daño`, type: 'danger' }
          : { text: useRanged ? '¡Esquivas!' : 'Bloqueas el ataque', type: 'success' });
      }

      /* Los debuffs/estados de la habilidad del NPC caen sobre el jugador conecte o no el golpe
         (mismo criterio que el buff propio, y que el debuff de las habilidades del jugador) —
         incluye el caso de deflectar/contraataque. Se salta si el NPC confundido se golpeó a sí
         mismo: ahí el jugador nunca fue el objetivo. */
      if (hab && !confundidoNpc) {
        const habDebuff = Array.isArray(hab.debuff) ? hab.debuff : [];
        const habDebuffStats = habDebuff.filter(s => !esTipoEstado(s));
        const habDebuffEstados = habDebuff.filter(esTipoEstado);
        const habRondas = hab.duracion ?? 2;
        if (habDebuffStats.length > 0) {
          setPlayerDebuffs(prev => [...prev, ...habDebuffStats.map(stat => ({ stat, turns: habRondas }))]);
          entries.push({ text: `${player.nombre}: ${habDebuffStats.map(s => `−1 ${s}`).join(', ')} (${habRondas} ronda${habRondas === 1 ? '' : 's'})`, type: 'info' });
        }
        if (habDebuffEstados.length > 0) {
          finalPlayerEstados = habDebuffEstados.reduce((acc, tipo) => aplicarEstadoDeHabilidad(acc, tipo, habRondas), finalPlayerEstados);
          entries.push({ text: `${player.nombre}: ${habDebuffEstados.map(t => ESTADO_LABEL[t] ?? t).join(', ')}`, type: 'info' });
        }
      }
      entries = entries.map(e => ({ ...e, ronda, actor: 'npc' }));

      setLog(prev => [...prev, ...entries.map((e, i) => ({ ...e, id: prev.length + i }))]);
      if (confundidoNpc) setNpcHp(newHp); else setPlayerHp(newHp);
      if (newNpcHpReflejo) setNpcHp(newNpcHpReflejo);
      if (!confundidoNpc && finalPlayerEstados !== estadosObjetivo) setPlayerEstados(finalPlayerEstados);

      /* Al fin del turno NPC: decrementar cooldowns propios y del enemigo (los buffs/debuffs/
         estados se tickean por ronda en endTurnAfter) */
      setCooldowns(prev => Object.fromEntries(
        Object.entries(prev).filter(([, v]) => v > 1).map(([k, v]) => [k, v - 1])
      ));
      setNpcCooldowns(prev => Object.fromEntries(
        Object.entries(prev).filter(([, v]) => v > 1).map(([k, v]) => [k, v - 1])
      ));

      setNpcBusy(false);
      if (confundidoNpc && newHp.vida <= 0) {
        setLog(prev => [...prev, { text: `⚡ ¡${npc.nombre} derrotado!`, type: 'success', id: prev.length, ronda, actor: 'system' }]);
        setPhase('victory');
      } else if (newNpcHpReflejo && newNpcHpReflejo.vida <= 0) {
        setLog(prev => [...prev, { text: `⚡ ¡${npc.nombre} derrotado por el contragolpe!`, type: 'success', id: prev.length, ronda, actor: 'system' }]);
        setPhase('victory');
      } else if (!confundidoNpc && newHp.vida <= 0) {
        setLog(prev => [...prev, { text: '☠ Has sido derrotado.', type: 'danger', id: prev.length, ronda, actor: 'system' }]);
        setPhase('defeat');
      } else {
        endTurnAfter('npc', confundidoNpc
          ? { npcHp: newHp, npcEstados: estadosObjetivo }
          : { playerHp: newHp, playerEstados: finalPlayerEstados, npcEstados: npcEstadosAfterSelfBuff, ...(newNpcHpReflejo ? { npcHp: newNpcHpReflejo } : {}) });
      }
    })();
    return () => { cancelled = true; };
  }, [currTurn, phase, ronda, phaseLock]);

  /* Parálisis del jugador: pierde el turno automáticamente sin necesidad de que elija una acción */
  useEffect(() => {
    if (currTurn !== 'player' || phase !== 'battle' || phaseLock) return;
    if (!tieneEstado(playerEstados, 'paralizado')) return;
    let cancelled = false;
    (async () => {
      await sleep(500);
      if (cancelled) return;
      const info = resolverParalisisAlEmpezarTurno(playerEstados);
      setPlayerEstados(info.estados);
      setLog(prev => [...prev, { text: `${player.nombre} está paralizado y pierde el turno`, type: 'danger', id: prev.length, ronda, actor: 'player' }]);
      endTurnAfter('player', { playerEstados: info.estados });
    })();
    return () => { cancelled = true; };
  }, [currTurn, phase, ronda, phaseLock]);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log]);

  /* Ejecutar habilidad del jugador */
  const doPlayerSkill = async (hab) => {
    if (phase !== 'battle' || currTurn !== 'player' || npcBusy || rolling || armed || actionLock) return;
    const habId = String(hab.id);
    if ((cooldowns[habId] ?? 0) > 0) return;
    if (playerFuerza < hab.costo_fuerza) return;
    setActionLock(true);

    const habBuff   = Array.isArray(hab.buff)   ? hab.buff   : [];
    const habDebuff = Array.isArray(hab.debuff) ? hab.debuff : [];
    const habRondas = hab.duracion ?? 2;

    /* Gastar fuerza */
    setPlayerFuerza(prev => prev - hab.costo_fuerza);

    /* Registrar cooldown */
    if (hab.cooldown > 0) {
      setCooldowns(prev => ({ ...prev, [habId]: hab.cooldown }));
    }

    const habBuffStats = habBuff.filter(s => !esTipoEstado(s));
    const habBuffEstados = habBuff.filter(esTipoEstado);
    const pendingBuffs = habBuffStats.length > 0 ? habBuffStats.map(stat => ({ stat, turns: habRondas })) : [];

    const entries = [];

    /* ─── Habilidad de auto-buff / auto-curación (objetivo: self) ── */
    if (hab.objetivo === 'self') {
      /* Anuncio inmediato — antes de la animación de FX (buff/curación) */
      setLog(prev => [...prev, { text: `${player.nombre} usa "${hab.nombre}"`, type: 'info', id: prev.length, ronda, actor: 'player' }]);

      if (habBuffStats.length > 0) {
        entries.push({ text: `${player.nombre}: ${habBuffStats.map(s => `+1 ${s}`).join(', ')}`, type: 'info' });
      }
      if (habBuffEstados.length > 0) {
        entries.push({ text: `${player.nombre}: ${habBuffEstados.map(t => ESTADO_LABEL[t] ?? t).join(', ')}`, type: 'info' });
      }

      const selfDmg = hab.damage ?? 0;
      const selfDmgEscudo = hab.damage_escudo ?? 0;
      let healedHp = { ...playerHp };
      let heal = 0;
      let healEsc = 0;
      if (selfDmg < 0) {
        heal = -selfDmg;
        healedHp.vida = Math.min(maxPlayer.vida, healedHp.vida + heal);
        entries.push({ text: `¡Curación! +${heal} vida`, type: 'success' });
      }
      if (selfDmgEscudo < 0) {
        healEsc = -selfDmgEscudo;
        healedHp.escudo = Math.min(maxPlayer.escudo, healedHp.escudo + healEsc);
        entries.push({ text: `¡Curación! +${healEsc} escudo`, type: 'success' });
      }

      let selfEstados = playerEstados;
      habBuffEstados.forEach(tipo => { selfEstados = aplicarEstadoDeHabilidad(selfEstados, tipo, habRondas); });

      /* Una habilidad "self" no tiene tirada de ataque — si además carga un debuff (p.ej.
       * un estado) para el enemigo, se aplica sin condición de impacto, igual que en PvP/RAID. */
      const habDebuffStats = habDebuff.filter(s => !esTipoEstado(s));
      const habDebuffEstados = habDebuff.filter(esTipoEstado);
      let npcEstadosFinal = npcEstados;
      if (habDebuffStats.length > 0) {
        setNpcDebuffs(prev => [...prev, ...habDebuffStats.map(stat => ({ stat, turns: habRondas }))]);
        entries.push({ text: `${npc.nombre}: ${habDebuffStats.map(s => `−1 ${s}`).join(', ')} (${habRondas} ronda${habRondas === 1 ? '' : 's'})`, type: 'info' });
      }
      if (habDebuffEstados.length > 0) {
        npcEstadosFinal = habDebuffEstados.reduce((acc, tipo) => aplicarEstadoDeHabilidad(acc, tipo, habRondas), npcEstadosFinal);
        entries.push({ text: `${npc.nombre}: ${habDebuffEstados.map(t => ESTADO_LABEL[t] ?? t).join(', ')}`, type: 'info' });
      }

      if (pendingBuffs.length > 0) {
        await playStatusFx(playerHudRef, 'buff');
        setPlayerBuffs(prev => [...prev, ...pendingBuffs]);
      }
      if (selfDmg < 0 || selfDmgEscudo < 0) {
        await playStatusFx(playerHudRef, 'heal');
        if (selfDmg < 0) showFloatText(playerHudRef, { variant: 'heal', text: `Curación: ${heal}` });
        if (selfDmgEscudo < 0) showFloatText(playerHudRef, { variant: 'heal', text: `Curación: ${healEsc}` });
        setPlayerHp(healedHp);
      }
      setPlayerEstados(selfEstados);
      if (npcEstadosFinal !== npcEstados) setNpcEstados(npcEstadosFinal);

      setLog(prev => [...prev, ...entries.map((e, i) => ({ ...e, id: prev.length + i, ronda, actor: 'player' }))]);
      endTurnAfter('player', { playerHp: healedHp, playerEstados: selfEstados, npcEstados: npcEstadosFinal });
      return;
    }

    /* ─── Habilidad de curación a distancia (objetivo: target, damage < 0) ─ */
    const targetDmg = hab.damage ?? 0;
    if (hab.objetivo === 'target' && targetDmg < 0) {
      /* Anuncio inmediato — antes de la animación de FX (curación) */
      setLog(prev => [...prev, { text: `${player.nombre} usa "${hab.nombre}"`, type: 'info', id: prev.length, ronda, actor: 'player' }]);

      const heal = -targetDmg;
      const newNpcHp = { ...npcHp, vida: Math.min(maxNpc.vida, npcHp.vida + heal) };
      entries.push({
        text: `Cura +${heal} vida a ${naveMode ? 'la nave enemiga' : npc.nombre}`,
        type: 'info',
      });
      let selfEstados = playerEstados;
      habBuffEstados.forEach(tipo => { selfEstados = aplicarEstadoDeHabilidad(selfEstados, tipo, habRondas); });
      if (pendingBuffs.length > 0) {
        await playStatusFx(playerHudRef, 'buff');
        setPlayerBuffs(prev => [...prev, ...pendingBuffs]);
      }
      setPlayerEstados(selfEstados);
      await playStatusFx(npcHudRef, 'heal');
      showFloatText(npcHudRef, { variant: 'heal', text: `Curación: ${heal}` });
      setLog(prev => [...prev, ...entries.map((e, i) => ({ ...e, id: prev.length + i, ronda, actor: 'player' }))]);
      setNpcHp(newNpcHp);
      endTurnAfter('player', { npcHp: newNpcHp, playerEstados: selfEstados });
      return;
    }

    /* ─── Habilidad de ataque ───────────────────────────────────── */
    const confundidoHab = resolverConfundido(playerEstados);
    const useAtq  = hab.tipo === 'melee';
    const atkVal  = useAtq ? effPlayerAtk : effPlayerPnt;
    const defVal  = confundidoHab ? (useAtq ? effPlayerDef : effPlayerMov) : (useAtq ? effNpcDef : effNpcMov);

    /* Anuncio inmediato — antes de la animación (dados/golpe) */
    const announceHab = [];
    if (confundidoHab) announceHab.push({ text: `¡${player.nombre} está confundido y ataca hacia sí mismo!`, type: 'info' });
    announceHab.push({ text: `${player.nombre} usa "${hab.nombre}"`, type: 'info' });
    setLog(prev => [...prev, ...announceHab.map((e, i) => ({ ...e, id: prev.length + i, ronda, actor: 'player' }))]);

    await armThrow(playerAvatarRef.current);

    const aTirada = tirarDados();
    const dTirada = tirarDados();
    const aR = mitigarTiradaAturdido(playerEstados, aTirada.total);
    const dR = mitigarTiradaAturdido(confundidoHab ? playerEstados : npcEstados, dTirada.total);
    const [aT, dT] = [aR + atkVal, dR + defVal];

    await rollDice([
      { key: 'ply', color: '#38cdf0', label: 'TÚ', values: [aTirada.dado1, aTirada.dado2] },
      { key: 'npc', color: '#ff6b6b', label: naveMode ? 'NAVE' : npc.nombre.slice(0, 8).toUpperCase(), values: [dTirada.dado1, dTirada.dado2] },
    ]);

    entries.push({
      text: `2d6(${aTirada.dado1}+${aTirada.dado2})+${atkVal}=${aT} vs 2d6(${dTirada.dado1}+${dTirada.dado2})+${defVal}=${dT}`,
      type: 'info',
    });

    let estadosObjetivoHab = confundidoHab ? playerEstados : npcEstados;
    const protegidoHab = consumirProtegido(estadosObjetivoHab);
    estadosObjetivoHab = protegidoHab.estados;
    const marcaHab = consumirMarcado(estadosObjetivoHab, aR);
    estadosObjetivoHab = marcaHab.estados;

    let hit = aT > dT;
    if (protegidoHab.activo) {
      hit = false;
      entries.push({ text: '¡El objetivo estaba protegido y bloquea el golpe automáticamente!', type: 'info' });
    } else if (marcaHab.activo) {
      hit = marcaHab.forzarExito;
      entries.push({
        text: hit ? '¡El objetivo estaba marcado — el golpe conecta automáticamente!' : '¡El objetivo estaba marcado, pero el ataque falla igual (natural 1)!',
        type: 'info',
      });
    }

    let reflejoHab = { activo: false, tipo: null };
    if (hit && !confundidoHab) {
      reflejoHab = consumirDeflectarOContraataque(estadosObjetivoHab, !useAtq);
      estadosObjetivoHab = reflejoHab.estados;
    }
    let playerEstadosFinal = confundidoHab ? estadosObjetivoHab : playerEstados;
    let npcEstadosFinal = confundidoHab ? npcEstados : estadosObjetivoHab;
    const reflejaHaciaJugador = confundidoHab || reflejoHab.activo;

    const habDebuffStats = habDebuff.filter(s => !esTipoEstado(s));
    const habDebuffEstados = habDebuff.filter(esTipoEstado);

    let newNpcHp = { ...npcHp };
    let newPlayerHpSelf = { ...playerHp };
    let dmgAplicado = 0;
    let effective = false;
    let resistant = false;
    if (hit) {
      let dmg = hab.damage ?? (useAtq ? effPlayerAtk : effPlayerPnt);
      let dmgEscudo = hab.damage_escudo ?? 0;
      let dmgPerforante = hab.damage_perforante ?? 0;
      effective = !confundidoHab && formaEsEfectiva(hab.forma, npc.forma ?? 0);
      resistant = !confundidoHab && formaEsResistente(hab.forma, npc.forma ?? 0);
      if (!confundidoHab) {
        dmg = Math.max(0, dmg + formaBonoDano(hab.forma, npc.forma ?? 0));
        if (effective) {
          entries.push({ text: `¡Forma efectiva! +1 daño (Forma ${formaLabel(hab.forma)} vs Forma ${formaLabel(npc.forma)})`, type: 'success' });
        } else if (resistant) {
          entries.push({ text: `Resistencia de forma −1 daño (Forma ${formaLabel(hab.forma)} vs Forma ${formaLabel(npc.forma)})`, type: 'danger' });
        }
      }
      dmg += formaBono(currentForma, 'dano');
      dmgEscudo += formaBono(currentForma, 'dano_escudo');
      dmgPerforante += formaBono(currentForma, 'dano_perforante');
      dmg = mitigarDanoDebilitado(playerEstados, dmg);

      if (reflejoHab.activo) {
        const [mitadDmg, mitadEsc, mitadPerf] = mitadDano(dmg, dmgEscudo, dmgPerforante);
        dmgAplicado = mitadDmg + mitadPerf + (playerHp.escudo > 0 ? Math.max(0, mitadEsc) : 0);
        const descDano = describeDano(mitadDmg, mitadEsc, mitadPerf, playerHp.escudo);
        newPlayerHpSelf = applyDmg(mitadDmg, playerHp, mitadEsc, mitadPerf);
        const verbo = reflejoHab.tipo === 'deflectar' ? 'deflecta' : 'contraataca';
        entries.push({ text: `¡${npc.nombre} ${verbo} tu ataque! ${descDano}`, type: 'danger' });
      } else if (confundidoHab) {
        dmgAplicado = dmg + dmgPerforante + (playerHp.escudo > 0 ? Math.max(0, dmgEscudo) : 0);
        const descDano = describeDano(dmg, dmgEscudo, dmgPerforante, playerHp.escudo);
        newPlayerHpSelf = applyDmg(dmg, playerHp, dmgEscudo, dmgPerforante);
        entries.push({ text: `¡Impacto! ${descDano}`, type: 'success' });
      } else {
        dmgAplicado = dmg + dmgPerforante + (npcHp.escudo > 0 ? Math.max(0, dmgEscudo) : 0);
        const descDano = describeDano(dmg, dmgEscudo, dmgPerforante, npcHp.escudo);
        newNpcHp = applyDmg(dmg, npcHp, dmgEscudo, dmgPerforante);
        entries.push({ text: `¡Impacto! ${descDano}`, type: 'success' });
      }
    } else {
      entries.push({ text: 'Bloqueado / Falla', type: 'miss' });
    }

    /* Los debuffs/estados de la habilidad caen sobre el NPC conecte o no el golpe (mismo criterio
       que el buff propio) — la tirada decide el daño, no el efecto. Solo se saltan si la confusión
       redirigió el ataque contra uno mismo: ahí el NPC nunca fue el objetivo real. */
    if (!confundidoHab) {
      if (habDebuffStats.length > 0) {
        entries.push({ text: `${npc.nombre}: ${habDebuffStats.map(s => `−1 ${s}`).join(', ')} (${habRondas} ronda${habRondas === 1 ? '' : 's'})`, type: 'info' });
      }
      if (habDebuffEstados.length > 0) {
        entries.push({ text: `${npc.nombre}: ${habDebuffEstados.map(t => ESTADO_LABEL[t] ?? t).join(', ')}`, type: 'info' });
      }
    }

    await triggerStrike({ playerIsAttacker: true, ranged: !useAtq, hit: hit && !reflejoHab.activo, effective, resistant, dmg: dmgAplicado });

    if (pendingBuffs.length > 0) {
      await playStatusFx(playerHudRef, 'buff');
      setPlayerBuffs(prev => [...prev, ...pendingBuffs]);
    }
    habBuffEstados.forEach(tipo => { playerEstadosFinal = aplicarEstadoDeHabilidad(playerEstadosFinal, tipo, habRondas); });
    if (!confundidoHab) {
      if (habDebuffStats.length > 0) {
        setNpcDebuffs(prev => [...prev, ...habDebuffStats.map(stat => ({ stat, turns: habRondas }))]);
      }
      habDebuffEstados.forEach(tipo => { npcEstadosFinal = aplicarEstadoDeHabilidad(npcEstadosFinal, tipo, habRondas); });
    }
    setPlayerEstados(playerEstadosFinal);
    setNpcEstados(npcEstadosFinal);

    setLog(prev => [...prev, ...entries.map((e, i) => ({ ...e, id: prev.length + i, ronda, actor: 'player' }))]);
    if (reflejaHaciaJugador) {
      setPlayerHp(newPlayerHpSelf);
    } else {
      setNpcHp(newNpcHp);
    }

    if (!reflejaHaciaJugador && newNpcHp.vida <= 0) {
      setLog(prev => [...prev, { text: `⚡ ¡${npc.nombre} derrotado!`, type: 'success', id: prev.length, ronda, actor: 'system' }]);
      setPhase('victory');
    } else if (reflejaHaciaJugador && newPlayerHpSelf.vida <= 0) {
      setLog(prev => [...prev, { text: '☠ Has sido derrotado.', type: 'danger', id: prev.length, ronda, actor: 'system' }]);
      setPhase('defeat');
    } else {
      endTurnAfter('player', {
        npcHp: reflejaHaciaJugador ? npcHp : newNpcHp,
        playerHp: reflejaHaciaJugador ? newPlayerHpSelf : playerHp,
        playerEstados: playerEstadosFinal,
        npcEstados: npcEstadosFinal,
      });
    }
  };

  /* Intento de huida: requiere ganar tirada de iniciativa contra el rival */
  const doPlayerFlee = async () => {
    if (phase !== 'battle' || currTurn !== 'player' || npcBusy || rolling || armed || actionLock) return;
    setActionLock(true);

    /* Anuncio inmediato — antes de la tirada/animación */
    setLog(prev => [...prev, { text: `${player.nombre} intenta huir`, type: 'info', id: prev.length, ronda, actor: 'player' }]);

    const npcLabel = naveMode ? 'NAVE' : npc.nombre.slice(0, 8).toUpperCase();
    const pTirada = tirarDados();
    const nTirada = tirarDados();
    const pR = mitigarTiradaAturdido(playerEstados, pTirada.total);
    const nR = mitigarTiradaAturdido(npcEstados, nTirada.total);
    const [pT, nT] = [pR + effPlayerIni, nR + effNpcIni];
    const success = pT >= nT;

    await rollDice([
      { key: 'p-flee', color: '#38cdf0', label: 'TÚ', values: [pTirada.dado1, pTirada.dado2] },
      { key: 'n-flee', color: '#ff6b6b', label: npcLabel, values: [nTirada.dado1, nTirada.dado2] },
    ]);

    const entries = [{
      text: `2d6(${pTirada.dado1}+${pTirada.dado2})+${effPlayerIni}=${pT} vs 2d6(${nTirada.dado1}+${nTirada.dado2})+${effNpcIni}=${nT}`,
      type: 'info',
    }];
    entries.push(success
      ? { text: '¡Logras escapar del combate!', type: 'success' }
      : { text: 'No logras huir y pierdes el turno', type: 'danger' });

    setLog(prev => [...prev, ...entries.map((e, i) => ({ ...e, id: prev.length + i, ronda, actor: 'player' }))]);

    if (success) {
      localStorage.removeItem(NPC_COMBAT_LS);
      setPhase('fled');
      onFlee?.(playerHp);
    } else {
      endTurnAfter('player');
    }
  };

  /**
   * Usa un objeto tipo 'utilizable' (Kit Médico, Generador de Escudo) del inventario:
   * consume el turno igual que cualquier otra acción. El servidor (onUsarObjeto) solo
   * valida y descuenta el inventario -no conoce el daño recibido EN este combate, que es
   * 100% cliente-side-, así que la curación se aplica acá con cura_vida/cura_escudo del
   * propio objeto; el HP final de este combate recién se sincroniza al terminar (onVictory/
   * onDefeat/onFlee ya persisten playerHp completo, sobreescribiendo cualquier valor
   * intermedio que haya dejado este uso).
   */
  const doUsarObjeto = async (objeto) => {
    if (phase !== 'battle' || currTurn !== 'player' || npcBusy || rolling || armed || actionLock || usingObjeto || !onUsarObjeto) return;
    setActionLock(true);
    setUsingObjeto(true);
    /* Anuncio inmediato — antes de la validación del servidor y la animación de FX */
    setLog(prev => [...prev, { text: `${player.nombre} usa ${objeto.nombre}`, type: 'info', id: prev.length, ronda, actor: 'player' }]);
    try {
      await onUsarObjeto(objeto.id);
      const newHp = {
        vida: Math.min(maxPlayer.vida, playerHp.vida + (objeto.cura_vida ?? 0)),
        escudo: Math.min(maxPlayer.escudo, playerHp.escudo + (objeto.cura_escudo ?? 0)),
      };
      setObjetoPicker(false);
      await playStatusFx(playerHudRef, 'heal');
      if (objeto.cura_vida) showFloatText(playerHudRef, { variant: 'heal', text: `Curación: ${objeto.cura_vida}` });
      if (objeto.cura_escudo) showFloatText(playerHudRef, { variant: 'heal', text: `+${objeto.cura_escudo} escudo` });
      setLog(prev => [...prev, {
        text: '¡Curación aplicada!', type: 'success', id: prev.length, ronda, actor: 'player',
      }]);
      setPlayerHp(newHp);
      endTurnAfter('player', { playerHp: newHp });
    } catch (e) {
      setLog(prev => [...prev, {
        text: e?.message || 'No se pudo usar el objeto.', type: 'danger', id: prev.length, ronda, actor: 'player',
      }]);
      setActionLock(false);
    } finally {
      setUsingObjeto(false);
    }
  };

  /* Evadir (solo naval): +1 Maniobra (defensa+movimiento) y +1 Iniciativa por 3 rondas —
     sirve para naves sin habilidades o para no quedar sin nada que hacer en el turno. */
  const doPlayerEvadir = () => {
    if (phase !== 'battle' || currTurn !== 'player' || npcBusy || rolling || armed || actionLock || !naveMode) return;

    setPlayerBuffs(prev => [...prev, ...['defensa', 'movimiento', 'iniciativa'].map(stat => ({ stat, turns: 3 }))]);
    setLog(prev => [...prev, {
      text: `${player.nombre} evade: +1 Maniobra y +1 Iniciativa (3 rondas)`,
      type: 'info', id: prev.length, ronda, actor: 'player',
    }]);
    endTurnAfter('player');
  };

  /* Ataque básico: arma equipada o desarmado */
  const doPlayerBasicAttack = async () => {
    if (phase !== 'battle' || currTurn !== 'player' || npcBusy || rolling || armed || actionLock) return;
    setActionLock(true);

    const confundido = resolverConfundido(playerEstados);
    const arma        = player.arma_equipada;
    const esDistancia = arma?.tipo_ataque === 'distancia';
    const atkVal       = esDistancia ? effPlayerPnt : effPlayerAtk;
    const defVal       = confundido
      ? (esDistancia ? effPlayerMov : effPlayerDef)
      : (esDistancia ? effNpcMov : effNpcDef);
    const accion = arma ? `ataca con ${arma.nombre}` : 'ataca desarmado';

    /* Anuncio inmediato — antes de cualquier animación (dados/golpe) */
    const announce = [];
    if (confundido) announce.push({ text: `¡${player.nombre} está confundido y ataca hacia sí mismo!`, type: 'info' });
    announce.push({ text: `${player.nombre} ${accion}`, type: 'info' });
    setLog(prev => [...prev, ...announce.map((e, i) => ({ ...e, id: prev.length + i, ronda, actor: 'player' }))]);

    const entries = [];

    await armThrow(playerAvatarRef.current);

    const aTirada = tirarDados();
    const dTirada = tirarDados();
    const aR = mitigarTiradaAturdido(playerEstados, aTirada.total);
    const dR = mitigarTiradaAturdido(confundido ? playerEstados : npcEstados, dTirada.total);
    const [aT, dT] = [aR + atkVal, dR + defVal];
    const critico   = arma?.critico ?? 0;
    const esCritico = !confundido && aR >= (12 - critico);

    await rollDice([
      { key: 'ply', color: '#38cdf0', label: 'TÚ', values: [aTirada.dado1, aTirada.dado2] },
      { key: 'npc', color: '#ff6b6b', label: naveMode ? 'NAVE' : npc.nombre.slice(0, 8).toUpperCase(), values: [dTirada.dado1, dTirada.dado2] },
    ]);

    entries.push({
      text: `2d6(${aTirada.dado1}+${aTirada.dado2})+${atkVal}=${aT} vs 2d6(${dTirada.dado1}+${dTirada.dado2})+${defVal}=${dT}`,
      type: 'info',
    });

    let estadosObjetivo = confundido ? playerEstados : npcEstados;
    const protegidoInfo = consumirProtegido(estadosObjetivo);
    estadosObjetivo = protegidoInfo.estados;
    const marcaInfo = consumirMarcado(estadosObjetivo, aR);
    estadosObjetivo = marcaInfo.estados;

    let hit = esCritico || aT > dT;
    if (protegidoInfo.activo) {
      hit = false;
      entries.push({ text: '¡El objetivo estaba protegido y bloquea el golpe automáticamente!', type: 'info' });
    } else if (marcaInfo.activo) {
      hit = marcaInfo.forzarExito;
      entries.push({
        text: hit ? '¡El objetivo estaba marcado — el golpe conecta automáticamente!' : '¡El objetivo estaba marcado, pero el ataque falla igual (natural 1)!',
        type: 'info',
      });
    }

    let reflejoInfo = { activo: false, tipo: null };
    if (hit && !confundido) {
      reflejoInfo = consumirDeflectarOContraataque(estadosObjetivo, esDistancia);
      estadosObjetivo = reflejoInfo.estados;
    }
    const playerEstadosFinal = confundido ? estadosObjetivo : playerEstados;
    const npcEstadosFinal = confundido ? npcEstados : estadosObjetivo;
    const reflejaHaciaJugador = confundido || reflejoInfo.activo;

    let newNpcHp = { ...npcHp };
    let newPlayerHpSelf = { ...playerHp };
    let dmgTotal = 0;
    if (hit) {
      const dmg = mitigarDanoDebilitado(playerEstados, (arma?.dano ?? 3) + (esCritico ? 1 : 0) + formaBono(currentForma, 'dano'));
      const dmgEscudo = formaBono(currentForma, 'dano_escudo');
      const dmgPerforante = (arma?.dano_perforante ?? 0) + formaBono(currentForma, 'dano_perforante');
      dmgTotal = dmg + dmgEscudo + dmgPerforante;
      if (reflejoInfo.activo) {
        const [mitadDmg, mitadEsc, mitadPerf] = mitadDano(dmg, dmgEscudo, dmgPerforante);
        const descDano = describeDano(mitadDmg, mitadEsc, mitadPerf, playerHp.escudo);
        newPlayerHpSelf = applyDmg(mitadDmg, playerHp, mitadEsc, mitadPerf);
        dmgTotal = mitadDmg + mitadEsc + mitadPerf;
        const verbo = reflejoInfo.tipo === 'deflectar' ? 'deflecta' : 'contraataca';
        entries.push({ text: `¡${npc.nombre} ${verbo} tu ataque! ${descDano}`, type: 'danger' });
      } else if (confundido) {
        const descDano = describeDano(dmg, dmgEscudo, dmgPerforante, playerHp.escudo);
        newPlayerHpSelf = applyDmg(dmg, playerHp, dmgEscudo, dmgPerforante);
        entries.push({ text: `¡Impacto! ${descDano}`, type: 'success' });
      } else {
        const descDano = describeDano(dmg, dmgEscudo, dmgPerforante, npcHp.escudo);
        newNpcHp = applyDmg(dmg, npcHp, dmgEscudo, dmgPerforante);
        entries.push({ text: esCritico ? `¡CRÍTICO! (natural ${aR}) ${descDano}` : `¡Impacto! ${descDano}`, type: 'success' });
      }
    } else {
      entries.push({ text: 'Bloqueado / Falla', type: 'miss' });
    }

    await triggerStrike({ playerIsAttacker: true, ranged: esDistancia, hit: hit && !reflejoInfo.activo, crit: esCritico, dmg: dmgTotal });

    setPlayerEstados(playerEstadosFinal);
    setNpcEstados(npcEstadosFinal);
    setLog(prev => [...prev, ...entries.map((e, i) => ({ ...e, id: prev.length + i, ronda, actor: 'player' }))]);
    if (reflejaHaciaJugador) {
      setPlayerHp(newPlayerHpSelf);
    } else {
      setNpcHp(newNpcHp);
    }

    if (!reflejaHaciaJugador && newNpcHp.vida <= 0) {
      setLog(prev => [...prev, { text: `⚡ ¡${npc.nombre} derrotado!`, type: 'success', id: prev.length, ronda, actor: 'system' }]);
      setPhase('victory');
    } else if (reflejaHaciaJugador && newPlayerHpSelf.vida <= 0) {
      setLog(prev => [...prev, { text: '☠ Has sido derrotado.', type: 'danger', id: prev.length, ronda, actor: 'system' }]);
      setPhase('defeat');
    } else {
      endTurnAfter('player', {
        npcHp: reflejaHaciaJugador ? npcHp : newNpcHp,
        playerHp: reflejaHaciaJugador ? newPlayerHpSelf : playerHp,
        playerEstados: playerEstadosFinal,
        npcEstados: npcEstadosFinal,
      });
    }
  };

  /* Cambio de estancia: tira INI + 2d6 >= 10 (ver utils/estancia.js). Si supera, la acción no
     consume el turno y el jugador puede volver a actuar; si falla, la forma igual queda cambiada
     y el turno termina. En el camino exitoso hay que liberar el actionLock a mano — el resto de
     las acciones lo sueltan dentro de endTurnAfter. */
  const doChangeForma = async (forma, label) => {
    if (phase !== 'battle' || currTurn !== 'player' || npcBusy || rolling || armed || actionLock) return;
    setActionLock(true);
    setStancePicker(false);
    setCurrentForma(forma);
    setLog(prev => [...prev, {
      text: `🔄 Cambias a Forma ${forma} (${label})`,
      type: 'info', id: prev.length, ronda, actor: 'player',
    }]);

    /* Una sola tirada por turno: si ya tiró (sigue actuando gracias a un cambio anterior), este
       segundo cambio no tira y cierra el turno. */
    if (estanciaTiradaRef.current) {
      setLog(prev => [...prev, {
        text: mensajeSinTirada(player.nombre || 'Tú'),
        type: 'info', id: prev.length, ronda, actor: 'player',
      }]);
      endTurnAfter('player');

      return;
    }

    const t = tirarEstancia(player.iniciativa_estancia, countBuff('iniciativa') - countPlayerDeb('iniciativa'));
    estanciaTiradaRef.current = true;
    await rollDice([
      { key: 'est', color: '#a78bfa', label: 'ESTANCIA', values: [t.dado1, t.dado2] },
    ]);
    setLog(prev => [...prev, {
      text: mensajeEstancia(player.nombre || 'Tú', t),
      type: t.exito ? 'success' : 'info', id: prev.length, ronda, actor: 'player',
    }]);

    if (t.exito) {
      setActionLock(false);

      return;
    }
    endTurnAfter('player');
  };

  const clickSkill = (hab) => {
    void playClickHabilidad();
    if (hab.sonido) void playSound(hab.sonido);
    void doPlayerSkill(hab);
  };

  const clickBasicAttack = () => {
    void playClickOpcion();
    void doPlayerBasicAttack();
  };

  const openStancePicker = () => {
    void playClickOpcion();
    setStancePicker(true);
  };

  const clickEvade = () => {
    void playClickOpcion();
    void doPlayerEvadir();
  };

  const clickFlee = () => {
    void playClickOpcion();
    void doPlayerFlee();
  };

  const clickObjetoPicker = () => {
    void playClickOpcion();
    setObjetoPicker(true);
  };

  const isPlayerTurn = currTurn === 'player' && phase === 'battle' && !phaseLock && !npcBusy && !rolling && !armed && !actionLock;
  useEffect(() => { if (!isPlayerTurn) setHoveredHabId(null); }, [isPlayerTurn]);

  /* Bloquea el scroll de la página mientras el combate está en pantalla */
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);

  const pct  = (v, m) => m > 0 ? Math.max(0, Math.min(100, (v / m) * 100)) : 0;
  const vcol = (p) => p > 50 ? '#10b981' : p > 25 ? '#E6B325' : '#ff2d45';
  const LOG_C = { info: 'rgba(200,225,255,0.78)', success: '#10b981', danger: '#ff6b6b', miss: 'rgba(150,180,220,0.5)', system: '#38cdf0' };

  /* Badges para HUDs — en combate naval solo se muestran ATQ y AGI (maniobrabilidad) */
  const npcBadgesFull = [
    { l: 'ATQ', v: effNpcAtk, c: '#ff7043', dim: effNpcAtk < npcAtk },
    { l: 'DEF', v: effNpcDef, c: '#38cdf0', dim: effNpcDef < npcDef },
    ...(npcPnt > 0 ? [{ l: 'PNT', v: effNpcPnt, c: '#10b981', dim: effNpcPnt < npcPnt }] : []),
    { l: 'AGI', v: effNpcMov, c: '#a78bfa', dim: effNpcMov < npcMov },
  ];
  const playerBadgesFull = [
    { l: 'ATQ', v: effPlayerAtk, c: '#ff7043', bonus: effPlayerAtk > player.ataque },
    { l: 'DEF', v: effPlayerDef, c: '#38cdf0', bonus: effPlayerDef > player.defensa },
    ...(player.punteria > 0 ? [{ l: 'PNT', v: effPlayerPnt, c: '#10b981', bonus: effPlayerPnt > player.punteria }] : []),
    { l: 'AGI', v: effPlayerMov, c: '#a78bfa', bonus: effPlayerMov > player.movimiento },
  ];
  const naveBadgeFilter = (b) => b.l === 'ATQ' || b.l === 'AGI';
  const npcBadges    = naveMode ? npcBadgesFull.filter(naveBadgeFilter)    : npcBadgesFull;
  const playerBadges = naveMode ? playerBadgesFull.filter(naveBadgeFilter) : playerBadgesFull;

  const HUD = ({ hp, maxHp, escudo, maxEscudo, photoUrl, nombre, borderColor, badges, ini, align, fallbackIcon = 'user', buffs = [], debuffs = [], estados = [], forma = 0, formaSide, effectsPosition = 'side', avatarRef, onAvatarClick }) => {
    const vPct = pct(hp, maxHp);
    const ePct = pct(escudo, maxEscudo);
    const vc   = vcol(vPct);
    const rev  = align === 'right';
    const formaImgSrc = forma > 0 ? NX.CLASSES[forma - 1]?.img : null;
    const formaBox = formaImgSrc && (
      <div title={`Forma ${formaLabel(forma)}`} style={{
        width: isMobile ? 40 : 56, height: isMobile ? 90 : 120, borderRadius: 10, flexShrink: 0, alignSelf: 'center',
        overflow: 'hidden', border: `2px solid ${borderColor}`, background: 'rgba(255,255,255,0.06)',
      }}>
        <img src={formaImgSrc} alt={`Forma ${formaLabel(forma)}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    );
    const statEffects = Object.values(
      [...buffs.map(b => ({ ...b, kind: 'buff' })), ...debuffs.map(d => ({ ...d, kind: 'debuff' }))]
        .reduce((acc, e) => {
          const key = `${e.kind}-${e.stat}`;
          acc[key] = acc[key]
            ? { ...acc[key], amount: acc[key].amount + 1, turns: Math.max(acc[key].turns, e.turns) }
            : { kind: e.kind, stat: e.stat, amount: 1, turns: e.turns };
          return acc;
        }, {})
    );
    const renderStatBadge = (e, i) => {
      const abbr = STAT_ABBR[e.stat] ?? e.stat.slice(0, 3).toUpperCase();
      const c = e.kind === 'buff' ? '#10b981' : '#ff6b6b';
      return (
        <span key={`${e.kind}-${e.stat}-${i}`} title={`${e.kind === 'buff' ? 'Buff' : 'Debuff'} · ${e.turns} ronda${e.turns === 1 ? '' : 's'} restante${e.turns === 1 ? '' : 's'}`} style={{
          display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0, whiteSpace: 'nowrap',
          fontSize: 8, fontFamily: 'var(--font-data)', padding: '2px 5px', borderRadius: 4,
          background: `${c}18`, border: `1px solid ${c}55`, color: c, fontWeight: 700,
        }}>
          {BADGE_ICON[abbr] && <Icon name={BADGE_ICON[abbr]} size={8} />}
          {e.kind === 'buff' ? '+' : '−'}{e.amount} {abbr}
          <span style={{ opacity: 0.75, fontWeight: 400 }}>· {e.turns}r</span>
        </span>
      );
    };
    const renderEstadoBadge = (e, i) => {
      const label = ESTADO_LABEL[e.tipo] ?? e.tipo;
      const turnsLabel = e.turns === null ? 'hasta consumirse' : `${e.turns} ronda${e.turns === 1 ? '' : 's'} restante${e.turns === 1 ? '' : 's'}`;
      return (
        <span key={`estado-${e.tipo}-${i}`} title={`${label} · ${turnsLabel}`} style={{
          display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0, whiteSpace: 'nowrap',
          fontSize: 8, fontFamily: 'var(--font-data)', padding: '2px 5px', borderRadius: 4,
          background: 'rgba(230,179,37,0.14)', border: '1px solid rgba(230,179,37,0.45)', color: '#E6B325', fontWeight: 700,
        }}>
          <span style={{ fontSize: 9, lineHeight: 1 }}>{ESTADO_ICON[e.tipo] ?? '❔'}</span>{label}
          <span style={{ opacity: 0.75, fontWeight: 400 }}>· {e.turns === null ? '∞' : `${e.turns}r`}</span>
        </span>
      );
    };
    const effectsColumn = (statEffects.length > 0 || estados.length > 0) && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0, justifyContent: 'center' }}>
        {estados.map(renderEstadoBadge)}
        {statEffects.map(renderStatBadge)}
      </div>
    );
    const effectsRow = (statEffects.length > 0 || estados.length > 0) && (
      <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
        {estados.map(renderEstadoBadge)}
        {statEffects.map(renderStatBadge)}
      </div>
    );

    const card = (
      <div style={{
        background: 'rgba(6,12,26,0.92)', backdropFilter: 'blur(16px)',
        border: `1px solid ${borderColor}`, borderRadius: 14,
        padding: isMobile ? 8 : 14, display: 'flex', flexDirection: rev ? 'row-reverse' : 'row',
        gap: isMobile ? 8 : 14, alignItems: 'flex-start', flex: 1, minWidth: 0,
      }}>
        <div ref={avatarRef} onClick={onAvatarClick} title={onAvatarClick ? 'Expresarse' : undefined}
          className={onAvatarClick ? 'nx-emoji-avatar-trigger' : undefined}
          style={{
            width: isMobile ? 74 : 130, height: isMobile ? 62 : 100, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
            border: `2px solid ${borderColor}`, background: 'rgba(255,255,255,0.06)', display: 'grid', placeItems: 'center',
          }}>
          {photoUrl
            ? <img src={photoUrl} alt={nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Icon name={fallbackIcon} size={26} style={{ color: 'var(--holo)', opacity: 0.5 }} />
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', flexDirection: rev ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombre}</div>
            {ini != null && (
              <span style={{
                fontSize: 9, fontFamily: 'var(--font-data)', padding: '2px 6px', borderRadius: 4,
                background: 'rgba(230,179,37,0.12)', border: '1px solid rgba(230,179,37,0.4)', color: '#E6B325',
                display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0,
              }}>
                <span style={{ fontSize: 9, lineHeight: 1 }}>⚡</span>{ini}
              </span>
            )}
          </div>
          {maxEscudo > 0 && (
            <div style={{ marginBottom: 5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 8, color: '#38cdf0', fontFamily: 'var(--font-data)' }}>ESC</span>
                <span style={{ fontSize: 8, color: '#38cdf0', fontFamily: 'var(--font-data)' }}>{escudo}/{maxEscudo}</span>
              </div>
              <div style={{ height: 4, background: 'rgba(56,205,240,0.12)', borderRadius: 2 }}>
                <div style={{ height: '100%', width: `${ePct}%`, background: '#38cdf0', borderRadius: 2, transition: 'width 0.4s ease' }} />
              </div>
            </div>
          )}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontSize: 8, color: vc, fontFamily: 'var(--font-data)' }}>VID</span>
              <span style={{ fontSize: 8, color: vc, fontFamily: 'var(--font-data)' }}>{hp}/{maxHp}</span>
            </div>
            <div style={{ height: 9, background: 'rgba(16,185,129,0.12)', borderRadius: 5 }}>
              <div style={{ height: '100%', width: `${vPct}%`, background: vc, borderRadius: 5, transition: 'width 0.4s ease' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, auto)', gap: 4, justifyContent: rev ? 'end' : 'start' }}>
            {badges.map(b => (
              <span key={b.l} style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 9, fontFamily: 'var(--font-data)', padding: '2px 6px', borderRadius: 4,
                background: `${b.c}14`, border: `1px solid ${b.c}45`, color: b.c,
                opacity: b.dim ? 0.55 : 1,
                ...(b.bonus ? { boxShadow: `0 0 8px ${b.c}55`, fontWeight: 700 } : {}),
              }}>
                {BADGE_ICON[b.l] && <Icon name={BADGE_ICON[b.l]} size={9} />}
                {b.l} {b.v}{b.bonus ? ' ▲' : b.dim ? ' ▼' : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
    );

    const cardRow = (
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
        {formaSide === 'left' && formaBox}
        {effectsPosition === 'side' ? (rev ? <>{card}{effectsColumn}</> : <>{effectsColumn}{card}</>) : card}
        {formaSide === 'right' && formaBox}
      </div>
    );

    if (effectsPosition === 'side') return cardRow;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {effectsPosition === 'above' && effectsRow}
        {cardRow}
        {effectsPosition === 'below' && effectsRow}
      </div>
    );
  };

  const ActionBtn = ({ onClick, disabled, bg, border, hoverBg, hoverBorder, children, minW = 56 }) => (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} style={{
      minWidth: minW, borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
      background: bg, border: `1px solid ${border}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 2, padding: '3px 6px', opacity: disabled ? 0.35 : 1, transition: 'all 0.14s', flexShrink: 0,
    }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = hoverBg; e.currentTarget.style.borderColor = hoverBorder; } }}
      onMouseLeave={e => { e.currentTarget.style.background = bg; e.currentTarget.style.borderColor = border; }}
    >{children}</button>
  );

  /* Icono por tipo de habilidad */
  const tipoIcon = (tipo) => tipo === 'melee' ? '⚔' : '◎';
  const formaLabel = (f) => ['―', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][f] ?? String(f);

  /* Encabezado del registro/resumen de ronda — compartido entre el panel flotante (desktop) y el bloque central (mobile) */
  const logHeader = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '7px 9px',
      cursor: 'pointer', userSelect: 'none', flexShrink: 0,
      borderBottom: logCollapsed ? 'none' : '1px solid rgba(56,205,240,0.10)',
    }} onClick={() => setLogCollapsed(p => !p)}>
      <span style={{ fontSize: 14, flexShrink: 0, lineHeight: 1 }}>📋</span>
      {!logCollapsed && (
        <span style={{ fontSize: 7, color: 'rgba(150,200,255,0.5)', fontFamily: 'var(--font-data)', letterSpacing: '0.16em', flex: 1, whiteSpace: 'nowrap' }}>
          REGISTRO · RONDA {ronda}
        </span>
      )}
      <span style={{ fontSize: 11, color: 'rgba(150,200,255,0.4)', flexShrink: 0 }}>{logCollapsed ? '›' : '‹'}</span>
    </div>
  );
  const logBody = !logCollapsed && (
    <div ref={logRef} style={{ overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
      {logRounds.map(round => (
        <div key={round.ronda} style={{
          border: '1px solid rgba(56,205,240,0.16)', borderRadius: 8,
          background: 'rgba(56,205,240,0.035)', padding: '5px 6px', display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <div style={{
            fontSize: 8, color: '#38cdf0', fontFamily: 'var(--font-data)', letterSpacing: '0.14em',
            fontWeight: 700, opacity: 0.85,
          }}>RONDA {round.ronda}</div>
          {round.turns.map((turn, ti) => {
            const isSystem = turn.actor === 'system';
            const isNpc    = turn.actor === 'npc';
            const label    = isSystem ? null : isNpc ? npc.nombre : (player.nombre || 'Tú');
            const accent   = isSystem ? 'rgba(150,200,255,0.35)' : isNpc ? 'rgba(255,45,69,0.35)' : 'rgba(56,205,240,0.35)';
            return (
              <div key={ti} style={{
                display: 'flex', flexDirection: 'column', gap: 2,
                ...(isSystem ? {} : {
                  border: `1px solid ${accent}`, borderRadius: 6,
                  background: isNpc ? 'rgba(255,45,69,0.05)' : 'rgba(56,205,240,0.05)',
                  padding: '4px 6px',
                }),
              }}>
                {label && (
                  <div style={{ fontSize: 7, color: accent.replace('0.35', '0.85'), fontFamily: 'var(--font-data)', letterSpacing: '0.08em', fontWeight: 700 }}>
                    {isNpc ? '👤 ' : '⚔ '}{label.toUpperCase()}
                  </div>
                )}
                {turn.entries.map(e => (
                  <div key={e.id} style={{
                    fontSize: 10, color: LOG_C[e.type] ?? 'rgba(200,225,255,0.75)',
                    fontFamily: 'var(--font-data)', letterSpacing: '0.03em', lineHeight: 1.4,
                    paddingLeft: isSystem ? 6 : 0,
                    borderLeft: isSystem ? '2px solid #38cdf0' : 'none',
                    animation: 'nx-fade-up 0.2s ease both',
                  }}>{renderDiceText(e.text, e.diceColors)}</div>
                ))}
              </div>
            );
          })}
        </div>
      ))}
      {npcBusy && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 3 }}>
          <span style={{ fontSize: 9, color: '#ff9999', fontFamily: 'var(--font-data)' }}>{npc.nombre}…</span>
          {[0, 1, 2].map(i => <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: '#ff9999', animation: `nx-pulse 0.8s ${i * 0.2}s infinite` }} />)}
        </div>
      )}
    </div>
  );

  /* Contenido de la barra de acciones — compartido entre el layout desktop (absoluto) y mobile (flex, dentro de la columna) */
  const actionBarInner = (
    <>
      {phase === 'initiative' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'rgba(150,200,255,0.4)', fontSize: 11, fontFamily: 'var(--font-data)', letterSpacing: '0.15em' }}>CALCULANDO INICIATIVA…</span>
        </div>
      )}
      {phase === 'victory' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <span style={{ fontSize: 16, color: '#10b981', fontFamily: 'var(--font-data)', letterSpacing: '0.14em' }}>⚡ VICTORIA</span>
          <button onClick={() => setShowCombatCard(true)} style={{ padding: '8px 22px', borderRadius: 7, cursor: 'pointer', background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.5)', color: '#10b981', fontFamily: 'var(--font-data)', fontSize: 10, letterSpacing: '0.14em' }}>CONTINUAR →</button>
        </div>
      )}
      {phase === 'defeat' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <span style={{ fontSize: 16, color: '#ff6b6b', fontFamily: 'var(--font-data)', letterSpacing: '0.14em' }}>☠ DERROTA</span>
          <button onClick={() => setShowCombatCard(true)} style={{ padding: '8px 22px', borderRadius: 7, cursor: 'pointer', background: 'rgba(255,45,69,0.14)', border: '1px solid rgba(255,45,69,0.45)', color: '#ff6b6b', fontFamily: 'var(--font-data)', fontSize: 10, letterSpacing: '0.14em' }}>RETIRARSE</button>
        </div>
      )}
      {phase === 'battle' && (
        <>
          {/* Barra de Fuerza */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 8, color: '#38cdf0', fontFamily: 'var(--font-data)', letterSpacing: '0.12em', flexShrink: 0 }}>FUERZA</span>
            <div style={{ display: 'flex', gap: 2, flex: 1 }}>
              {Array.from({ length: maxFuerza }, (_, i) => (
                <div key={i} style={{
                  flex: 1, height: 6, borderRadius: 2,
                  background: i < playerFuerza ? '#38cdf0' : 'rgba(56,205,240,0.12)',
                  transition: 'background 0.2s ease',
                }} />
              ))}
            </div>
            <span style={{ fontSize: 8, color: '#38cdf0', fontFamily: 'var(--font-data)', flexShrink: 0 }}>{playerFuerza}/{maxFuerza}</span>
          </div>

          {/* Habilidades (grid 2x2) + otras opciones (grid 2x2) */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'stretch', flex: 1, minHeight: 0 }}>
            {/* Habilidades */}
            <div style={{ flex: '1 1 62%', minWidth: 0, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: 5 }}>
              {habilidades.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', gridRow: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 10, color: 'rgba(150,200,255,0.3)', fontFamily: 'var(--font-data)' }}>Sin habilidades equipadas</span>
                </div>
              ) : (
                habilidades.map(hab => {
                  const habId    = String(hab.id);
                  const cdLeft   = cooldowns[habId] ?? 0;
                  const noFuerza = playerFuerza < hab.costo_fuerza;
                  const disabled = !isPlayerTurn || cdLeft > 0 || noFuerza;
                  const isSelf   = hab.objetivo === 'self';

                  return (
                    <button key={hab.id} onClick={() => !disabled && clickSkill(hab)}
                      disabled={disabled}
                      style={{
                        minWidth: 0, borderRadius: 8,
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        background: disabled ? 'rgba(56,205,240,0.03)' : 'rgba(56,205,240,0.08)',
                        border: `1px solid ${disabled ? 'rgba(56,205,240,0.09)' : 'rgba(56,205,240,0.26)'}`,
                        display: 'flex', flexDirection: 'column', alignItems: 'stretch', textAlign: 'left',
                        gap: 3, padding: 4, opacity: disabled ? 0.45 : 1,
                        position: 'relative', transition: 'all 0.13s',
                      }}
                      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = 'rgba(56,205,240,0.16)'; e.currentTarget.style.borderColor = 'rgba(56,205,240,0.48)'; } setHoveredHabId(hab.id); }}
                      onMouseLeave={e => { e.currentTarget.style.background = disabled ? 'rgba(56,205,240,0.03)' : 'rgba(56,205,240,0.08)'; e.currentTarget.style.borderColor = disabled ? 'rgba(56,205,240,0.09)' : 'rgba(56,205,240,0.26)'; setHoveredHabId(null); }}
                    >
                      {hoveredHabId === hab.id && <SkillTooltip hab={hab} />}
                      {/* Overlay de cooldown */}
                      {cdLeft > 0 && (
                        <div style={{
                          position: 'absolute', inset: 0, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(0,0,0,0.55)', zIndex: 2,
                        }}>
                          <span style={{ fontSize: 13, color: '#ff6b6b', fontFamily: 'var(--font-data)', fontWeight: 700 }}>CD {cdLeft}</span>
                        </div>
                      )}
                      {/* Cabecera: nombre de la habilidad */}
                      <div style={{
                        borderBottom: '1px solid rgba(56,205,240,0.16)', paddingBottom: 3,
                      }}>
                        <span style={{
                          fontSize: 9, color: 'var(--txt)', fontFamily: 'var(--font-data)', fontWeight: 700, letterSpacing: '0.02em',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block',
                        }}>{hab.nombre}</span>
                      </div>
                      {/* Cuerpo: imagen a la izquierda, daño y demás a la derecha */}
                      <div style={{ display: 'flex', flex: 1, minHeight: 0, alignItems: 'center', gap: 6 }}>
                        <div style={{
                          width: 34, height: 34, flexShrink: 0, borderRadius: 6, overflow: 'hidden',
                          background: 'rgba(0,0,0,0.28)', display: 'grid', placeItems: 'center',
                        }}>
                          {(hab.icono_url || hab.icono)
                            ? <img src={mediaUrl(hab.icono_url ?? hab.icono)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <span style={{ fontSize: 16, lineHeight: 1 }}>{tipoIcon(hab.tipo)}</span>
                          }
                        </div>
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, justifyContent: 'center' }}>
                          <span style={{ fontSize: 7, color: 'rgba(150,200,255,0.55)', fontFamily: 'var(--font-data)' }}>
                            {hab.tipo === 'melee' ? '⚔ Melee' : hab.tipo === 'nave' ? '🚀 Nave' : '◎ Distancia'}
                          </span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                            {!isSelf && (
                              <span style={{ fontSize: 7, color: '#ff7043', fontFamily: 'var(--font-data)' }}>
                                DMG {hab.damage}
                                {!!hab.damage_perforante && <span style={{ color: '#8aa0c0' }}> +{hab.damage_perforante}P</span>}
                              </span>
                            )}
                            {isSelf && (
                              <span style={{ fontSize: 7, color: '#10b981', fontFamily: 'var(--font-data)' }}>BUFF</span>
                            )}
                            <span style={{
                              fontSize: 7, fontFamily: 'var(--font-data)', padding: '1px 4px', borderRadius: 3,
                              background: noFuerza && isPlayerTurn ? 'rgba(255,45,69,0.25)' : 'rgba(56,205,240,0.15)',
                              color: noFuerza && isPlayerTurn ? '#ff6b6b' : '#38cdf0',
                            }}>
                              ⚡{hab.costo_fuerza}
                            </span>
                            {hab.forma > 0 && (
                              <span style={{ fontSize: 7, color: 'rgba(150,200,255,0.5)', fontFamily: 'var(--font-data)' }}>
                                F{formaLabel(hab.forma)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', flexShrink: 0, alignSelf: 'stretch' }} />

            {/* Otras opciones */}
            <div style={{ flex: '1 1 38%', minWidth: 0, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: 5 }}>
              {!naveMode && (
                <ActionBtn onClick={() => isPlayerTurn && clickBasicAttack()}
                  disabled={!isPlayerTurn}
                  bg="rgba(255,140,0,0.07)" border="rgba(255,140,0,0.22)"
                  hoverBg="rgba(255,140,0,0.18)" hoverBorder="rgba(255,140,0,0.5)" minW={0}
                >
                  {player.arma_equipada?.imagen ? (
                    <div style={{ width: 26, height: 26, borderRadius: 5, overflow: 'hidden', flexShrink: 0 }}>
                      <img src={mediaUrl(player.arma_equipada.imagen)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ) : player.arma_equipada?.es_sable ? (
                    <Icon name="sword" size={18} style={{ color: NX.SABERS[player.arma_equipada.color_hoja] ?? '#ff9955', filter: `drop-shadow(0 0 4px ${NX.SABERS[player.arma_equipada.color_hoja] ?? '#ff9955'})` }} />
                  ) : (
                    <span style={{ fontSize: 16, lineHeight: 1 }}>✊</span>
                  )}
                  <span style={{
                    fontSize: 7, fontFamily: 'var(--font-data)', letterSpacing: '0.04em', whiteSpace: 'nowrap',
                    maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
                    color: (player.arma_equipada?.es_sable && NX.SABERS[player.arma_equipada.color_hoja]) || '#ff9955',
                  }}>
                    {player.arma_equipada ? player.arma_equipada.nombre.toUpperCase() : 'DESARMADO'}
                  </span>
                  <span style={{ fontSize: 7, color: '#ff7043', fontFamily: 'var(--font-data)' }}>
                    DMG {player.arma_equipada?.dano ?? 3}
                    {!!player.arma_equipada?.dano_perforante && (
                      <span style={{ color: '#8aa0c0' }}> +{player.arma_equipada.dano_perforante}P</span>
                    )}
                  </span>
                </ActionBtn>
              )}

              {!naveMode && (
                <ActionBtn onClick={() => isPlayerTurn && openStancePicker()}
                  disabled={!isPlayerTurn}
                  bg="rgba(139,92,246,0.07)" border="rgba(139,92,246,0.22)"
                  hoverBg="rgba(139,92,246,0.18)" hoverBorder="rgba(139,92,246,0.5)" minW={0}
                >
                  {NX.CLASSES[currentForma - 1]?.img ? (
                    <div style={{ width: 22, height: 22, borderRadius: 5, overflow: 'hidden', flexShrink: 0 }}>
                      <img src={NX.CLASSES[currentForma - 1].img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <span style={{ fontSize: 14, lineHeight: 1 }}>🔄</span>
                  )}
                  <span style={{ fontSize: 7, color: '#a78bfa', fontFamily: 'var(--font-data)', whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{FORMA_LABELS_SHORT[currentForma - 1] ?? `F${currentForma}`}</span>
                  <span style={{ fontSize: 7, color: '#a78bfa', fontFamily: 'var(--font-data)' }}>ESTANCIA</span>
                </ActionBtn>
              )}

              {naveMode && (
                <ActionBtn onClick={() => isPlayerTurn && clickEvade()}
                  disabled={!isPlayerTurn}
                  bg="rgba(16,185,129,0.07)" border="rgba(16,185,129,0.22)"
                  hoverBg="rgba(16,185,129,0.18)" hoverBorder="rgba(16,185,129,0.5)" minW={0}
                >
                  <span style={{ fontSize: 16, lineHeight: 1 }}>🌀</span>
                  <span style={{ fontSize: 7, color: '#10b981', fontFamily: 'var(--font-data)' }}>EVADIR</span>
                </ActionBtn>
              )}

              <ActionBtn onClick={() => isPlayerTurn && clickFlee()}
                disabled={!isPlayerTurn}
                bg="rgba(255,45,69,0.07)" border="rgba(255,45,69,0.22)"
                hoverBg="rgba(255,45,69,0.18)" hoverBorder="rgba(255,45,69,0.5)" minW={0}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>🏃</span>
                <span style={{ fontSize: 8, color: '#ff6b6b', fontFamily: 'var(--font-data)' }}>HUIR</span>
              </ActionBtn>

              {objetosUtilizables.length > 0 && (
                <ActionBtn onClick={() => isPlayerTurn && clickObjetoPicker()}
                  disabled={!isPlayerTurn || usingObjeto}
                  bg="rgba(16,185,129,0.07)" border="rgba(16,185,129,0.22)"
                  hoverBg="rgba(16,185,129,0.18)" hoverBorder="rgba(16,185,129,0.5)" minW={0}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>🧪</span>
                  <span style={{ fontSize: 8, color: '#10b981', fontFamily: 'var(--font-data)' }}>OBJETO</span>
                </ActionBtn>
              )}

              <ActionBtn onClick={() => setEmojiPicker(v => !v)}
                disabled={false}
                bg="rgba(230,179,37,0.07)" border="rgba(230,179,37,0.22)"
                hoverBg="rgba(230,179,37,0.18)" hoverBorder="rgba(230,179,37,0.5)" minW={0}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>😊</span>
                <span style={{ fontSize: 8, color: '#E6B325', fontFamily: 'var(--font-data)' }}>EMOTE</span>
              </ActionBtn>
            </div>
          </div>
        </>
      )}
    </>
  );

  const actionBar = (
    <div style={{
      position: isMobile ? 'relative' : 'absolute',
      ...(isMobile ? {} : { bottom: 0, left: 0, right: 0 }),
      zIndex: 10, flexShrink: 0,
      background: 'rgba(3,7,16,0.96)', backdropFilter: 'blur(16px)',
      borderTop: '1px solid rgba(56,205,240,0.13)',
      borderRadius: isMobile ? 10 : 0,
      padding: isMobile ? '8px 10px 12px' : '6px 12px 8px', display: 'flex', flexDirection: 'column', gap: 5,
      minHeight: isMobile ? 195 : 175,
    }}>
      {actionBarInner}
    </div>
  );

  const screen = (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9500,
      background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 12,
    }}>
      <div ref={stageRef} style={{
        position: 'relative',
        width: '100%', maxWidth: 900,
        height: '100%', maxHeight: 720,
        borderRadius: 18,
        overflow: 'hidden',
        boxShadow: '0 0 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(56,205,240,0.18)',
      }}>
        {/* Fondo */}
        {naveMode
          ? <SpaceBackground />
          : bgImg
          ? <img src={bgImg} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
          : <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 30%, #0c1e42, #020810)' }} />
        }
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(2,6,16,0.72)' }} />

        {diceOverlay}
        {throwHandle}

        {/* Botón "Comenzar" — el combate queda detenido hasta que el jugador lo presiona, para
            que si le toca actuar primero al enemigo, su golpe no se resuelva tan rápido tras
            entrar a la pantalla que no dé tiempo a notarlo. */}
        {!started && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(2,6,16,0.6)',
          }}>
            <button onClick={() => setStarted(true)} style={{
              padding: '14px 40px', borderRadius: 10, cursor: 'pointer',
              background: 'rgba(56,205,240,0.16)', border: '1px solid var(--holo)',
              color: 'var(--holo)', fontFamily: 'var(--font-data)', fontSize: 15,
              letterSpacing: '0.18em', boxShadow: '0 0 24px -6px var(--holo)',
              animation: 'nx-pulse 2s ease-in-out infinite',
            }}>COMENZAR</button>
          </div>
        )}

        {/* Banner "¡Combate iniciado!" — primera fase de la secuencia de arranque, antes
            incluso del banner de "Turno 1". */}
        {inicioMsg && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 47,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none', overflow: 'hidden',
          }}>
            <span key={inicioMsg.key} className="nx-turno-banner" style={{ fontSize: 'clamp(30px, 7vw, 54px)' }}>
              ⚔ ¡Combate iniciado!
            </span>
          </div>
        )}

        {/* Aviso grande de inicio de ronda — separa visualmente "empieza la ronda N" (con
            nueva tirada de iniciativa) de a quién le toca actuar dentro de ella, que solía
            confundirse leyendo solo el registro de combate. Se remonta (key={ronda}) y
            reproduce su animación cada vez que arranca una ronda nueva. */}
        {combatIntroDone && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 45,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none', overflow: 'hidden',
          }}>
            <span key={ronda} className="nx-turno-banner" style={{ fontSize: 'clamp(34px, 8vw, 60px)' }}>
              Turno {ronda}
            </span>
          </div>
        )}

        {/* Reemplaza la tirada de dados de iniciativa: en vez de animar los 2d6, se
            muestra directamente quién ganó la iniciativa (mismo estilo que el banner de turno). */}
        {iniciativaMsg && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 46,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none', overflow: 'hidden',
          }}>
            <span key={iniciativaMsg.key} className="nx-turno-banner" style={{ fontSize: 'clamp(26px, 6vw, 46px)' }}>
              {iniciativaMsg.texto} — Iniciativa
            </span>
          </div>
        )}

        {isMobile ? (
          /* Layout mobile: enemigo arriba (full width) → registro/resumen al medio → jugador abajo (full width) → barra de acciones */
          <div style={{ position: 'absolute', inset: 8, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div ref={npcHudRef}>
              <HUD
                hp={npcHp.vida} maxHp={maxNpc.vida} escudo={npcHp.escudo} maxEscudo={maxNpc.escudo}
                nombre={npc.nombre} photoUrl={mediaUrl(npc.imagen_mini) || mediaUrl(npc.imagen)} ini={npcIni}
                borderColor="rgba(255,45,69,0.40)" badges={npcBadges} align="left"
                fallbackIcon={naveMode ? 'ship' : 'user'}
                debuffs={npcDebuffs}
                estados={npcEstados}
                forma={naveMode ? 0 : (npc.forma ?? 0)} formaSide="right"
                effectsPosition="below"
              />
            </div>

            <div style={{
              flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
              background: 'rgba(4,9,20,0.55)', backdropFilter: 'blur(10px)',
              borderRadius: 10, border: '1px solid rgba(56,205,240,0.14)', overflow: 'hidden',
            }}>
              {logHeader}
              {logBody}
            </div>

            <div ref={playerHudRef}>
              <HUD
                hp={playerHp.vida} maxHp={maxPlayer.vida} escudo={playerHp.escudo} maxEscudo={maxPlayer.escudo}
                nombre={player.nombre} photoUrl={mediaUrl(player.photo)} ini={player.iniciativa}
                borderColor="rgba(56,205,240,0.30)" badges={playerBadges} align="right"
                fallbackIcon={naveMode ? 'ship' : 'user'}
                buffs={playerBuffs}
                estados={playerEstados}
                forma={naveMode ? 0 : currentForma} formaSide="left"
                effectsPosition="above"
                avatarRef={playerAvatarRef}
              />
            </div>

            {actionBar}
          </div>
        ) : (
          <>
            {/* NPC HUD — arriba derecha */}
            <div ref={npcHudRef} style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, width: 'clamp(360px, 55%, 520px)' }}>
              <HUD
                hp={npcHp.vida} maxHp={maxNpc.vida} escudo={npcHp.escudo} maxEscudo={maxNpc.escudo}
                nombre={npc.nombre} photoUrl={mediaUrl(npc.imagen_mini) || mediaUrl(npc.imagen)} ini={npcIni}
                borderColor="rgba(255,45,69,0.40)" badges={npcBadges} align="left"
                fallbackIcon={naveMode ? 'ship' : 'user'}
                debuffs={npcDebuffs}
                estados={npcEstados}
                forma={naveMode ? 0 : (npc.forma ?? 0)} formaSide="right"
              />
            </div>

            {/* Jugador HUD — abajo izquierda */}
            <div ref={playerHudRef} style={{ position: 'absolute', bottom: 195, left: 14, zIndex: 10, width: 'clamp(360px, 55%, 520px)' }}>
              <HUD
                hp={playerHp.vida} maxHp={maxPlayer.vida} escudo={playerHp.escudo} maxEscudo={maxPlayer.escudo}
                nombre={player.nombre} photoUrl={mediaUrl(player.photo)} ini={player.iniciativa}
                borderColor="rgba(56,205,240,0.30)" badges={playerBadges} align="right"
                fallbackIcon={naveMode ? 'ship' : 'user'}
                buffs={playerBuffs}
                estados={playerEstados}
                forma={naveMode ? 0 : currentForma} formaSide="left"
                avatarRef={playerAvatarRef}
              />
            </div>
          </>
        )}

        {emojiPicker && (
          <EmojiRing
            anchorRef={playerAvatarRef} stageRef={stageRef}
            onSelect={sendEmoji}
            onClose={() => setEmojiPicker(false)}
          />
        )}
        {emojiBurst && (
          <EmojiBurst key={emojiBurst.id} emoji={emojiBurst.emoji} onDone={() => setEmojiBurst(null)} />
        )}

        {/* Golpe de energía (melee) o mira (a distancia) */}
        {strike && (strike.type === 'melee' ? (
          <EnergyStrikeEffect key={strike.key}
            from={strike.from} to={strike.to} color={strike.color} outcome={strike.outcome}
            stageRef={stageRef} attackerRef={strike.attackerRef} targetRef={strike.targetRef}
            onDone={() => {
              strike.onResolve?.();
              setFloatTexts((prev) => [...prev, { id: strike.key, x: strike.to.x, y: strike.to.y, ...strike.result }]);
              setStrike(null);
            }}
          />
        ) : (
          <RangedStrikeEffect key={strike.key}
            from={strike.from} to={strike.to} color={strike.color} outcome={strike.outcome}
            stageRef={stageRef} attackerRef={strike.attackerRef} targetRef={strike.targetRef}
            onDone={() => {
              strike.onResolve?.();
              setFloatTexts((prev) => [...prev, { id: strike.key, x: strike.to.x, y: strike.to.y, ...strike.result }]);
              setStrike(null);
            }}
          />
        ))}

        {statusFx && (
          <StatusBurstEffect key={statusFx.key}
            variant={statusFx.variant}
            stageRef={stageRef} targetRef={statusFx.targetRef}
            onDone={() => {
              statusFx.onResolve?.();
              setStatusFx(null);
            }}
          />
        )}

        {/* Resultado del ataque — texto flotante sobre el personaje afectado; cada uno vive su propio segundo */}
        {floatTexts.map((ft) => (
          <FloatingCombatText key={ft.id}
            x={ft.x} y={ft.y} text={ft.text} variant={ft.variant}
            onDone={() => setFloatTexts((prev) => prev.filter((f) => f.id !== ft.id))}
          />
        ))}

        {/* Log de combate — izquierda, colapsable (desktop; en mobile va integrado en la columna central) */}
        {!isMobile && (
          <div style={{
            position: 'absolute', left: 14, top: 14, zIndex: 10,
            width: logCollapsed ? 36 : 'clamp(150px, 26%, 240px)',
            maxHeight: 'calc(100% - 365px)',
            background: 'rgba(4,9,20,0.88)', backdropFilter: 'blur(12px)',
            borderRadius: 10, border: '1px solid rgba(56,205,240,0.14)',
            display: 'flex', flexDirection: 'column',
            transition: 'width 0.20s ease', overflow: 'hidden',
          }}>
            {logHeader}
            {logBody}
          </div>
        )}

        {/* Barra de acciones (desktop; en mobile va integrada en la columna central) */}
        {!isMobile && actionBar}

        {/* Stance Picker Modal */}
        {stancePicker && !naveMode && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 20,
            background: 'rgba(2,6,16,0.88)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} onClick={() => setStancePicker(false)}>
            <div onClick={e => e.stopPropagation()} style={{
              background: 'rgba(6,12,26,0.97)', border: '1px solid rgba(139,92,246,0.35)',
              borderRadius: 16, padding: 24, width: 360, maxWidth: '90%',
            }}>
              <div style={{ fontSize: 11, color: '#a78bfa', fontFamily: 'var(--font-data)', letterSpacing: '0.14em', marginBottom: 16, textAlign: 'center' }}>
                🔄 CAMBIAR ESTANCIA — Tirada INI+2d6 ≥ 10: si superas, conservas el turno
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {FORMA_LABELS_SHORT.map((label, i) => {
                  const f = i + 1;
                  const active = f === currentForma;
                  const hasSlots = Array.isArray(porForma[String(f)]) && porForma[String(f)].some(Boolean);
                  return (
                    <button key={f} onClick={() => {
                      void playClickOpcion();
                      if (active) { setStancePicker(false); return; }
                      void doChangeForma(f, label);
                    }} style={{
                      padding: '10px 6px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                      background: active ? 'rgba(139,92,246,0.25)' : hasSlots ? 'rgba(139,92,246,0.06)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${active ? '#a78bfa' : hasSlots ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.08)'}`,
                      opacity: active ? 1 : 0.85,
                    }}>
                      <div style={{ fontSize: 13, fontFamily: 'var(--font-data)', color: active ? '#a78bfa' : '#fff', fontWeight: 700 }}>F{f}</div>
                      <div style={{ fontSize: 8, color: 'rgba(200,180,255,0.6)', marginTop: 3, lineHeight: 1.3 }}>{label}</div>
                      {!hasSlots && <div style={{ fontSize: 7, color: 'rgba(150,150,150,0.5)', marginTop: 2 }}>sin slots</div>}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setStancePicker(false)} style={{
                marginTop: 16, width: '100%', padding: '8px', borderRadius: 8, cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(200,200,255,0.5)', fontSize: 10, fontFamily: 'var(--font-data)',
              }}>Cancelar</button>
            </div>
          </div>
        )}

        {/* Picker de objetos utilizables (Kits Médicos, Generadores de Escudo, etc.) */}
        {objetoPicker && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 20,
            background: 'rgba(2,6,16,0.88)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} onClick={() => !usingObjeto && setObjetoPicker(false)}>
            <div onClick={e => e.stopPropagation()} style={{
              background: 'rgba(6,12,26,0.97)', border: '1px solid rgba(16,185,129,0.35)',
              borderRadius: 16, padding: 24, width: 360, maxWidth: '90%',
            }}>
              <div style={{ fontSize: 11, color: '#10b981', fontFamily: 'var(--font-data)', letterSpacing: '0.14em', marginBottom: 16, textAlign: 'center' }}>
                🧪 USAR OBJETO — Acabará tu turno
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {objetosUtilizables.map((objeto) => (
                  <button key={objeto.id} onClick={() => doUsarObjeto(objeto)} disabled={usingObjeto} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                    padding: '10px 12px', borderRadius: 8, cursor: usingObjeto ? 'not-allowed' : 'pointer', textAlign: 'left',
                    background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.3)',
                    opacity: usingObjeto ? 0.6 : 1,
                  }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{objeto.nombre}</div>
                      <div style={{ fontSize: 9, color: 'rgba(150,220,190,0.7)', fontFamily: 'var(--font-data)' }}>
                        {objeto.cura_vida > 0 && `+${objeto.cura_vida} vida `}
                        {objeto.cura_escudo > 0 && `+${objeto.cura_escudo} escudo`}
                      </div>
                    </div>
                    <span style={{ fontSize: 10, color: '#10b981', fontFamily: 'var(--font-data)' }}>×{objeto.cantidad}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setObjetoPicker(false)} disabled={usingObjeto} style={{
                marginTop: 16, width: '100%', padding: '8px', borderRadius: 8, cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(200,200,255,0.5)', fontSize: 10, fontFamily: 'var(--font-data)',
              }}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const container = document.getElementById('nx-content') ?? document.body;

  /* Al terminar el combate se cierra la ventana y solo queda el resumen; al cerrarlo se vuelve al mapa */
  if (showCombatCard) {
    return createPortal(
      <NpcCombatCardModal
        phase={phase} player={player} npc={npc} log={log} ronda={ronda} naveMode={naveMode}
        planetaNombre={planetaNombre} lugarNombre={lugarNombre} lugarImagen={lugarImagen} planetaImagen={planetaImagen}
        onClose={() => {
          localStorage.removeItem(NPC_COMBAT_LS);
          if (phase === 'victory') onVictory?.(playerHp);
          else onDefeat?.(playerHp);
        }}
      />,
      container
    );
  }

  return createPortal(screen, container);
}
