import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './ui.jsx';
import { NX } from '../data/seed.js';
import { playClickHabilidad, playClickOpcion, playCombateNpc, playSound } from '../utils/sounds.js';
import { getRelativeCenter } from './combatFx.jsx';
import EnergyStrikeEffect from './EnergyStrikeEffect.jsx';
import RangedStrikeEffect from './RangedStrikeEffect.jsx';
import FloatingCombatText from './FloatingCombatText.jsx';
import { useDiceRoller, renderDiceText } from './DiceRoller.jsx';
import { SkillTooltip } from './SkillTooltip.jsx';
import StatusBurstEffect from './StatusBurstEffect.jsx';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/* ─── Espejo de app/Support/Combat/AplicaEstadosCombate.php + NpcCombatScreen.jsx ───────
   Combate 100% client-side (sin servidor autoritativo) contra hasta 4 enemigos a la vez
   (un enemigo tipo 'horda' resuelto a sus miembros — ver MapEnemigo::resolverHordaSlots). */
const FORMA_BEATS = {
  1: 6, 2: 1, 3: 4, 4: 5, 5: 3, 6: 7, 7: 2,
};
const FORMA_RESISTS = {
  1: 5, 2: 4, 3: 1, 4: 7, 5: 3, 6: 6, 7: 2,
};
const formaEsEfectiva = (atkForma, defForma) => {
  if (!atkForma || !defForma) return false;
  return FORMA_BEATS[atkForma] === defForma;
};
const formaEsResistente = (atkForma, defForma) => {
  if (!atkForma || !defForma) return false;
  return FORMA_RESISTS[defForma] === atkForma;
};
const formaBonoDano = (atkForma, defForma) => {
  let bono = 0;
  if (formaEsEfectiva(atkForma, defForma)) bono += 1;
  if (formaEsResistente(atkForma, defForma)) bono -= 1;
  return bono;
};
const FORMA_BONOS = {
  1: { ataque: 1 }, 2: { dano_escudo: 1 }, 3: { defensa: 1 }, 4: { iniciativa: 1 },
  5: { dano: 1 }, 6: { movimiento: 1 }, 7: { dano_perforante: 1 },
};
const formaBono = (forma, clave) => FORMA_BONOS[forma]?.[clave] ?? 0;
const FORMA_LABELS_SHORT = ['Shii-Cho', 'Makashi', 'Soresu', 'Ataru', 'Shien/DjSo', 'Niman', 'Juyo/Vaapad'];
const formaLabel = (f) => ['―', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][f] ?? String(f);
const tipoIcon = (tipo) => (tipo === 'melee' ? '⚔' : '◎');

const TIPOS_ESTADO = [
  'paralizado', 'inmune_paralisis', 'aturdido', 'marcado', 'protegido',
  'sangrado', 'envenenado', 'debilitado', 'confundido', 'regeneracion',
  'deflectar', 'contraataque', 'revivir',
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
  revivir: { turns: 1, valor: 0 },
};
const ESTADOS_DOT = { sangrado: true, envenenado: true };
const ESTADOS_HOT = { regeneracion: true };
const ESTADO_ICON = {
  paralizado: '🔒', aturdido: '💫', marcado: '🎯', protegido: '🛡️',
  sangrado: '🩸', envenenado: '☠️', debilitado: '⬇️', confundido: '❓', regeneracion: '💚',
  deflectar: '↩️', contraataque: '🗡️', revivir: '✨',
};
const ESTADO_LABEL = {
  paralizado: 'Paralizado', aturdido: 'Aturdido', marcado: 'Marcado', protegido: 'Protegido',
  sangrado: 'Sangrado', envenenado: 'Envenenado', debilitado: 'Debilitado', confundido: 'Confundido', regeneracion: 'Regeneración',
  deflectar: 'Deflectar', contraataque: 'Contraataque', revivir: 'Revivir',
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
const agregarEstadoPorTipo = (estados, tipo) => {
  const def = DEFAULTS_ESTADO[tipo] ?? { turns: 1, valor: 0 };
  return agregarEstado(estados, tipo, def.turns, def.valor);
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
const consumirDeflectarOContraataque = (estadosObjetivo, esDistancia) => {
  const tipo = esDistancia ? 'deflectar' : 'contraataque';
  if (!tieneEstado(estadosObjetivo, tipo)) return { estados: estadosObjetivo, activo: false, tipo: null };
  return { estados: quitarEstado(estadosObjetivo, tipo), activo: true, tipo };
};
const mitadDano = (dmg, dmgEscudo, dmgPerforante) => [
  Math.floor(Math.max(0, dmg) / 2), Math.floor(Math.max(0, dmgEscudo) / 2), Math.floor(Math.max(0, dmgPerforante) / 2),
];
const aplicarEstadoDeHabilidad = (estados, tipo) => (tipo === 'paralizado' ? intentarParalizar(estados).estados : agregarEstadoPorTipo(estados, tipo));
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

const tirarDados = () => {
  const dado1 = 1 + Math.floor(Math.random() * 6);
  const dado2 = 1 + Math.floor(Math.random() * 6);
  return { dado1, dado2, total: dado1 + dado2 };
};

/* El escudo mitiga solo la MITAD (floor) del componente de daño normal mientras tenga
   capacidad — dano_escudo (flat) y dano_perforante (ignora escudo por completo) no se ven
   afectados por esta reducción. Mismo criterio que RaidCombatController/PvpCombatController/
   NpcCombatScreen::applyDamage. */
const applyDmg = (dmg, hp, dmgEscudo = 0, dmgPerforante = 0) => {
  if (hp.escudo <= 0) return { vida: Math.max(0, hp.vida - dmg - dmgPerforante), escudo: 0 };
  const escudoTrasComponenteEscudo = Math.max(0, hp.escudo - Math.max(0, dmgEscudo));
  if (escudoTrasComponenteEscudo > 0) {
    const dmgMitigado = Math.floor(Math.max(0, dmg) / 2);
    const desborde = Math.max(0, dmgMitigado - escudoTrasComponenteEscudo);
    return { vida: Math.max(0, hp.vida - desborde - dmgPerforante), escudo: Math.max(0, escudoTrasComponenteEscudo - dmgMitigado) };
  }
  return { vida: Math.max(0, hp.vida - dmg - dmgPerforante), escudo: 0 };
};
const describeDano = (dmg, dmgEscudo, dmgPerforante, escudoAntes) => {
  if (escudoAntes <= 0) return `−${dmg + dmgPerforante} daño a la vida`;
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

const mediaUrl = (path) => {
  if (!path) return null;
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:') || path.startsWith('blob:')) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (cleanPath.startsWith('/storage/')) return cleanPath;
  if (cleanPath.startsWith('/admin/')) return `/storage${cleanPath}`;
  if (cleanPath.startsWith('/public/')) return cleanPath.replace('/public/', '/storage/');
  return `/storage${cleanPath}`;
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

/* ─── Piezas de HUD compartidas con RaidCombatScreen (mismo lenguaje visual) ──────────── */

const BADGE_ICON = { ATQ: 'sword', DEF: 'shield', PNT: 'target', AGI: 'arrow' };

/* Badges compactos (ícono + turnos) para los estados activos de un combatiente */
function EstadoBadges({ estados, align = 'left' }) {
  if (!Array.isArray(estados) || estados.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
      {estados.map((e, i) => {
        const label = ESTADO_LABEL[e.tipo] ?? e.tipo;
        const turnsLabel = e.turns === null ? 'hasta consumirse' : `${e.turns} ronda${e.turns === 1 ? '' : 's'} restante${e.turns === 1 ? '' : 's'}`;
        return (
          <span key={`${e.tipo}-${i}`} title={`${label} · ${turnsLabel}`} style={{
            display: 'inline-flex', alignItems: 'center', gap: 2,
            fontSize: 8, fontFamily: 'var(--font-data)', padding: '1px 4px', borderRadius: 4,
            background: 'rgba(230,179,37,0.14)', border: '1px solid rgba(230,179,37,0.45)', color: '#E6B325', fontWeight: 700,
          }}>
            <span style={{ fontSize: 9, lineHeight: 1 }}>{ESTADO_ICON[e.tipo] ?? '❔'}</span>
            {e.turns === null ? '∞' : e.turns}
          </span>
        );
      })}
    </div>
  );
}

/* Badges horizontales de atributos. `base` es opcional: cuando viene y difiere del valor
   efectivo, dibuja ▲/▼ igual que en RaidCombatScreen. */
function AttrBadges({ badges, align = 'left' }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
      {badges.map(b => {
        const bonus = b.base != null && b.v > b.base;
        const dim = b.base != null && b.v < b.base;
        return (
          <span key={b.l} style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 9, fontFamily: 'var(--font-data)', padding: '2px 6px', borderRadius: 4,
            background: `${b.c}14`, border: `1px solid ${b.c}45`, color: b.c,
            ...(bonus ? { boxShadow: `0 0 8px ${b.c}55`, fontWeight: 700 } : {}),
          }}>
            {BADGE_ICON[b.l] && <Icon name={BADGE_ICON[b.l]} size={9} />}
            {b.l} {b.v}{bonus ? ' ▲' : dim ? ' ▼' : ''}
          </span>
        );
      })}
    </div>
  );
}

function StatBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontSize: 8, color, fontFamily: 'var(--font-data)' }}>{label}</span>
        <span style={{ fontSize: 8, color, fontFamily: 'var(--font-data)' }}>{value}/{max}</span>
      </div>
      <div style={{ height: 6, background: `${color}22`, borderRadius: 3 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.3s ease' }} />
      </div>
    </div>
  );
}

const ActionBtn = ({ onClick, disabled, bg, border, hoverBg, hoverBorder, children }) => (
  <button onClick={disabled ? undefined : onClick} disabled={disabled} style={{
    minWidth: 0, borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
    background: bg, border: `1px solid ${border}`,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 2, padding: '3px 6px', opacity: disabled ? 0.35 : 1, transition: 'all 0.14s',
  }}
    onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = hoverBg; e.currentTarget.style.borderColor = hoverBorder; } }}
    onMouseLeave={e => { e.currentTarget.style.background = bg; e.currentTarget.style.borderColor = border; }}
  >{children}</button>
);

/* Ficha de un miembro de la horda — mismo lenguaje visual que el panel del jefe en
 * RaidCombatScreen (retrato + barras + badges de atributo/estado), pero en grilla porque
 * son hasta 4 a la vez. `apuntando` la marca como elegible para confirmar el objetivo de la
 * acción pendiente (ver targeting en HordaCombatScreen); `activo` = es su turno. */
function EnemyCard({ enemigo, seleccionado, apuntando, activo, onSelect, cardRef, compact }) {
  const derrotado = enemigo.hp <= 0;
  const img = mediaUrl(enemigo.imagen || enemigo.imagen_mini);
  const vidaRatio = enemigo.maxHp > 0 ? Math.max(0, enemigo.hp) / enemigo.maxHp : 0;
  const vidaColor = vidaRatio > 0.5 ? '#10b981' : vidaRatio > 0.25 ? '#E6B325' : '#ff2d45';
  const elegible = apuntando && !derrotado;
  const retrato = compact ? 40 : 52;
  const borde = derrotado ? 'rgba(255,255,255,0.07)'
    : elegible ? '#E6B325'
      : activo ? '#ff2d45'
        : seleccionado ? 'rgba(255,45,69,0.6)'
          : 'rgba(255,45,69,0.22)';

  return (
    <button ref={cardRef} type="button" disabled={derrotado} onClick={() => !derrotado && onSelect()}
      title={derrotado ? `${enemigo.nombre} — derrotado` : elegible ? `Elegir a ${enemigo.nombre} como objetivo` : enemigo.nombre}
      style={{
        position: 'relative', display: 'flex', flexDirection: 'column', gap: 4, padding: 8, borderRadius: 10,
        textAlign: 'left', minWidth: 0,
        background: derrotado ? 'rgba(0,0,0,0.32)' : elegible ? 'rgba(230,179,37,0.10)' : 'rgba(4,9,20,0.5)',
        border: `1.5px solid ${borde}`,
        boxShadow: elegible ? '0 0 18px -4px #E6B325' : activo ? '0 0 18px -4px #ff2d45' : 'none',
        cursor: derrotado ? 'not-allowed' : 'pointer', opacity: derrotado ? 0.4 : 1, transition: 'all 0.15s',
      }}>
      {derrotado && <div style={{ position: 'absolute', top: 6, right: 8, fontSize: 15 }}>💀</div>}
      {elegible && (
        <div className="nx-live-dot" style={{
          position: 'absolute', top: -7, right: -7, width: 20, height: 20, borderRadius: '50%',
          background: 'rgba(6,12,26,0.96)', border: '1px solid #E6B325', boxShadow: '0 0 12px rgba(230,179,37,0.45)',
          display: 'grid', placeItems: 'center', color: '#E6B325',
        }}>
          <Icon name="target" size={11} />
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: retrato, height: retrato, borderRadius: 8, flexShrink: 0, overflow: 'hidden',
          border: '1px solid rgba(255,45,69,0.35)', background: 'rgba(255,45,69,0.08)',
          display: 'grid', placeItems: 'center',
        }}>
          {img
            ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Icon name="flame" size={compact ? 18 : 24} style={{ color: '#ff2d45', opacity: 0.6 }} />}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {enemigo.nombre}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <span title={`Nivel de dificultad ${enemigo.nivel}`} style={{ display: 'inline-flex', gap: 1 }}>
              {Array.from({ length: Math.min(5, Math.max(1, enemigo.nivel)) }, (_, i) => (
                <Icon key={i} name="star" fill size={8} style={{ color: '#E6B325' }} />
              ))}
            </span>
            {enemigo.forma > 0 && (
              <span style={{ fontSize: 7.5, color: 'rgba(150,200,255,0.55)', fontFamily: 'var(--font-data)' }}>F{formaLabel(enemigo.forma)}</span>
            )}
            {activo && <span style={{ fontSize: 7.5, color: '#ff6b6b', fontFamily: 'var(--font-data)', letterSpacing: '0.08em' }}>⚔ SU TURNO</span>}
          </div>
        </div>
      </div>
      {enemigo.maxEscudo > 0 && <StatBar label="ESC" value={Math.max(0, enemigo.escudo)} max={enemigo.maxEscudo} color="#38cdf0" />}
      <StatBar label="VID" value={Math.max(0, enemigo.hp)} max={enemigo.maxHp} color={vidaColor} />
      <AttrBadges badges={[
        { l: 'ATQ', v: enemigo.atk, c: '#ff7043' },
        { l: 'DEF', v: enemigo.def, c: '#38cdf0' },
        ...(enemigo.pnt > 0 ? [{ l: 'PNT', v: enemigo.pnt, c: '#10b981' }] : []),
        { l: 'AGI', v: enemigo.mov, c: '#a78bfa' },
      ]} />
      <EstadoBadges estados={enemigo.estados} />
    </button>
  );
}

/**
 * Combate 1 jugador vs hasta 4 enemigos simultáneos (encuentro tipo 'horda' — ver
 * MapEnemigo::resolverHordaSlots). 100% client-side, mismo criterio que NpcCombatScreen
 * (sin servidor autoritativo): el resultado final se persiste vía onVictory/onDefeat/onFlee.
 *
 * `enemigos`: array de hasta 4 MapEnemigo ya resueltos (con habilidad1/habilidad2 cargadas y
 * el nivel de SU slot ya aplicado). El orden de turnos se re-tira cada ronda (jugador + cada
 * enemigo vivo) — ver rollNewRound.
 */
export default function HordaCombatScreen({
  enemigos, player, lugarImagen, planetaNombre, lugarNombre, planetaImagen,
  objetosUtilizables = [], onUsarObjeto, onVictory, onDefeat, onFlee, initialState,
}) {
  const isMobile = useIsMobile();
  const { diceOverlay, rollDice } = useDiceRoller();

  const maxPlayer = { vida: player.vida_max ?? player.vida, escudo: player.escudo_max ?? player.escudo };
  const maxFuerza = player.maxFuerza ?? 10;
  const fuerzaPorTurno = player.fuerzaPorTurno ?? 2;

  /* Base de cada miembro (nivel, stats con bono de nivel, habilidades) — no cambia durante el combate. */
  const base = useMemo(() => enemigos.map((e) => {
    const nivel = e.nivel ?? 1;
    const bonoNivel = Math.max(0, nivel - 1);
    const bonoDoblesCrit = Math.min(4, Math.floor((nivel + 1) / 2));
    return {
      id: e.id,
      nombre: e.nombre,
      imagen: e.imagen,
      imagen_mini: e.imagen_mini,
      forma: e.forma ?? 0,
      nivel,
      bonoNivel,
      bonoDoblesCrit,
      maxHp: Math.max(e.vida, 1) + bonoNivel,
      maxEscudo: Math.min(5, (e.escudo ?? 0) + bonoNivel),
      atk: Math.max(e.ataque, 1) + bonoNivel,
      def: Math.max(e.defensa, 1) + bonoNivel,
      mov: Math.max(e.movimiento, 1) + bonoNivel,
      ini: Math.max(e.iniciativa, 1) + bonoNivel,
      pnt: (e.punteria ?? 0) > 0 ? (e.punteria + bonoNivel) : 0,
      dano: e.dano ?? 0,
      dano_escudo: e.dano_escudo ?? 0,
      dano_perforante: e.dano_perforante ?? 0,
      habilidades: [e.habilidad1, e.habilidad2].filter(Boolean),
    };
  }), [enemigos]);

  const esCriticoEnemigo = (b, dado1, dado2) => {
    if (b.nivel >= 4) {
      const companero = b.nivel >= 5 ? 4 : 5;
      return (dado1 === 6 && dado2 >= companero) || (dado2 === 6 && dado1 >= companero);
    }
    return dado1 === dado2 && dado1 !== 1 && dado1 >= (6 - b.bonoDoblesCrit);
  };
  const esFalloCriticoEnemigo = (dado1, dado2) => dado1 === 1 && dado2 === 1;

  const [playerHp, setPlayerHp] = useState(initialState?.playerHp ?? { vida: player.vida, escudo: player.escudo });
  const [enemigosState, setEnemigosState] = useState(() => initialState?.enemigosState ?? base.map((b) => ({
    ...b, hp: b.maxHp, escudo: b.maxEscudo, estados: [], buffs: [], debuffs: [], cooldowns: {},
  })));
  const [phase, setPhase] = useState(initialState?.phase ?? 'battle'); // battle | victory | defeat | fled
  const [turnOrder, setTurnOrder] = useState(initialState?.turnOrder ?? []);
  const [turnIndex, setTurnIndex] = useState(initialState?.turnIndex ?? 0);
  const [ronda, setRonda] = useState(initialState?.ronda ?? 0); // 0 = aún no se tiró la 1ra iniciativa
  const [rondaMsg, setRondaMsg] = useState(null);
  const [log, setLog] = useState(initialState?.log ?? []);
  const [logCollapsed, setLogCollapsed] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState(initialState?.selectedTarget ?? 0);
  const [busy, setBusy] = useState(false);
  const [enemyActing, setEnemyActing] = useState(false);
  /* Acción esperando que el jugador elija a cuál miembro de la horda va dirigida, haciendo
     click en su ficha: { kind: 'basico' } | { kind: 'habilidad', hab } | { kind: 'objeto', objeto } */
  const [targeting, setTargeting] = useState(null);

  const [playerFuerza, setPlayerFuerza] = useState(initialState?.playerFuerza ?? 0);
  const [cooldowns, setCooldowns] = useState(initialState?.cooldowns ?? {});
  const [playerBuffs, setPlayerBuffs] = useState(initialState?.playerBuffs ?? []);
  const [playerDebuffs, setPlayerDebuffs] = useState(initialState?.playerDebuffs ?? []);
  const [playerEstados, setPlayerEstados] = useState(initialState?.playerEstados ?? []);
  const [currentForma, setCurrentForma] = useState(initialState?.currentForma ?? player.current_forma ?? 1);
  const [stancePicker, setStancePicker] = useState(false);
  const [objetoPicker, setObjetoPicker] = useState(false);
  const [usingObjeto, setUsingObjeto] = useState(false);

  const [strike, setStrike] = useState(null);
  const [statusFx, setStatusFx] = useState(null);
  const [floatTexts, setFloatTexts] = useState([]);
  const [hoveredHabId, setHoveredHabId] = useState(null);

  const logRef = useRef(null);
  const stageRef = useRef(null);
  const playerHudRef = useRef(null);
  const enemyRefs = useRef({});

  const habPool = player.all_habilidades_data ?? {};
  const porForma = player.habilidades_por_forma ?? {};
  const habilidades = useMemo(() => {
    const slotIds = Array.isArray(porForma[String(currentForma)]) ? porForma[String(currentForma)] : [];
    return slotIds.filter(Boolean).map(id => habPool[String(id)]).filter(Boolean);
  }, [currentForma, porForma, habPool]);

  const enemigosVivos = () => enemigosState.map((e, idx) => ({ e, idx })).filter(({ e }) => e.hp > 0);

  /* Si el objetivo elegido cae, retargetea automáticamente al primero que siga vivo */
  useEffect(() => {
    if (enemigosState[selectedTarget]?.hp > 0) return;
    const vivo = enemigosState.findIndex(e => e.hp > 0);
    if (vivo >= 0) setSelectedTarget(vivo);
  }, [enemigosState, selectedTarget]);

  const showFloatText = (ref, result) => {
    if (!stageRef.current || !ref?.current) return;
    const pos = getRelativeCenter(ref.current, stageRef.current);
    setFloatTexts(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, x: pos.x, y: pos.y, ...result }]);
  };
  const playStatusFx = (targetRef, variant) => new Promise((resolve) => {
    if (!stageRef.current || !targetRef?.current) { resolve(); return; }
    setStatusFx({ key: `${Date.now()}-${Math.random()}`, variant, targetRef, onResolve: resolve });
  });
  const resultTextFor = (hit, ranged, crit, dmg) => {
    if (!hit) return { variant: ranged ? 'dodge' : 'block', text: ranged ? 'ESQUIVADO' : 'BLOQUEADO' };
    if (crit) return { variant: 'crit', text: `¡CRÍTICO! −${dmg}` };
    return { variant: 'hit', text: `HIT: ${dmg}` };
  };
  const triggerStrike = ({ attackerRef, targetRef, ranged, hit, crit = false, dmg = 0 }) => {
    if (!stageRef.current) return Promise.resolve();
    const color = attackerRef === playerHudRef
      ? ((player.arma_equipada?.es_sable && NX.SABERS[player.arma_equipada.color_hoja]) || '#38cdf0')
      : '#ff2d45';
    return new Promise((resolve) => {
      setStrike({
        key: `${Date.now()}-${Math.random()}`, type: ranged ? 'ranged' : 'melee',
        outcome: hit ? 'hit' : (ranged ? 'dodge' : 'block'), color, attackerRef, targetRef,
        from: getRelativeCenter(attackerRef.current, stageRef.current),
        to: getRelativeCenter(targetRef.current, stageRef.current),
        result: resultTextFor(hit, ranged, crit, dmg),
        onResolve: resolve,
      });
    });
  };

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log]);

  /* Persistencia — mismo criterio que NpcCombatScreen (localStorage, ver Mapa.jsx) */
  useEffect(() => {
    let prevExtra = {};
    try {
      const raw = localStorage.getItem('nx-horda-combat');
      if (raw) {
        const { enemigos: _e, player: _p, lugarImagen: _li, planetaNombre: _pn, lugarNombre: _ln, planetaImagen: _pi, state: _s, ...rest } = JSON.parse(raw);
        prevExtra = rest;
      }
    } catch { /* ignore */ }
    localStorage.setItem('nx-horda-combat', JSON.stringify({
      ...prevExtra, enemigos, player, lugarImagen, planetaNombre, lugarNombre, planetaImagen,
      state: {
        playerHp, enemigosState, phase, turnOrder, turnIndex, ronda, log, selectedTarget,
        playerFuerza, cooldowns, playerBuffs, playerDebuffs, playerEstados, currentForma,
      },
    }));
  }, [playerHp, enemigosState, phase, turnOrder, turnIndex, ronda, log, selectedTarget, playerFuerza, cooldowns, playerBuffs, playerDebuffs, playerEstados, currentForma]);

  /* Stats efectivos del jugador (buffs/debuffs + bono de forma equipada) */
  const countBuff = (stat) => playerBuffs.filter(b => b.stat === stat).length;
  const countDeb = (stat) => playerDebuffs.filter(d => d.stat === stat).length;
  const effPlayerAtk = Math.max(1, player.ataque + countBuff('ataque') - countDeb('ataque') + formaBono(currentForma, 'ataque'));
  const effPlayerDef = Math.max(1, player.defensa + countBuff('defensa') - countDeb('defensa') + formaBono(currentForma, 'defensa'));
  const effPlayerPnt = Math.max(0, player.punteria + countBuff('punteria') - countDeb('punteria'));
  const effPlayerMov = Math.max(1, player.movimiento + countBuff('movimiento') - countDeb('movimiento') + formaBono(currentForma, 'movimiento'));
  const effPlayerIni = Math.max(1, player.iniciativa + countBuff('iniciativa') - countDeb('iniciativa') + formaBono(currentForma, 'iniciativa'));

  /* ─── Ronda: tira iniciativa para el jugador + cada enemigo vivo, ordena descendente ── */
  const rollNewRound = async (enemigosActuales) => {
    const vivos = enemigosActuales.map((e, idx) => ({ e, idx })).filter(({ e }) => e.hp > 0);
    const rolls = [{ tipo: 'player', ini: effPlayerIni, nombre: player.nombre || 'Tú' },
      ...vivos.map(({ e, idx }) => ({ tipo: 'enemigo', idx, ini: e.ini, nombre: e.nombre }))]
      .map(c => {
        const t = tirarDados();
        return { ...c, dado: t, total: t.total + c.ini };
      });
    rolls.sort((a, b) => b.total - a.total);

    const nextRonda = ronda + 1;
    const orden = rolls.map(r => `${r.nombre} 2d6(${r.dado.dado1}+${r.dado.dado2})=${r.total}`).join(' | ');
    setRondaMsg({ key: `${nextRonda}-${rolls[0]?.nombre ?? ''}`, ronda: nextRonda, primero: rolls[0]?.nombre ?? '' });
    setLog(prev => [...prev, { text: `Ronda ${nextRonda} — Orden de turnos: ${orden}`, type: 'info', id: prev.length, ronda: nextRonda, actor: 'system' }]);
    await sleep(1400);
    setRondaMsg(null);

    setRonda(nextRonda);
    setTurnOrder(rolls.map(r => (r.tipo === 'player' ? { type: 'player' } : { type: 'enemigo', idx: r.idx })));
    setTurnIndex(0);
    /* El jugador tiene exactamente 1 turno por ronda (a diferencia de los enemigos, que pueden
       ser varios) — regenera Fuerza una vez por ronda, sin importar en qué posición del orden
       le toque actuar. */
    setPlayerFuerza(p => Math.min(maxFuerza, p + fuerzaPorTurno));
  };

  /* Arranca la primera ronda al montar (si es un combate nuevo, no uno restaurado) */
  useEffect(() => {
    if (ronda === 0 && phase === 'battle') {
      if (!initialState) void playCombateNpc();
      rollNewRound(enemigosState);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const avanzarTurno = async (enemigosActuales, playerHpActual, playerEstadosActuales) => {
    const vivos = enemigosActuales.filter(e => e.hp > 0);
    if (vivos.length === 0) {
      setPhase('victory');
      return;
    }
    if (playerHpActual.vida <= 0) {
      setPhase('defeat');
      return;
    }
    const next = turnIndex + 1;
    if (next >= turnOrder.length) {
      /* Fin de ronda: tick de estados/buffs para jugador + cada enemigo vivo */
      setPlayerBuffs(prev => prev.map(b => ({ ...b, turns: b.turns - 1 })).filter(b => b.turns > 0));
      setPlayerDebuffs(prev => prev.map(d => ({ ...d, turns: d.turns - 1 })).filter(d => d.turns > 0));

      const playerTick = tickEstadosRonda(playerEstadosActuales, playerHpActual.vida, maxPlayer.vida, player.nombre || 'Tú');
      const nuevoPlayerHp = { ...playerHpActual, vida: playerTick.hp };
      const nuevosEnemigos = enemigosActuales.map((e) => {
        if (e.hp <= 0) return e;
        const tick = tickEstadosRonda(e.estados, e.hp, e.maxHp, e.nombre);
        return {
          ...e, hp: tick.hp, estados: tick.estados,
          buffs: (e.buffs ?? []).map(b => ({ ...b, turns: b.turns - 1 })).filter(b => b.turns > 0),
          debuffs: (e.debuffs ?? []).map(d => ({ ...d, turns: d.turns - 1 })).filter(d => d.turns > 0),
          cooldowns: Object.fromEntries(Object.entries(e.cooldowns ?? {}).filter(([, v]) => v > 1).map(([k, v]) => [k, v - 1])),
        };
      });
      const tickMsgs = [...playerTick.mensajes, ...nuevosEnemigos.flatMap((e, i) => (
        enemigosActuales[i].hp > 0 ? tickEstadosRonda(enemigosActuales[i].estados, enemigosActuales[i].hp, enemigosActuales[i].maxHp, enemigosActuales[i].nombre).mensajes : []
      ))];
      if (tickMsgs.length > 0) {
        setLog(prev => [...prev, ...tickMsgs.map((text, i) => ({ text, type: 'info', id: prev.length + i, ronda, actor: 'system' }))]);
      }
      setPlayerEstados(playerTick.estados);
      setPlayerHp(nuevoPlayerHp);
      setEnemigosState(nuevosEnemigos);
      setCooldowns(prev => Object.fromEntries(Object.entries(prev).filter(([, v]) => v > 1).map(([k, v]) => [k, v - 1])));

      if (nuevoPlayerHp.vida <= 0) { setPhase('defeat'); return; }
      if (nuevosEnemigos.every(e => e.hp <= 0)) { setPhase('victory'); return; }

      await sleep(300);
      await rollNewRound(nuevosEnemigos);
    } else {
      setTurnIndex(next);
    }
  };

  /* ─── Turno de un enemigo (IA): 60% habilidad disponible, si no ataque básico 50/50 rango/melee ── */
  useEffect(() => {
    const current = turnOrder[turnIndex];
    if (!current || current.type !== 'enemigo' || phase !== 'battle') return;
    const idx = current.idx;
    if (enemigosState[idx]?.hp <= 0) { avanzarTurno(enemigosState, playerHp, playerEstados); return; }

    setEnemyActing(true);
    let cancelled = false;
    (async () => {
      await sleep(650);
      if (cancelled) return;

      const enemigo = enemigosState[idx];
      const b = base[idx];

      const paralisisInfo = resolverParalisisAlEmpezarTurno(enemigo.estados);
      if (paralisisInfo.paralizado) {
        const nextEnemigos = enemigosState.map((e, i) => (i === idx ? { ...e, estados: paralisisInfo.estados } : e));
        setEnemigosState(nextEnemigos);
        setLog(prev => [...prev, { text: `${enemigo.nombre} está paralizado y pierde el turno`, type: 'info', id: prev.length, ronda, actor: 'npc' }]);
        setEnemyActing(false);
        await avanzarTurno(nextEnemigos, playerHp, playerEstados);
        return;
      }

      const confundido = resolverConfundido(enemigo.estados);
      if (confundido) {
        setLog(prev => [...prev, { text: `¡${enemigo.nombre} está confundido!`, type: 'info', id: prev.length, ronda, actor: 'npc' }]);
      }

      const cds = enemigo.cooldowns ?? {};
      const disponibles = (b.habilidades ?? []).filter(h => (cds[h.id] ?? 0) <= 0 && h.objetivo !== 'self');
      const hab = (disponibles.length > 0 && Math.random() <= 0.6) ? disponibles[Math.floor(Math.random() * disponibles.length)] : null;

      const useRanged = !confundido && (hab ? hab.tipo !== 'melee' : (b.pnt > 0 && Math.random() > 0.5));
      const targetEstadosPrevios = confundido ? enemigo.estados : playerEstados;
      const aTirada = tirarDados();
      const dTirada = tirarDados();
      const aR = mitigarTiradaAturdido(enemigo.estados, aTirada.total);
      const dR = mitigarTiradaAturdido(targetEstadosPrevios, dTirada.total);
      const atkVal = confundido ? b.atk : (useRanged ? b.pnt : b.atk);
      const defVal = confundido ? (useRanged ? b.mov : b.def) : (useRanged ? effPlayerMov : effPlayerDef);
      const atkRoll = aR + atkVal;
      const defRoll = dR + defVal;
      const esCritico = !confundido && esCriticoEnemigo(b, aTirada.dado1, aTirada.dado2);
      const esFalloCritico = !confundido && esFalloCriticoEnemigo(aTirada.dado1, aTirada.dado2);

      let estadosObjetivo = targetEstadosPrevios;
      const protegidoInfo = consumirProtegido(estadosObjetivo);
      estadosObjetivo = protegidoInfo.estados;
      const marcaInfo = consumirMarcado(estadosObjetivo, aR);
      estadosObjetivo = marcaInfo.estados;

      let hit = esCritico || atkRoll > defRoll;
      if (protegidoInfo.activo) hit = false;
      else if (marcaInfo.activo) hit = marcaInfo.forzarExito;
      if (esFalloCritico) hit = false;

      let reflejo = { activo: false, tipo: null };
      if (hit && !confundido) {
        reflejo = consumirDeflectarOContraataque(estadosObjetivo, useRanged);
        estadosObjetivo = reflejo.estados;
      }

      let nuevoPlayerEstados = playerEstados;
      let nuevoEnemigoEstados = enemigo.estados;
      if (confundido) nuevoEnemigoEstados = estadosObjetivo; else nuevoPlayerEstados = estadosObjetivo;

      const nombreObjetivo = confundido ? enemigo.nombre : (player.nombre || 'Tú');
      const accion = hab ? `usa "${hab.nombre}"` : (useRanged ? 'dispara' : 'ataca');
      const entries = [{
        text: `${enemigo.nombre} ${accion} contra ${nombreObjetivo}: 2d6(${aTirada.dado1}+${aTirada.dado2})+${atkVal}=${atkRoll} vs 2d6(${dTirada.dado1}+${dTirada.dado2})+${defVal}=${defRoll}`,
        type: 'info',
      }];

      let newPlayerHp = playerHp;
      let newEnemigoHpSelf = enemigo.hp;
      let newEnemigoEscudoSelf = enemigo.escudo;
      let habCooldowns = enemigo.cooldowns ?? {};
      if (hab && hab.cooldown > 0) habCooldowns = { ...habCooldowns, [hab.id]: hab.cooldown };

      if (!hit) {
        entries.push({ text: esFalloCritico ? `¡Fallo crítico! ${enemigo.nombre} pierde el equilibrio.` : protegidoInfo.activo ? '¡Protegido! El golpe se bloquea automáticamente.' : `${nombreObjetivo} esquiva/bloquea el ataque.`, type: 'miss' });
        await triggerStrike({ attackerRef: enemyRefs.current[idx], targetRef: confundido ? enemyRefs.current[idx] : playerHudRef, ranged: useRanged, hit: false });
      } else {
        const habForma = hab?.forma ?? 0;
        const dmgBase = hab ? (hab.damage ?? 0) : b.dano;
        const dmgEscudoBase = hab ? (hab.damage_escudo ?? 0) : b.dano_escudo;
        const dmgPerfBase = hab ? (hab.damage_perforante ?? 0) : b.dano_perforante;
        const bonoForma = confundido ? 0 : formaBonoDano(habForma, currentForma);
        let dmg = mitigarDanoDebilitado(enemigo.estados, dmgBase + (esCritico ? 1 : 0) + bonoForma);
        let dmgEscudo = dmgEscudoBase;
        let dmgPerf = dmgPerfBase;

        if (reflejo.activo) {
          const [mDmg, mEsc, mPerf] = mitadDano(dmg, dmgEscudo, dmgPerf);
          const escudoAntes = enemigo.escudo;
          const res = applyDmg(mDmg, { vida: enemigo.hp, escudo: enemigo.escudo }, mEsc, mPerf);
          newEnemigoHpSelf = res.vida; newEnemigoEscudoSelf = res.escudo;
          const verbo = reflejo.tipo === 'deflectar' ? 'deflecta' : 'contraataca';
          entries.push({ text: `¡${nombreObjetivo} ${verbo} el ataque de ${enemigo.nombre}! ${describeDano(mDmg, mEsc, mPerf, escudoAntes)}`, type: 'danger' });
          await triggerStrike({ attackerRef: enemyRefs.current[idx], targetRef: enemyRefs.current[idx], ranged: useRanged, hit: false });
        } else if (confundido) {
          const escudoAntes = enemigo.escudo;
          const res = applyDmg(dmg, { vida: enemigo.hp, escudo: enemigo.escudo }, dmgEscudo, dmgPerf);
          newEnemigoHpSelf = res.vida; newEnemigoEscudoSelf = res.escudo;
          entries.push({ text: `¡Se golpea a sí mismo! ${describeDano(dmg, dmgEscudo, dmgPerf, escudoAntes)}`, type: 'danger' });
          await triggerStrike({ attackerRef: enemyRefs.current[idx], targetRef: enemyRefs.current[idx], ranged: useRanged, hit: true, crit: esCritico, dmg: dmg + dmgPerf });
        } else {
          const escudoAntes = playerHp.escudo;
          const res = applyDmg(dmg, playerHp, dmgEscudo, dmgPerf);
          newPlayerHp = res;
          const efectivo = formaEsEfectiva(habForma, currentForma);
          const resistente = formaEsResistente(habForma, currentForma);
          const formaMsg = efectivo ? '¡Forma efectiva! +1 daño — ' : (resistente ? 'Resistencia de forma −1 daño — ' : '');
          entries.push({ text: `${esCritico ? '¡CRÍTICO! ' : '¡Impacto! '}${formaMsg}${describeDano(dmg, dmgEscudo, dmgPerf, escudoAntes)}`, type: 'danger' });
          await triggerStrike({ attackerRef: enemyRefs.current[idx], targetRef: playerHudRef, ranged: useRanged, hit: true, crit: esCritico, dmg: dmg + dmgPerf });
        }
      }

      /* Los debuffs/estados de la habilidad del enemigo caen sobre el jugador conecte o no el
         golpe (mismo criterio que el buff propio) — incluye deflectar/contraataque. Se salta si el
         enemigo confundido se golpeó a sí mismo: ahí el jugador nunca fue el objetivo. */
      if (hab && !confundido && Array.isArray(hab.debuff) && hab.debuff.length > 0) {
        const debuffStats = hab.debuff.filter(s => !esTipoEstado(s));
        const debuffEstados = hab.debuff.filter(s => esTipoEstado(s) && s !== 'revivir');
        if (debuffStats.length > 0) setPlayerDebuffs(prev => [...prev, ...debuffStats.map(stat => ({ stat, turns: hab.duracion ?? 2 }))]);
        debuffEstados.forEach(tipo => { nuevoPlayerEstados = aplicarEstadoDeHabilidad(nuevoPlayerEstados, tipo); });
        entries.push({ text: `${player.nombre || 'Tú'}: −${[...debuffStats, ...debuffEstados].join(', −')}`, type: 'info' });
      }

      const nextEnemigos = enemigosState.map((e, i) => (i === idx
        ? { ...e, hp: newEnemigoHpSelf, escudo: newEnemigoEscudoSelf, estados: nuevoEnemigoEstados, cooldowns: habCooldowns }
        : e));
      setEnemigosState(nextEnemigos);
      setPlayerHp(newPlayerHp);
      setPlayerEstados(nuevoPlayerEstados);
      setLog(prev => [...prev, ...entries.map((e, i) => ({ ...e, id: prev.length + i, ronda, actor: 'npc' }))]);
      setEnemyActing(false);

      if (newPlayerHp.vida <= 0) { setPhase('defeat'); return; }
      await avanzarTurno(nextEnemigos, newPlayerHp, nuevoPlayerEstados);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnIndex, ronda, phase]);

  const isPlayerTurn = phase === 'battle' && turnOrder[turnIndex]?.type === 'player' && !busy && !enemyActing && !usingObjeto;

  /* ─── Ataque básico del jugador (arma equipada > desarmado) contra el objetivo elegido ── */
  const doPlayerBasicAttack = async (idx) => {
    if (!isPlayerTurn || !(enemigosState[idx]?.hp > 0)) return;
    setBusy(true);
    setSelectedTarget(idx);
    const target = enemigosState[idx];
    const confundido = resolverConfundido(playerEstados);
    const entries = [];
    if (confundido) entries.push({ text: `¡${player.nombre || 'Tú'} está confundido y ataca hacia sí mismo!`, type: 'info' });

    const arma = player.arma_equipada;
    const esDistancia = arma?.tipo_ataque === 'distancia';
    const atkVal = esDistancia ? effPlayerPnt : effPlayerAtk;
    const statsObjetivo = confundido ? { def: effPlayerDef, mov: effPlayerMov } : { def: target.def, mov: target.mov };
    const defVal = esDistancia ? statsObjetivo.mov : statsObjetivo.def;

    const aTirada = tirarDados();
    const dTirada = tirarDados();
    const aR = mitigarTiradaAturdido(playerEstados, aTirada.total);
    const targetEstadosPrevios = confundido ? playerEstados : target.estados;
    const dR = mitigarTiradaAturdido(targetEstadosPrevios, dTirada.total);
    const atkRoll = aR + atkVal;
    const defRoll = dR + defVal;
    const critico = arma?.critico ?? 0;
    const esCritico = aR >= (12 - critico);
    const accion = arma ? `ataca con ${arma.nombre}` : 'ataca desarmado';

    await rollDice([
      { key: 'ply', color: '#38cdf0', label: 'TÚ', values: [aTirada.dado1, aTirada.dado2] },
      { key: 'obj', color: '#ff2d45', label: (confundido ? player.nombre : target.nombre)?.slice(0, 8)?.toUpperCase(), values: [dTirada.dado1, dTirada.dado2] },
    ]);

    entries.push({ text: `${player.nombre || 'Tú'} ${accion} a ${confundido ? 'sí mismo' : target.nombre}: 2d6(${aTirada.dado1}+${aTirada.dado2})+${atkVal}=${atkRoll} vs 2d6(${dTirada.dado1}+${dTirada.dado2})+${defVal}=${defRoll}`, type: 'info' });

    let estadosObjetivo = targetEstadosPrevios;
    const protegidoInfo = consumirProtegido(estadosObjetivo);
    estadosObjetivo = protegidoInfo.estados;
    const marcaInfo = consumirMarcado(estadosObjetivo, aR);
    estadosObjetivo = marcaInfo.estados;

    let hit = esCritico || atkRoll > defRoll;
    if (protegidoInfo.activo) { hit = false; entries.push({ text: '¡El objetivo estaba protegido!', type: 'info' }); }
    else if (marcaInfo.activo) { hit = marcaInfo.forzarExito; entries.push({ text: hit ? '¡Marcado — conecta automáticamente!' : '¡Marcado, pero falla igual (natural 1)!', type: 'info' }); }

    let reflejo = { activo: false, tipo: null };
    if (hit && !confundido) {
      reflejo = consumirDeflectarOContraataque(estadosObjetivo, esDistancia);
      estadosObjetivo = reflejo.estados;
    }
    if (confundido) setPlayerEstados(estadosObjetivo);

    let nextEnemigos = enemigosState;
    let newPlayerHp = playerHp;

    if (hit) {
      const dmg = mitigarDanoDebilitado(playerEstados, (arma?.dano ?? 3) + (esCritico ? 1 : 0) + formaBono(currentForma, 'dano'));
      const dmgEscudo = formaBono(currentForma, 'dano_escudo');
      const dmgPerforante = (arma?.dano_perforante ?? 0) + formaBono(currentForma, 'dano_perforante');

      if (reflejo.activo) {
        const [mDmg, mEsc, mPerf] = mitadDano(dmg, dmgEscudo, dmgPerforante);
        const escudoAntes = playerHp.escudo;
        newPlayerHp = applyDmg(mDmg, playerHp, mEsc, mPerf);
        const verbo = reflejo.tipo === 'deflectar' ? 'deflecta' : 'contraataca';
        entries.push({ text: `¡${target.nombre} ${verbo} tu ataque! ${describeDano(mDmg, mEsc, mPerf, escudoAntes)}`, type: 'danger' });
        await triggerStrike({ attackerRef: playerHudRef, targetRef: playerHudRef, ranged: esDistancia, hit: false });
      } else if (confundido) {
        const escudoAntes = playerHp.escudo;
        newPlayerHp = applyDmg(dmg, playerHp, dmgEscudo, dmgPerforante);
        entries.push({ text: `¡Impacto! ${describeDano(dmg, dmgEscudo, dmgPerforante, escudoAntes)}`, type: 'success' });
        await triggerStrike({ attackerRef: playerHudRef, targetRef: playerHudRef, ranged: esDistancia, hit: true, crit: esCritico, dmg: dmg + dmgPerforante });
      } else {
        const escudoAntes = target.escudo;
        const res = applyDmg(dmg, { vida: target.hp, escudo: target.escudo }, dmgEscudo, dmgPerforante);
        nextEnemigos = enemigosState.map((e, i) => (i === idx ? { ...e, hp: res.vida, escudo: res.escudo, estados: estadosObjetivo } : e));
        entries.push({ text: `${esCritico ? '¡CRÍTICO! ' : '¡Impacto! '}${describeDano(dmg, dmgEscudo, dmgPerforante, escudoAntes)}`, type: 'success' });
        await triggerStrike({ attackerRef: playerHudRef, targetRef: enemyRefs.current[idx], ranged: esDistancia, hit: true, crit: esCritico, dmg: dmg + dmgPerforante });
      }
    } else {
      entries.push({ text: 'Bloqueado / Falla', type: 'miss' });
    }

    /* Estados del enemigo tras la acción (consumo de protegido/marcado/deflectar) cuando la rama de
       daño no los escribió — p.ej. al fallar el golpe o al ser deflectado. */
    if (!confundido && nextEnemigos === enemigosState) {
      nextEnemigos = enemigosState.map((e, i) => (i === idx ? { ...e, estados: estadosObjetivo } : e));
    }

    setEnemigosState(nextEnemigos);
    setPlayerHp(newPlayerHp);
    setLog(prev => [...prev, ...entries.map((e, i) => ({ ...e, id: prev.length + i, ronda, actor: 'player' }))]);
    setBusy(false);

    if (newPlayerHp.vida <= 0) { setPhase('defeat'); return; }
    await avanzarTurno(nextEnemigos, newPlayerHp, confundido ? estadosObjetivo : playerEstados);
  };

  /* ─── Habilidad del jugador (forma actual) contra el objetivo elegido, o self ── */
  const doPlayerSkill = async (hab, targetIdx) => {
    if (!isPlayerTurn) return;
    if (hab.objetivo !== 'self' && !(enemigosState[targetIdx]?.hp > 0)) return;
    const habId = String(hab.id);
    if ((cooldowns[habId] ?? 0) > 0) return;
    if (playerFuerza < hab.costo_fuerza) return;
    setBusy(true);

    setPlayerFuerza(prev => prev - hab.costo_fuerza);
    const nextCooldowns = hab.cooldown > 0 ? { ...cooldowns, [habId]: hab.cooldown } : cooldowns;
    setCooldowns(nextCooldowns);

    const habBuff = Array.isArray(hab.buff) ? hab.buff : [];
    const habDebuff = Array.isArray(hab.debuff) ? hab.debuff : [];
    const habRondas = hab.duracion ?? 2;
    const entries = [];

    if (hab.objetivo === 'self') {
      const buffStats = habBuff.filter(s => !esTipoEstado(s));
      const buffEstados = habBuff.filter(esTipoEstado);
      const buffDesc = buffStats.map(s => `+1 ${s}`).join(', ');
      entries.push({ text: `${player.nombre || 'Tú'} usa "${hab.nombre}"${buffDesc ? ` (${buffDesc})` : ''}`, type: 'info' });

      const selfDmg = hab.damage ?? 0;
      const selfDmgEscudo = hab.damage_escudo ?? 0;
      let newPlayerHp = { ...playerHp };
      if (selfDmg < 0) {
        newPlayerHp.vida = Math.min(maxPlayer.vida, newPlayerHp.vida - selfDmg);
        entries.push({ text: `¡Curación! +${-selfDmg} vida`, type: 'success' });
        showFloatText(playerHudRef, { variant: 'heal', text: `Curación: ${-selfDmg}` });
      }
      if (selfDmgEscudo < 0) {
        newPlayerHp.escudo = Math.min(maxPlayer.escudo, newPlayerHp.escudo - selfDmgEscudo);
        entries.push({ text: `¡Escudo restaurado! +${-selfDmgEscudo}`, type: 'success' });
        showFloatText(playerHudRef, { variant: 'heal', text: `Curación: ${-selfDmgEscudo}` });
      }

      let nuevoEstados = playerEstados;
      buffEstados.filter(t => t !== 'revivir').forEach(tipo => { nuevoEstados = aplicarEstadoDeHabilidad(nuevoEstados, tipo); });

      if (buffStats.length > 0) setPlayerBuffs(prev => [...prev, ...buffStats.map(stat => ({ stat, turns: habRondas }))]);
      if (selfDmg < 0 || selfDmgEscudo < 0) await playStatusFx(playerHudRef, 'heal');
      else if (buffStats.length > 0 || buffEstados.length > 0) await playStatusFx(playerHudRef, 'buff');

      setPlayerHp(newPlayerHp);
      setPlayerEstados(nuevoEstados);
      setLog(prev => [...prev, ...entries.map((e, i) => ({ ...e, id: prev.length + i, ronda, actor: 'player' }))]);
      setBusy(false);
      await avanzarTurno(enemigosState, newPlayerHp, nuevoEstados);
      return;
    }

    /* Objetivo: target — el enemigo que el jugador eligió en su ficha */
    const idx = targetIdx;
    const target = enemigosState[idx];
    if (!target || target.hp <= 0) { setBusy(false); return; }
    setSelectedTarget(idx);

    const confundido = resolverConfundido(playerEstados);
    const statsObjetivo = confundido ? { def: effPlayerDef, mov: effPlayerMov } : { def: target.def, mov: target.mov };
    const useAtq = hab.tipo === 'melee';
    const atkVal = useAtq ? effPlayerAtk : effPlayerPnt;
    const defVal = useAtq ? statsObjetivo.def : statsObjetivo.mov;

    const aTirada = tirarDados();
    const dTirada = tirarDados();
    const aR = mitigarTiradaAturdido(playerEstados, aTirada.total);
    const targetEstadosPrevios = confundido ? playerEstados : target.estados;
    const dR = mitigarTiradaAturdido(targetEstadosPrevios, dTirada.total);
    const atkRoll = aR + atkVal;
    const defRoll = dR + defVal;

    await rollDice([
      { key: 'ply', color: '#38cdf0', label: 'TÚ', values: [aTirada.dado1, aTirada.dado2] },
      { key: 'obj', color: '#ff2d45', label: (confundido ? player.nombre : target.nombre)?.slice(0, 8)?.toUpperCase(), values: [dTirada.dado1, dTirada.dado2] },
    ]);
    entries.push({ text: `${player.nombre || 'Tú'} usa "${hab.nombre}": 2d6(${aTirada.dado1}+${aTirada.dado2})+${atkVal}=${atkRoll} vs 2d6(${dTirada.dado1}+${dTirada.dado2})+${defVal}=${defRoll}`, type: 'info' });

    let estadosObjetivo = targetEstadosPrevios;
    const protegidoInfo = consumirProtegido(estadosObjetivo);
    estadosObjetivo = protegidoInfo.estados;
    const marcaInfo = consumirMarcado(estadosObjetivo, aR);
    estadosObjetivo = marcaInfo.estados;

    let hit = atkRoll > defRoll;
    if (protegidoInfo.activo) { hit = false; entries.push({ text: '¡El objetivo estaba protegido!', type: 'info' }); }
    else if (marcaInfo.activo) { hit = marcaInfo.forzarExito; entries.push({ text: hit ? '¡Marcado — conecta automáticamente!' : '¡Marcado, pero falla igual!', type: 'info' }); }

    let reflejo = { activo: false, tipo: null };
    if (hit && !confundido) {
      reflejo = consumirDeflectarOContraataque(estadosObjetivo, !useAtq);
      estadosObjetivo = reflejo.estados;
    }
    if (confundido) setPlayerEstados(estadosObjetivo);

    let nextEnemigos = enemigosState;
    let newPlayerHp = playerHp;

    if (hit) {
      let dmg = hab.damage ?? 0;
      let dmgEscudo = hab.damage_escudo ?? 0;
      let dmgPerforante = hab.damage_perforante ?? 0;
      const efectivo = !confundido && formaEsEfectiva(hab.forma, target.forma);
      const resistente = !confundido && formaEsResistente(hab.forma, target.forma);
      if (!confundido) {
        const bono = formaBonoDano(hab.forma, target.forma);
        dmg = Math.max(0, dmg + bono);
        if (efectivo) entries.push({ text: `¡Forma efectiva! +1 daño (Forma ${formaLabel(hab.forma)} vs Forma ${formaLabel(target.forma)})`, type: 'success' });
        else if (resistente) entries.push({ text: `Resistencia de forma −1 daño (Forma ${formaLabel(hab.forma)} vs Forma ${formaLabel(target.forma)})`, type: 'danger' });
      }
      dmg += formaBono(currentForma, 'dano');
      dmgEscudo += formaBono(currentForma, 'dano_escudo');
      dmgPerforante += formaBono(currentForma, 'dano_perforante');
      dmg = mitigarDanoDebilitado(playerEstados, dmg);

      if (reflejo.activo) {
        const [mDmg, mEsc, mPerf] = mitadDano(dmg, dmgEscudo, dmgPerforante);
        const escudoAntes = playerHp.escudo;
        newPlayerHp = applyDmg(mDmg, playerHp, mEsc, mPerf);
        const verbo = reflejo.tipo === 'deflectar' ? 'deflecta' : 'contraataca';
        entries.push({ text: `¡${target.nombre} ${verbo} tu ataque! ${describeDano(mDmg, mEsc, mPerf, escudoAntes)}`, type: 'danger' });
        await triggerStrike({ attackerRef: playerHudRef, targetRef: playerHudRef, ranged: !useAtq, hit: false });
      } else if (confundido) {
        const escudoAntes = playerHp.escudo;
        newPlayerHp = applyDmg(dmg, playerHp, dmgEscudo, dmgPerforante);
        entries.push({ text: `¡Impacto! ${describeDano(dmg, dmgEscudo, dmgPerforante, escudoAntes)}`, type: 'success' });
        await triggerStrike({ attackerRef: playerHudRef, targetRef: playerHudRef, ranged: !useAtq, hit: true, dmg: dmg + dmgPerforante });
      } else {
        const escudoAntes = target.escudo;
        const res = applyDmg(dmg, { vida: target.hp, escudo: target.escudo }, dmgEscudo, dmgPerforante);
        nextEnemigos = enemigosState.map((e, i) => (i === idx
          ? { ...e, hp: res.vida, escudo: res.escudo, estados: estadosObjetivo }
          : e));
        entries.push({ text: `¡Impacto! ${describeDano(dmg, dmgEscudo, dmgPerforante, escudoAntes)}`, type: 'success' });
        await triggerStrike({ attackerRef: playerHudRef, targetRef: enemyRefs.current[idx], ranged: !useAtq, hit: true, dmg: dmg + dmgPerforante });
      }
    } else {
      entries.push({ text: `${player.nombre || 'Tú'} falla el ataque`, type: 'miss' });
    }

    /* Estados del enemigo tras la acción (consumo de protegido/marcado/deflectar) cuando ninguna
       de las ramas de arriba ya los escribió — p.ej. al fallar el golpe o al ser deflectado. */
    if (!confundido && nextEnemigos === enemigosState) {
      nextEnemigos = enemigosState.map((e, i) => (i === idx ? { ...e, estados: estadosObjetivo } : e));
    }

    /* Los debuffs/estados de la habilidad caen sobre el enemigo conecte o no el golpe (mismo
       criterio que el buff propio) — la tirada decide el daño, no el efecto; incluye el caso de
       deflectar/contraataque. Se salta si la confusión redirigió el ataque contra uno mismo. */
    const debuffStats = habDebuff.filter(s => !esTipoEstado(s));
    const debuffEstados = habDebuff.filter(s => esTipoEstado(s) && s !== 'revivir');
    if (!confundido && (debuffStats.length > 0 || debuffEstados.length > 0)) {
      nextEnemigos = nextEnemigos.map((e, i) => {
        if (i !== idx) return e;
        let est = e.estados;
        debuffEstados.forEach(tipo => { est = aplicarEstadoDeHabilidad(est, tipo); });
        return {
          ...e,
          estados: est,
          debuffs: debuffStats.length > 0 ? [...(e.debuffs ?? []), ...debuffStats.map(stat => ({ stat, turns: habRondas }))] : e.debuffs,
        };
      });
      entries.push({ text: `${target.nombre}: −${[...debuffStats, ...debuffEstados].join(', −')}`, type: 'info' });
    }

    setEnemigosState(nextEnemigos);
    setPlayerHp(newPlayerHp);
    setLog(prev => [...prev, ...entries.map((e, i) => ({ ...e, id: prev.length + i, ronda, actor: 'player' }))]);
    setBusy(false);

    if (newPlayerHp.vida <= 0) { setPhase('defeat'); return; }
    await avanzarTurno(nextEnemigos, newPlayerHp, confundido ? estadosObjetivo : playerEstados);
  };

  /* ─── Objeto utilizable: buff/heal a uno mismo, debuff al objetivo elegido ── */
  const doUsarObjeto = async (objeto, targetIdx) => {
    if (!isPlayerTurn || usingObjeto || !onUsarObjeto) return;
    setUsingObjeto(true);
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

      const entries = [{ text: `${player.nombre || 'Tú'} usa ${objeto.nombre}`, type: 'success' }];
      const objBuff = Array.isArray(objeto.buff) ? objeto.buff : [];
      const objDebuff = Array.isArray(objeto.debuff) ? objeto.debuff : [];
      const buffStats = objBuff.filter(s => !esTipoEstado(s));
      const buffEstados = objBuff.filter(s => esTipoEstado(s) && s !== 'revivir');
      const debuffStats = objDebuff.filter(s => !esTipoEstado(s));
      const debuffEstados = objDebuff.filter(s => esTipoEstado(s) && s !== 'revivir');

      let nuevoPlayerEstados = playerEstados;
      if (buffStats.length > 0) { setPlayerBuffs(prev => [...prev, ...buffStats.map(stat => ({ stat, turns: 2 }))]); entries.push({ text: `${player.nombre || 'Tú'}: +${buffStats.join(', +')}`, type: 'info' }); }
      buffEstados.forEach(tipo => { nuevoPlayerEstados = aplicarEstadoDeHabilidad(nuevoPlayerEstados, tipo); });

      let nextEnemigos = enemigosState;
      const idx = targetIdx ?? selectedTarget;
      if ((debuffStats.length > 0 || debuffEstados.length > 0) && enemigosState[idx]?.hp > 0) {
        if (idx !== selectedTarget) setSelectedTarget(idx);
        nextEnemigos = enemigosState.map((e, i) => {
          if (i !== idx) return e;
          let est = e.estados;
          debuffEstados.forEach(tipo => { est = aplicarEstadoDeHabilidad(est, tipo); });
          return { ...e, estados: est, debuffs: debuffStats.length > 0 ? [...(e.debuffs ?? []), ...debuffStats.map(stat => ({ stat, turns: 2 }))] : e.debuffs };
        });
        if (debuffStats.length > 0) entries.push({ text: `${enemigosState[idx].nombre}: −${debuffStats.join(', −')}`, type: 'info' });
      }

      setEnemigosState(nextEnemigos);
      setPlayerHp(newHp);
      setPlayerEstados(nuevoPlayerEstados);
      setLog(prev => [...prev, ...entries.map((e, i) => ({ ...e, id: prev.length + i, ronda, actor: 'player' }))]);
      await avanzarTurno(nextEnemigos, newHp, nuevoPlayerEstados);
    } catch (e) {
      setLog(prev => [...prev, { text: e?.message || 'No se pudo usar el objeto.', type: 'danger', id: prev.length, ronda, actor: 'player' }]);
    } finally {
      setUsingObjeto(false);
    }
  };

  /* ─── Huir: tirada de iniciativa contra el enemigo vivo con más Iniciativa ── */
  const doPlayerFlee = async () => {
    if (!isPlayerTurn) return;
    setBusy(true);
    const vivos = enemigosVivos();
    const rival = vivos.reduce((max, cur) => (cur.e.ini > (max?.e.ini ?? -1) ? cur : max), null);
    const aTirada = tirarDados();
    const dTirada = tirarDados();
    const aR = aTirada.total + effPlayerIni;
    const dR = dTirada.total + (rival?.e.ini ?? 0);
    const gana = aR >= dR;

    await rollDice([
      { key: 'ply', color: '#38cdf0', label: 'TÚ', values: [aTirada.dado1, aTirada.dado2] },
      { key: 'obj', color: '#ff2d45', label: rival?.e.nombre?.slice(0, 8)?.toUpperCase() ?? '—', values: [dTirada.dado1, dTirada.dado2] },
    ]);
    setLog(prev => [...prev, {
      text: `${player.nombre || 'Tú'} intenta huir: 2d6(${aTirada.dado1}+${aTirada.dado2})+${effPlayerIni}=${aR} vs 2d6(${dTirada.dado1}+${dTirada.dado2})+${rival?.e.ini ?? 0}=${dR}`,
      type: 'info', id: prev.length, ronda, actor: 'player',
    }]);

    if (gana) {
      setLog(prev => [...prev, { text: `¡${player.nombre || 'Tú'} logra huir!`, type: 'success', id: prev.length, ronda, actor: 'player' }]);
      setPhase('fled');
      setBusy(false);
      return;
    }
    setLog(prev => [...prev, { text: `${player.nombre || 'Tú'} no logra huir y pierde el turno`, type: 'miss', id: prev.length, ronda, actor: 'player' }]);
    setBusy(false);
    await avanzarTurno(enemigosState, playerHp, playerEstados);
  };

  const doChangeForma = (forma) => {
    if (!isPlayerTurn) return;
    setStancePicker(false);
    setCurrentForma(forma);
    setLog(prev => [...prev, { text: `${player.nombre || 'Tú'} cambia a Forma ${formaLabel(forma)} (${FORMA_LABELS_SHORT[forma - 1]})`, type: 'info', id: prev.length, ronda, actor: 'player' }]);
    avanzarTurno(enemigosState, playerHp, playerEstados);
  };

  /* ─── Elección de objetivo ────────────────────────────────────────────────────────────
     Toda acción dirigida (ataque básico, habilidad con objetivo, objeto con debuff) entra
     primero en modo "apuntar": las fichas de la horda quedan elegibles y el jugador confirma
     haciendo click en la del enemigo que quiere golpear. Con un único enemigo vivo no hay
     nada que elegir, así que se resuelve de inmediato. */
  const objetoNecesitaObjetivo = (objeto) => (Array.isArray(objeto.debuff) ? objeto.debuff : []).some(s => s !== 'revivir');

  const ejecutarAccion = (accion, idx) => {
    setTargeting(null);
    if (accion.kind === 'basico') { void doPlayerBasicAttack(idx); return; }
    if (accion.kind === 'habilidad') {
      if (accion.hab.sonido) void playSound(accion.hab.sonido);
      void doPlayerSkill(accion.hab, idx);
      return;
    }
    setObjetoPicker(false);
    void doUsarObjeto(accion.objeto, idx);
  };

  const pedirObjetivo = (accion) => {
    if (!isPlayerTurn) return;
    if (accion.kind === 'habilidad') void playClickHabilidad(); else void playClickOpcion();
    const requiere = accion.kind === 'basico'
      || (accion.kind === 'habilidad' && accion.hab.objetivo !== 'self')
      || (accion.kind === 'objeto' && objetoNecesitaObjetivo(accion.objeto));
    if (!requiere) { ejecutarAccion(accion, selectedTarget); return; }
    const vivos = enemigosVivos();
    if (vivos.length === 0) return;
    if (vivos.length === 1) { ejecutarAccion(accion, vivos[0].idx); return; }
    setObjetoPicker(false);
    setStancePicker(false);
    setTargeting(accion);
  };

  const clickEnemigo = (idx) => {
    if (targeting) { void playClickOpcion(); ejecutarAccion(targeting, idx); return; }
    setSelectedTarget(idx);
  };

  /* Si deja de ser el turno del jugador (o termina el combate), se cancela el modo apuntar */
  useEffect(() => { if (!isPlayerTurn) setTargeting(null); }, [isPlayerTurn]);

  /* Escape cancela lo que esté abierto: apuntar > selector de objeto > selector de forma */
  useEffect(() => {
    const onKey = (ev) => {
      if (ev.key !== 'Escape') return;
      if (targeting) setTargeting(null);
      else if (objetoPicker) setObjetoPicker(false);
      else if (stancePicker) setStancePicker(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [targeting, objetoPicker, stancePicker]);

  const targetingLabel = targeting?.kind === 'habilidad' ? targeting.hab.nombre
    : targeting?.kind === 'objeto' ? targeting.objeto.nombre
      : 'Ataque básico';

  /* ─── Fin de combate: notifica al padre ── */
  useEffect(() => {
    if (phase === 'victory') {
      localStorage.removeItem('nx-horda-combat');
      onVictory?.(playerHp, enemigosState.map(e => e.id));
    } else if (phase === 'defeat') {
      localStorage.removeItem('nx-horda-combat');
      onDefeat?.(playerHp);
    } else if (phase === 'fled') {
      localStorage.removeItem('nx-horda-combat');
      onFlee?.(playerHp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const logRounds = useMemo(() => {
    const rounds = [];
    let curRound = null;
    let curTurn = null;
    log.forEach(entry => {
      const r = entry.ronda ?? 1;
      if (!curRound || curRound.ronda !== r) { curRound = { ronda: r, turns: [] }; rounds.push(curRound); curTurn = null; }
      const actor = entry.actor ?? 'system';
      if (!curTurn || curTurn.actor !== actor) { curTurn = { actor, entries: [] }; curRound.turns.push(curTurn); }
      curTurn.entries.push(entry);
    });
    return rounds;
  }, [log]);

  const LOG_C = { info: 'rgba(200,225,255,0.75)', success: '#10b981', danger: '#ff6b6b', miss: 'rgba(200,200,200,0.5)' };

  /* Enemigo al que le toca actuar ahora (para resaltar su ficha, como el "TURNO DEL JEFE") */
  const turnoActual = turnOrder[turnIndex];
  const enemigoActivoIdx = turnoActual?.type === 'enemigo' ? turnoActual.idx : -1;
  const enPie = enemigosState.filter(e => e.hp > 0).length;
  const armaSable = (player.arma_equipada?.es_sable && NX.SABERS[player.arma_equipada.color_hoja]) || '#ff9955';

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? 0 : 12,
    }}>
      <div ref={stageRef} style={{
        position: 'relative', width: '100%', maxWidth: 980, height: '100%', maxHeight: isMobile ? '100%' : 720,
        borderRadius: isMobile ? 0 : 18, overflow: 'hidden',
        boxShadow: '0 0 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,45,69,0.18)',
      }}>
        {mediaUrl(lugarImagen)
          ? <img src={mediaUrl(lugarImagen)} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 30%, #2a0c14, #020810)' }} />}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(2,6,16,0.76)' }} />

        <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>

          {/* Aviso grande de inicio de ronda — mismo criterio que RaidCombatScreen: el detalle
              de la tirada de iniciativa queda en el registro, acá solo la ronda y quién abre. */}
          {rondaMsg && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 45,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none', overflow: 'hidden',
            }}>
              <span key={rondaMsg.key} className="nx-turno-banner" style={{ fontSize: 'clamp(30px, 7vw, 54px)' }}>
                Ronda {rondaMsg.ronda}
              </span>
              <span style={{ marginTop: 4, fontSize: 12, color: '#ff9999', fontFamily: 'var(--font-data)', letterSpacing: '0.12em' }}>
                Abre {rondaMsg.primero}
              </span>
            </div>
          )}

          {/* ── Barra superior: orden de turnos ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(4,9,20,0.6)', borderBottom: '1px solid rgba(255,45,69,0.16)' }}>
            <span className="nx-kicker" style={{ fontSize: 8, flexShrink: 0 }}>RONDA {ronda}</span>
            <div style={{ display: 'flex', gap: 8, flex: 1, overflowX: 'auto' }}>
              {turnOrder.map((t, i) => {
                const active = i === turnIndex;
                const esEnemigo = t.type === 'enemigo';
                const e = esEnemigo ? enemigosState[t.idx] : null;
                const img = esEnemigo ? mediaUrl(e?.imagen_mini || e?.imagen) : mediaUrl(player.photo);
                const nombre = esEnemigo ? (e?.nombre ?? '?') : (player.nombre || 'Tú');
                const dead = esEnemigo ? (e?.hp ?? 0) <= 0 : playerHp.vida <= 0;
                return (
                  <div key={i} title={nombre} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0,
                    opacity: dead ? 0.35 : 1,
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                      border: `2px solid ${active ? (esEnemigo ? '#ff2d45' : 'var(--holo)') : 'rgba(255,255,255,0.15)'}`,
                      boxShadow: active ? `0 0 12px ${esEnemigo ? '#ff2d45' : 'var(--holo)'}` : 'none',
                      background: esEnemigo ? 'rgba(255,45,69,0.15)' : 'rgba(56,205,240,0.15)', display: 'grid', placeItems: 'center',
                    }}>
                      {img ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name={esEnemigo ? 'flame' : 'user'} size={14} style={{ color: esEnemigo ? '#ff2d45' : 'var(--holo)' }} />}
                    </div>
                    <span style={{ fontSize: 7, color: active ? 'var(--txt)' : 'var(--txt-faint)', fontFamily: 'var(--font-data)', maxWidth: 42, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre}</span>
                  </div>
                );
              })}
            </div>
            {!isMobile && (planetaNombre || lugarNombre) && (
              <div style={{ textAlign: 'right', flexShrink: 0, fontFamily: 'var(--font-data)' }}>
                <div style={{ fontSize: 8, color: 'rgba(200,225,255,0.45)', letterSpacing: '0.12em' }}>{planetaNombre}</div>
                <div style={{ fontSize: 11, color: '#ff9999', fontWeight: 700 }}>⚔ HORDA · {lugarNombre}</div>
              </div>
            )}
            <button onClick={() => setLogCollapsed(v => !v)} title={logCollapsed ? 'Mostrar registro' : 'Ocultar registro'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: logCollapsed ? 'var(--txt-faint)' : 'var(--holo)', flexShrink: 0 }}>
              <Icon name="tasks" size={15} />
            </button>
          </div>

          {/* ── Centro: horda + registro ── */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 10, padding: 12 }}>
            <div style={{ flex: logCollapsed ? '1 1 100%' : '1 1 55%', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span className="nx-kicker" style={{ fontSize: 8, color: '#ff9999' }}>HORDA · {enPie}/{enemigosState.length} EN PIE</span>
                {!targeting && enPie > 1 && (
                  <span style={{ fontSize: 8, color: 'var(--txt-faint)', fontFamily: 'var(--font-data)' }}>elige objetivo al atacar</span>
                )}
              </div>

              {/* Aviso del modo apuntar: la acción queda pendiente hasta que se elija la ficha */}
              {targeting && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8,
                  background: 'rgba(230,179,37,0.12)', border: '1px solid rgba(230,179,37,0.5)',
                }}>
                  <Icon name="target" size={14} style={{ color: '#E6B325' }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 10, color: '#E6B325', fontFamily: 'var(--font-data)', letterSpacing: '0.04em' }}>
                    Elige el objetivo de <strong>{targetingLabel}</strong>
                  </span>
                  <button onClick={() => { void playClickOpcion(); setTargeting(null); }} style={{
                    background: 'none', border: '1px solid rgba(230,179,37,0.45)', borderRadius: 6, cursor: 'pointer',
                    color: '#E6B325', fontFamily: 'var(--font-data)', fontSize: 9, padding: '3px 8px', letterSpacing: '0.08em',
                  }}>CANCELAR</button>
                </div>
              )}

              <div style={{
                flex: 1, minHeight: 0, overflowY: 'auto', display: 'grid', alignContent: 'start',
                gridTemplateColumns: enemigosState.length === 1 ? '1fr' : 'repeat(2, 1fr)', gap: 8,
              }}>
                {enemigosState.map((e, idx) => (
                  <EnemyCard key={`${e.id}-${idx}`} enemigo={e}
                    seleccionado={selectedTarget === idx}
                    apuntando={!!targeting}
                    activo={enemigoActivoIdx === idx}
                    compact={isMobile}
                    onSelect={() => clickEnemigo(idx)}
                    cardRef={(el) => { enemyRefs.current[idx] = { current: el }; }}
                  />
                ))}
              </div>
            </div>

            {/* Registro */}
            <div style={{
              flex: '1 1 45%', display: logCollapsed ? 'none' : 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0,
              background: 'rgba(4,9,20,0.55)', backdropFilter: 'blur(10px)', borderRadius: 10,
              border: '1px solid rgba(255,45,69,0.16)', overflow: 'hidden',
            }}>
              <div style={{ padding: '7px 10px', borderBottom: '1px solid rgba(255,45,69,0.14)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="tasks" size={12} style={{ color: '#ff9999' }} />
                <span style={{ fontSize: 8, color: 'rgba(255,150,150,0.7)', fontFamily: 'var(--font-data)', letterSpacing: '0.1em' }}>REGISTRO DE RONDAS</span>
              </div>
              <div ref={logRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {logRounds.map(round => (
                  <div key={round.ronda} style={{ border: '1px solid rgba(255,45,69,0.16)', borderRadius: 8, background: 'rgba(255,45,69,0.035)', padding: '5px 6px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: 8, color: '#ff9999', fontFamily: 'var(--font-data)', letterSpacing: '0.14em', fontWeight: 700, opacity: 0.85 }}>RONDA {round.ronda}</div>
                    {round.turns.map((turn, ti) => {
                      const isSystem = turn.actor === 'system';
                      const isNpc = turn.actor === 'npc';
                      return (
                        <div key={ti} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {turn.entries.map(e => (
                            <div key={e.id} style={{
                              fontSize: 10, color: LOG_C[e.type] ?? 'rgba(200,225,255,0.75)', fontFamily: 'var(--font-data)',
                              lineHeight: 1.4, paddingLeft: isSystem ? 6 : 0, borderLeft: isSystem ? '2px solid #ff6b6b' : 'none',
                            }}>{renderDiceText(e.text, isNpc ? ['#ff2d45', '#38cdf0'] : ['#38cdf0', '#ff2d45'])}</div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
                {enemyActing && <span style={{ fontSize: 9, color: '#ff9999', fontFamily: 'var(--font-data)' }}>Enemigo actuando…</span>}
              </div>
            </div>
          </div>

          {/* ── Barra inferior: el jugador ── */}
          <div style={{ padding: '10px 14px', background: 'rgba(4,9,20,0.6)', borderTop: '1px solid rgba(56,205,240,0.16)' }}>
            <div ref={playerHudRef} style={{
              display: 'flex', gap: 10, alignItems: 'center', padding: '6px 10px', borderRadius: 8,
              border: `1px solid ${isPlayerTurn ? 'var(--holo)' : 'rgba(255,255,255,0.1)'}`,
              background: isPlayerTurn ? 'color-mix(in srgb, var(--holo) 10%, transparent)' : 'rgba(255,255,255,0.02)',
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                background: 'rgba(56,205,240,0.15)', display: 'grid', placeItems: 'center', border: '2px solid rgba(56,205,240,0.4)',
              }}>
                {player.photo
                  ? <img src={mediaUrl(player.photo)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Icon name="user" size={16} style={{ color: 'var(--holo)' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--holocron-oro)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {player.nombre || 'Tú'}
                  </span>
                  <span style={{ fontSize: 8, color: '#a78bfa', fontFamily: 'var(--font-data)' }}>F{formaLabel(currentForma)} · {FORMA_LABELS_SHORT[currentForma - 1]}</span>
                  {isPlayerTurn && <span style={{ fontSize: 8, color: 'var(--holo)', fontFamily: 'var(--font-data)', letterSpacing: '0.1em' }}>TU TURNO</span>}
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: '1 1 180px', minWidth: 140 }}>
                    {maxPlayer.escudo > 0 && <StatBar label="ESC" value={Math.max(0, playerHp.escudo)} max={maxPlayer.escudo} color="#38cdf0" />}
                    <StatBar label="VID" value={Math.max(0, playerHp.vida)} max={maxPlayer.vida}
                      color={playerHp.vida / maxPlayer.vida > 0.5 ? '#10b981' : playerHp.vida / maxPlayer.vida > 0.25 ? '#E6B325' : '#ff2d45'} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
                    <AttrBadges align="right" badges={[
                      { l: 'ATQ', v: effPlayerAtk, base: player.ataque, c: '#ff7043' },
                      { l: 'DEF', v: effPlayerDef, base: player.defensa, c: '#38cdf0' },
                      ...(effPlayerPnt > 0 ? [{ l: 'PNT', v: effPlayerPnt, base: player.punteria, c: '#10b981' }] : []),
                      { l: 'AGI', v: effPlayerMov, base: player.movimiento, c: '#a78bfa' },
                    ]} />
                    <EstadoBadges estados={playerEstados} align="right" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Barra de acciones ── */}
          {phase === 'battle' && (
            <div style={{ padding: '10px 14px', background: 'rgba(4,9,20,0.7)', borderTop: '1px solid rgba(56,205,240,0.16)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 8, color: '#38cdf0', fontFamily: 'var(--font-data)', letterSpacing: '0.12em', flexShrink: 0 }}>FUERZA</span>
                <div style={{ display: 'flex', gap: 2, flex: 1 }}>
                  {Array.from({ length: maxFuerza }, (_, i) => (
                    <div key={i} style={{ flex: 1, height: 6, borderRadius: 2, background: i < playerFuerza ? '#38cdf0' : 'rgba(56,205,240,0.12)' }} />
                  ))}
                </div>
                <span style={{ fontSize: 8, color: '#38cdf0', fontFamily: 'var(--font-data)', flexShrink: 0 }}>{playerFuerza}/{maxFuerza}</span>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'stretch', minHeight: 90 }}>
                {/* Habilidades (grid 2x2) */}
                <div style={{ flex: '1 1 62%', minWidth: 0, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: 5 }}>
                  {habilidades.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', gridRow: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 10, color: 'rgba(150,200,255,0.3)', fontFamily: 'var(--font-data)' }}>Sin habilidades equipadas</span>
                    </div>
                  ) : habilidades.map(hab => {
                    const cdLeft = cooldowns[String(hab.id)] ?? 0;
                    const noFuerza = playerFuerza < hab.costo_fuerza;
                    const disabled = !isPlayerTurn || cdLeft > 0 || noFuerza;
                    const isSelf = hab.objetivo === 'self';
                    const pendiente = targeting?.kind === 'habilidad' && targeting.hab.id === hab.id;
                    return (
                      <button key={hab.id} onClick={() => !disabled && pedirObjetivo({ kind: 'habilidad', hab })} disabled={disabled}
                        onMouseEnter={() => setHoveredHabId(hab.id)} onMouseLeave={() => setHoveredHabId(null)}
                        style={{
                          minWidth: 0, borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
                          background: pendiente ? 'rgba(230,179,37,0.14)' : disabled ? 'rgba(255,45,69,0.03)' : 'rgba(255,45,69,0.08)',
                          border: `1px solid ${pendiente ? '#E6B325' : disabled ? 'rgba(255,45,69,0.09)' : 'rgba(255,45,69,0.26)'}`,
                          display: 'flex', flexDirection: 'column', alignItems: 'stretch', textAlign: 'left',
                          gap: 3, padding: 4, opacity: disabled ? 0.45 : 1, position: 'relative', transition: 'all 0.13s',
                        }}>
                        {hoveredHabId === hab.id && <SkillTooltip hab={hab} />}
                        {cdLeft > 0 && (
                          <div style={{ position: 'absolute', inset: 0, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.55)', zIndex: 2 }}>
                            <span style={{ fontSize: 13, color: '#ff6b6b', fontFamily: 'var(--font-data)', fontWeight: 700 }}>CD {cdLeft}</span>
                          </div>
                        )}
                        <div style={{ borderBottom: '1px solid rgba(255,45,69,0.18)', paddingBottom: 3 }}>
                          <span style={{ fontSize: 9, color: 'var(--txt)', fontFamily: 'var(--font-data)', fontWeight: 700, letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{hab.nombre}</span>
                        </div>
                        <div style={{ display: 'flex', flex: 1, minHeight: 0, alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 6, overflow: 'hidden', background: 'rgba(0,0,0,0.28)', display: 'grid', placeItems: 'center' }}>
                            {hab.icono_url
                              ? <img src={mediaUrl(hab.icono_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <span style={{ fontSize: 16, lineHeight: 1 }}>{tipoIcon(hab.tipo)}</span>}
                          </div>
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, justifyContent: 'center' }}>
                            <span style={{ fontSize: 7, color: 'rgba(150,200,255,0.55)', fontFamily: 'var(--font-data)' }}>
                              {hab.tipo === 'melee' ? '⚔ Melee' : '◎ Distancia'}
                            </span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                              {isSelf
                                ? <span style={{ fontSize: 7, color: '#10b981', fontFamily: 'var(--font-data)' }}>BUFF</span>
                                : (
                                  <span style={{ fontSize: 7, color: '#ff7043', fontFamily: 'var(--font-data)' }}>
                                    DMG {hab.damage}
                                    {!!hab.damage_perforante && <span style={{ color: '#8aa0c0' }}> +{hab.damage_perforante}P</span>}
                                  </span>
                                )}
                              <span style={{
                                fontSize: 7, fontFamily: 'var(--font-data)', padding: '1px 4px', borderRadius: 3,
                                background: noFuerza ? 'rgba(255,45,69,0.25)' : 'rgba(56,205,240,0.15)',
                                color: noFuerza ? '#ff6b6b' : '#38cdf0',
                              }}>⚡{hab.costo_fuerza}</span>
                              {hab.forma > 0 && <span style={{ fontSize: 7, color: 'rgba(150,200,255,0.5)', fontFamily: 'var(--font-data)' }}>F{hab.forma}</span>}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', flexShrink: 0, alignSelf: 'stretch' }} />

                {/* Ataque / Forma / Objeto / Huir */}
                <div style={{ flex: '1 1 38%', minWidth: 0, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: 5 }}>
                  <ActionBtn onClick={() => pedirObjetivo({ kind: 'basico' })} disabled={!isPlayerTurn}
                    bg={targeting?.kind === 'basico' ? 'rgba(230,179,37,0.18)' : 'rgba(255,140,0,0.07)'}
                    border={targeting?.kind === 'basico' ? '#E6B325' : 'rgba(255,140,0,0.22)'}
                    hoverBg="rgba(255,140,0,0.18)" hoverBorder="rgba(255,140,0,0.5)">
                    {player.arma_equipada?.imagen ? (
                      <div style={{ width: 26, height: 26, borderRadius: 5, overflow: 'hidden', flexShrink: 0 }}>
                        <img src={mediaUrl(player.arma_equipada.imagen)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ) : player.arma_equipada?.es_sable ? (
                      <Icon name="sword" size={18} style={{ color: armaSable }} />
                    ) : (
                      <span style={{ fontSize: 16, lineHeight: 1 }}>✊</span>
                    )}
                    <span style={{
                      fontSize: 7, fontFamily: 'var(--font-data)', letterSpacing: '0.04em', whiteSpace: 'nowrap',
                      maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', color: armaSable,
                    }}>{player.arma_equipada ? player.arma_equipada.nombre.toUpperCase() : 'DESARMADO'}</span>
                    <span style={{ fontSize: 7, color: '#ff7043', fontFamily: 'var(--font-data)' }}>
                      DMG {player.arma_equipada?.dano ?? 3}
                      {!!player.arma_equipada?.dano_perforante && <span style={{ color: '#8aa0c0' }}> +{player.arma_equipada.dano_perforante}P</span>}
                    </span>
                  </ActionBtn>

                  <ActionBtn onClick={() => { void playClickOpcion(); setTargeting(null); setObjetoPicker(false); setStancePicker(v => !v); }} disabled={!isPlayerTurn}
                    bg="rgba(139,92,246,0.07)" border="rgba(139,92,246,0.22)" hoverBg="rgba(139,92,246,0.18)" hoverBorder="rgba(139,92,246,0.5)">
                    {NX.CLASSES[currentForma - 1]?.img ? (
                      <div style={{ width: 22, height: 22, borderRadius: 5, overflow: 'hidden', flexShrink: 0 }}>
                        <img src={NX.CLASSES[currentForma - 1].img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ) : <span style={{ fontSize: 14, lineHeight: 1 }}>🔄</span>}
                    <span style={{ fontSize: 7, color: '#a78bfa', fontFamily: 'var(--font-data)', whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{FORMA_LABELS_SHORT[currentForma - 1]}</span>
                    <span style={{ fontSize: 7, color: '#a78bfa', fontFamily: 'var(--font-data)' }}>ESTANCIA</span>
                  </ActionBtn>

                  <ActionBtn onClick={() => { void playClickOpcion(); setTargeting(null); setStancePicker(false); setObjetoPicker(v => !v); }}
                    disabled={!isPlayerTurn || objetosUtilizables.length === 0}
                    bg="rgba(16,185,129,0.07)" border="rgba(16,185,129,0.22)" hoverBg="rgba(16,185,129,0.18)" hoverBorder="rgba(16,185,129,0.5)">
                    <span style={{ fontSize: 16, lineHeight: 1 }}>🧪</span>
                    <span style={{ fontSize: 7, color: '#10b981', fontFamily: 'var(--font-data)' }}>OBJETO</span>
                    <span style={{ fontSize: 7, color: 'rgba(150,200,255,0.5)', fontFamily: 'var(--font-data)' }}>{objetosUtilizables.length} disp.</span>
                  </ActionBtn>

                  <ActionBtn onClick={() => { void playClickOpcion(); setTargeting(null); void doPlayerFlee(); }} disabled={!isPlayerTurn}
                    bg="rgba(255,45,69,0.07)" border="rgba(255,45,69,0.22)" hoverBg="rgba(255,45,69,0.18)" hoverBorder="rgba(255,45,69,0.5)">
                    <span style={{ fontSize: 16, lineHeight: 1 }}>🏃</span>
                    <span style={{ fontSize: 7, color: '#ff6b6b', fontFamily: 'var(--font-data)' }}>HUIR</span>
                  </ActionBtn>
                </div>
              </div>
            </div>
          )}

          {/* ── Pantalla de fin ── */}
          {phase !== 'battle' && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(2,5,12,0.9)', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 10, zIndex: 40,
            }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: phase === 'victory' ? '#10b981' : phase === 'fled' ? '#E6B325' : '#ff6b6b' }}>
                {phase === 'victory' ? '⚡ ¡Horda derrotada!' : phase === 'fled' ? '🏃 Huiste del combate' : '☠ Has sido derrotado'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--txt-faint)', fontFamily: 'var(--font-data)', letterSpacing: '0.1em' }}>
                {ronda} ronda{ronda === 1 ? '' : 's'} · {enemigosState.length - enPie}/{enemigosState.length} enemigos abatidos
              </div>
            </div>
          )}
        </div>

        {diceOverlay}
        {strike && (strike.type === 'melee'
          ? <EnergyStrikeEffect {...strike} onDone={() => { strike.onResolve(); setStrike(null); }} />
          : <RangedStrikeEffect {...strike} onDone={() => { strike.onResolve(); setStrike(null); }} />
        )}
        {statusFx && <StatusBurstEffect variant={statusFx.variant} stageRef={stageRef} targetRef={statusFx.targetRef} onDone={() => { statusFx.onResolve(); setStatusFx(null); }} />}
        {floatTexts.map(ft => (
          <FloatingCombatText key={ft.id} x={ft.x} y={ft.y} text={ft.text} variant={ft.variant} onDone={() => setFloatTexts(prev => prev.filter(f => f.id !== ft.id))} />
        ))}
      </div>

      {/* ── Selector de forma ── */}
      {stancePicker && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 960, background: 'rgba(2,5,12,0.85)', display: 'grid', placeItems: 'center' }}
          onMouseDown={() => setStancePicker(false)}>
          <div className="nx-panel solid nx-panel-glow" style={{ padding: 18, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }} onMouseDown={e => e.stopPropagation()}>
            {NX.CLASSES.map((c, i) => (
              <button key={c.id} onClick={() => doChangeForma(i + 1)} title={FORMA_LABELS_SHORT[i]} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 10, borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${currentForma === i + 1 ? c.accent : 'var(--holo-line)'}`,
                background: currentForma === i + 1 ? `color-mix(in srgb, ${c.accent} 14%, transparent)` : 'rgba(255,255,255,0.02)',
              }}>
                <img src={c.img} alt="" style={{ width: 34, height: 34, objectFit: 'contain' }} />
                <span style={{ fontSize: 9, color: c.accent, fontFamily: 'var(--font-data)' }}>{c.num}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Selector de objeto utilizable ── */}
      {objetoPicker && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 960, background: 'rgba(2,5,12,0.85)', display: 'grid', placeItems: 'center', padding: 16 }}
          onMouseDown={() => setObjetoPicker(false)}>
          <div className="nx-panel solid nx-panel-glow" style={{ width: '100%', maxWidth: 380, padding: 18 }} onMouseDown={e => e.stopPropagation()}>
            <div className="nx-kicker" style={{ marginBottom: 10 }}>OBJETOS UTILIZABLES</div>
            <div style={{ display: 'grid', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
              {objetosUtilizables.length === 0 ? (
                <span style={{ fontSize: 11, color: 'var(--txt-faint)' }}>Sin objetos utilizables</span>
              ) : objetosUtilizables.map(o => (
                <button key={o.id} disabled={usingObjeto} onClick={() => pedirObjetivo({ kind: 'objeto', objeto: o })} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, textAlign: 'left',
                  padding: '8px 10px', borderRadius: 7, cursor: usingObjeto ? 'not-allowed' : 'pointer',
                  background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.35)', opacity: usingObjeto ? 0.5 : 1,
                }}>
                  <span style={{ fontSize: 11, color: '#10b981', fontFamily: 'var(--font-data)' }}>{o.nombre}</span>
                  <span style={{ fontSize: 10, color: 'var(--txt-faint)', fontFamily: 'var(--font-data)' }}>×{o.cantidad}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
